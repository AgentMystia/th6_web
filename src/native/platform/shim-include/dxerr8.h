// <dxerr8.h> shim: DirectX 8 error-string helper (used only for logging).
#pragma once
#include "windows.h"

#ifdef __cplusplus
extern "C"
{
#endif
    const char *DXGetErrorString8A(HRESULT hr);
    const char *DXGetErrorDescription8A(HRESULT hr);
#ifdef __cplusplus
}
#endif

#define DXGetErrorString8 DXGetErrorString8A
#define DXGetErrorDescription8 DXGetErrorDescription8A

// DXTRACE_ERR family (release builds just evaluate to the HRESULT).
#define DXTRACE_ERR(str, hr) (hr)
#define DXTRACE_ERR_MSGBOX(str, hr) (hr)
#define DXTRACE_ERR_NOMSGBOX(str, hr) (hr)
