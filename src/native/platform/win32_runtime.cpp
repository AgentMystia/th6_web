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

// Directory enumeration (MainMenu replay listing) via POSIX opendir on MEMFS.
#include <dirent.h>
#include <fnmatch.h>
#include <sys/stat.h>
struct FindCtx { DIR *d; char pattern[MAX_PATH]; char dir[MAX_PATH]; };
extern "C" HANDLE FindFirstFileA(LPCSTR lpFileName, LPWIN32_FIND_DATAA lpFindData)
{
    if (!lpFileName || !lpFindData) return INVALID_HANDLE_VALUE;
    memset(lpFindData, 0, sizeof(*lpFindData));
    char dirBuf[MAX_PATH];
    strncpy(dirBuf, lpFileName, MAX_PATH - 1);
    dirBuf[MAX_PATH - 1] = 0;
    char *sep = strrchr(dirBuf, '/');
    char patBuf[MAX_PATH];
    if (sep) { strncpy(patBuf, sep + 1, MAX_PATH - 1); *sep = 0; }
    else { strncpy(patBuf, dirBuf, MAX_PATH - 1); strcpy(dirBuf, "."); }
    DIR *d = opendir(dirBuf);
    if (!d) return INVALID_HANDLE_VALUE;
    auto *ctx = new FindCtx();
    ctx->d = d;
    strncpy(ctx->pattern, patBuf, MAX_PATH - 1);
    strncpy(ctx->dir, dirBuf, MAX_PATH - 1);
    if (FindNextFileA((HANDLE)ctx, lpFindData)) return (HANDLE)ctx;
    closedir(d); delete ctx;
    return INVALID_HANDLE_VALUE;
}
extern "C" BOOL FindNextFileA(HANDLE hFind, LPWIN32_FIND_DATAA lpFindData)
{
    if (hFind == INVALID_HANDLE_VALUE || !lpFindData) return FALSE;
    auto *ctx = (FindCtx *)hFind;
    struct dirent *ent;
    while ((ent = readdir(ctx->d)) != nullptr)
    {
        if (fnmatch(ctx->pattern, ent->d_name, 0) == 0)
        {
            memset(lpFindData, 0, sizeof(*lpFindData));
            strncpy(lpFindData->cFileName, ent->d_name, MAX_PATH - 1);
            return TRUE;
        }
    }
    return FALSE;
}
extern "C" BOOL FindClose(HANDLE hFind)
{
    if (hFind != INVALID_HANDLE_VALUE) { auto *ctx = (FindCtx *)hFind; closedir(ctx->d); delete ctx; }
    return TRUE;
}

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

// GDI font/text — minimal implementation using Emscripten OffscreenCanvas for
// TextOutA. The engine's TextHelper renders spellcard names / dialogue into a
// DIB bitmap, then blits it onto a D3D texture. We allocate real pixel memory
// and draw text via a JS OffscreenCanvas so the characters appear.

#include <emscripten.h>

struct GdiBitmap { uint32_t magic; uint8_t *bits; int w, h, bpp; };
struct GdiFont { uint32_t magic; int height; };
#define GDI_BITMAP_MAGIC 0x424D5047
#define GDI_FONT_MAGIC   0x464E5447
struct GdiDC {
    GdiBitmap *bmp;
    DWORD textColor;
    int fontH;
};

extern "C" HFONT CreateFontA(int height, int, int, int, int, DWORD, DWORD, DWORD, DWORD, DWORD, DWORD, DWORD, DWORD, LPCSTR)
{
    int h = height > 0 ? height : -height;
    if (h == 0) h = 16;
    auto *f = new GdiFont();
    f->magic = GDI_FONT_MAGIC;
    f->height = h;
    return (HFONT)f;
}
extern "C" HFONT CreateFontIndirectA(const LOGFONTA *lf)
{
    int h = lf ? (lf->lfHeight > 0 ? lf->lfHeight : -lf->lfHeight) : 16;
    auto *f = new GdiFont();
    f->magic = GDI_FONT_MAGIC;
    f->height = h;
    return (HFONT)f;
}
extern "C" HGDIOBJ SelectObject(HDC hdc, HGDIOBJ obj)
{
    GdiDC *dc = (GdiDC *)hdc;
    if (!dc || !obj) return (HGDIOBJ)1;
    uint32_t magic = *(uint32_t *)obj;
    if (magic == GDI_FONT_MAGIC) { dc->fontH = ((GdiFont *)obj)->height; }
    else if (magic == GDI_BITMAP_MAGIC) { dc->bmp = (GdiBitmap *)obj; }
    return (HGDIOBJ)1;
}
extern "C" BOOL DeleteObject(HGDIOBJ obj)
{
    if (!obj) return TRUE;
    uint32_t magic = *(uint32_t *)obj;
    if (magic == GDI_BITMAP_MAGIC) { auto *b = (GdiBitmap *)obj; free(b->bits); delete b; }
    else if (magic == GDI_FONT_MAGIC) { delete (GdiFont *)obj; }
    return TRUE;
}
extern "C" HDC CreateCompatibleDC(HDC)
{
    GdiDC *dc = new GdiDC();
    dc->bmp = nullptr;
    dc->textColor = 0xFFFFFF;
    dc->fontH = 16;
    return (HDC)dc;
}
extern "C" BOOL DeleteDC(HDC hdc)
{
    if (hdc) delete (GdiDC *)hdc;
    return TRUE;
}
extern "C" HBITMAP CreateDIBSection(HDC, const BITMAPINFO *bi, UINT, void **bits, HANDLE, DWORD)
{
    if (!bi) { if (bits) *bits = nullptr; return nullptr; }
    int w = bi->bmiHeader.biWidth;
    int h = bi->bmiHeader.biHeight < 0 ? -bi->bmiHeader.biHeight : bi->bmiHeader.biHeight;
    int bpp = bi->bmiHeader.biBitCount / 8;
    if (bpp < 2) bpp = 2;
    GdiBitmap *bmp = new GdiBitmap();
    bmp->magic = GDI_BITMAP_MAGIC;
    bmp->w = w; bmp->h = h; bmp->bpp = bpp;
    bmp->bits = (uint8_t *)calloc(1, (size_t)w * h * bpp);
    if (bits) *bits = bmp->bits;
    return (HBITMAP)bmp;
}
extern "C" int SetBkMode(HDC, int) { return 0; }
extern "C" DWORD SetTextColor(HDC hdc, DWORD color)
{
    GdiDC *dc = (GdiDC *)hdc;
    if (dc) dc->textColor = color;
    return 0;
}
extern "C" DWORD SetBkColor(HDC, DWORD) { return 0; }

EM_JS(void, gdiTextOut, (int bufPtr, int bufW, int bufH, int bpp, int x, int y, int strPtr, int len, int fontH, unsigned int color), {
    // TH06 text is Shift-JIS encoded — read raw bytes and decode manually
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = Module.HEAPU8[strPtr + i];
    var text;
    try { text = new TextDecoder('shift-jis').decode(bytes); }
    catch(e) { text = String.fromCharCode.apply(null, bytes); }
    if (!text || !bufW || !bufH) return;
    var cvs = new OffscreenCanvas(bufW, bufH);
    var ctx = cvs.getContext('2d');
    var r = (color & 0xFF), g = ((color >> 8) & 0xFF), b = ((color >> 16) & 0xFF);
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.font = 'bold ' + fontH + 'px TH06Font, "MS Gothic", "Yu Gothic", "Noto Sans JP", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    var imgData = ctx.getImageData(0, 0, bufW, bufH).data;
    // Write pixels into the native-format DIB buffer.  Windows GDI TextOutA
    // writes RGB with alpha=0 on A1R5G5B5 DIBs (the high bit is cleared).
    // TextHelper::InvertAlpha relies on this: text pixels (alpha=0) get flipped
    // to alpha=1 (visible), background pixels (alpha=1) get flipped to alpha=0.
    if (bpp === 4) {
        for (var i = 0; i < bufW * bufH; i++) {
            var a = imgData[i * 4 + 3];
            if (a === 0) continue;
            var sr = imgData[i*4], sg = imgData[i*4+1], sb = imgData[i*4+2];
            Module.HEAPU8[bufPtr + i*4 + 0] = sb;
            Module.HEAPU8[bufPtr + i*4 + 1] = sg;
            Module.HEAPU8[bufPtr + i*4 + 2] = sr;
            Module.HEAPU8[bufPtr + i*4 + 3] = 0;
        }
    } else if (bpp === 2) {
        for (var i = 0; i < bufW * bufH; i++) {
            var a = imgData[i * 4 + 3];
            if (a === 0) continue;
            var sr = imgData[i*4] >> 3, sg = imgData[i*4+1] >> 3, sb = imgData[i*4+2] >> 3;
            var px = (sr << 10) | (sg << 5) | sb;
            Module.HEAPU8[bufPtr + i*2] = px & 0xFF;
            Module.HEAPU8[bufPtr + i*2 + 1] = (px >> 8) & 0xFF;
        }
    }
});

extern "C" BOOL TextOutA(HDC hdc, int x, int y, LPCSTR str, int len)
{
    GdiDC *dc = (GdiDC *)hdc;
    if (!dc || !dc->bmp || !dc->bmp->bits || !str || len <= 0) return TRUE;
    gdiTextOut((int)(intptr_t)dc->bmp->bits, dc->bmp->w, dc->bmp->h, dc->bmp->bpp,
               x, y, (int)(intptr_t)str, len, dc->fontH, dc->textColor);
    return TRUE;
}
extern "C" int GetObjectA(HANDLE h, int sz, void *buf) { if (buf) memset(buf, 0, sz); return sz; }

extern "C" UINT_PTR SetTimer(HWND, UINT_PTR, UINT, void *) { return 1; }
extern "C" BOOL KillTimer(HWND, UINT_PTR) { return TRUE; }

// Joystick — none on the web for now (Gamepad API wiring is a later task).
extern "C" MMRESULT joyGetDevCapsA(UINT, LPJOYCAPSA, UINT) { return MMSYSERR_BADDEVICEID; }
extern "C" MMRESULT joyGetPosEx(UINT, LPJOYINFOEX) { return JOYERR_PARMS; }

// DX error strings (logging only).
extern "C" const char *DXGetErrorString8A(HRESULT) { return "D3DERR"; }
extern "C" const char *DXGetErrorDescription8A(HRESULT) { return "Direct3D error"; }
