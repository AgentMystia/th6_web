// <dsound.h> shim: DirectSound interfaces (SFX + streaming). Backend = WebAudio.
#pragma once
#include "mmreg.h"
#include "windows.h"

#define DS_OK 0
#define DSERR_BUFFERLOST ((HRESULT)0x88780096L)

#define DSSCL_NORMAL 1
#define DSSCL_PRIORITY 2
#define DSSCL_EXCLUSIVE 3
#define DSSCL_WRITEPRIMARY 4

#define DSBPLAY_LOOPING 0x00000001

#define DSBSTATUS_PLAYING 0x00000001
#define DSBSTATUS_BUFFERLOST 0x00000002
#define DSBSTATUS_LOOPING 0x00000004

#define DSBCAPS_PRIMARYBUFFER 0x00000001
#define DSBCAPS_CTRLVOLUME 0x00000080
#define DSBCAPS_CTRLPOSITIONNOTIFY 0x00000100
#define DSBCAPS_GETCURRENTPOSITION2 0x00010000
#define DSBCAPS_GLOBALFOCUS 0x00008000
#define DSBCAPS_LOCSOFTWARE 0x00000008
#define DSBCAPS_STICKYFOCUS 0x00004000

#define DSBLOCK_FROMWRITECURSOR 0x00000001
#define DSBLOCK_ENTIREBUFFER 0x00000002

typedef struct _DSBUFFERDESC
{
    DWORD dwSize;
    DWORD dwFlags;
    DWORD dwBufferBytes;
    DWORD dwReserved;
    LPWAVEFORMATEX lpwfxFormat;
    GUID guid3DAlgorithm; // DX8 field
} DSBUFFERDESC, *LPDSBUFFERDESC;

typedef struct _DSBPOSITIONNOTIFY
{
    DWORD dwOffset;
    HANDLE hEventNotify;
} DSBPOSITIONNOTIFY, *LPDSBPOSITIONNOTIFY;

struct IDirectSoundBuffer;
struct IDirectSoundNotify;

struct IDirectSound : public IUnknown
{
    virtual HRESULT __stdcall CreateSoundBuffer(const DSBUFFERDESC *pcDSBufferDesc, IDirectSoundBuffer **ppDSBuffer,
                                                IUnknown *pUnkOuter) = 0;
    virtual HRESULT __stdcall GetCaps(void *pDSCaps) = 0;
    virtual HRESULT __stdcall DuplicateSoundBuffer(IDirectSoundBuffer *pDSBufferOriginal,
                                                   IDirectSoundBuffer **ppDSBufferDuplicate) = 0;
    virtual HRESULT __stdcall SetCooperativeLevel(HWND hwnd, DWORD dwLevel) = 0;
    virtual HRESULT __stdcall Compact() = 0;
    virtual HRESULT __stdcall Initialize(const GUID *pcGuidDevice) = 0;
};

struct IDirectSoundBuffer : public IUnknown
{
    virtual HRESULT __stdcall GetCaps(void *pDSBufferCaps) = 0;
    virtual HRESULT __stdcall GetCurrentPosition(DWORD *pdwCurrentPlayCursor, DWORD *pdwCurrentWriteCursor) = 0;
    virtual HRESULT __stdcall GetFormat(LPWAVEFORMATEX pwfxFormat, DWORD dwSizeAllocated, DWORD *pdwSizeWritten) = 0;
    virtual HRESULT __stdcall GetVolume(LONG *plVolume) = 0;
    virtual HRESULT __stdcall GetStatus(DWORD *pdwStatus) = 0;
    virtual HRESULT __stdcall Initialize(IDirectSound *pDirectSound, const DSBUFFERDESC *pcDSBufferDesc) = 0;
    virtual HRESULT __stdcall Lock(DWORD dwOffset, DWORD dwBytes, void **ppvAudioPtr1, DWORD *pdwAudioBytes1,
                                   void **ppvAudioPtr2, DWORD *pdwAudioBytes2, DWORD dwFlags) = 0;
    virtual HRESULT __stdcall Play(DWORD dwReserved1, DWORD dwPriority, DWORD dwFlags) = 0;
    virtual HRESULT __stdcall SetCurrentPosition(DWORD dwNewPosition) = 0;
    virtual HRESULT __stdcall SetFormat(const WAVEFORMATEX *pcfxFormat) = 0;
    virtual HRESULT __stdcall SetVolume(LONG lVolume) = 0;
    virtual HRESULT __stdcall Stop() = 0;
    virtual HRESULT __stdcall Unlock(void *pvAudioPtr1, DWORD dwAudioBytes1, void *pvAudioPtr2,
                                     DWORD dwAudioBytes2) = 0;
    virtual HRESULT __stdcall Restore() = 0;
};

struct IDirectSoundNotify : public IUnknown
{
    virtual HRESULT __stdcall SetNotificationPositions(DWORD dwPositionNotifies,
                                                       const DSBPOSITIONNOTIFY *pcPositionNotifies) = 0;
};

typedef IDirectSound *LPDIRECTSOUND;
typedef IDirectSoundBuffer *LPDIRECTSOUNDBUFFER;
typedef IDirectSoundNotify *LPDIRECTSOUNDNOTIFY;

// DirectSound8 names (the engine uses LPDIRECTSOUND8 for the device object).
typedef IDirectSound IDirectSound8;
typedef IDirectSoundBuffer IDirectSoundBuffer8;
typedef IDirectSound8 *LPDIRECTSOUND8;
typedef IDirectSoundBuffer8 *LPDIRECTSOUNDBUFFER8;

extern const GUID IID_IDirectSoundNotify;

#ifdef __cplusplus
extern "C"
{
#endif
    HRESULT __stdcall DirectSoundCreate(const GUID *pcGuidDevice, IDirectSound **ppDS, IUnknown *pUnkOuter);
    HRESULT __stdcall DirectSoundCreate8(const GUID *pcGuidDevice, IDirectSound8 **ppDS8, IUnknown *pUnkOuter);
#ifdef __cplusplus
}
#endif
