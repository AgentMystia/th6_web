// <dinput.h> shim: DirectInput keyboard/joystick. Backend fills the 256-byte
// keyboard state (indexed by DIK_* scancodes) from browser key events; the
// engine's primary path also uses GetKeyboardState. DIK_* use the real
// DirectInput scancodes so both sides agree on indices.
#pragma once
#include "windows.h"

#ifndef DIRECTINPUT_VERSION
#define DIRECTINPUT_VERSION 0x0800
#endif

#define DI_OK 0
#define DIERR_INPUTLOST ((HRESULT)0x8007001EL)
#define DIERR_NOTACQUIRED ((HRESULT)0x8007001CL)

#define DISCL_EXCLUSIVE 0x00000001
#define DISCL_NONEXCLUSIVE 0x00000002
#define DISCL_FOREGROUND 0x00000004
#define DISCL_BACKGROUND 0x00000008
#define DISCL_NOWINKEY 0x00000010

#define DIPH_DEVICE 0
#define DIPH_BYOFFSET 1
#define DIPH_BYID 2

#define DIENUM_STOP 0
#define DIENUM_CONTINUE 1
#define DIEDFL_ATTACHEDONLY 0x00000001

// Keyboard scancodes (DirectInput) used by Controller.
#define DIK_ESCAPE 0x01
#define DIK_RETURN 0x1C
#define DIK_LCONTROL 0x1D
#define DIK_LSHIFT 0x2A
#define DIK_RSHIFT 0x36
#define DIK_RCONTROL 0x9D
#define DIK_HOME 0xC7
#define DIK_UP 0xC8
#define DIK_LEFT 0xCB
#define DIK_RIGHT 0xCD
#define DIK_DOWN 0xD0
#define DIK_Q 0x10
#define DIK_S 0x1F
#define DIK_X 0x2D
#define DIK_Z 0x2C
#define DIK_NUMPAD1 0x4F
#define DIK_NUMPAD2 0x50
#define DIK_NUMPAD3 0x51
#define DIK_NUMPAD4 0x4B
#define DIK_NUMPAD6 0x4D
#define DIK_NUMPAD7 0x47
#define DIK_NUMPAD8 0x48
#define DIK_NUMPAD9 0x49

#define DI8DEVCLASS_ALL 0
#define DI8DEVCLASS_GAMECTRL 4
#define DIDFT_ALL 0x00000000
#define DIDFT_RELAXIS 0x00000001
#define DIDFT_ABSAXIS 0x00000002
#define DIDFT_AXIS 0x00000003
#define DIDFT_PSHBUTTON 0x00000004
#define DIDFT_BUTTON 0x0000000C
#define DIDFT_POV 0x00000010

typedef struct _DIDATAFORMAT
{
    DWORD dwSize;
    DWORD dwObjSize;
    DWORD dwFlags;
    DWORD dwDataSize;
    DWORD dwNumObjs;
    void *rgodf;
} DIDATAFORMAT;

typedef struct DIDEVICEINSTANCEA
{
    DWORD dwSize;
    GUID guidInstance;
    GUID guidProduct;
    DWORD dwDevType;
    char tszInstanceName[260];
    char tszProductName[260];
    GUID guidFFDriver;
    WORD wUsagePage;
    WORD wUsage;
} DIDEVICEINSTANCEA, *LPDIDEVICEINSTANCEA;
typedef const DIDEVICEINSTANCEA *LPCDIDEVICEINSTANCEA;

typedef struct DIDEVICEOBJECTINSTANCEA
{
    DWORD dwSize;
    GUID guidType;
    DWORD dwOfs;
    DWORD dwType;
    DWORD dwFlags;
    char tszName[260];
    DWORD dwFFMaxForce;
    DWORD dwFFForceResolution;
    WORD wCollectionNumber;
    WORD wDesignatorIndex;
    WORD wUsagePage;
    WORD wUsage;
    DWORD dwDimension;
    WORD wExponent;
    WORD wReserved;
} DIDEVICEOBJECTINSTANCEA, *LPDIDEVICEOBJECTINSTANCEA;
typedef const DIDEVICEOBJECTINSTANCEA *LPCDIDEVICEOBJECTINSTANCEA;

typedef int(__stdcall *LPDIENUMDEVICEOBJECTSCALLBACKA)(LPCDIDEVICEOBJECTINSTANCEA, void *);

typedef struct DIJOYSTATE2
{
    LONG lX, lY, lZ;
    LONG lRx, lRy, lRz;
    LONG rglSlider[2];
    DWORD rgdwPOV[4];
    BYTE rgbButtons[128];
    LONG lVX, lVY, lVZ;
    LONG lVRx, lVRy, lVRz;
    LONG rglVSlider[2];
    LONG lAX, lAY, lAZ;
    LONG lARx, lARy, lARz;
    LONG rglASlider[2];
    LONG lFX, lFY, lFZ;
    LONG lFRx, lFRy, lFRz;
    LONG rglFSlider[2];
} DIJOYSTATE2, *LPDIJOYSTATE2;

typedef struct DIDEVCAPS
{
    DWORD dwSize;
    DWORD dwFlags;
    DWORD dwDevType;
    DWORD dwAxes;
    DWORD dwButtons;
    DWORD dwPOVs;
    DWORD dwFFSamplePeriod;
    DWORD dwFFMinTimeResolution;
    DWORD dwFirmwareRevision;
    DWORD dwHardwareRevision;
    DWORD dwFFDriverVersion;
} DIDEVCAPS, *LPDIDEVCAPS;

typedef struct _DIPROPHEADER
{
    DWORD dwSize;
    DWORD dwHeaderSize;
    DWORD dwObj;
    DWORD dwHow;
} DIPROPHEADER, *LPDIPROPHEADER;

typedef struct _DIPROPRANGE
{
    DIPROPHEADER diph;
    LONG lMin;
    LONG lMax;
} DIPROPRANGE, *LPDIPROPRANGE;

// Magic property GUIDs are integer-valued REFGUIDs (MAKEDIPROP pattern).
#define MAKEDIPROP(prop) (*(const GUID *)(prop))
#define DIPROP_BUFFERSIZE MAKEDIPROP(1)
#define DIPROP_AXISMODE MAKEDIPROP(2)
#define DIPROP_RANGE MAKEDIPROP(4)

struct IDirectInputDevice8A;

typedef int(__stdcall *LPDIENUMDEVICESCALLBACKA)(LPCDIDEVICEINSTANCEA, void *);

struct IDirectInput8A : public IUnknown
{
    virtual HRESULT __stdcall CreateDevice(REFGUID rguid, IDirectInputDevice8A **lplpDirectInputDevice,
                                           IUnknown *pUnkOuter) = 0;
    virtual HRESULT __stdcall EnumDevices(DWORD dwDevType, LPDIENUMDEVICESCALLBACKA lpCallback, void *pvRef,
                                          DWORD dwFlags) = 0;
};

struct IDirectInputDevice8A : public IUnknown
{
    virtual HRESULT __stdcall SetDataFormat(const DIDATAFORMAT *lpdf) = 0;
    virtual HRESULT __stdcall SetCooperativeLevel(HWND hwnd, DWORD dwFlags) = 0;
    virtual HRESULT __stdcall SetProperty(REFGUID rguidProp, const DIPROPHEADER *pdiph) = 0;
    virtual HRESULT __stdcall Acquire() = 0;
    virtual HRESULT __stdcall Unacquire() = 0;
    virtual HRESULT __stdcall GetCapabilities(LPDIDEVCAPS lpDIDevCaps) = 0;
    virtual HRESULT __stdcall GetDeviceState(DWORD cbData, void *lpvData) = 0;
    virtual HRESULT __stdcall EnumObjects(LPDIENUMDEVICEOBJECTSCALLBACKA lpCallback, void *pvRef, DWORD dwFlags) = 0;
    virtual HRESULT __stdcall Poll() = 0;
};

typedef IDirectInput8A *LPDIRECTINPUT8, *LPDIRECTINPUT8A;
typedef IDirectInputDevice8A *LPDIRECTINPUTDEVICE8A;

extern const GUID GUID_SysKeyboard;
extern const DIDATAFORMAT c_dfDIKeyboard;
extern const DIDATAFORMAT c_dfDIJoystick2;

#ifdef __cplusplus
extern "C"
{
#endif
    HRESULT __stdcall DirectInput8Create(HINSTANCE hinst, DWORD dwVersion, REFIID riidltf, void **ppvOut,
                                         IUnknown *punkOuter);
#ifdef __cplusplus
}
#endif

extern const GUID IID_IDirectInput8A;
