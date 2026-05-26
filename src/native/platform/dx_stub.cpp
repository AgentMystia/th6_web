// Stub DirectSound / DirectInput / D3DX-font / mmio / MIDI backend.
//
// The D3D8 device + D3DX texture/surface helpers now live in gl_device.cpp
// (real WebGL2). This file keeps the remaining inert backends so the engine
// links and runs: audio (DirectSound, replaced by WebAudio later), input
// (DirectInput; keyboard is fed via g_Th06KeyState / GetKeyboardState), the
// GDI-style font (ID3DXFont), the WAV mmio reader, and MIDI-out (unused; BGM
// uses external Ogg). Also defines the DirectInput/DirectSound GUIDs + data
// formats (their extern decls come from dinput.h/dsound.h).
#include <cstdlib>
#include <cstring>

#include <d3dx8.h>
#include <dinput.h>
#include <dsound.h>

// Browser keyboard state (DIK-indexed, 0x80 = pressed), filled by the JS glue.
extern "C" unsigned char g_Th06KeyState[256];

namespace
{

#define STUB_IUNKNOWN(refcountField)                                                                                  \
    ULONG refcountField = 1;                                                                                          \
    HRESULT __stdcall QueryInterface(REFIID, void **ppv) override                                                    \
    {                                                                                                                  \
        if (ppv) *ppv = this;                                                                                         \
        return S_OK;                                                                                                   \
    }                                                                                                                  \
    ULONG __stdcall AddRef() override { return ++refcountField; }                                                    \
    ULONG __stdcall Release() override                                                                                \
    {                                                                                                                  \
        if (--refcountField == 0) { delete this; return 0; }                                                         \
        return refcountField;                                                                                          \
    }

// --- DirectSound stubs ---
struct StubSoundBuffer : IDirectSoundBuffer
{
    STUB_IUNKNOWN(rc)
    HRESULT __stdcall GetCaps(void *) override { return DS_OK; }
    HRESULT __stdcall GetCurrentPosition(DWORD *p, DWORD *w) override { if (p) *p = 0; if (w) *w = 0; return DS_OK; }
    HRESULT __stdcall GetFormat(LPWAVEFORMATEX, DWORD, DWORD *) override { return DS_OK; }
    HRESULT __stdcall GetVolume(LONG *v) override { if (v) *v = 0; return DS_OK; }
    HRESULT __stdcall GetStatus(DWORD *s) override { if (s) *s = 0; return DS_OK; }
    HRESULT __stdcall Initialize(IDirectSound *, const DSBUFFERDESC *) override { return DS_OK; }
    HRESULT __stdcall Lock(DWORD, DWORD bytes, void **p1, DWORD *b1, void **p2, DWORD *b2, DWORD) override
    {
        static void *scratch = nullptr;
        scratch = realloc(scratch, bytes ? bytes : 1);
        if (p1) *p1 = scratch;
        if (b1) *b1 = bytes;
        if (p2) *p2 = nullptr;
        if (b2) *b2 = 0;
        return DS_OK;
    }
    HRESULT __stdcall Play(DWORD, DWORD, DWORD) override { return DS_OK; }
    HRESULT __stdcall SetCurrentPosition(DWORD) override { return DS_OK; }
    HRESULT __stdcall SetFormat(const WAVEFORMATEX *) override { return DS_OK; }
    HRESULT __stdcall SetVolume(LONG) override { return DS_OK; }
    HRESULT __stdcall Stop() override { return DS_OK; }
    HRESULT __stdcall Unlock(void *, DWORD, void *, DWORD) override { return DS_OK; }
    HRESULT __stdcall Restore() override { return DS_OK; }
};

struct StubSound : IDirectSound
{
    STUB_IUNKNOWN(rc)
    HRESULT __stdcall CreateSoundBuffer(const DSBUFFERDESC *, IDirectSoundBuffer **pp, IUnknown *) override
    {
        if (pp) *pp = new StubSoundBuffer();
        return DS_OK;
    }
    HRESULT __stdcall GetCaps(void *) override { return DS_OK; }
    HRESULT __stdcall DuplicateSoundBuffer(IDirectSoundBuffer *, IDirectSoundBuffer **pp) override
    {
        if (pp) *pp = new StubSoundBuffer();
        return DS_OK;
    }
    HRESULT __stdcall SetCooperativeLevel(HWND, DWORD) override { return DS_OK; }
    HRESULT __stdcall Compact() override { return DS_OK; }
    HRESULT __stdcall Initialize(const GUID *) override { return DS_OK; }
};

// --- DirectInput stubs ---
struct StubInputDevice : IDirectInputDevice8A
{
    STUB_IUNKNOWN(rc)
    HRESULT __stdcall SetDataFormat(const DIDATAFORMAT *) override { return DI_OK; }
    HRESULT __stdcall SetCooperativeLevel(HWND, DWORD) override { return DI_OK; }
    HRESULT __stdcall SetProperty(REFGUID, const DIPROPHEADER *) override { return DI_OK; }
    HRESULT __stdcall Acquire() override { return DI_OK; }
    HRESULT __stdcall Unacquire() override { return DI_OK; }
    HRESULT __stdcall GetCapabilities(LPDIDEVCAPS c) override
    {
        if (c) memset(c, 0, sizeof(*c));
        return DI_OK;
    }
    HRESULT __stdcall GetDeviceState(DWORD cb, void *data) override
    {
        if (!data)
            return DI_OK;
        // Keyboard device state = 256 DIK-indexed bytes from the JS glue.
        if (cb == 256)
            memcpy(data, g_Th06KeyState, 256);
        else
            memset(data, 0, cb); // joystick etc. (unused)
        return DI_OK;
    }
    HRESULT __stdcall EnumObjects(LPDIENUMDEVICEOBJECTSCALLBACKA, void *, DWORD) override { return DI_OK; }
    HRESULT __stdcall Poll() override { return DI_OK; }
};

struct StubInput8 : IDirectInput8A
{
    STUB_IUNKNOWN(rc)
    HRESULT __stdcall CreateDevice(REFGUID, IDirectInputDevice8A **pp, IUnknown *) override
    {
        if (pp) *pp = new StubInputDevice();
        return DI_OK;
    }
    HRESULT __stdcall EnumDevices(DWORD, LPDIENUMDEVICESCALLBACKA, void *, DWORD) override { return DI_OK; }
};

struct StubFont : ID3DXFont
{
    STUB_IUNKNOWN(rc)
    HRESULT __stdcall GetDevice(IDirect3DDevice8 **) override { return S_OK; }
    HRESULT __stdcall Begin() override { return S_OK; }
    INT __stdcall DrawTextA(const char *, INT, RECT *, DWORD, D3DCOLOR) override { return 0; }
    HRESULT __stdcall End() override { return S_OK; }
    HRESULT __stdcall OnLostDevice() override { return S_OK; }
    HRESULT __stdcall OnResetDevice() override { return S_OK; }
};

} // namespace

// DirectInput data-format globals + DirectInput/DirectSound GUIDs.
const DIDATAFORMAT c_dfDIKeyboard = {sizeof(DIDATAFORMAT), 0, 0, 256, 0, nullptr};
const DIDATAFORMAT c_dfDIJoystick2 = {sizeof(DIDATAFORMAT), 0, 0, sizeof(DIJOYSTATE2), 0, nullptr};
const GUID GUID_SysKeyboard = {0x6F1D2B61, 0xD5A0, 0x11CF, {0xBF, 0xC7, 0x44, 0x45, 0x53, 0x54, 0x00, 0x00}};
const GUID IID_IDirectInput8A = {0xBF798031, 0x483A, 0x4DA2, {0xAA, 0x99, 0x5D, 0x64, 0xED, 0x36, 0x97, 0x00}};
const GUID IID_IDirectSoundNotify = {0xB0210783, 0x89CD, 0x11D0, {0xAF, 0x08, 0x00, 0xA0, 0xC9, 0x25, 0xCD, 0x16}};

// --- Audio / input factories ---
extern "C" HRESULT __stdcall DirectSoundCreate(const GUID *, IDirectSound **pp, IUnknown *)
{
    if (pp) *pp = new StubSound();
    return DS_OK;
}
extern "C" HRESULT __stdcall DirectSoundCreate8(const GUID *, IDirectSound8 **pp, IUnknown *)
{
    if (pp) *pp = new StubSound();
    return DS_OK;
}
extern "C" HRESULT __stdcall DirectInput8Create(HINSTANCE, DWORD, REFIID, void **pp, IUnknown *)
{
    if (pp) *pp = (void *)new StubInput8();
    return DI_OK;
}

// --- D3DX font (text rendering handled later via atlas/canvas) ---
extern "C" HRESULT D3DXCreateFont(IDirect3DDevice8 *, HFONT, LPD3DXFONT *pp)
{
    if (pp) *pp = new StubFont();
    return S_OK;
}
extern "C" HRESULT D3DXCreateFontIndirect(IDirect3DDevice8 *, const LOGFONTA *, LPD3DXFONT *pp)
{
    if (pp) *pp = new StubFont();
    return S_OK;
}

// --- mmio (WAV reader) — stubbed to fail; SFX won't load yet ---
extern "C" HMMIO mmioOpenA(LPSTR, LPMMIOINFO, DWORD) { return nullptr; }
extern "C" MMRESULT mmioClose(HMMIO, UINT) { return 0; }
extern "C" LONG mmioRead(HMMIO, HPSTR, LONG) { return -1; }
extern "C" LONG mmioSeek(HMMIO, LONG, int) { return -1; }
extern "C" LONG mmioAdvance(HMMIO, LPMMIOINFO, UINT) { return MMIOERR_CANNOTOPEN; }
extern "C" MMRESULT mmioDescend(HMMIO, LPMMCKINFO, const MMCKINFO *, UINT) { return MMIOERR_CANNOTOPEN; }
extern "C" MMRESULT mmioAscend(HMMIO, LPMMCKINFO, UINT) { return MMIOERR_CANNOTOPEN; }
extern "C" MMRESULT mmioGetInfo(HMMIO, LPMMIOINFO, UINT) { return MMIOERR_CANNOTOPEN; }
extern "C" MMRESULT mmioSetInfo(HMMIO, const MMIOINFO *, UINT) { return MMIOERR_CANNOTOPEN; }

// --- MIDI out — unused (BGM via external Ogg) ---
extern "C" UINT midiOutGetNumDevs(void) { return 0; }
extern "C" MMRESULT midiOutOpen(HMIDIOUT *, UINT, DWORD_PTR, DWORD_PTR, DWORD) { return MMSYSERR_ERROR; }
extern "C" MMRESULT midiOutClose(HMIDIOUT) { return MMSYSERR_NOERROR; }
extern "C" MMRESULT midiOutReset(HMIDIOUT) { return MMSYSERR_NOERROR; }
extern "C" MMRESULT midiOutShortMsg(HMIDIOUT, DWORD) { return MMSYSERR_NOERROR; }
extern "C" MMRESULT midiOutLongMsg(HMIDIOUT, LPMIDIHDR, UINT) { return MMSYSERR_NOERROR; }
extern "C" MMRESULT midiOutPrepareHeader(HMIDIOUT, LPMIDIHDR, UINT) { return MMSYSERR_NOERROR; }
extern "C" MMRESULT midiOutUnprepareHeader(HMIDIOUT, LPMIDIHDR, UINT) { return MMSYSERR_NOERROR; }
