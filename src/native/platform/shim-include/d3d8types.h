// <d3d8types.h> shim: Direct3D 8 enums, constants and POD structs used by TH06.
// Numeric values follow the real D3D8 SDK so the decompiled engine and our
// WebGL/stub backend agree. No COM interfaces here (see d3d8.h).
#pragma once
#include "windows.h"

typedef DWORD D3DCOLOR;

#define D3DCOLOR_ARGB(a, r, g, b)                                                                                      \
    ((D3DCOLOR)((((a)&0xff) << 24) | (((r)&0xff) << 16) | (((g)&0xff) << 8) | ((b)&0xff)))
#define D3DCOLOR_RGBA(r, g, b, a) D3DCOLOR_ARGB(a, r, g, b)
#define D3DCOLOR_XRGB(r, g, b) D3DCOLOR_ARGB(0xff, r, g, b)

#define D3D_SDK_VERSION 220
#define D3D_OK ((HRESULT)0)
#define D3DERR_DEVICELOST ((HRESULT)0x88760868L)
#define D3DERR_DEVICENOTRESET ((HRESULT)0x88760869L)
#define D3DERR_INVALIDCALL ((HRESULT)0x8876086CL)
#define D3DADAPTER_DEFAULT 0

typedef struct _D3DVECTOR
{
    float x, y, z;
} D3DVECTOR;

typedef struct _D3DCOLORVALUE
{
    float r, g, b, a;
} D3DCOLORVALUE;

typedef struct _D3DMATRIX
{
    union {
        struct
        {
            float _11, _12, _13, _14;
            float _21, _22, _23, _24;
            float _31, _32, _33, _34;
            float _41, _42, _43, _44;
        };
        float m[4][4];
    };
} D3DMATRIX;

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------
typedef enum _D3DFORMAT
{
    D3DFMT_UNKNOWN = 0,
    D3DFMT_R8G8B8 = 20,
    D3DFMT_A8R8G8B8 = 21,
    D3DFMT_X8R8G8B8 = 22,
    D3DFMT_R5G6B5 = 23,
    D3DFMT_X1R5G5B5 = 24,
    D3DFMT_A1R5G5B5 = 25,
    D3DFMT_A4R4G4B4 = 26,
    D3DFMT_A8 = 28,
    D3DFMT_D16 = 80,
    D3DFMT_D24S8 = 75,
    D3DFMT_FORCE_DWORD = 0x7fffffff
} D3DFORMAT;

typedef enum _D3DRESOURCETYPE
{
    D3DRTYPE_SURFACE = 1,
    D3DRTYPE_TEXTURE = 3,
    D3DRTYPE_FORCE_DWORD = 0x7fffffff
} D3DRESOURCETYPE;

typedef enum _D3DDEVTYPE
{
    D3DDEVTYPE_HAL = 1,
    D3DDEVTYPE_REF = 2,
    D3DDEVTYPE_SW = 3,
    D3DDEVTYPE_FORCE_DWORD = 0x7fffffff
} D3DDEVTYPE;

typedef enum _D3DSWAPEFFECT
{
    D3DSWAPEFFECT_DISCARD = 1,
    D3DSWAPEFFECT_FLIP = 2,
    D3DSWAPEFFECT_COPY = 3,
    D3DSWAPEFFECT_COPY_VSYNC = 4,
    D3DSWAPEFFECT_FORCE_DWORD = 0x7fffffff
} D3DSWAPEFFECT;

typedef enum _D3DMULTISAMPLE_TYPE
{
    D3DMULTISAMPLE_NONE = 0,
    D3DMULTISAMPLE_FORCE_DWORD = 0x7fffffff
} D3DMULTISAMPLE_TYPE;

typedef enum _D3DPRIMITIVETYPE
{
    D3DPT_POINTLIST = 1,
    D3DPT_LINELIST = 2,
    D3DPT_LINESTRIP = 3,
    D3DPT_TRIANGLELIST = 4,
    D3DPT_TRIANGLESTRIP = 5,
    D3DPT_TRIANGLEFAN = 6,
    D3DPT_FORCE_DWORD = 0x7fffffff
} D3DPRIMITIVETYPE;

typedef enum _D3DBACKBUFFER_TYPE
{
    D3DBACKBUFFER_TYPE_MONO = 0,
    D3DBACKBUFFER_TYPE_FORCE_DWORD = 0x7fffffff
} D3DBACKBUFFER_TYPE;

typedef enum _D3DPOOL
{
    D3DPOOL_DEFAULT = 0,
    D3DPOOL_MANAGED = 1,
    D3DPOOL_SYSTEMMEM = 2,
    D3DPOOL_SCRATCH = 3,
    D3DPOOL_FORCE_DWORD = 0x7fffffff
} D3DPOOL;

// ---------------------------------------------------------------------------
// Transform / render / texture-stage state enums
// ---------------------------------------------------------------------------
typedef enum _D3DTRANSFORMSTATETYPE
{
    D3DTS_VIEW = 2,
    D3DTS_PROJECTION = 3,
    D3DTS_TEXTURE0 = 16,
    D3DTS_WORLD = 256,
    D3DTS_FORCE_DWORD = 0x7fffffff
} D3DTRANSFORMSTATETYPE;

typedef enum _D3DRENDERSTATETYPE
{
    D3DRS_ZENABLE = 7,
    D3DRS_FILLMODE = 8,
    D3DRS_SHADEMODE = 9,
    D3DRS_ZWRITEENABLE = 14,
    D3DRS_ALPHATESTENABLE = 15,
    D3DRS_SRCBLEND = 19,
    D3DRS_DESTBLEND = 20,
    D3DRS_CULLMODE = 22,
    D3DRS_ZFUNC = 23,
    D3DRS_ALPHAREF = 24,
    D3DRS_ALPHAFUNC = 25,
    D3DRS_ALPHABLENDENABLE = 27,
    D3DRS_FOGENABLE = 28,
    D3DRS_FOGCOLOR = 34,
    D3DRS_FOGTABLEMODE = 35,
    D3DRS_FOGSTART = 36,
    D3DRS_FOGEND = 37,
    D3DRS_FOGDENSITY = 38,
    D3DRS_LIGHTING = 137,
    D3DRS_TEXTUREFACTOR = 60,
    D3DRS_FORCE_DWORD = 0x7fffffff
} D3DRENDERSTATETYPE;

typedef enum _D3DTEXTURESTAGESTATETYPE
{
    D3DTSS_COLOROP = 1,
    D3DTSS_COLORARG1 = 2,
    D3DTSS_COLORARG2 = 3,
    D3DTSS_ALPHAOP = 4,
    D3DTSS_ALPHAARG1 = 5,
    D3DTSS_ALPHAARG2 = 6,
    D3DTSS_ADDRESSU = 13,
    D3DTSS_ADDRESSV = 14,
    D3DTSS_MAGFILTER = 16,
    D3DTSS_MINFILTER = 17,
    D3DTSS_MIPFILTER = 18,
    D3DTSS_ADDRESSW = 25,
    D3DTSS_TEXTURETRANSFORMFLAGS = 24,
    D3DTSS_FORCE_DWORD = 0x7fffffff
} D3DTEXTURESTAGESTATETYPE;

// Texture-op / arg / blend / cmp / cull / shade / fog / filter / address values
#define D3DTOP_DISABLE 1
#define D3DTOP_SELECTARG1 2
#define D3DTOP_MODULATE 4
#define D3DTOP_ADD 7

#define D3DTA_DIFFUSE 0x00000000
#define D3DTA_CURRENT 0x00000001
#define D3DTA_TEXTURE 0x00000002
#define D3DTA_TFACTOR 0x00000003

#define D3DBLEND_ZERO 1
#define D3DBLEND_ONE 2
#define D3DBLEND_SRCALPHA 5
#define D3DBLEND_INVSRCALPHA 6

#define D3DCMP_NEVER 1
#define D3DCMP_LESS 2
#define D3DCMP_LESSEQUAL 4
#define D3DCMP_GREATEREQUAL 7
#define D3DCMP_ALWAYS 8

#define D3DCULL_NONE 1
#define D3DCULL_CW 2
#define D3DCULL_CCW 3

#define D3DSHADE_FLAT 1
#define D3DSHADE_GOURAUD 2

#define D3DFOG_NONE 0
#define D3DFOG_EXP 1
#define D3DFOG_EXP2 2
#define D3DFOG_LINEAR 3

#define D3DTEXF_NONE 0
#define D3DTEXF_POINT 1
#define D3DTEXF_LINEAR 2

#define D3DTADDRESS_WRAP 1
#define D3DTADDRESS_CLAMP 3

// Texture transform flags (D3DTSS_TEXTURETRANSFORMFLAGS)
#define D3DTTFF_DISABLE 0
#define D3DTTFF_COUNT1 1
#define D3DTTFF_COUNT2 2
#define D3DTTFF_COUNT3 3
#define D3DTTFF_COUNT4 4
#define D3DTTFF_PROJECTED 256

#define D3DZB_FALSE 0
#define D3DZB_TRUE 1
#define D3DZB_USEW 2

// ---------------------------------------------------------------------------
// FVF / clear / create / present flags
// ---------------------------------------------------------------------------
#define D3DFVF_XYZ 0x002
#define D3DFVF_XYZRHW 0x004
#define D3DFVF_DIFFUSE 0x040
#define D3DFVF_SPECULAR 0x080
#define D3DFVF_TEX1 0x100

#define D3DCLEAR_TARGET 0x00000001
#define D3DCLEAR_ZBUFFER 0x00000002
#define D3DCLEAR_STENCIL 0x00000004

#define D3DCREATE_FPU_PRESERVE 0x00000002
#define D3DCREATE_SOFTWARE_VERTEXPROCESSING 0x00000020
#define D3DCREATE_HARDWARE_VERTEXPROCESSING 0x00000040

#define D3DPRESENT_INTERVAL_DEFAULT 0x00000000
#define D3DPRESENT_INTERVAL_ONE 0x00000001
#define D3DPRESENT_INTERVAL_IMMEDIATE 0x80000000
#define D3DPRESENTFLAG_LOCKABLE_BACKBUFFER 0x00000001

#define D3DUSAGE_RENDERTARGET 0x00000001
#define D3DUSAGE_DEPTHSTENCIL 0x00000002
#define D3DUSAGE_DYNAMIC 0x00000200

// Lock flags
#define D3DLOCK_READONLY 0x00000010
#define D3DLOCK_DISCARD 0x00002000
#define D3DLOCK_NOOVERWRITE 0x00001000
#define D3DLOCK_NOSYSLOCK 0x00000800
#define D3DLOCK_NO_DIRTY_UPDATE 0x00008000

// Caps bits actually consulted by the engine.
#define D3DTEXOPCAPS_ADD 0x00000040
#define D3DPRASTERCAPS_FOGRANGE 0x00010000
#define D3DPTEXTURECAPS_POW2 0x00000002

// ---------------------------------------------------------------------------
// POD structs
// ---------------------------------------------------------------------------
typedef struct _D3DVIEWPORT8
{
    DWORD X;
    DWORD Y;
    DWORD Width;
    DWORD Height;
    float MinZ;
    float MaxZ;
} D3DVIEWPORT8;

typedef struct _D3DLOCKED_RECT
{
    INT Pitch;
    void *pBits;
} D3DLOCKED_RECT;

typedef struct _D3DDISPLAYMODE
{
    UINT Width;
    UINT Height;
    UINT RefreshRate;
    D3DFORMAT Format;
} D3DDISPLAYMODE;

typedef struct _D3DSURFACE_DESC
{
    D3DFORMAT Format;
    D3DRESOURCETYPE Type;
    DWORD Usage;
    D3DPOOL Pool;
    UINT Size;
    D3DMULTISAMPLE_TYPE MultiSampleType;
    UINT Width;
    UINT Height;
} D3DSURFACE_DESC;

typedef struct _D3DPRESENT_PARAMETERS_
{
    UINT BackBufferWidth;
    UINT BackBufferHeight;
    D3DFORMAT BackBufferFormat;
    UINT BackBufferCount;
    D3DMULTISAMPLE_TYPE MultiSampleType;
    D3DSWAPEFFECT SwapEffect;
    HWND hDeviceWindow;
    BOOL Windowed;
    BOOL EnableAutoDepthStencil;
    D3DFORMAT AutoDepthStencilFormat;
    DWORD Flags;
    UINT FullScreen_RefreshRateInHz;
    UINT FullScreen_PresentationInterval;
} D3DPRESENT_PARAMETERS;

typedef struct _D3DCAPS8
{
    D3DDEVTYPE DeviceType;
    UINT AdapterOrdinal;
    DWORD Caps;
    DWORD Caps2;
    DWORD Caps3;
    DWORD PresentationIntervals;
    DWORD DevCaps;
    DWORD PrimitiveMiscCaps;
    DWORD RasterCaps;
    DWORD ZCmpCaps;
    DWORD SrcBlendCaps;
    DWORD DestBlendCaps;
    DWORD AlphaCmpCaps;
    DWORD ShadeCaps;
    DWORD TextureCaps;
    DWORD TextureFilterCaps;
    DWORD TextureAddressCaps;
    DWORD TextureOpCaps;
    DWORD MaxTextureWidth;
    DWORD MaxTextureHeight;
    DWORD MaxTextureBlendStages;
    DWORD MaxSimultaneousTextures;
    DWORD MaxActiveLights;
    float MaxVertexW;
    DWORD MaxPrimitiveCount;
    DWORD MaxStreams;
} D3DCAPS8;
