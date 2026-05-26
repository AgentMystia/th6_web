// <mmsystem.h> shim: multimedia timer, MIDI-out and joystick APIs.
// Timing is backed by the platform clock; MIDI is stubbed (BGM uses external
// Ogg via the SoundPlayer intercept); joystick maps to the Gamepad API later.
#pragma once
#include "mmreg.h"
#include "windows.h"

typedef UINT MMRESULT;
#define MMSYSERR_NOERROR 0
#define MMSYSERR_ERROR 1
#define TIMERR_NOERROR 0
#define TIMERR_NOCANDO 97
#define MMSYSERR_BADDEVICEID 2
#define JOYERR_NOERROR 0
#define JOYERR_PARMS 165
#define MMIOERR_BASE 256
#define MMIOERR_FILENOTFOUND (MMIOERR_BASE + 1)
#define MMIOERR_OUTOFMEMORY (MMIOERR_BASE + 2)
#define MMIOERR_CANNOTOPEN (MMIOERR_BASE + 3)
#define MMIOERR_PATHNOTFOUND (MMIOERR_BASE + 7)
#define MMIOERR_ACCESSDENIED (MMIOERR_BASE + 8)
#define MMIOERR_SHARINGVIOLATION (MMIOERR_BASE + 9)
#define MMIOERR_NETWORKERROR (MMIOERR_BASE + 10)
#define MMIOERR_TOOMANYOPENFILES (MMIOERR_BASE + 11)
#define MMIOERR_INVALIDFILE (MMIOERR_BASE + 12)
#ifndef SEEK_SET
#define SEEK_SET 0
#define SEEK_CUR 1
#define SEEK_END 2
#endif

DECLARE_HANDLE(HMIDIOUT);
DECLARE_HANDLE(HMIDI);

// ---- Multimedia timer ----
typedef struct timecaps_tag
{
    UINT wPeriodMin;
    UINT wPeriodMax;
} TIMECAPS, *LPTIMECAPS;

#define TIME_ONESHOT 0x0000
#define TIME_PERIODIC 0x0001
#define TIME_CALLBACK_FUNCTION 0x0000

typedef void(CALLBACK *LPTIMECALLBACK)(UINT uTimerID, UINT uMsg, DWORD_PTR dwUser, DWORD_PTR dw1, DWORD_PTR dw2);

#define CALLBACK_NULL 0x00000000
#define CALLBACK_WINDOW 0x00010000
#define CALLBACK_FUNCTION 0x00030000

// ---- MIDI out header ----
typedef struct midihdr_tag
{
    LPSTR lpData;
    DWORD dwBufferLength;
    DWORD dwBytesRecorded;
    DWORD_PTR dwUser;
    DWORD dwFlags;
    struct midihdr_tag *lpNext;
    DWORD_PTR reserved;
    DWORD dwOffset;
    DWORD_PTR dwReserved[8];
} MIDIHDR, *LPMIDIHDR;

// ---- Joystick ----
#define JOYSTICKID1 0
#define JOY_RETURNX 0x00000001
#define JOY_RETURNY 0x00000002
#define JOY_RETURNBUTTONS 0x00000080
#define JOY_RETURNALL 0x000000ff
#define JOYCAPS_HASPOV 0x00000001

typedef struct joycapsA_tag
{
    WORD wMid;
    WORD wPid;
    char szPname[32];
    UINT wXmin, wXmax;
    UINT wYmin, wYmax;
    UINT wZmin, wZmax;
    UINT wNumButtons;
    UINT wPeriodMin, wPeriodMax;
    UINT wRmin, wRmax;
    UINT wUmin, wUmax;
    UINT wVmin, wVmax;
    UINT wCaps;
    UINT wMaxAxes, wNumAxes, wMaxButtons;
    char szRegKey[32];
    char szOEMVxD[260];
} JOYCAPSA, *LPJOYCAPSA;

typedef struct joyinfoex_tag
{
    DWORD dwSize;
    DWORD dwFlags;
    DWORD dwXpos, dwYpos, dwZpos;
    DWORD dwRpos, dwUpos, dwVpos;
    DWORD dwButtons, dwButtonNumber;
    DWORD dwPOV;
    DWORD dwReserved1, dwReserved2;
} JOYINFOEX, *LPJOYINFOEX;

// ---- Multimedia file I/O (mmio): the WAV loader in zwave.cpp ----
DECLARE_HANDLE(HMMIO);
typedef DWORD FOURCC;
typedef char *HPSTR;

#define mmioFOURCC(c0, c1, c2, c3)                                                                                     \
    ((DWORD)(BYTE)(c0) | ((DWORD)(BYTE)(c1) << 8) | ((DWORD)(BYTE)(c2) << 16) | ((DWORD)(BYTE)(c3) << 24))
#define FOURCC_RIFF mmioFOURCC('R', 'I', 'F', 'F')
#define FOURCC_LIST mmioFOURCC('L', 'I', 'S', 'T')

#define MMIO_READ 0x00000000
#define MMIO_WRITE 0x00000001
#define MMIO_ALLOCBUF 0x00010000
#define MMIO_FINDCHUNK 0x00000010
#define MMIO_FINDRIFF 0x00000020

typedef struct _MMIOINFO
{
    DWORD dwFlags;
    FOURCC fccIOProc;
    void *pIOProc;
    UINT wErrorRet;
    HANDLE htask;
    LONG cchBuffer;
    HPSTR pchBuffer;
    HPSTR pchNext;
    HPSTR pchEndRead;
    HPSTR pchEndWrite;
    LONG lBufOffset;
    LONG lDiskOffset;
    DWORD adwInfo[3];
    DWORD dwReserved1;
    DWORD dwReserved2;
    HMMIO hmmio;
} MMIOINFO, *LPMMIOINFO;

typedef struct _MMCKINFO
{
    FOURCC ckid;
    DWORD cksize;
    FOURCC fccType;
    DWORD dwDataOffset;
    DWORD dwFlags;
} MMCKINFO, *LPMMCKINFO;

#ifdef __cplusplus
extern "C"
{
#endif
    HMMIO mmioOpenA(LPSTR pszFileName, LPMMIOINFO pmmioinfo, DWORD fdwOpen);
    MMRESULT mmioClose(HMMIO hmmio, UINT fuClose);
    LONG mmioRead(HMMIO hmmio, HPSTR pch, LONG cch);
    LONG mmioSeek(HMMIO hmmio, LONG lOffset, int iOrigin);
    LONG mmioAdvance(HMMIO hmmio, LPMMIOINFO pmmioinfo, UINT fuAdvance);
    MMRESULT mmioDescend(HMMIO hmmio, LPMMCKINFO pmmcki, const MMCKINFO *pmmckiParent, UINT fuDescend);
    MMRESULT mmioAscend(HMMIO hmmio, LPMMCKINFO pmmcki, UINT fuAscend);
    MMRESULT mmioGetInfo(HMMIO hmmio, LPMMIOINFO pmmioinfo, UINT fuInfo);
    MMRESULT mmioSetInfo(HMMIO hmmio, const MMIOINFO *pmmioinfo, UINT fuInfo);

    DWORD timeGetTime(void);
    MMRESULT timeBeginPeriod(UINT uPeriod);
    MMRESULT timeEndPeriod(UINT uPeriod);
    MMRESULT timeGetDevCaps(LPTIMECAPS ptc, UINT cbtc);
    MMRESULT timeSetEvent(UINT uDelay, UINT uResolution, LPTIMECALLBACK cb, DWORD_PTR dwUser, UINT fuEvent);
    MMRESULT timeKillEvent(UINT uTimerID);

    UINT midiOutGetNumDevs(void);
    MMRESULT midiOutOpen(HMIDIOUT *lphmo, UINT uDeviceID, DWORD_PTR dwCallback, DWORD_PTR dwInstance, DWORD fdwOpen);
    MMRESULT midiOutClose(HMIDIOUT hmo);
    MMRESULT midiOutReset(HMIDIOUT hmo);
    MMRESULT midiOutShortMsg(HMIDIOUT hmo, DWORD dwMsg);
    MMRESULT midiOutLongMsg(HMIDIOUT hmo, LPMIDIHDR lpMidiOutHdr, UINT cbMidiOutHdr);
    MMRESULT midiOutPrepareHeader(HMIDIOUT hmo, LPMIDIHDR lpMidiOutHdr, UINT cbMidiOutHdr);
    MMRESULT midiOutUnprepareHeader(HMIDIOUT hmo, LPMIDIHDR lpMidiOutHdr, UINT cbMidiOutHdr);

    MMRESULT joyGetDevCapsA(UINT uJoyID, LPJOYCAPSA pjc, UINT cbjc);
    MMRESULT joyGetPosEx(UINT uJoyID, LPJOYINFOEX pji);
#ifdef __cplusplus
}
#endif

#define joyGetDevCaps joyGetDevCapsA
#define mmioOpen mmioOpenA
