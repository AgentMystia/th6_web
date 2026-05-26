// Win32 / CRT / multimedia-timer backend for the TH06 WASM/native port.
//
// Implements the small surface of <windows.h> / <mmsystem.h> the engine calls,
// backed by libc + a portable clock. File I/O maps to stdio (MEMFS under
// Emscripten). Window/cursor/screensaver/thread APIs are no-ops on the web.
// Keyboard state is a shared 256-entry table filled by the input backend.
#include <chrono>
#include <cstdio>
#include <cstring>
#include <ctime>
#include <cstdlib>
#include <sys/stat.h>
#include <unistd.h>

#include <windows.h> // our shim (pulls in mmsystem.h)

// <direct.h> CRT directory helpers (config/score/replay paths in MEMFS/IDBFS).
extern "C" int _mkdir(const char *path) { return mkdir(path, 0777); }
extern "C" int _chdir(const char *path) { return chdir(path); }
extern "C" char *_getcwd(char *buf, int maxlen) { return getcwd(buf, (size_t)maxlen); }

// GUID_NULL is declared (extern) by <windows.h>, so defining it here gives it
// external linkage. The DirectInput/DirectSound GUIDs live in dx_stub.cpp where
// their <dinput.h>/<dsound.h> extern declarations are in scope.
const GUID GUID_NULL = {0, 0, 0, {0, 0, 0, 0, 0, 0, 0, 0}};

// ---------------------------------------------------------------------------
// Shared input state (256 DirectInput scancodes). Filled by the input backend
// (browser key events) / read by Controller via GetKeyboardState/DInput.
// ---------------------------------------------------------------------------
extern "C" unsigned char g_Th06KeyState[256] = {0};
// Exposed to the JS glue so browser key events can write DIK-indexed state.
extern "C" unsigned char *th06_key_state_ptr(void) { return g_Th06KeyState; }

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
static std::chrono::steady_clock::time_point g_clockStart = std::chrono::steady_clock::now();

extern "C" DWORD timeGetTime(void)
{
    auto now = std::chrono::steady_clock::now();
    return (DWORD)std::chrono::duration_cast<std::chrono::milliseconds>(now - g_clockStart).count();
}
extern "C" MMRESULT timeBeginPeriod(UINT) { return TIMERR_NOERROR; }
extern "C" MMRESULT timeEndPeriod(UINT) { return TIMERR_NOERROR; }
extern "C" MMRESULT timeGetDevCaps(LPTIMECAPS ptc, UINT)
{
    if (ptc) { ptc->wPeriodMin = 1; ptc->wPeriodMax = 1000000; }
    return TIMERR_NOERROR;
}
// BGM uses external Ogg, so the MIDI multimedia timer is never armed.
extern "C" MMRESULT timeSetEvent(UINT, UINT, LPTIMECALLBACK, DWORD_PTR, UINT) { return 0; }
extern "C" MMRESULT timeKillEvent(UINT) { return TIMERR_NOERROR; }

extern "C" void Sleep(DWORD) {} // cooperative single loop on the web; never block

// ---------------------------------------------------------------------------
// CRT date/time strings (ReplayManager)
// ---------------------------------------------------------------------------
extern "C" void _strdate(char *buf)
{
    time_t t = time(nullptr);
    struct tm tmv;
    localtime_r(&t, &tmv);
    strftime(buf, 9, "%m/%d/%y", &tmv);
}
extern "C" void _strtime(char *buf)
{
    time_t t = time(nullptr);
    struct tm tmv;
    localtime_r(&t, &tmv);
    strftime(buf, 9, "%H:%M:%S", &tmv);
}

// ---------------------------------------------------------------------------
// File I/O — HANDLE is a FILE*. Paths resolve in the (MEMFS) working directory.
// ---------------------------------------------------------------------------
extern "C" DWORD g_LastErrorValue = 0;
extern "C" DWORD GetLastError(void) { return g_LastErrorValue; }
extern "C" void SetLastError(DWORD e) { g_LastErrorValue = e; }

extern "C" HANDLE CreateFileA(LPCSTR fileName, DWORD desiredAccess, DWORD, void *, DWORD creationDisposition, DWORD,
                              HANDLE)
{
    const char *mode;
    if (creationDisposition == CREATE_ALWAYS || creationDisposition == CREATE_NEW)
        mode = "wb";
    else if (desiredAccess & GENERIC_WRITE)
        mode = "rb+";
    else
        mode = "rb";
    FILE *f = fopen(fileName, mode);
    if (!f && (desiredAccess & GENERIC_WRITE))
        f = fopen(fileName, "wb");
    if (!f) { g_LastErrorValue = ERROR_FILE_NOT_FOUND; return INVALID_HANDLE_VALUE; }
    return (HANDLE)f;
}
extern "C" BOOL ReadFile(HANDLE h, LPVOID buf, DWORD toRead, LPDWORD read, void *)
{
    if (h == INVALID_HANDLE_VALUE) return FALSE;
    size_t n = fread(buf, 1, toRead, (FILE *)h);
    if (read) *read = (DWORD)n;
    return TRUE;
}
extern "C" BOOL WriteFile(HANDLE h, LPCVOID buf, DWORD toWrite, LPDWORD written, void *)
{
    if (h == INVALID_HANDLE_VALUE) return FALSE;
    size_t n = fwrite(buf, 1, toWrite, (FILE *)h);
    if (written) *written = (DWORD)n;
    return TRUE;
}
extern "C" DWORD SetFilePointer(HANDLE h, LONG dist, LONG *distHigh, DWORD method)
{
    if (h == INVALID_HANDLE_VALUE) return INVALID_SET_FILE_POINTER;
    int origin = method == FILE_BEGIN ? SEEK_SET : method == FILE_END ? SEEK_END : SEEK_CUR;
    fseek((FILE *)h, dist, origin);
    if (distHigh) *distHigh = 0;
    return (DWORD)ftell((FILE *)h);
}
extern "C" DWORD GetFileSize(HANDLE h, LPDWORD sizeHigh)
{
    if (h == INVALID_HANDLE_VALUE) return INVALID_FILE_SIZE;
    long cur = ftell((FILE *)h);
    fseek((FILE *)h, 0, SEEK_END);
    long end = ftell((FILE *)h);
    fseek((FILE *)h, cur, SEEK_SET);
    if (sizeHigh) *sizeHigh = 0;
    return (DWORD)end;
}
extern "C" BOOL GetFileTime(HANDLE, LPFILETIME c, LPFILETIME a, LPFILETIME w)
{
    if (c) *c = FILETIME{0, 0};
    if (a) *a = FILETIME{0, 0};
    if (w) *w = FILETIME{0, 0};
    return TRUE;
}
extern "C" BOOL CloseHandle(HANDLE h)
{
    if (h && h != INVALID_HANDLE_VALUE) fclose((FILE *)h);
    return TRUE;
}
extern "C" BOOL DeleteFileA(LPCSTR p) { return remove(p) == 0; }

extern "C" HLOCAL LocalAlloc(UINT flags, SIZE_T bytes)
{
    void *p = malloc(bytes);
    if (p && (flags & LMEM_ZEROINIT)) memset(p, 0, bytes);
    return p;
}
extern "C" HLOCAL LocalFree(HLOCAL m) { free(m); return nullptr; }

// Directory enumeration (MainMenu replay listing) — empty for now.
extern "C" HANDLE FindFirstFileA(LPCSTR, LPWIN32_FIND_DATAA) { return INVALID_HANDLE_VALUE; }
extern "C" BOOL FindNextFileA(HANDLE, LPWIN32_FIND_DATAA) { return FALSE; }
extern "C" BOOL FindClose(HANDLE) { return TRUE; }

// ---------------------------------------------------------------------------
// Window / cursor / system — no-ops on the web (the canvas is the window).
// ---------------------------------------------------------------------------
extern "C" HANDLE CreateMutexA(void *, BOOL, LPCSTR) { return (HANDLE)1; }
extern "C" HWND CreateWindowExA(DWORD, LPCSTR, LPCSTR, DWORD, int, int, int, int, HWND, HMENU, HINSTANCE, LPVOID)
{
    return (HWND)1;
}
extern "C" ATOM RegisterClassA(const WNDCLASSA *) { return 1; }
extern "C" LRESULT DefWindowProcA(HWND, UINT, WPARAM, LPARAM) { return 0; }
extern "C" BOOL DestroyWindow(HWND) { return TRUE; }
extern "C" BOOL ShowWindow(HWND, int) { return TRUE; }
extern "C" BOOL UpdateWindow(HWND) { return TRUE; }
extern "C" int ShowCursor(BOOL) { return 0; }
extern "C" HCURSOR SetCursor(HCURSOR) { return nullptr; }
extern "C" HCURSOR LoadCursorA(HINSTANCE, LPCSTR) { return nullptr; }
extern "C" HGDIOBJ GetStockObject(int) { return nullptr; }
extern "C" LONG SetWindowLongA(HWND, int, LONG) { return 0; }
extern "C" LONG GetWindowLongA(HWND, int) { return 0; }
extern "C" BOOL GetClientRect(HWND, LPRECT r)
{
    if (r) { r->left = r->top = 0; r->right = 640; r->bottom = 480; } // TH06 fixed 640x480
    return TRUE;
}
extern "C" BOOL PeekMessageA(LPMSG, HWND, UINT, UINT, UINT) { return FALSE; }
extern "C" BOOL GetMessageA(LPMSG, HWND, UINT, UINT) { return FALSE; }
extern "C" BOOL TranslateMessage(const MSG *) { return TRUE; }
extern "C" LRESULT DispatchMessageA(const MSG *) { return 0; }
extern "C" void PostQuitMessage(int) {}
extern "C" int MessageBoxA(HWND, LPCSTR text, LPCSTR cap, UINT)
{
    fprintf(stderr, "[MessageBox] %s: %s\n", cap ? cap : "", text ? text : "");
    return 1;
}
extern "C" BOOL SystemParametersInfoA(UINT, UINT, void *ptr, UINT)
{
    if (ptr) *(int *)ptr = 0;
    return TRUE;
}
extern "C" int GetSystemMetrics(int) { return 0; }
extern "C" void OutputDebugStringA(LPCSTR s) { if (s) fputs(s, stderr); }

extern "C" SHORT GetAsyncKeyState(int) { return 0; }
extern "C" BOOL GetKeyboardState(LPBYTE st) { if (st) memset(st, 0, 256); return TRUE; }
extern "C" BOOL SetKeyboardState(LPBYTE) { return TRUE; }

// Threads / events / sync — SoundPlayer's streaming thread is unused (Ogg BGM
// is driven from JS); provide inert handles so init paths succeed.
extern "C" HANDLE CreateEventA(void *, BOOL, BOOL, LPCSTR) { return (HANDLE)1; }
extern "C" BOOL SetEvent(HANDLE) { return TRUE; }
extern "C" BOOL ResetEvent(HANDLE) { return TRUE; }
extern "C" DWORD WaitForSingleObject(HANDLE, DWORD) { return WAIT_OBJECT_0; }
extern "C" DWORD MsgWaitForMultipleObjects(DWORD, const HANDLE *, BOOL, DWORD, DWORD) { return WAIT_OBJECT_0; }
extern "C" HANDLE CreateThread(void *, SIZE_T, LPTHREAD_START_ROUTINE, LPVOID, DWORD, LPDWORD id)
{
    if (id) *id = 1;
    return (HANDLE)1;
}
extern "C" void ExitThread(DWORD) {}
extern "C" BOOL TerminateThread(HANDLE, DWORD) { return TRUE; }
extern "C" BOOL SetThreadPriority(HANDLE, int) { return TRUE; }
extern "C" BOOL PostThreadMessageA(DWORD, UINT, WPARAM, LPARAM) { return TRUE; }
extern "C" DWORD GetCurrentThreadId(void) { return 1; }

// GDI font/text — stubbed (text rendering handled later via atlas/canvas).
extern "C" HFONT CreateFontA(int, int, int, int, int, DWORD, DWORD, DWORD, DWORD, DWORD, DWORD, DWORD, DWORD, LPCSTR)
{
    return nullptr;
}
extern "C" HFONT CreateFontIndirectA(const LOGFONTA *) { return nullptr; }
extern "C" HGDIOBJ SelectObject(HDC, HGDIOBJ) { return nullptr; }
extern "C" BOOL DeleteObject(HGDIOBJ) { return TRUE; }
extern "C" HDC CreateCompatibleDC(HDC) { return nullptr; }
extern "C" BOOL DeleteDC(HDC) { return TRUE; }
extern "C" HBITMAP CreateDIBSection(HDC, const BITMAPINFO *, UINT, void **bits, HANDLE, DWORD)
{
    if (bits) *bits = nullptr;
    return nullptr;
}
extern "C" int SetBkMode(HDC, int) { return 0; }
extern "C" DWORD SetTextColor(HDC, DWORD) { return 0; }
extern "C" DWORD SetBkColor(HDC, DWORD) { return 0; }
extern "C" BOOL TextOutA(HDC, int, int, LPCSTR, int) { return TRUE; }

extern "C" UINT_PTR SetTimer(HWND, UINT_PTR, UINT, void *) { return 1; }
extern "C" BOOL KillTimer(HWND, UINT_PTR) { return TRUE; }

// Joystick — none on the web for now (Gamepad API wiring is a later task).
extern "C" MMRESULT joyGetDevCapsA(UINT, LPJOYCAPSA, UINT) { return MMSYSERR_BADDEVICEID; }
extern "C" MMRESULT joyGetPosEx(UINT, LPJOYINFOEX) { return JOYERR_PARMS; }

// DX error strings (logging only).
extern "C" const char *DXGetErrorString8A(HRESULT) { return "D3DERR"; }
extern "C" const char *DXGetErrorDescription8A(HRESULT) { return "Direct3D error"; }
