// <d3dx8math.h> shim: D3DX8 vector/matrix types and the math helpers TH06 uses.
// Fully implemented inline (pure math, no device dependency).
#pragma once
#include "d3d8.h"
#include <math.h>

typedef struct _D3DXIMAGE_INFO
{
    UINT Width;
    UINT Height;
    UINT Depth;
    UINT MipLevels;
    D3DFORMAT Format;
    D3DRESOURCETYPE ResourceType;
    DWORD ImageFileFormat;
} D3DXIMAGE_INFO;

#define D3DX_DEFAULT ((UINT)-1)
#define D3DX_FILTER_NONE 0x00000001
#define D3DX_FILTER_POINT 0x00000002
#define D3DX_FILTER_LINEAR 0x00000003
#define D3DX_FILTER_TRIANGLE 0x00000004

#define D3DX_PI 3.14159265358979323846f
#define D3DXToRadian(degree) ((degree) * (D3DX_PI / 180.0f))
#define D3DXToDegree(radian) ((radian) * (180.0f / D3DX_PI))

// ---------------------------------------------------------------------------
// Vectors (layout-compatible with the engine's ZunVec2/ZunVec3 via reinterpret)
// ---------------------------------------------------------------------------
struct D3DXVECTOR2
{
    float x, y;
    D3DXVECTOR2()
    {
    }
    D3DXVECTOR2(float fx, float fy) : x(fx), y(fy)
    {
    }
    operator float *()
    {
        return &x;
    }
    operator const float *() const
    {
        return &x;
    }
};

struct D3DXVECTOR3 : public D3DVECTOR
{
    D3DXVECTOR3()
    {
    }
    D3DXVECTOR3(float fx, float fy, float fz)
    {
        x = fx;
        y = fy;
        z = fz;
    }
    D3DXVECTOR3(const D3DVECTOR &v)
    {
        x = v.x;
        y = v.y;
        z = v.z;
    }
    operator float *()
    {
        return &x;
    }
    operator const float *() const
    {
        return &x;
    }
    D3DXVECTOR3 operator+(const D3DXVECTOR3 &v) const
    {
        return D3DXVECTOR3(x + v.x, y + v.y, z + v.z);
    }
    D3DXVECTOR3 operator-(const D3DXVECTOR3 &v) const
    {
        return D3DXVECTOR3(x - v.x, y - v.y, z - v.z);
    }
    D3DXVECTOR3 operator*(float s) const
    {
        return D3DXVECTOR3(x * s, y * s, z * s);
    }
    D3DXVECTOR3 operator/(float s) const
    {
        return D3DXVECTOR3(x / s, y / s, z / s);
    }
    D3DXVECTOR3 operator-() const
    {
        return D3DXVECTOR3(-x, -y, -z);
    }
    D3DXVECTOR3 operator+() const
    {
        return *this;
    }
    D3DXVECTOR3 &operator+=(const D3DXVECTOR3 &v)
    {
        x += v.x;
        y += v.y;
        z += v.z;
        return *this;
    }
    D3DXVECTOR3 &operator-=(const D3DXVECTOR3 &v)
    {
        x -= v.x;
        y -= v.y;
        z -= v.z;
        return *this;
    }
    D3DXVECTOR3 &operator*=(float s)
    {
        x *= s;
        y *= s;
        z *= s;
        return *this;
    }
    D3DXVECTOR3 &operator/=(float s)
    {
        x /= s;
        y /= s;
        z /= s;
        return *this;
    }
};

inline D3DXVECTOR3 operator*(float s, const D3DXVECTOR3 &v)
{
    return D3DXVECTOR3(v.x * s, v.y * s, v.z * s);
}

struct D3DXVECTOR4
{
    float x, y, z, w;
    D3DXVECTOR4()
    {
    }
    D3DXVECTOR4(float fx, float fy, float fz, float fw) : x(fx), y(fy), z(fz), w(fw)
    {
    }
    operator float *()
    {
        return &x;
    }
};

struct D3DXQUATERNION
{
    float x, y, z, w;
    D3DXQUATERNION()
    {
    }
    D3DXQUATERNION(float fx, float fy, float fz, float fw) : x(fx), y(fy), z(fz), w(fw)
    {
    }
};

struct D3DXMATRIX : public D3DMATRIX
{
    D3DXMATRIX()
    {
    }
    D3DXMATRIX(const D3DMATRIX &mat)
    {
        *(D3DMATRIX *)this = mat;
    }
    float &operator()(int r, int c)
    {
        return m[r][c];
    }
    float operator()(int r, int c) const
    {
        return m[r][c];
    }
    operator float *()
    {
        return &_11;
    }
    D3DXMATRIX operator-() const
    {
        D3DXMATRIX r;
        for (int i = 0; i < 4; i++)
            for (int j = 0; j < 4; j++)
                r.m[i][j] = -m[i][j];
        return r;
    }
    D3DXMATRIX operator*(const D3DXMATRIX &o) const
    {
        D3DXMATRIX r;
        for (int i = 0; i < 4; i++)
            for (int j = 0; j < 4; j++)
                r.m[i][j] = m[i][0] * o.m[0][j] + m[i][1] * o.m[1][j] + m[i][2] * o.m[2][j] + m[i][3] * o.m[3][j];
        return r;
    }
    D3DXMATRIX &operator*=(const D3DXMATRIX &o)
    {
        *this = *this * o;
        return *this;
    }
};

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------
inline float D3DXVec3LengthSq(const D3DXVECTOR3 *v)
{
    return v->x * v->x + v->y * v->y + v->z * v->z;
}

inline float D3DXVec3Length(const D3DXVECTOR3 *v)
{
    return sqrtf(D3DXVec3LengthSq(v));
}

inline D3DXVECTOR3 *D3DXVec3Normalize(D3DXVECTOR3 *out, const D3DXVECTOR3 *v)
{
    float len = D3DXVec3Length(v);
    if (len > 0.0f)
    {
        float inv = 1.0f / len;
        out->x = v->x * inv;
        out->y = v->y * inv;
        out->z = v->z * inv;
    }
    else
    {
        out->x = out->y = out->z = 0.0f;
    }
    return out;
}

inline D3DXVECTOR3 *D3DXVec3TransformCoord(D3DXVECTOR3 *out, const D3DXVECTOR3 *v, const D3DXMATRIX *mat)
{
    float x = v->x * mat->m[0][0] + v->y * mat->m[1][0] + v->z * mat->m[2][0] + mat->m[3][0];
    float y = v->x * mat->m[0][1] + v->y * mat->m[1][1] + v->z * mat->m[2][1] + mat->m[3][1];
    float z = v->x * mat->m[0][2] + v->y * mat->m[1][2] + v->z * mat->m[2][2] + mat->m[3][2];
    float w = v->x * mat->m[0][3] + v->y * mat->m[1][3] + v->z * mat->m[2][3] + mat->m[3][3];
    float inv = (w != 0.0f) ? 1.0f / w : 1.0f;
    out->x = x * inv;
    out->y = y * inv;
    out->z = z * inv;
    return out;
}

// ---------------------------------------------------------------------------
// Matrix helpers
// ---------------------------------------------------------------------------
inline D3DXMATRIX *D3DXMatrixIdentity(D3DXMATRIX *out)
{
    for (int r = 0; r < 4; r++)
        for (int c = 0; c < 4; c++)
            out->m[r][c] = (r == c) ? 1.0f : 0.0f;
    return out;
}

inline D3DXMATRIX *D3DXMatrixMultiply(D3DXMATRIX *out, const D3DXMATRIX *a, const D3DXMATRIX *b)
{
    D3DXMATRIX r;
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 4; j++)
            r.m[i][j] = a->m[i][0] * b->m[0][j] + a->m[i][1] * b->m[1][j] + a->m[i][2] * b->m[2][j] +
                        a->m[i][3] * b->m[3][j];
    *out = r;
    return out;
}

inline D3DXMATRIX *D3DXMatrixPerspectiveFovLH(D3DXMATRIX *out, float fovy, float aspect, float zn, float zf)
{
    float yScale = 1.0f / tanf(fovy / 2.0f);
    float xScale = yScale / aspect;
    D3DXMatrixIdentity(out);
    out->m[0][0] = xScale;
    out->m[1][1] = yScale;
    out->m[2][2] = zf / (zf - zn);
    out->m[2][3] = 1.0f;
    out->m[3][2] = -zn * zf / (zf - zn);
    out->m[3][3] = 0.0f;
    return out;
}

inline D3DXMATRIX *D3DXMatrixLookAtLH(D3DXMATRIX *out, const D3DXVECTOR3 *eye, const D3DXVECTOR3 *at,
                                      const D3DXVECTOR3 *up)
{
    D3DXVECTOR3 zaxis, xaxis, yaxis;
    D3DXVECTOR3 dir(at->x - eye->x, at->y - eye->y, at->z - eye->z);
    D3DXVec3Normalize(&zaxis, &dir);
    // xaxis = normalize(cross(up, zaxis))
    D3DXVECTOR3 cx(up->y * zaxis.z - up->z * zaxis.y, up->z * zaxis.x - up->x * zaxis.z,
                   up->x * zaxis.y - up->y * zaxis.x);
    D3DXVec3Normalize(&xaxis, &cx);
    // yaxis = cross(zaxis, xaxis)
    yaxis = D3DXVECTOR3(zaxis.y * xaxis.z - zaxis.z * xaxis.y, zaxis.z * xaxis.x - zaxis.x * xaxis.z,
                        zaxis.x * xaxis.y - zaxis.y * xaxis.x);
    D3DXMatrixIdentity(out);
    out->m[0][0] = xaxis.x;
    out->m[1][0] = xaxis.y;
    out->m[2][0] = xaxis.z;
    out->m[0][1] = yaxis.x;
    out->m[1][1] = yaxis.y;
    out->m[2][1] = yaxis.z;
    out->m[0][2] = zaxis.x;
    out->m[1][2] = zaxis.y;
    out->m[2][2] = zaxis.z;
    out->m[3][0] = -(xaxis.x * eye->x + xaxis.y * eye->y + xaxis.z * eye->z);
    out->m[3][1] = -(yaxis.x * eye->x + yaxis.y * eye->y + yaxis.z * eye->z);
    out->m[3][2] = -(zaxis.x * eye->x + zaxis.y * eye->y + zaxis.z * eye->z);
    return out;
}

inline D3DXMATRIX *D3DXMatrixRotationX(D3DXMATRIX *out, float angle)
{
    float s = sinf(angle), c = cosf(angle);
    D3DXMatrixIdentity(out);
    out->m[1][1] = c;
    out->m[1][2] = s;
    out->m[2][1] = -s;
    out->m[2][2] = c;
    return out;
}

inline D3DXMATRIX *D3DXMatrixRotationY(D3DXMATRIX *out, float angle)
{
    float s = sinf(angle), c = cosf(angle);
    D3DXMatrixIdentity(out);
    out->m[0][0] = c;
    out->m[0][2] = -s;
    out->m[2][0] = s;
    out->m[2][2] = c;
    return out;
}

inline D3DXMATRIX *D3DXMatrixRotationZ(D3DXMATRIX *out, float angle)
{
    float s = sinf(angle), c = cosf(angle);
    D3DXMatrixIdentity(out);
    out->m[0][0] = c;
    out->m[0][1] = s;
    out->m[1][0] = -s;
    out->m[1][1] = c;
    return out;
}

inline D3DXMATRIX *D3DXMatrixRotationQuaternion(D3DXMATRIX *out, const D3DXQUATERNION *q)
{
    float xx = q->x * q->x, yy = q->y * q->y, zz = q->z * q->z;
    float xy = q->x * q->y, xz = q->x * q->z, yz = q->y * q->z;
    float wx = q->w * q->x, wy = q->w * q->y, wz = q->w * q->z;
    D3DXMatrixIdentity(out);
    out->m[0][0] = 1.0f - 2.0f * (yy + zz);
    out->m[0][1] = 2.0f * (xy + wz);
    out->m[0][2] = 2.0f * (xz - wy);
    out->m[1][0] = 2.0f * (xy - wz);
    out->m[1][1] = 1.0f - 2.0f * (xx + zz);
    out->m[1][2] = 2.0f * (yz + wx);
    out->m[2][0] = 2.0f * (xz + wy);
    out->m[2][1] = 2.0f * (yz - wx);
    out->m[2][2] = 1.0f - 2.0f * (xx + yy);
    return out;
}

// Project a point from object space to screen space (world * view * proj + viewport).
inline D3DXVECTOR3 *D3DXVec3Project(D3DXVECTOR3 *out, const D3DXVECTOR3 *v, const D3DVIEWPORT8 *viewport,
                                    const D3DXMATRIX *projection, const D3DXMATRIX *view, const D3DXMATRIX *world)
{
    D3DXMATRIX clip = *world;
    if (view)
        D3DXMatrixMultiply(&clip, &clip, view);
    if (projection)
        D3DXMatrixMultiply(&clip, &clip, projection);
    D3DXVECTOR3 t;
    D3DXVec3TransformCoord(&t, v, &clip);
    out->x = viewport->X + (1.0f + t.x) * 0.5f * viewport->Width;
    out->y = viewport->Y + (1.0f - t.y) * 0.5f * viewport->Height;
    out->z = viewport->MinZ + t.z * (viewport->MaxZ - viewport->MinZ);
    return out;
}

// ---------------------------------------------------------------------------
// Texture / surface helpers (impl in the platform backend: decode → GL upload,
// surface blits). Declared here so headers including only <d3dx8math.h> see them.
// ---------------------------------------------------------------------------
#ifdef __cplusplus
extern "C"
{
#endif
    HRESULT D3DXCreateTexture(IDirect3DDevice8 *pDevice, UINT Width, UINT Height, UINT MipLevels, DWORD Usage,
                              D3DFORMAT Format, D3DPOOL Pool, IDirect3DTexture8 **ppTexture);

    HRESULT D3DXCreateTextureFromFileInMemoryEx(IDirect3DDevice8 *pDevice, const void *pSrcData, UINT SrcDataSize,
                                                UINT Width, UINT Height, UINT MipLevels, DWORD Usage, D3DFORMAT Format,
                                                D3DPOOL Pool, DWORD Filter, DWORD MipFilter, D3DCOLOR ColorKey,
                                                D3DXIMAGE_INFO *pSrcInfo, PALETTEENTRY *pPalette,
                                                IDirect3DTexture8 **ppTexture);

    HRESULT D3DXLoadSurfaceFromSurface(IDirect3DSurface8 *pDestSurface, const PALETTEENTRY *pDestPalette,
                                       const RECT *pDestRect, IDirect3DSurface8 *pSrcSurface,
                                       const PALETTEENTRY *pSrcPalette, const RECT *pSrcRect, DWORD Filter,
                                       D3DCOLOR ColorKey);

    HRESULT D3DXLoadSurfaceFromFileInMemory(IDirect3DSurface8 *pDestSurface, const PALETTEENTRY *pDestPalette,
                                            const RECT *pDestRect, const void *pSrcData, UINT SrcDataSize,
                                            const RECT *pSrcRect, DWORD Filter, D3DCOLOR ColorKey,
                                            D3DXIMAGE_INFO *pSrcInfo);
#ifdef __cplusplus
}
#endif
