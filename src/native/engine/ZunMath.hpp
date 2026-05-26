#pragma once
#include "diffbuild.hpp"
#include "inttypes.hpp"
#include <Windows.h>
#include <d3dx8math.h>
#include <math.h>

struct ZunVec2
{
    f32 x;
    f32 y;

    f32 VectorLength()
    {
        return sqrt(this->x * this->x + this->y * this->y);
    }

    f64 VectorLengthF64()
    {
        return (f64)this->VectorLength();
    }

    D3DXVECTOR2 *AsD3dXVec()
    {
        return (D3DXVECTOR2 *)this;
    }
};
ZUN_ASSERT_SIZE(ZunVec2, 0x8);

struct ZunVec3
{
    f32 x;
    f32 y;
    f32 z;

    D3DXVECTOR3 *AsD3dXVec()
    {
        return (D3DXVECTOR3 *)this;
    }

    static void SetVecCorners(ZunVec3 *topLeftCorner, ZunVec3 *bottomRightCorner, const D3DXVECTOR3 *centerPosition,
                              const D3DXVECTOR3 *size)
    {
        topLeftCorner->x = centerPosition->x - size->x / 2.0f;
        topLeftCorner->y = centerPosition->y - size->y / 2.0f;
        bottomRightCorner->x = size->x / 2.0f + centerPosition->x;
        bottomRightCorner->y = size->y / 2.0f + centerPosition->y;
    }
};
ZUN_ASSERT_SIZE(ZunVec3, 0xC);

#define ZUN_MIN(x, y) ((x) > (y) ? (y) : (x))
#define ZUN_PI ((f32)(3.14159265358979323846))
#define ZUN_2PI ((f32)(ZUN_PI * 2.0f))

#define RADIANS(degrees) ((degrees * ZUN_PI / 180.0f))

// WASM/clang port: the original used x87 `fsincos`/`frndint` inline assembly to
// byte-match the game. We replace those with standard math. To stay as close as
// possible to the original 80-bit x87 results, the trigonometric helpers compute
// in f64 (closer to 80-bit than f32) and round back to f32. `rintf` uses
// round-half-to-even (the x87 default rounding mode), matching `frndint`.
#define sincos(in, out_sine, out_cosine)                                                                               \
    do                                                                                                                 \
    {                                                                                                                  \
        f64 _zun_sc_in = (f64)(in);                                                                                    \
        (out_cosine) = (f32)cos(_zun_sc_in);                                                                           \
        (out_sine) = (f32)sin(_zun_sc_in);                                                                             \
    } while (0)

void __inline fsincos_wrapper(f32 *out_sine, f32 *out_cosine, f32 angle)
{
    f64 a = (f64)angle;
    *out_cosine = (f32)cos(a);
    *out_sine = (f32)sin(a);
}

void __inline sincosmul(D3DXVECTOR3 *out_vel, f32 input, f32 multiplier)
{
    f64 a = (f64)input;
    f64 m = (f64)multiplier;
    out_vel->x = (f32)(cos(a) * m);
    out_vel->y = (f32)(sin(a) * m);
}

f32 __inline invertf(f32 x)
{
    return 1.f / x;
}

f32 __inline rintf(f32 float_in)
{
    return (f32)__builtin_rintf(float_in);
}
