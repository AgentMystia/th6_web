// <d3dx8.h> shim: the D3DX8 texture/surface/font helpers TH06 uses.
// Implementations live in the platform backend (texture decode → GL upload,
// surface blits, GDI-style font → canvas/atlas). Declarations only here.
#pragma once
#include "d3d8.h"
#include "d3dx8math.h"

// D3DX_DEFAULT / D3DX_FILTER_* and D3DXIMAGE_INFO are defined in d3dx8math.h
// (included above) so headers that only
// pull in <d3dx8math.h> (e.g. AnmManager.hpp) still see it.

struct ID3DXFont : public IUnknown
{
    virtual HRESULT __stdcall GetDevice(IDirect3DDevice8 **ppDevice) = 0;
    virtual HRESULT __stdcall Begin() = 0;
    virtual INT __stdcall DrawTextA(const char *pString, INT Count, RECT *pRect, DWORD Format, D3DCOLOR Color) = 0;
    virtual HRESULT __stdcall End() = 0;
    virtual HRESULT __stdcall OnLostDevice() = 0;
    virtual HRESULT __stdcall OnResetDevice() = 0;
};
typedef ID3DXFont *LPD3DXFONT;

#ifdef __cplusplus
extern "C"
{
#endif

    HRESULT D3DXCreateFont(IDirect3DDevice8 *pDevice, HFONT hFont, LPD3DXFONT *ppFont);
    HRESULT D3DXCreateFontIndirect(IDirect3DDevice8 *pDevice, const LOGFONTA *pLogFont, LPD3DXFONT *ppFont);

#ifdef __cplusplus
}
#endif

// Texture/surface helpers are declared in d3dx8math.h (included above).

// ANSI alias: the engine calls ID3DXFont::DrawText(...) which maps to DrawTextA.
#define DrawText DrawTextA
