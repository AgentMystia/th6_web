// <d3d8.h> shim: Direct3D 8 COM interfaces used by TH06.
// These are abstract (pure-virtual) interfaces; the concrete implementation is
// the WebGL-backed (or stub/native-GL) device in platform/. Direct3DCreate8()
// returns that backend instance. The engine code is unchanged.
#pragma once
#include "d3d8types.h"
#include "windows.h"

typedef struct _D3DRECT
{
    LONG x1, y1, x2, y2;
} D3DRECT;

struct IDirect3DSurface8;
struct IDirect3DBaseTexture8;
struct IDirect3DTexture8;
struct IDirect3DVertexBuffer8;
struct IDirect3DDevice8;
struct IDirect3D8;

struct IDirect3DSurface8 : public IUnknown
{
    virtual HRESULT __stdcall GetDesc(D3DSURFACE_DESC *pDesc) = 0;
    virtual HRESULT __stdcall LockRect(D3DLOCKED_RECT *pLockedRect, const RECT *pRect, DWORD Flags) = 0;
    virtual HRESULT __stdcall UnlockRect() = 0;
};

struct IDirect3DBaseTexture8 : public IUnknown
{
    virtual D3DRESOURCETYPE __stdcall GetType() = 0;
};

struct IDirect3DTexture8 : public IDirect3DBaseTexture8
{
    virtual HRESULT __stdcall GetLevelDesc(UINT Level, D3DSURFACE_DESC *pDesc) = 0;
    virtual HRESULT __stdcall GetSurfaceLevel(UINT Level, IDirect3DSurface8 **ppSurfaceLevel) = 0;
    virtual HRESULT __stdcall LockRect(UINT Level, D3DLOCKED_RECT *pLockedRect, const RECT *pRect, DWORD Flags) = 0;
    virtual HRESULT __stdcall UnlockRect(UINT Level) = 0;
};

struct IDirect3DVertexBuffer8 : public IUnknown
{
    virtual HRESULT __stdcall Lock(UINT OffsetToLock, UINT SizeToLock, BYTE **ppbData, DWORD Flags) = 0;
    virtual HRESULT __stdcall Unlock() = 0;
};

struct IDirect3DDevice8 : public IUnknown
{
    virtual HRESULT __stdcall TestCooperativeLevel() = 0;
    virtual UINT __stdcall GetAvailableTextureMem() = 0;
    virtual HRESULT __stdcall ResourceManagerDiscardBytes(DWORD Bytes) = 0;
    virtual HRESULT __stdcall GetDeviceCaps(D3DCAPS8 *pCaps) = 0;
    virtual HRESULT __stdcall Reset(D3DPRESENT_PARAMETERS *pPresentationParameters) = 0;
    virtual HRESULT __stdcall Present(const RECT *pSourceRect, const RECT *pDestRect, HWND hDestWindowOverride,
                                      const void *pDirtyRegion) = 0;
    virtual HRESULT __stdcall GetBackBuffer(UINT BackBuffer, D3DBACKBUFFER_TYPE Type,
                                            IDirect3DSurface8 **ppBackBuffer) = 0;
    virtual HRESULT __stdcall CreateTexture(UINT Width, UINT Height, UINT Levels, DWORD Usage, D3DFORMAT Format,
                                            D3DPOOL Pool, IDirect3DTexture8 **ppTexture) = 0;
    virtual HRESULT __stdcall CreateVertexBuffer(UINT Length, DWORD Usage, DWORD FVF, D3DPOOL Pool,
                                                 IDirect3DVertexBuffer8 **ppVertexBuffer) = 0;
    virtual HRESULT __stdcall CreateRenderTarget(UINT Width, UINT Height, D3DFORMAT Format,
                                                 D3DMULTISAMPLE_TYPE MultiSample, BOOL Lockable,
                                                 IDirect3DSurface8 **ppSurface) = 0;
    virtual HRESULT __stdcall CreateImageSurface(UINT Width, UINT Height, D3DFORMAT Format,
                                                 IDirect3DSurface8 **ppSurface) = 0;
    virtual HRESULT __stdcall CopyRects(IDirect3DSurface8 *pSourceSurface, const RECT *pSourceRectsArray, UINT cRects,
                                        IDirect3DSurface8 *pDestinationSurface, const POINT *pDestPointsArray) = 0;
    virtual HRESULT __stdcall SetViewport(const D3DVIEWPORT8 *pViewport) = 0;
    virtual HRESULT __stdcall GetViewport(D3DVIEWPORT8 *pViewport) = 0;
    virtual HRESULT __stdcall SetTransform(D3DTRANSFORMSTATETYPE State, const D3DMATRIX *pMatrix) = 0;
    virtual HRESULT __stdcall SetRenderState(D3DRENDERSTATETYPE State, DWORD Value) = 0;
    virtual HRESULT __stdcall GetRenderState(D3DRENDERSTATETYPE State, DWORD *pValue) = 0;
    virtual HRESULT __stdcall SetTextureStageState(DWORD Stage, D3DTEXTURESTAGESTATETYPE Type, DWORD Value) = 0;
    virtual HRESULT __stdcall SetTexture(DWORD Stage, IDirect3DBaseTexture8 *pTexture) = 0;
    virtual HRESULT __stdcall SetVertexShader(DWORD Handle) = 0;
    virtual HRESULT __stdcall SetStreamSource(UINT StreamNumber, IDirect3DVertexBuffer8 *pStreamData,
                                              UINT Stride) = 0;
    virtual HRESULT __stdcall DrawPrimitive(D3DPRIMITIVETYPE PrimitiveType, UINT StartVertex,
                                            UINT PrimitiveCount) = 0;
    virtual HRESULT __stdcall DrawPrimitiveUP(D3DPRIMITIVETYPE PrimitiveType, UINT PrimitiveCount,
                                              const void *pVertexStreamZeroData, UINT VertexStreamZeroStride) = 0;
    virtual HRESULT __stdcall Clear(DWORD Count, const D3DRECT *pRects, DWORD Flags, D3DCOLOR Color, float Z,
                                    DWORD Stencil) = 0;
    virtual HRESULT __stdcall BeginScene() = 0;
    virtual HRESULT __stdcall EndScene() = 0;
};

struct IDirect3D8 : public IUnknown
{
    virtual HRESULT __stdcall GetAdapterDisplayMode(UINT Adapter, D3DDISPLAYMODE *pMode) = 0;
    virtual HRESULT __stdcall CheckDeviceType(UINT Adapter, D3DDEVTYPE CheckType, D3DFORMAT DisplayFormat,
                                              D3DFORMAT BackBufferFormat, BOOL Windowed) = 0;
    virtual HRESULT __stdcall CheckDeviceFormat(UINT Adapter, D3DDEVTYPE DeviceType, D3DFORMAT AdapterFormat,
                                                DWORD Usage, D3DRESOURCETYPE RType, D3DFORMAT CheckFormat) = 0;
    virtual HRESULT __stdcall GetDeviceCaps(UINT Adapter, D3DDEVTYPE DeviceType, D3DCAPS8 *pCaps) = 0;
    virtual HRESULT __stdcall CreateDevice(UINT Adapter, D3DDEVTYPE DeviceType, HWND hFocusWindow,
                                           DWORD BehaviorFlags, D3DPRESENT_PARAMETERS *pPresentationParameters,
                                           IDirect3DDevice8 **ppReturnedDeviceInterface) = 0;
};

typedef IDirect3D8 *LPDIRECT3D8, *PDIRECT3D8;
typedef IDirect3DDevice8 *LPDIRECT3DDEVICE8, *PDIRECT3DDEVICE8;
typedef IDirect3DTexture8 *LPDIRECT3DTEXTURE8, *PDIRECT3DTEXTURE8;
typedef IDirect3DBaseTexture8 *LPDIRECT3DBASETEXTURE8, *PDIRECT3DBASETEXTURE8;
typedef IDirect3DSurface8 *LPDIRECT3DSURFACE8, *PDIRECT3DSURFACE8;
typedef IDirect3DVertexBuffer8 *LPDIRECT3DVERTEXBUFFER8, *PDIRECT3DVERTEXBUFFER8;

#ifdef __cplusplus
extern "C"
{
#endif
    IDirect3D8 *__stdcall Direct3DCreate8(UINT SDKVersion);
#ifdef __cplusplus
}
#endif
