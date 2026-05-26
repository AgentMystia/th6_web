// Minimal <windows.h> shim for the TH06 WASM/native port.
//
// The decompiled engine targets Win32. On wasm32 / native Linux those headers
// do not exist, so this shim provides exactly the Win32 types, macros and
// constants the engine actually uses. Window/cursor/timing APIs are declared
// here and implemented as no-ops (or web-backed) in platform/win32_stub.cpp.
#pragma once

#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Calling conventions / annotations (meaningless off-Win32 → expand to nothing)
// ---------------------------------------------------------------------------
#ifndef __stdcall
#define __stdcall
#endif
#ifndef __cdecl
#define __cdecl
#endif
#ifndef __fastcall
#define __fastcall
#endif
#define WINAPI
#define APIENTRY
#define CALLBACK
#define WINAPIV
#define FAR
#define NEAR
#define PASCAL
#define CONST const
#ifndef IN
#define IN
#endif
#ifndef OUT
#define OUT
#endif
#define OPTIONAL
#define __declspec(x)

// MSVC sized-integer keywords.
#define __int64 long long
#define __int32 int
#define __int16 short
#define __int8 char

// ---------------------------------------------------------------------------
// Base integer types
// ---------------------------------------------------------------------------
typedef int BOOL;
typedef unsigned char BYTE;
typedef unsigned char byte; // RPC/Win32 lowercase byte type
typedef unsigned short WORD;
typedef unsigned long DWORD;
typedef unsigned int UINT;
typedef int INT;
typedef long LONG;
typedef unsigned long ULONG;
typedef short SHORT;
typedef unsigned short USHORT;
typedef char CHAR;
typedef unsigned char UCHAR;
typedef wchar_t WCHAR;
typedef float FLOAT;
typedef double DOUBLE;
typedef void VOID;
typedef long long LONGLONG;
typedef unsigned long long ULONGLONG;
typedef int64_t INT64;
typedef uint64_t UINT64;

typedef intptr_t INT_PTR;
typedef uintptr_t UINT_PTR;
typedef intptr_t LONG_PTR;
typedef uintptr_t ULONG_PTR;
typedef ULONG_PTR DWORD_PTR;
typedef size_t SIZE_T;
typedef intptr_t SSIZE_T;

typedef DWORD COLORREF;
typedef WORD ATOM;

// Pointers
typedef void *PVOID;
typedef void *LPVOID;
typedef const void *LPCVOID;
typedef char *PSTR;
typedef char *LPSTR;
typedef const char *PCSTR;
typedef const char *LPCSTR;
typedef WCHAR *LPWSTR;
typedef const WCHAR *LPCWSTR;
typedef CHAR TCHAR;
typedef LPSTR LPTSTR;
typedef LPCSTR LPCTSTR;
typedef BYTE *LPBYTE;
typedef WORD *LPWORD;
typedef DWORD *LPDWORD;
typedef LONG *LPLONG;
typedef int *LPINT;
typedef BOOL *LPBOOL;
typedef UINT *LPUINT;

// Window message params
typedef UINT_PTR WPARAM;
typedef LONG_PTR LPARAM;
typedef LONG_PTR LRESULT;

// ---------------------------------------------------------------------------
// Handles (opaque)
// ---------------------------------------------------------------------------
#define DECLARE_HANDLE(name)                                                                                           \
    struct name##__;                                                                                                   \
    typedef struct name##__ *name
typedef void *HANDLE;
DECLARE_HANDLE(HWND);
DECLARE_HANDLE(HINSTANCE);
typedef HINSTANCE HMODULE;
DECLARE_HANDLE(HDC);
// GDI objects are loosely typed (all void*) so e.g. SelectObject(HDC, HFONT) compiles.
typedef void *HGDIOBJ;
typedef void *HFONT;
typedef void *HBITMAP;
typedef void *HICON;
typedef void *HCURSOR;
typedef void *HBRUSH;
typedef void *HRGN;
typedef void *HPEN;
typedef void *HPALETTE;
DECLARE_HANDLE(HMENU);
DECLARE_HANDLE(HKEY);
typedef void *HGLOBAL;
typedef void *HLOCAL;

// ---------------------------------------------------------------------------
// Common constants / macros
// ---------------------------------------------------------------------------
#ifndef NULL
#define NULL 0
#endif
#ifndef TRUE
#define TRUE 1
#endif
#ifndef FALSE
#define FALSE 0
#endif
#define MAX_PATH 260
#define INVALID_HANDLE_VALUE ((HANDLE)(LONG_PTR)-1)

// ANSI text macros (the engine builds ANSI, so these are identity).
#define TEXT(s) s
#define _T(s) s
#define __TEXT(s) s

// Common Win32 error codes referenced by the engine.
#define ERROR_SUCCESS 0L
#define ERROR_FILE_NOT_FOUND 2L
#define ERROR_ALREADY_EXISTS 183L

// File I/O (FileAbstraction / pbg3 archive reader). Backend = MEMFS via stdio.
#define GENERIC_READ 0x80000000UL
#define GENERIC_WRITE 0x40000000UL
#define CREATE_NEW 1
#define CREATE_ALWAYS 2
#define OPEN_EXISTING 3
#define OPEN_ALWAYS 4
#define FILE_SHARE_READ 0x00000001
#define FILE_SHARE_WRITE 0x00000002
#define FILE_ATTRIBUTE_NORMAL 0x00000080
#define FILE_FLAG_SEQUENTIAL_SCAN 0x08000000
#define FILE_BEGIN 0
#define FILE_CURRENT 1
#define FILE_END 2
#define INVALID_FILE_SIZE 0xFFFFFFFF
#define INVALID_SET_FILE_POINTER ((DWORD)-1)

// Local heap allocation flags.
#define LMEM_FIXED 0x0000
#define LMEM_ZEROINIT 0x0040
#define LPTR (LMEM_FIXED | LMEM_ZEROINIT)
#define LHND (0x0002 | LMEM_ZEROINIT)

#define INFINITE 0xFFFFFFFF
#define CW_USEDEFAULT ((int)0x80000000)
#define WAIT_OBJECT_0 0x00000000L
#define WAIT_TIMEOUT 0x00000102L
#define WAIT_FAILED 0xFFFFFFFF

// Queue-status flags for MsgWaitForMultipleObjects.
#define QS_KEY 0x0001
#define QS_MOUSE 0x0006
#define QS_POSTMESSAGE 0x0008
#define QS_TIMER 0x0010
#define QS_PAINT 0x0020
#define QS_SENDMESSAGE 0x0040
#define QS_ALLEVENTS 0x04BF
#define QS_ALLINPUT 0x04FF

// GDI background modes
#define TRANSPARENT 1
#define OPAQUE 2

// GetSystemMetrics indices used by GameWindow.
#define SM_CXSCREEN 0
#define SM_CYSCREEN 1
#define SM_CYCAPTION 4
#define SM_CXBORDER 5
#define SM_CYBORDER 6
#define SM_CXFIXEDFRAME 7
#define SM_CYFIXEDFRAME 8
#define SM_CXDLGFRAME SM_CXFIXEDFRAME
#define SM_CYDLGFRAME SM_CYFIXEDFRAME

#define LOWORD(l) ((WORD)(((DWORD_PTR)(l)) & 0xffff))
#define HIWORD(l) ((WORD)((((DWORD_PTR)(l)) >> 16) & 0xffff))
#define LOBYTE(w) ((BYTE)(((DWORD_PTR)(w)) & 0xff))
#define HIBYTE(w) ((BYTE)((((DWORD_PTR)(w)) >> 8) & 0xff))
#define MAKELONG(a, b) ((LONG)(((WORD)(a)) | (((DWORD)((WORD)(b))) << 16)))
#define MAKEWORD(a, b) ((WORD)(((BYTE)(a)) | (((WORD)((BYTE)(b))) << 8)))
#define RGB(r, g, b) ((COLORREF)((BYTE)(r) | ((BYTE)(g) << 8) | ((BYTE)(b) << 16)))

#define ZeroMemory(dst, len) memset((dst), 0, (len))
#define CopyMemory(dst, src, len) memcpy((dst), (src), (len))
#define MoveMemory(dst, src, len) memmove((dst), (src), (len))
#define FillMemory(dst, len, val) memset((dst), (val), (len))

// static_assert-based C_ASSERT (the engine only uses C_ASSERT(true) off-match).
#define C_ASSERT(e) static_assert((e), #e)

// ---------------------------------------------------------------------------
// HRESULT / COM result codes
// ---------------------------------------------------------------------------
typedef long HRESULT;
#define S_OK ((HRESULT)0L)
#define S_FALSE ((HRESULT)1L)
#define E_FAIL ((HRESULT)0x80004005L)
#define E_NOINTERFACE ((HRESULT)0x80004002L)
#define E_OUTOFMEMORY ((HRESULT)0x8007000EL)
#define E_INVALIDARG ((HRESULT)0x80070057L)
#define CO_E_NOTINITIALIZED ((HRESULT)0x800401F0L)
#define E_UNEXPECTED ((HRESULT)0x8000FFFFL)
#define E_NOTIMPL ((HRESULT)0x80004001L)
#define SUCCEEDED(hr) (((HRESULT)(hr)) >= 0)
#define FAILED(hr) (((HRESULT)(hr)) < 0)

// ---------------------------------------------------------------------------
// GUID / COM IUnknown
// ---------------------------------------------------------------------------
typedef struct _GUID
{
    unsigned long Data1;
    unsigned short Data2;
    unsigned short Data3;
    unsigned char Data4[8];
} GUID;
typedef GUID IID;
typedef GUID CLSID;
typedef const GUID &REFGUID;
typedef const IID &REFIID;
typedef const CLSID &REFCLSID;
extern const GUID GUID_NULL;

struct IUnknown
{
    virtual HRESULT __stdcall QueryInterface(REFIID riid, void **ppvObject) = 0;
    virtual ULONG __stdcall AddRef() = 0;
    virtual ULONG __stdcall Release() = 0;
};

// ---------------------------------------------------------------------------
// Basic structs
// ---------------------------------------------------------------------------
typedef struct tagPOINT
{
    LONG x;
    LONG y;
} POINT, *LPPOINT;

typedef struct tagSIZE
{
    LONG cx;
    LONG cy;
} SIZE, *LPSIZE;

typedef struct tagRECT
{
    LONG left;
    LONG top;
    LONG right;
    LONG bottom;
} RECT, *LPRECT;

typedef struct _FILETIME
{
    DWORD dwLowDateTime;
    DWORD dwHighDateTime;
} FILETIME, *LPFILETIME, *PFILETIME;

typedef struct _WIN32_FIND_DATAA
{
    DWORD dwFileAttributes;
    FILETIME ftCreationTime, ftLastAccessTime, ftLastWriteTime;
    DWORD nFileSizeHigh, nFileSizeLow;
    DWORD dwReserved0, dwReserved1;
    CHAR cFileName[MAX_PATH];
    CHAR cAlternateFileName[14];
} WIN32_FIND_DATAA, *LPWIN32_FIND_DATAA;
typedef WIN32_FIND_DATAA WIN32_FIND_DATA;

typedef struct _SYSTEMTIME
{
    WORD wYear, wMonth, wDayOfWeek, wDay, wHour, wMinute, wSecond, wMilliseconds;
} SYSTEMTIME;

typedef union _LARGE_INTEGER {
    struct
    {
        DWORD LowPart;
        LONG HighPart;
    };
    LONGLONG QuadPart;
} LARGE_INTEGER;

typedef LRESULT(__stdcall *WNDPROC)(HWND, UINT, WPARAM, LPARAM);
typedef DWORD(__stdcall *LPTHREAD_START_ROUTINE)(LPVOID);

typedef struct tagMSG
{
    HWND hwnd;
    UINT message;
    WPARAM wParam;
    LPARAM lParam;
    DWORD time;
    POINT pt;
} MSG, *LPMSG;

typedef struct tagWNDCLASSA
{
    UINT style;
    WNDPROC lpfnWndProc;
    int cbClsExtra;
    int cbWndExtra;
    HINSTANCE hInstance;
    HICON hIcon;
    HCURSOR hCursor;
    HBRUSH hbrBackground;
    LPCSTR lpszMenuName;
    LPCSTR lpszClassName;
} WNDCLASSA, *LPWNDCLASSA;
typedef WNDCLASSA WNDCLASS;

// ---------------------------------------------------------------------------
// Window / input constants actually referenced by the engine
// ---------------------------------------------------------------------------
#define WM_CLOSE 0x0010
#define WM_QUIT 0x0012
#define WM_ACTIVATEAPP 0x001C
#define WM_SETCURSOR 0x0020

#define WS_VISIBLE 0x10000000L
#define WS_SYSMENU 0x00080000L
#define WS_MINIMIZEBOX 0x00020000L
#define WS_OVERLAPPED 0x00000000L
#define WS_CAPTION 0x00C00000L
#define WS_THICKFRAME 0x00040000L
#define WS_MAXIMIZEBOX 0x00010000L
#define WS_OVERLAPPEDWINDOW                                                                                            \
    (WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX)

#define CS_VREDRAW 0x0001
#define CS_HREDRAW 0x0002
#define CS_OWNDC 0x0020

#define SW_HIDE 0
#define SW_SHOW 5
#define SW_SHOWNORMAL 1

#define PM_NOREMOVE 0x0000
#define PM_REMOVE 0x0001

#define GWL_WNDPROC (-4)
#define GWL_HINSTANCE (-6)
#define GWL_STYLE (-16)
#define GWL_USERDATA (-21)

#define MB_OK 0x00000000L
#define MB_ICONERROR 0x00000010L

#define WHITE_BRUSH 0
#define BLACK_BRUSH 4
#define NULL_BRUSH 5

#define IDC_ARROW ((LPCSTR)(ULONG_PTR)32512)

// SystemParametersInfo actions (used by the startup path).
#define SPI_GETSCREENSAVEACTIVE 0x0010
#define SPI_SETSCREENSAVEACTIVE 0x0011
#define SPI_GETLOWPOWERACTIVE 0x0053
#define SPI_SETLOWPOWERACTIVE 0x0055
#define SPI_GETPOWEROFFACTIVE 0x0054
#define SPI_SETPOWEROFFACTIVE 0x0056
#define SPIF_SENDCHANGE 0x0002

// Virtual key codes referenced by Controller.
#define VK_RETURN 0x0D
#define VK_SHIFT 0x10
#define VK_CONTROL 0x11
#define VK_ESCAPE 0x1B
#define VK_HOME 0x24
#define VK_LEFT 0x25
#define VK_UP 0x26
#define VK_RIGHT 0x27
#define VK_DOWN 0x28
#define VK_NUMPAD1 0x61
#define VK_NUMPAD2 0x62
#define VK_NUMPAD3 0x63
#define VK_NUMPAD4 0x64
#define VK_NUMPAD6 0x66
#define VK_NUMPAD7 0x67
#define VK_NUMPAD8 0x68
#define VK_NUMPAD9 0x69

// GDI font/text constants (CMyFont uses CreateFont + ID3DXFont::DrawText).
#define FW_DONTCARE 0
#define FW_NORMAL 400
#define FW_REGULAR 400
#define FW_BOLD 700
#define DEFAULT_CHARSET 1
#define SHIFTJIS_CHARSET 128
#define OUT_DEFAULT_PRECIS 0
#define CLIP_DEFAULT_PRECIS 0
#define DEFAULT_QUALITY 0
#define PROOF_QUALITY 2
#define ANTIALIASED_QUALITY 4
#define DEFAULT_PITCH 0
#define FIXED_PITCH 1
#define VARIABLE_PITCH 2
#define FF_DONTCARE 0
#define FF_ROMAN 16
#define FF_MODERN 48

#define DT_TOP 0x0000
#define DT_LEFT 0x0000
#define DT_CENTER 0x0001
#define DT_RIGHT 0x0002
#define DT_VCENTER 0x0004
#define DT_WORDBREAK 0x0010
#define DT_SINGLELINE 0x0020
#define DT_EXPANDTABS 0x0040
#define DT_NOCLIP 0x0100
#define DT_CALCRECT 0x0400

typedef struct tagLOGFONTA
{
    LONG lfHeight, lfWidth, lfEscapement, lfOrientation, lfWeight;
    BYTE lfItalic, lfUnderline, lfStrikeOut, lfCharSet, lfOutPrecision, lfClipPrecision, lfQuality, lfPitchAndFamily;
    CHAR lfFaceName[32];
} LOGFONTA, *LPLOGFONTA;
typedef LOGFONTA LOGFONT;

typedef struct tagPALETTEENTRY
{
    BYTE peRed, peGreen, peBlue, peFlags;
} PALETTEENTRY, *LPPALETTEENTRY;

// GDI DIB structs (TextHelper builds glyph bitmaps via CreateDIBSection).
#pragma pack(push, 1)
typedef struct tagRGBQUAD
{
    BYTE rgbBlue, rgbGreen, rgbRed, rgbReserved;
} RGBQUAD;
typedef struct tagBITMAPFILEHEADER
{
    WORD bfType;
    DWORD bfSize;
    WORD bfReserved1, bfReserved2;
    DWORD bfOffBits;
} BITMAPFILEHEADER, *LPBITMAPFILEHEADER;
#pragma pack(pop)
typedef struct tagBITMAPINFOHEADER
{
    DWORD biSize;
    LONG biWidth, biHeight;
    WORD biPlanes, biBitCount;
    DWORD biCompression, biSizeImage;
    LONG biXPelsPerMeter, biYPelsPerMeter;
    DWORD biClrUsed, biClrImportant;
} BITMAPINFOHEADER, *LPBITMAPINFOHEADER;
typedef struct tagBITMAPINFO
{
    BITMAPINFOHEADER bmiHeader;
    RGBQUAD bmiColors[1];
} BITMAPINFO, *LPBITMAPINFO;
#define BI_RGB 0

// ---------------------------------------------------------------------------
// Win32 API surface used by the engine (implemented in platform/win32_stub.cpp)
// ---------------------------------------------------------------------------
#ifdef __cplusplus
extern "C"
{
#endif

    DWORD GetLastError(void);
    void SetLastError(DWORD);

    // MSVC CRT date/time strings (ReplayManager timestamps). Impl via strftime.
    void _strdate(char *buf);
    void _strtime(char *buf);
    void Sleep(DWORD ms);
    void OutputDebugStringA(LPCSTR);

    HANDLE CreateMutexA(void *attrs, BOOL initialOwner, LPCSTR name);
    BOOL CloseHandle(HANDLE);

    // File I/O
    HANDLE CreateFileA(LPCSTR fileName, DWORD desiredAccess, DWORD shareMode, void *securityAttrs,
                       DWORD creationDisposition, DWORD flagsAndAttributes, HANDLE templateFile);
    BOOL ReadFile(HANDLE file, LPVOID buffer, DWORD bytesToRead, LPDWORD bytesRead, void *overlapped);
    BOOL WriteFile(HANDLE file, LPCVOID buffer, DWORD bytesToWrite, LPDWORD bytesWritten, void *overlapped);
    DWORD SetFilePointer(HANDLE file, LONG distanceToMove, LONG *distanceToMoveHigh, DWORD moveMethod);
    DWORD GetFileSize(HANDLE file, LPDWORD fileSizeHigh);
    BOOL GetFileTime(HANDLE file, LPFILETIME creation, LPFILETIME lastAccess, LPFILETIME lastWrite);
    BOOL DeleteFileA(LPCSTR fileName);

    // Local heap (FileAbstraction uses LocalAlloc/LocalFree with LPTR).
    HLOCAL LocalAlloc(UINT flags, SIZE_T bytes);
    HLOCAL LocalFree(HLOCAL mem);

    HWND CreateWindowExA(DWORD exStyle, LPCSTR className, LPCSTR windowName, DWORD style, int x, int y, int w, int h,
                         HWND parent, HMENU menu, HINSTANCE inst, LPVOID param);
    ATOM RegisterClassA(const WNDCLASSA *);
    LRESULT DefWindowProcA(HWND, UINT, WPARAM, LPARAM);
    BOOL DestroyWindow(HWND);
    BOOL ShowWindow(HWND, int);
    BOOL UpdateWindow(HWND);
    int ShowCursor(BOOL);
    HCURSOR LoadCursorA(HINSTANCE, LPCSTR);
    HCURSOR SetCursor(HCURSOR);
    HGDIOBJ GetStockObject(int);
    LONG SetWindowLongA(HWND, int, LONG);
    LONG GetWindowLongA(HWND, int);
    BOOL GetClientRect(HWND, LPRECT);
    BOOL PeekMessageA(LPMSG, HWND, UINT, UINT, UINT);
    BOOL GetMessageA(LPMSG, HWND, UINT, UINT);
    BOOL TranslateMessage(const MSG *);
    LRESULT DispatchMessageA(const MSG *);
    void PostQuitMessage(int);
    int MessageBoxA(HWND, LPCSTR, LPCSTR, UINT);
    BOOL SystemParametersInfoA(UINT action, UINT param, void *ptr, UINT winIni);

    SHORT GetAsyncKeyState(int vKey);
    BOOL GetKeyboardState(LPBYTE);
    BOOL SetKeyboardState(LPBYTE);
    int GetSystemMetrics(int nIndex);

    HANDLE FindFirstFileA(LPCSTR fileName, LPWIN32_FIND_DATAA findData);
    BOOL FindNextFileA(HANDLE findHandle, LPWIN32_FIND_DATAA findData);
    BOOL FindClose(HANDLE findHandle);

    // GDI (font rendering path)
    HFONT CreateFontA(int height, int width, int escapement, int orientation, int weight, DWORD italic,
                      DWORD underline, DWORD strikeOut, DWORD charSet, DWORD outPrecision, DWORD clipPrecision,
                      DWORD quality, DWORD pitchAndFamily, LPCSTR faceName);
    HFONT CreateFontIndirectA(const LOGFONTA *);
    HGDIOBJ SelectObject(HDC, HGDIOBJ);
    BOOL DeleteObject(HGDIOBJ);
    HDC CreateCompatibleDC(HDC);
    BOOL DeleteDC(HDC);

    // Window timers (SoundPlayer uses a timer for streaming).
    UINT_PTR SetTimer(HWND hWnd, UINT_PTR nIDEvent, UINT uElapse, void *lpTimerFunc);
    BOOL KillTimer(HWND hWnd, UINT_PTR uIDEvent);
    BOOL PostThreadMessageA(DWORD idThread, UINT Msg, WPARAM wParam, LPARAM lParam);
    DWORD GetCurrentThreadId(void);

    // Synchronization + thread (SoundPlayer streaming uses an event + thread).
    HANDLE CreateEventA(void *attrs, BOOL manualReset, BOOL initialState, LPCSTR name);
    BOOL SetEvent(HANDLE);
    BOOL ResetEvent(HANDLE);
    DWORD WaitForSingleObject(HANDLE handle, DWORD milliseconds);
    DWORD MsgWaitForMultipleObjects(DWORD count, const HANDLE *handles, BOOL waitAll, DWORD milliseconds,
                                    DWORD wakeMask);
    HANDLE CreateThread(void *attrs, SIZE_T stackSize, LPTHREAD_START_ROUTINE start, LPVOID param,
                        DWORD creationFlags, LPDWORD threadId);
    void ExitThread(DWORD exitCode);
    BOOL TerminateThread(HANDLE thread, DWORD exitCode);
    BOOL SetThreadPriority(HANDLE thread, int priority);

    // GDI DIB section (TextHelper renders glyphs into a DIB).
    HBITMAP CreateDIBSection(HDC hdc, const BITMAPINFO *pbmi, UINT usage, void **ppvBits, HANDLE hSection,
                             DWORD offset);
    int SetBkMode(HDC, int);
    DWORD SetTextColor(HDC, DWORD);
    DWORD SetBkColor(HDC, DWORD);
    BOOL TextOutA(HDC, int, int, LPCSTR, int);

#ifdef __cplusplus
}
#endif

#define CreateFont CreateFontA
#define CreateFontIndirect CreateFontIndirectA
#define TextOut TextOutA
#define FindFirstFile FindFirstFileA
#define FindNextFile FindNextFileA

// Real <windows.h> (default settings) transitively provides the multimedia
// types/APIs; several engine headers (e.g. MidiOutput.hpp) rely on that. Pull
// in the multimedia shim here, after all base types are defined.
#include "mmsystem.h"

// ANSI/Unicode macro aliases (engine builds ANSI).
#define CreateWindowEx CreateWindowExA
#define CreateWindow(cls, name, style, x, y, w, h, parent, menu, inst, param)                                          \
    CreateWindowExA(0, cls, name, style, x, y, w, h, parent, menu, inst, param)
#define RegisterClass RegisterClassA
#define DefWindowProc DefWindowProcA
#define LoadCursor LoadCursorA
#define SetWindowLong SetWindowLongA
#define GetWindowLong GetWindowLongA
#define PeekMessage PeekMessageA
#define GetMessage GetMessageA
#define DispatchMessage DispatchMessageA
#define MessageBox MessageBoxA
#define SystemParametersInfo SystemParametersInfoA
#define CreateMutex CreateMutexA
#define OutputDebugString OutputDebugStringA
#define DeleteFile DeleteFileA
