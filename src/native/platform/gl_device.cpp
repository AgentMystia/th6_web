// WebGL2-backed Direct3D 8 device for the TH06 WASM port.
//
// Replaces the stub D3D8 device with a real renderer that reproduces TH06's
// fixed-function pipeline: textured/colored quads (DrawPrimitiveUP), the stage-0
// texture combiner (COLOROP/ALPHAOP × TEXTURE/DIFFUSE/TFACTOR), alpha blending,
// alpha test, depth, and both pre-transformed (XYZRHW, 2D) and transformed
// (XYZ, 3D backgrounds) vertex paths. Textures decode via libpng; their CPU
// shadow keeps the original D3DFORMAT byte layout (so the engine's LockRect
// pixel manipulation stays correct and the original 16-bit colour banding is
// preserved), and upload as RGBA8 to GL.
#include <GLES3/gl3.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <emscripten/html5.h>
#include <emscripten/html5_webgl.h>
extern "C" {
#include <jpeglib.h>
}
#include <png.h>
#include <vector>

#include <d3d8.h>
#include <d3dx8.h>

// ===========================================================================
// GL context + shader program
// ===========================================================================
namespace
{

EMSCRIPTEN_WEBGL_CONTEXT_HANDLE g_glCtx = 0;
GLuint g_program = 0;
GLuint g_vbo = 0, g_vao = 0;

// Uniform locations
GLint u_mode, u_viewport, u_viewportOfs, u_mvp, u_useTexture, u_tex, u_tfactor;
GLint u_colorOp, u_colorArg1, u_colorArg2, u_alphaOp, u_alphaArg1, u_alphaArg2;
GLint u_alphaTest, u_alphaFunc, u_alphaRef;
GLint u_mv, u_fogEnable, u_fogColor, u_fogStart, u_fogEnd;
GLint u_texMatrix, u_texTransform;

const char *kVertexShader = R"(#version 300 es
precision highp float;
layout(location=0) in vec4 aPos;
layout(location=1) in vec4 aColor;
layout(location=2) in vec2 aUV;
uniform int uMode;          // 0 = XYZRHW (2D pretransformed), 1 = XYZ (3D)
uniform vec2 uViewport;     // viewport width, height
uniform vec2 uViewportOfs;  // viewport X, Y offset (XYZRHW is screen-space!)
uniform mat4 uMVP;          // world*view*proj
uniform mat4 uMV;           // world*view (for fog eye-space Z)
uniform int uFogEnable;
uniform float uFogStart, uFogEnd;
uniform mat4 uTexMatrix;
uniform int uTexTransform;
out vec4 vColor;
out vec2 vUV;
out float vEyeZ;
void main(){
  vColor = aColor.bgra;     // D3DCOLOR BGRA in memory -> RGBA
  if (uMode == 0) {
    vUV = aUV;
    float x = ((aPos.x - uViewportOfs.x) / uViewport.x) * 2.0 - 1.0;
    float y = 1.0 - ((aPos.y - uViewportOfs.y) / uViewport.y) * 2.0;
    float z = aPos.z * 2.0 - 1.0;
    gl_Position = vec4(x, y, z, 1.0);
    vEyeZ = 0.0;            // no fog for 2D
  } else {
    vUV = uTexTransform != 0 ? (uTexMatrix * vec4(aUV, 1.0, 1.0)).xy : aUV;
    gl_Position = uMVP * vec4(aPos.xyz, 1.0);
    if (uFogEnable != 0) {
      vEyeZ = abs((uMV * vec4(aPos.xyz, 1.0)).z);
    } else {
      vEyeZ = -1.0;         // negative signals "fog off"
    }
  }
}
)";

const char *kFragmentShader = R"(#version 300 es
precision highp float;
precision highp int;
in vec4 vColor;
in vec2 vUV;
in float vEyeZ;
uniform sampler2D uTex;
uniform int uUseTexture;
uniform vec4 uTFactor;
uniform int uColorOp, uColorArg1, uColorArg2;
uniform int uAlphaOp, uAlphaArg1, uAlphaArg2;
uniform int uAlphaTest, uAlphaFunc;
uniform float uAlphaRef;
uniform int uFogEnable;
uniform vec4 uFogColor;
uniform float uFogStart, uFogEnd;
out vec4 fragColor;

vec4 pickArg(int a, vec4 tex){
  if (a == 2) return tex;
  if (a == 3) return uTFactor;
  return vColor;
}
float combine1(int op, float a1, float a2){
  if (op == 2) return a1;
  if (op == 7) return a1 + a2;
  return a1 * a2;
}
void main(){
  vec4 tex = uUseTexture != 0 ? texture(uTex, vUV) : vec4(1.0);
  vec4 c1 = pickArg(uColorArg1, tex), c2 = pickArg(uColorArg2, tex);
  vec4 a1 = pickArg(uAlphaArg1, tex), a2 = pickArg(uAlphaArg2, tex);
  vec3 rgb = vec3(combine1(uColorOp, c1.r, c2.r), combine1(uColorOp, c1.g, c2.g), combine1(uColorOp, c1.b, c2.b));
  float a = combine1(uAlphaOp, a1.a, a2.a);
  vec4 col = vec4(rgb, a);
  // D3D table fog (per-pixel): compute fog factor from interpolated eye-space Z.
  if (uFogEnable != 0 && vEyeZ >= 0.0) {
    float fogFactor = clamp((uFogEnd - vEyeZ) / (uFogEnd - uFogStart + 0.0001), 0.0, 1.0);
    col.rgb = mix(uFogColor.rgb, col.rgb, fogFactor);
  }
  if (uAlphaTest != 0) {
    bool pass = uAlphaFunc == 8 || (uAlphaFunc == 7 ? col.a >= uAlphaRef
               : uAlphaFunc == 4 ? col.a <= uAlphaRef : col.a > uAlphaRef);
    if (!pass) discard;
  }
  fragColor = col;
}
)";

GLuint compileShader(GLenum type, const char *src)
{
    GLuint s = glCreateShader(type);
    glShaderSource(s, 1, &src, nullptr);
    glCompileShader(s);
    GLint ok = 0;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok)
    {
        char log[1024];
        glGetShaderInfoLog(s, sizeof(log), nullptr, log);
        fprintf(stderr, "[gl] shader compile error: %s\n", log);
    }
    return s;
}

void initGlProgram()
{
    GLuint vs = compileShader(GL_VERTEX_SHADER, kVertexShader);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, kFragmentShader);
    g_program = glCreateProgram();
    glAttachShader(g_program, vs);
    glAttachShader(g_program, fs);
    glLinkProgram(g_program);
    GLint linkOk = 0;
    glGetProgramiv(g_program, GL_LINK_STATUS, &linkOk);
    if (!linkOk)
    {
        char log[2048];
        glGetProgramInfoLog(g_program, sizeof(log), nullptr, log);
        fprintf(stderr, "[gl] program link error: %s\n", log);
    }
    glUseProgram(g_program);
    u_mode = glGetUniformLocation(g_program, "uMode");
    u_viewport = glGetUniformLocation(g_program, "uViewport");
    u_viewportOfs = glGetUniformLocation(g_program, "uViewportOfs");
    u_mvp = glGetUniformLocation(g_program, "uMVP");
    u_useTexture = glGetUniformLocation(g_program, "uUseTexture");
    u_tex = glGetUniformLocation(g_program, "uTex");
    u_tfactor = glGetUniformLocation(g_program, "uTFactor");
    u_colorOp = glGetUniformLocation(g_program, "uColorOp");
    u_colorArg1 = glGetUniformLocation(g_program, "uColorArg1");
    u_colorArg2 = glGetUniformLocation(g_program, "uColorArg2");
    u_alphaOp = glGetUniformLocation(g_program, "uAlphaOp");
    u_alphaArg1 = glGetUniformLocation(g_program, "uAlphaArg1");
    u_alphaArg2 = glGetUniformLocation(g_program, "uAlphaArg2");
    u_alphaTest = glGetUniformLocation(g_program, "uAlphaTest");
    u_alphaFunc = glGetUniformLocation(g_program, "uAlphaFunc");
    u_alphaRef = glGetUniformLocation(g_program, "uAlphaRef");
    u_mv = glGetUniformLocation(g_program, "uMV");
    u_fogEnable = glGetUniformLocation(g_program, "uFogEnable");
    u_fogColor = glGetUniformLocation(g_program, "uFogColor");
    u_fogStart = glGetUniformLocation(g_program, "uFogStart");
    u_fogEnd = glGetUniformLocation(g_program, "uFogEnd");
    u_texMatrix = glGetUniformLocation(g_program, "uTexMatrix");
    u_texTransform = glGetUniformLocation(g_program, "uTexTransform");
    glUniform1i(u_tex, 0);
    glGenVertexArrays(1, &g_vao);
    glBindVertexArray(g_vao);
    glGenBuffers(1, &g_vbo);
}

void ensureGlContext()
{
    if (g_glCtx)
        return;
    EmscriptenWebGLContextAttributes attr;
    emscripten_webgl_init_context_attributes(&attr);
    attr.majorVersion = 2;
    attr.minorVersion = 0;
    attr.alpha = false;
    attr.depth = true;
    attr.stencil = false;
    attr.antialias = false;
    attr.premultipliedAlpha = false;
    attr.preserveDrawingBuffer = false;
    attr.powerPreference = EM_WEBGL_POWER_PREFERENCE_HIGH_PERFORMANCE;
    g_glCtx = emscripten_webgl_create_context("#canvas", &attr);
    if (g_glCtx <= 0)
    {
        fprintf(stderr, "[gl] failed to create WebGL2 context (handle=%d)\n", (int)g_glCtx);
        return;
    }
    emscripten_webgl_make_context_current(g_glCtx);
    initGlProgram();
    glDisable(GL_CULL_FACE);
    fprintf(stderr, "[gl] WebGL2 context ready\n");
}

// ===========================================================================
// Format conversion: native D3DFORMAT shadow <-> RGBA8 (GL)
// ===========================================================================
int formatBytes(D3DFORMAT f)
{
    switch (f)
    {
    case D3DFMT_A8R8G8B8:
    case D3DFMT_X8R8G8B8:
        return 4;
    case D3DFMT_R8G8B8:
        return 3;
    case D3DFMT_A1R5G5B5:
    case D3DFMT_X1R5G5B5:
    case D3DFMT_A4R4G4B4:
    case D3DFMT_R5G6B5:
        return 2;
    default:
        return 4;
    }
}

// Convert one row of native-format pixels to RGBA8.
void nativeToRGBA8(D3DFORMAT f, const uint8_t *src, uint8_t *dst, int count)
{
    for (int i = 0; i < count; i++)
    {
        uint8_t r, g, b, a;
        switch (f)
        {
        case D3DFMT_A8R8G8B8:
        case D3DFMT_X8R8G8B8:
        {
            b = src[i * 4 + 0]; g = src[i * 4 + 1]; r = src[i * 4 + 2];
            a = (f == D3DFMT_X8R8G8B8) ? 255 : src[i * 4 + 3];
            break;
        }
        case D3DFMT_R8G8B8:
        {
            b = src[i * 3 + 0]; g = src[i * 3 + 1]; r = src[i * 3 + 2]; a = 255;
            break;
        }
        case D3DFMT_A1R5G5B5:
        case D3DFMT_X1R5G5B5:
        {
            uint16_t p = ((const uint16_t *)src)[i];
            a = (f == D3DFMT_X1R5G5B5) ? 255 : ((p & 0x8000) ? 255 : 0);
            r = ((p >> 10) & 0x1F) * 255 / 31;
            g = ((p >> 5) & 0x1F) * 255 / 31;
            b = (p & 0x1F) * 255 / 31;
            break;
        }
        case D3DFMT_A4R4G4B4:
        {
            uint16_t p = ((const uint16_t *)src)[i];
            a = ((p >> 12) & 0xF) * 255 / 15;
            r = ((p >> 8) & 0xF) * 255 / 15;
            g = ((p >> 4) & 0xF) * 255 / 15;
            b = (p & 0xF) * 255 / 15;
            break;
        }
        case D3DFMT_R5G6B5:
        {
            uint16_t p = ((const uint16_t *)src)[i];
            a = 255;
            r = ((p >> 11) & 0x1F) * 255 / 31;
            g = ((p >> 5) & 0x3F) * 255 / 63;
            b = (p & 0x1F) * 255 / 31;
            break;
        }
        default:
            r = g = b = a = 255;
            break;
        }
        dst[i * 4 + 0] = r; dst[i * 4 + 1] = g; dst[i * 4 + 2] = b; dst[i * 4 + 3] = a;
    }
}

// Convert RGBA8 to native format (for storing decoded PNG into the shadow).
void rgba8ToNative(D3DFORMAT f, const uint8_t *src, uint8_t *dst, int count)
{
    for (int i = 0; i < count; i++)
    {
        uint8_t r = src[i * 4 + 0], g = src[i * 4 + 1], b = src[i * 4 + 2], a = src[i * 4 + 3];
        switch (f)
        {
        case D3DFMT_A8R8G8B8:
        case D3DFMT_X8R8G8B8:
            dst[i * 4 + 0] = b; dst[i * 4 + 1] = g; dst[i * 4 + 2] = r;
            dst[i * 4 + 3] = (f == D3DFMT_X8R8G8B8) ? 255 : a;
            break;
        case D3DFMT_R8G8B8:
            dst[i * 3 + 0] = b; dst[i * 3 + 1] = g; dst[i * 3 + 2] = r;
            break;
        case D3DFMT_A1R5G5B5:
        case D3DFMT_X1R5G5B5:
            ((uint16_t *)dst)[i] = (uint16_t)(((f == D3DFMT_X1R5G5B5 || a >= 128) ? 0x8000 : 0) |
                                              ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
            break;
        case D3DFMT_A4R4G4B4:
            ((uint16_t *)dst)[i] =
                (uint16_t)(((a >> 4) << 12) | ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
            break;
        case D3DFMT_R5G6B5:
            ((uint16_t *)dst)[i] = (uint16_t)(((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3));
            break;
        default:
            break;
        }
    }
}

// ===========================================================================
// Texture / surface objects
// ===========================================================================
struct GLTexture;

struct GLSurface : IDirect3DSurface8
{
    GLTexture *owner; // non-owning back-ref (level 0)
    UINT w, h;
    D3DFORMAT fmt;
    ULONG rc = 1;
    GLSurface(GLTexture *o, UINT W, UINT H, D3DFORMAT F) : owner(o), w(W), h(H), fmt(F) {}
    HRESULT __stdcall QueryInterface(REFIID, void **pp) override { if (pp) *pp = this; return S_OK; }
    ULONG __stdcall AddRef() override { return ++rc; }
    ULONG __stdcall Release() override { return --rc ? rc : (rc); } // surfaces are owned by texture
    HRESULT __stdcall GetDesc(D3DSURFACE_DESC *d) override;
    HRESULT __stdcall LockRect(D3DLOCKED_RECT *lr, const RECT *, DWORD) override;
    HRESULT __stdcall UnlockRect() override;
};

struct GLTexture : IDirect3DTexture8
{
    UINT w, h;
    D3DFORMAT fmt;
    int bpp;
    GLuint tex = 0;
    std::vector<uint8_t> shadow; // native-format pixels
    GLSurface *surf;
    ULONG rc = 1;

    GLTexture(UINT W, UINT H, D3DFORMAT F) : w(W), h(H), fmt(F)
    {
        bpp = formatBytes(F);
        shadow.assign((size_t)W * H * bpp, 0);
        surf = new GLSurface(this, W, H, F);
        ensureGlContext();
        glGenTextures(1, &tex);
        glBindTexture(GL_TEXTURE_2D, tex);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT); // D3D default = WRAP
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        upload();
    }
    ~GLTexture()
    {
        if (tex) glDeleteTextures(1, &tex);
        delete surf;
    }
    void upload()
    {
        std::vector<uint8_t> rgba((size_t)w * h * 4);
        for (UINT y = 0; y < h; y++)
            nativeToRGBA8(fmt, shadow.data() + (size_t)y * w * bpp, rgba.data() + (size_t)y * w * 4, w);
        glBindTexture(GL_TEXTURE_2D, tex);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, rgba.data());
    }
    HRESULT __stdcall QueryInterface(REFIID, void **pp) override { if (pp) *pp = this; return S_OK; }
    ULONG __stdcall AddRef() override { return ++rc; }
    ULONG __stdcall Release() override { if (--rc == 0) { delete this; return 0; } return rc; }
    D3DRESOURCETYPE __stdcall GetType() override { return D3DRTYPE_TEXTURE; }
    HRESULT __stdcall GetLevelDesc(UINT, D3DSURFACE_DESC *d) override { return surf->GetDesc(d); }
    HRESULT __stdcall GetSurfaceLevel(UINT, IDirect3DSurface8 **pp) override
    {
        surf->AddRef();
        if (pp) *pp = surf;
        return S_OK;
    }
    HRESULT __stdcall LockRect(UINT, D3DLOCKED_RECT *lr, const RECT *, DWORD) override
    {
        if (lr) { lr->Pitch = (INT)(w * bpp); lr->pBits = shadow.data(); }
        return S_OK;
    }
    HRESULT __stdcall UnlockRect(UINT) override { upload(); return S_OK; }
};

HRESULT GLSurface::GetDesc(D3DSURFACE_DESC *d)
{
    if (d) { memset(d, 0, sizeof(*d)); d->Width = w; d->Height = h; d->Format = fmt; d->Type = D3DRTYPE_SURFACE; }
    return S_OK;
}
HRESULT GLSurface::LockRect(D3DLOCKED_RECT *lr, const RECT *, DWORD)
{
    if (lr && owner) { lr->Pitch = (INT)(w * owner->bpp); lr->pBits = owner->shadow.data(); }
    return S_OK;
}
HRESULT GLSurface::UnlockRect()
{
    if (owner) owner->upload();
    return S_OK;
}

// ===========================================================================
// PNG decode (libpng, from memory) -> RGBA8
// ===========================================================================
struct PngMem { const uint8_t *data; size_t size, pos; };
void pngRead(png_structp p, png_bytep out, png_size_t len)
{
    PngMem *m = (PngMem *)png_get_io_ptr(p);
    size_t n = (m->pos + len <= m->size) ? len : (m->size - m->pos);
    memcpy(out, m->data + m->pos, n);
    m->pos += n;
}
bool decodePng(const uint8_t *data, size_t size, std::vector<uint8_t> &rgba, int &W, int &H)
{
    if (size < 8 || png_sig_cmp((png_const_bytep)data, 0, 8))
        return false;
    png_structp png = png_create_read_struct(PNG_LIBPNG_VER_STRING, nullptr, nullptr, nullptr);
    if (!png) return false;
    png_infop info = png_create_info_struct(png);
    if (!info) { png_destroy_read_struct(&png, nullptr, nullptr); return false; }
    if (setjmp(png_jmpbuf(png))) { png_destroy_read_struct(&png, &info, nullptr); return false; }
    PngMem m{data, size, 0};
    png_set_read_fn(png, &m, pngRead);
    png_read_info(png, info);
    W = png_get_image_width(png, info);
    H = png_get_image_height(png, info);
    int bd = png_get_bit_depth(png, info), ct = png_get_color_type(png, info);
    if (bd == 16) png_set_strip_16(png);
    if (ct == PNG_COLOR_TYPE_PALETTE) png_set_palette_to_rgb(png);
    if (ct == PNG_COLOR_TYPE_GRAY && bd < 8) png_set_expand_gray_1_2_4_to_8(png);
    if (png_get_valid(png, info, PNG_INFO_tRNS)) png_set_tRNS_to_alpha(png);
    if (ct == PNG_COLOR_TYPE_GRAY || ct == PNG_COLOR_TYPE_GRAY_ALPHA) png_set_gray_to_rgb(png);
    if (ct == PNG_COLOR_TYPE_RGB || ct == PNG_COLOR_TYPE_GRAY || ct == PNG_COLOR_TYPE_PALETTE)
        png_set_filler(png, 0xFF, PNG_FILLER_AFTER);
    png_read_update_info(png, info);
    rgba.assign((size_t)W * H * 4, 0);
    std::vector<png_bytep> rows(H);
    for (int y = 0; y < H; y++) rows[y] = rgba.data() + (size_t)y * W * 4;
    png_read_image(png, rows.data());
    png_destroy_read_struct(&png, &info, nullptr);
    return true;
}

bool decodeJpeg(const uint8_t *data, size_t size, std::vector<uint8_t> &rgba, int &W, int &H)
{
    if (size < 2 || data[0] != 0xFF || data[1] != 0xD8)
        return false;
    struct jpeg_decompress_struct cinfo;
    struct jpeg_error_mgr jerr;
    cinfo.err = jpeg_std_error(&jerr);
    jpeg_create_decompress(&cinfo);
    jpeg_mem_src(&cinfo, data, (unsigned long)size);
    if (jpeg_read_header(&cinfo, (boolean)1) != JPEG_HEADER_OK)
    {
        jpeg_destroy_decompress(&cinfo);
        return false;
    }
    cinfo.out_color_space = JCS_RGB;
    jpeg_start_decompress(&cinfo);
    W = cinfo.output_width;
    H = cinfo.output_height;
    rgba.assign((size_t)W * H * 4, 0xFF);
    std::vector<uint8_t> row((size_t)W * 3);
    for (int y = 0; y < H; y++)
    {
        JSAMPROW rp = row.data();
        jpeg_read_scanlines(&cinfo, &rp, 1);
        uint8_t *dst = rgba.data() + (size_t)y * W * 4;
        for (int x = 0; x < W; x++)
        {
            dst[x * 4 + 0] = row[x * 3 + 0];
            dst[x * 4 + 1] = row[x * 3 + 1];
            dst[x * 4 + 2] = row[x * 3 + 2];
        }
    }
    jpeg_finish_decompress(&cinfo);
    jpeg_destroy_decompress(&cinfo);
    return true;
}

bool decodeImage(const uint8_t *data, size_t size, std::vector<uint8_t> &rgba, int &W, int &H)
{
    return decodePng(data, size, rgba, W, H) || decodeJpeg(data, size, rgba, W, H);
}

void applyColorKey(std::vector<uint8_t> &rgba, D3DCOLOR colorKey)
{
    if (colorKey == 0) return;
    // D3D8: colorKey alpha byte = 0 means DISABLED (not "black with alpha 0").
    // Only apply when the alpha byte is non-zero (e.g., 0xFF000000 = "make black transparent").
    if ((colorKey >> 24) == 0) return;
    uint8_t kr = (colorKey >> 16) & 0xFF, kg = (colorKey >> 8) & 0xFF, kb = colorKey & 0xFF;
    for (size_t i = 0; i + 3 < rgba.size(); i += 4)
        if (rgba[i] == kr && rgba[i + 1] == kg && rgba[i + 2] == kb)
            rgba[i + 3] = 0;
}

// ===========================================================================
// Device
// ===========================================================================
struct GLVertexBuffer : IDirect3DVertexBuffer8
{
    std::vector<uint8_t> data;
    ULONG rc = 1;
    GLVertexBuffer(UINT len) : data(len ? len : 1) {}
    HRESULT __stdcall QueryInterface(REFIID, void **pp) override { if (pp) *pp = this; return S_OK; }
    ULONG __stdcall AddRef() override { return ++rc; }
    ULONG __stdcall Release() override { if (--rc == 0) { delete this; return 0; } return rc; }
    HRESULT __stdcall Lock(UINT off, UINT, BYTE **pp, DWORD) override
    {
        if (pp) *pp = data.data() + off;
        return S_OK;
    }
    HRESULT __stdcall Unlock() override { return S_OK; }
};

GLenum d3dBlendToGl(DWORD b)
{
    switch (b)
    {
    case D3DBLEND_ZERO: return GL_ZERO;
    case D3DBLEND_ONE: return GL_ONE;
    case D3DBLEND_SRCALPHA: return GL_SRC_ALPHA;
    case D3DBLEND_INVSRCALPHA: return GL_ONE_MINUS_SRC_ALPHA;
    default: return GL_ONE;
    }
}

struct GLDevice : IDirect3DDevice8
{
    ULONG rc = 1;
    DWORD fvf = 0;
    GLTexture *boundTex = nullptr;
    D3DXMATRIX world, view, proj, texMatrix;
    D3DVIEWPORT8 vp{0, 0, 640, 480, 0, 1};
    // render/stage state cache
    DWORD rs[256] = {0};
    DWORD tss0[64] = {0};

    GLDevice()
    {
        D3DXMatrixIdentity(&world);
        D3DXMatrixIdentity(&view);
        D3DXMatrixIdentity(&proj);
        D3DXMatrixIdentity(&texMatrix);
        rs[D3DRS_SRCBLEND] = D3DBLEND_SRCALPHA;
        rs[D3DRS_DESTBLEND] = D3DBLEND_INVSRCALPHA;
        rs[D3DRS_ALPHAFUNC] = D3DCMP_GREATEREQUAL;
        tss0[D3DTSS_ADDRESSU] = D3DTADDRESS_WRAP; // D3D8 default
        tss0[D3DTSS_ADDRESSV] = D3DTADDRESS_WRAP;
        tss0[D3DTSS_ADDRESSW] = D3DTADDRESS_WRAP;
        tss0[D3DTSS_COLOROP] = D3DTOP_MODULATE;
        tss0[D3DTSS_COLORARG1] = D3DTA_TEXTURE;
        tss0[D3DTSS_COLORARG2] = D3DTA_DIFFUSE;
        tss0[D3DTSS_ALPHAOP] = D3DTOP_MODULATE;
        tss0[D3DTSS_ALPHAARG1] = D3DTA_TEXTURE;
        tss0[D3DTSS_ALPHAARG2] = D3DTA_DIFFUSE;
    }
    HRESULT __stdcall QueryInterface(REFIID, void **pp) override { if (pp) *pp = this; return S_OK; }
    ULONG __stdcall AddRef() override { return ++rc; }
    ULONG __stdcall Release() override { if (--rc == 0) { delete this; return 0; } return rc; }
    HRESULT __stdcall TestCooperativeLevel() override { return D3D_OK; }
    UINT __stdcall GetAvailableTextureMem() override { return 256u * 1024 * 1024; }
    HRESULT __stdcall ResourceManagerDiscardBytes(DWORD) override { return D3D_OK; }
    HRESULT __stdcall GetDeviceCaps(D3DCAPS8 *c) override
    {
        if (c) { memset(c, 0, sizeof(*c)); c->TextureOpCaps = D3DTEXOPCAPS_ADD; c->MaxTextureWidth =
            c->MaxTextureHeight = 4096; c->MaxSimultaneousTextures = 8; }
        return D3D_OK;
    }
    HRESULT __stdcall Reset(D3DPRESENT_PARAMETERS *) override { return D3D_OK; }
    HRESULT __stdcall Present(const RECT *, const RECT *, HWND, const void *) override
    {
#ifdef TH06_BOOT_TRACE
        static int pc = 0;
        pc++;
        if (pc % 120 == 0)
        {
            fprintf(stderr, "[gl] present %d: draws=%d (2d=%d 3d=%d) lastClear=%08X\n", pc, dbgDraws,
                    dbg2dDraws, dbgDraws - dbg2dDraws, dbgLastClear);
        }
        dbgDraws = dbg2dDraws = dbgTexDraws = 0;
#endif
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glFlush();
        return D3D_OK;
    }
#ifdef TH06_BOOT_TRACE
    int dbgDraws = 0, dbg2dDraws = 0, dbgTexDraws = 0, dumpN = 0;
    unsigned dbgLastClear = 0;
#endif
    HRESULT __stdcall GetBackBuffer(UINT, D3DBACKBUFFER_TYPE, IDirect3DSurface8 **pp) override
    {
        if (pp) *pp = (new GLTexture(640, 480, D3DFMT_A8R8G8B8))->surf;
        return D3D_OK;
    }
    HRESULT __stdcall CreateTexture(UINT w, UINT h, UINT, DWORD, D3DFORMAT f, D3DPOOL, IDirect3DTexture8 **pp) override
    {
        if (pp) *pp = new GLTexture(w ? w : 1, h ? h : 1, f == D3DFMT_UNKNOWN ? D3DFMT_A8R8G8B8 : f);
        return D3D_OK;
    }
    HRESULT __stdcall CreateVertexBuffer(UINT len, DWORD, DWORD, D3DPOOL, IDirect3DVertexBuffer8 **pp) override
    {
        if (pp) *pp = new GLVertexBuffer(len);
        return D3D_OK;
    }
    HRESULT __stdcall CreateRenderTarget(UINT w, UINT h, D3DFORMAT f, D3DMULTISAMPLE_TYPE, BOOL,
                                         IDirect3DSurface8 **pp) override
    {
        if (pp) *pp = (new GLTexture(w, h, f == D3DFMT_UNKNOWN ? D3DFMT_A8R8G8B8 : f))->surf;
        return D3D_OK;
    }
    HRESULT __stdcall CreateImageSurface(UINT w, UINT h, D3DFORMAT f, IDirect3DSurface8 **pp) override
    {
        if (pp) *pp = (new GLTexture(w ? w : 1, h ? h : 1, f == D3DFMT_UNKNOWN ? D3DFMT_A8R8G8B8 : f))->surf;
        return D3D_OK;
    }
    HRESULT __stdcall CopyRects(IDirect3DSurface8 *srcSurf, const RECT *srcRects, UINT numRects,
                                IDirect3DSurface8 *, const POINT *dstPts) override
    {
        if (!srcSurf || !numRects) return D3D_OK;
        GLSurface *src = static_cast<GLSurface *>(srcSurf);
        if (!src->owner || !src->owner->tex) return D3D_OK;
        float sx = dstPts ? (float)dstPts->x : 0.0f;
        float sy = dstPts ? (float)dstPts->y : 0.0f;
        float sw = srcRects ? (float)(srcRects->right - srcRects->left) : (float)src->w;
        float sh = srcRects ? (float)(srcRects->bottom - srcRects->top) : (float)src->h;
        float u0 = srcRects ? (float)srcRects->left / src->w : 0.0f;
        float v0 = srcRects ? (float)srcRects->top / src->h : 0.0f;
        float u1 = srcRects ? (float)srcRects->right / src->w : 1.0f;
        float v1 = srcRects ? (float)srcRects->bottom / src->h : 1.0f;
        float verts[] = {
            sx,      sy,      0, 1, u0, v0,
            sx + sw, sy,      0, 1, u1, v0,
            sx,      sy + sh, 0, 1, u0, v1,
            sx + sw, sy + sh, 0, 1, u1, v1,
        };
        GLTexture *prevTex = boundTex;
        DWORD prevFvf = fvf;
        boundTex = src->owner;
        fvf = D3DFVF_XYZRHW | D3DFVF_TEX1;
        DWORD prevBlend = rs[D3DRS_ALPHABLENDENABLE];
        DWORD prevATest = rs[D3DRS_ALPHATESTENABLE];
        rs[D3DRS_ALPHABLENDENABLE] = 0;
        rs[D3DRS_ALPHATESTENABLE] = 0;
        drawArrays(D3DPT_TRIANGLESTRIP, 2, verts, 24);
        rs[D3DRS_ALPHABLENDENABLE] = prevBlend;
        rs[D3DRS_ALPHATESTENABLE] = prevATest;
        boundTex = prevTex;
        fvf = prevFvf;
        return D3D_OK;
    }
    HRESULT __stdcall SetViewport(const D3DVIEWPORT8 *v) override
    {
        if (v) { vp = *v; glViewport(v->X, v->Y, v->Width, v->Height); }
        return D3D_OK;
    }
    HRESULT __stdcall GetViewport(D3DVIEWPORT8 *v) override { if (v) *v = vp; return D3D_OK; }
    HRESULT __stdcall SetTransform(D3DTRANSFORMSTATETYPE s, const D3DMATRIX *m) override
    {
        if (!m) return D3D_OK;
        if (s == D3DTS_WORLD) world = *m;
        else if (s == D3DTS_VIEW) view = *m;
        else if (s == D3DTS_PROJECTION) proj = *m;
        else if (s == D3DTS_TEXTURE0) texMatrix = *m;
        return D3D_OK;
    }
    HRESULT __stdcall SetRenderState(D3DRENDERSTATETYPE s, DWORD v) override { if (s < 256) rs[s] = v; return D3D_OK; }
    HRESULT __stdcall GetRenderState(D3DRENDERSTATETYPE s, DWORD *v) override { if (v && s < 256) *v = rs[s]; return D3D_OK; }
    HRESULT __stdcall SetTextureStageState(DWORD stage, D3DTEXTURESTAGESTATETYPE t, DWORD v) override
    {
        if (stage == 0 && t < 64) tss0[t] = v;
        return D3D_OK;
    }
    HRESULT __stdcall SetTexture(DWORD stage, IDirect3DBaseTexture8 *t) override
    {
        if (stage == 0) boundTex = static_cast<GLTexture *>(t);
        return D3D_OK;
    }
    HRESULT __stdcall SetVertexShader(DWORD handle) override { fvf = handle; return D3D_OK; }
    HRESULT __stdcall SetStreamSource(UINT, IDirect3DVertexBuffer8 *pStreamData, UINT stride) override
    {
        streamVB = static_cast<GLVertexBuffer *>(pStreamData);
        streamStride = stride;
        return D3D_OK;
    }
    HRESULT __stdcall DrawPrimitive(D3DPRIMITIVETYPE prim, UINT startVertex, UINT primCount) override
    {
        // The 3D stage/title background draws from a bound vertex buffer (XYZ|TEX1).
        if (streamVB && streamStride)
            drawArrays(prim, primCount, streamVB->data.data() + (size_t)startVertex * streamStride, streamStride);
        return D3D_OK;
    }
    HRESULT __stdcall DrawPrimitiveUP(D3DPRIMITIVETYPE prim, UINT primCount, const void *vtx, UINT stride) override
    {
        drawArrays(prim, primCount, vtx, stride);
        return D3D_OK;
    }
    void drawArrays(D3DPRIMITIVETYPE prim, UINT primCount, const void *vtx, UINT stride);
    GLVertexBuffer *streamVB = nullptr;
    UINT streamStride = 0;
    HRESULT __stdcall Clear(DWORD, const D3DRECT *, DWORD flags, D3DCOLOR color, float z, DWORD) override
    {
        GLbitfield m = 0;
        if (flags & D3DCLEAR_TARGET)
        {
            float a = ((color >> 24) & 0xFF) / 255.0f, r = ((color >> 16) & 0xFF) / 255.0f,
                  g = ((color >> 8) & 0xFF) / 255.0f, b = (color & 0xFF) / 255.0f;
            glClearColor(r, g, b, a);
            m |= GL_COLOR_BUFFER_BIT;
        }
        if (flags & D3DCLEAR_ZBUFFER)
        {
            glClearDepthf(z);
            m |= GL_DEPTH_BUFFER_BIT;
        }
#ifdef TH06_BOOT_TRACE
        dbgLastClear = color;
#endif
        if (m) glClear(m);
        return D3D_OK;
    }
    HRESULT __stdcall BeginScene() override { return D3D_OK; }
    HRESULT __stdcall EndScene() override { return D3D_OK; }
};

void GLDevice::drawArrays(D3DPRIMITIVETYPE prim, UINT primCount, const void *vtx, UINT stride)
{
    if (!g_program || !vtx)
        return;
    bool hasTex = (fvf & D3DFVF_TEX1) != 0;
    bool hasDiffuse = (fvf & D3DFVF_DIFFUSE) != 0;
    bool xyzrhw = (fvf & D3DFVF_XYZRHW) != 0;
    UINT vcount = (prim == D3DPT_TRIANGLESTRIP) ? primCount + 2
                  : (prim == D3DPT_TRIANGLELIST) ? primCount * 3
                                                 : primCount + 1;

#ifdef TH06_BOOT_TRACE
    if (dumpN > 0)
    {
        dumpN--;
        const float *fv = (const float *)vtx;
        int posC = xyzrhw ? 4 : 3;
        uint32_t dif = hasDiffuse ? *(const uint32_t *)((const uint8_t *)vtx + posC * 4) : 0xFFFFFFFF;
        fprintf(stderr, "  [draw] fvf=%03X %s%s%s v0=(%.0f,%.0f) dif=%08X tex=%s(%ux%u) blend=%s dst=%d\n",
                (unsigned)fvf, xyzrhw ? "RHW " : "XYZ ", hasDiffuse ? "DIF " : "", hasTex ? "TEX" : "",
                fv[0], fv[1], (unsigned)dif, boundTex ? "Y" : "N", boundTex ? boundTex->w : 0,
                boundTex ? boundTex->h : 0, rs[D3DRS_ALPHABLENDENABLE] ? "on" : "off",
                (int)rs[D3DRS_DESTBLEND]);
    }
#endif

    glUseProgram(g_program);
    glBindVertexArray(g_vao);
    glBindBuffer(GL_ARRAY_BUFFER, g_vbo);
    glBufferData(GL_ARRAY_BUFFER, (GLsizeiptr)vcount * stride, vtx, GL_STREAM_DRAW);

    // Attribute offsets depend on FVF layout (pos [diffuse] [uv]).
    int posComponents = xyzrhw ? 4 : 3;
    int off = 0;
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, posComponents, GL_FLOAT, GL_FALSE, stride, (void *)(intptr_t)off);
    off += posComponents * 4;
    if (hasDiffuse)
    {
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 4, GL_UNSIGNED_BYTE, GL_TRUE, stride, (void *)(intptr_t)off);
        off += 4;
    }
    else
    {
        glDisableVertexAttribArray(1);
        glVertexAttrib4f(1, 1, 1, 1, 1); // default white (BGRA->RGBA still white)
    }
    if (hasTex)
    {
        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, stride, (void *)(intptr_t)off);
    }
    else
    {
        glDisableVertexAttribArray(2);
        glVertexAttrib2f(2, 0, 0);
    }

    // Uniforms
#ifdef TH06_DEBUG_NO3D
    if (!xyzrhw) return;
#endif
    glUniform1i(u_mode, xyzrhw ? 0 : 1);
    glUniform2f(u_viewport, (float)vp.Width, (float)vp.Height);
    glUniform2f(u_viewportOfs, (float)vp.X, (float)vp.Y);
    if (!xyzrhw)
    {
        D3DXMATRIX mvp, wv;
        D3DXMatrixMultiply(&wv, &world, &view);
        D3DXMatrixMultiply(&mvp, &wv, &proj);
        glUniformMatrix4fv(u_mvp, 1, GL_TRUE, &mvp._11);
        glUniformMatrix4fv(u_mv, 1, GL_TRUE, &wv._11);
        int ttf = (int)tss0[D3DTSS_TEXTURETRANSFORMFLAGS];
        glUniform1i(u_texTransform, ttf);
        if (ttf)
            glUniformMatrix4fv(u_texMatrix, 1, GL_TRUE, &texMatrix._11);
    }
    else
    {
        glUniform1i(u_texTransform, 0);
    }
    // Fog (3D only; D3DRS_FOGSTART/FOGEND are float bits stored as DWORD)
    bool fogOn = !xyzrhw && rs[D3DRS_FOGENABLE];
    glUniform1i(u_fogEnable, fogOn ? 1 : 0);
    if (fogOn)
    {
        DWORD fc = rs[D3DRS_FOGCOLOR];
        glUniform4f(u_fogColor, ((fc >> 16) & 0xFF) / 255.0f, ((fc >> 8) & 0xFF) / 255.0f, (fc & 0xFF) / 255.0f, 1.0f);
        float fs = *(float *)&rs[D3DRS_FOGSTART], fe = *(float *)&rs[D3DRS_FOGEND];
        glUniform1f(u_fogStart, fs);
        glUniform1f(u_fogEnd, fe);
    }
    glUniform1i(u_useTexture, (hasTex && boundTex) ? 1 : 0);
    if (hasTex && boundTex)
    {
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, boundTex->tex);
        // Apply per-draw texture filter + address mode from SetTextureStageState.
        GLenum magF = (tss0[D3DTSS_MAGFILTER] == D3DTEXF_POINT) ? GL_NEAREST : GL_LINEAR;
        GLenum minF = (tss0[D3DTSS_MINFILTER] == D3DTEXF_POINT) ? GL_NEAREST : GL_LINEAR;
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, magF);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, minF);
        GLenum wrapS = (tss0[D3DTSS_ADDRESSU] == D3DTADDRESS_CLAMP) ? GL_CLAMP_TO_EDGE : GL_REPEAT;
        GLenum wrapT = (tss0[D3DTSS_ADDRESSV] == D3DTADDRESS_CLAMP) ? GL_CLAMP_TO_EDGE : GL_REPEAT;
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrapS);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, wrapT);
    }
    DWORD tf = rs[D3DRS_TEXTUREFACTOR];
    glUniform4f(u_tfactor, ((tf >> 16) & 0xFF) / 255.0f, ((tf >> 8) & 0xFF) / 255.0f, (tf & 0xFF) / 255.0f,
                ((tf >> 24) & 0xFF) / 255.0f);
    glUniform1i(u_colorOp, (int)tss0[D3DTSS_COLOROP]);
    glUniform1i(u_colorArg1, (int)tss0[D3DTSS_COLORARG1] & 3);
    glUniform1i(u_colorArg2, (int)tss0[D3DTSS_COLORARG2] & 3);
    glUniform1i(u_alphaOp, (int)tss0[D3DTSS_ALPHAOP]);
    glUniform1i(u_alphaArg1, (int)tss0[D3DTSS_ALPHAARG1] & 3);
    glUniform1i(u_alphaArg2, (int)tss0[D3DTSS_ALPHAARG2] & 3);
    glUniform1i(u_alphaTest, rs[D3DRS_ALPHATESTENABLE] ? 1 : 0);
    glUniform1i(u_alphaFunc, (int)rs[D3DRS_ALPHAFUNC]);
    glUniform1f(u_alphaRef, rs[D3DRS_ALPHAREF] / 255.0f);

    // Blend
    if (rs[D3DRS_ALPHABLENDENABLE])
    {
        glEnable(GL_BLEND);
        glBlendFunc(d3dBlendToGl(rs[D3DRS_SRCBLEND]), d3dBlendToGl(rs[D3DRS_DESTBLEND]));
    }
    else
        glDisable(GL_BLEND);

    // Depth — use the engine's actual ZFUNC (critical: Gui sets D3DCMP_ALWAYS for HUD draws)
    if (rs[D3DRS_ZENABLE])
    {
        glEnable(GL_DEPTH_TEST);
        glDepthMask(rs[D3DRS_ZWRITEENABLE] ? GL_TRUE : GL_FALSE);
        switch (rs[D3DRS_ZFUNC])
        {
        case D3DCMP_ALWAYS:
            glDepthFunc(GL_ALWAYS);
            break;
        case D3DCMP_GREATEREQUAL:
            glDepthFunc(GL_GEQUAL);
            break;
        case D3DCMP_LESS:
            glDepthFunc(GL_LESS);
            break;
        default:
            glDepthFunc(GL_LEQUAL);
            break;
        }
    }
    else
        glDisable(GL_DEPTH_TEST);

    GLenum mode = (prim == D3DPT_TRIANGLELIST) ? GL_TRIANGLES : GL_TRIANGLE_STRIP;
    glDrawArrays(mode, 0, vcount);
#ifdef TH06_BOOT_TRACE
    dbgDraws++;
    if (xyzrhw) dbg2dDraws++;
    if (hasTex && boundTex) dbgTexDraws++;
#endif
}

struct GLD3D8 : IDirect3D8
{
    ULONG rc = 1;
    HRESULT __stdcall QueryInterface(REFIID, void **pp) override { if (pp) *pp = this; return S_OK; }
    ULONG __stdcall AddRef() override { return ++rc; }
    ULONG __stdcall Release() override { if (--rc == 0) { delete this; return 0; } return rc; }
    HRESULT __stdcall GetAdapterDisplayMode(UINT, D3DDISPLAYMODE *m) override
    {
        if (m) { m->Width = 640; m->Height = 480; m->RefreshRate = 60; m->Format = D3DFMT_X8R8G8B8; }
        return D3D_OK;
    }
    HRESULT __stdcall CheckDeviceType(UINT, D3DDEVTYPE, D3DFORMAT, D3DFORMAT, BOOL) override { return D3D_OK; }
    HRESULT __stdcall CheckDeviceFormat(UINT, D3DDEVTYPE, D3DFORMAT, DWORD, D3DRESOURCETYPE, D3DFORMAT) override
    {
        return D3D_OK;
    }
    HRESULT __stdcall GetDeviceCaps(UINT, D3DDEVTYPE, D3DCAPS8 *c) override
    {
        if (c) { memset(c, 0, sizeof(*c)); c->TextureOpCaps = D3DTEXOPCAPS_ADD; }
        return D3D_OK;
    }
    HRESULT __stdcall CreateDevice(UINT, D3DDEVTYPE, HWND, DWORD, D3DPRESENT_PARAMETERS *,
                                   IDirect3DDevice8 **pp) override
    {
        ensureGlContext();
        if (pp) *pp = new GLDevice();
        return D3D_OK;
    }
};

} // namespace

// ===========================================================================
// Exported factories (replace the dx_stub D3D ones)
// ===========================================================================
extern "C" IDirect3D8 *__stdcall Direct3DCreate8(UINT) { return new GLD3D8(); }

extern "C" HRESULT D3DXCreateTexture(IDirect3DDevice8 *, UINT w, UINT h, UINT, DWORD, D3DFORMAT f, D3DPOOL,
                                     IDirect3DTexture8 **pp)
{
    if (pp) *pp = new GLTexture(w ? w : 1, h ? h : 1, f == D3DFMT_UNKNOWN ? D3DFMT_A8R8G8B8 : f);
    return S_OK;
}

extern "C" HRESULT D3DXCreateTextureFromFileInMemoryEx(IDirect3DDevice8 *, const void *src, UINT srcSize, UINT, UINT,
                                                       UINT, DWORD, D3DFORMAT fmt, D3DPOOL, DWORD, DWORD,
                                                       D3DCOLOR colorKey, D3DXIMAGE_INFO *info, PALETTEENTRY *,
                                                       IDirect3DTexture8 **pp)
{
    std::vector<uint8_t> rgba;
    int W = 0, H = 0;
    if (!decodeImage((const uint8_t *)src, srcSize, rgba, W, H))
    {
        fprintf(stderr, "[gl] D3DXCreateTextureFromFileInMemoryEx: decode failed (size=%u, hdr=%02X%02X)\n",
                srcSize, srcSize > 0 ? ((const uint8_t*)src)[0] : 0, srcSize > 1 ? ((const uint8_t*)src)[1] : 0);
        if (pp) *pp = new GLTexture(8, 8, D3DFMT_A8R8G8B8);
        return S_OK;
    }
    // TH06 textures: force alpha=255, then carve transparency via colorKey only.
    // PNG tRNS is intentionally discarded — TH06's palette PNGs have unreliable
    // tRNS data that causes sprites to be invisible if preserved.
    // When colorKey is 0 (disabled), preserve the PNG's native alpha channel —
    // used by non-TH06 assets (e.g. hitbox.png) that have correct RGBA alpha.
    if ((colorKey >> 24) != 0)
    {
        for (size_t i = 3; i < rgba.size(); i += 4)
            rgba[i] = 255;
        applyColorKey(rgba, colorKey);
    }
    D3DFORMAT useFmt = (fmt == D3DFMT_UNKNOWN) ? D3DFMT_A8R8G8B8 : fmt;
    GLTexture *t = new GLTexture(W, H, useFmt);
    // Store decoded pixels into the native-format shadow (preserves banding), upload.
    for (int y = 0; y < H; y++)
        rgba8ToNative(useFmt, rgba.data() + (size_t)y * W * 4, t->shadow.data() + (size_t)y * W * t->bpp, W);
    t->upload();
    if (info) { memset(info, 0, sizeof(*info)); info->Width = W; info->Height = H; info->Format = useFmt; }
    if (pp) *pp = t;
#ifdef TH06_BOOT_TRACE
    static int texLog = 0;
    if (texLog < 4) {
        char path[64]; snprintf(path, sizeof(path), "tex%d.rgba", texLog);
        FILE *f = fopen(path, "wb");
        if (f) { fwrite(rgba.data(), 1, rgba.size(), f); fclose(f);
            fprintf(stderr, "[tex] saved %s (%dx%d, %zu bytes, ck=%08X)\n", path, W, H, rgba.size(), (unsigned)colorKey); }
    }
    texLog++;
#endif
    return S_OK;
}

extern "C" HRESULT D3DXLoadSurfaceFromSurface(IDirect3DSurface8 *dst, const PALETTEENTRY *, const RECT *dstRect,
                                              IDirect3DSurface8 *srcS, const PALETTEENTRY *, const RECT *srcRect, DWORD,
                                              D3DCOLOR)
{
    GLSurface *d = static_cast<GLSurface *>(dst), *s = static_cast<GLSurface *>(srcS);
    if (d && s && d->owner && s->owner)
    {
        if (!dstRect && !srcRect)
        {
            // Fast path: full surface copy (used by title background, surface init)
            UINT cw = d->w < s->w ? d->w : s->w;
            UINT ch = d->h < s->h ? d->h : s->h;
            int dbpp = d->owner->bpp, sbpp = s->owner->bpp;
            for (UINT y = 0; y < ch; y++)
            {
                uint8_t *dr = d->owner->shadow.data() + (size_t)y * d->w * dbpp;
                const uint8_t *sr = s->owner->shadow.data() + (size_t)y * s->w * sbpp;
                if (dbpp == sbpp)
                    memcpy(dr, sr, (size_t)cw * dbpp);
                else
                    for (UINT x = 0; x < cw; x++)
                    {
                        uint8_t rgba[4];
                        nativeToRGBA8(s->fmt, sr + (size_t)x * sbpp, rgba, 1);
                        rgba8ToNative(d->fmt, rgba, dr + (size_t)x * dbpp, 1);
                    }
            }
        }
        else
        {
            // Rect blit with nearest-neighbor scaling (used by text rendering)
            int sx0 = srcRect ? srcRect->left : 0, sy0 = srcRect ? srcRect->top : 0;
            int sw = srcRect ? (srcRect->right - srcRect->left) : (int)s->w;
            int sh = srcRect ? (srcRect->bottom - srcRect->top) : (int)s->h;
            int dx0 = dstRect ? dstRect->left : 0, dy0 = dstRect ? dstRect->top : 0;
            int dw = dstRect ? (dstRect->right - dstRect->left) : (int)d->w;
            int dh = dstRect ? (dstRect->bottom - dstRect->top) : (int)d->h;
            if (sw > 0 && sh > 0 && dw > 0 && dh > 0)
            {
                int sbpp = s->owner->bpp, dbpp = d->owner->bpp;
                for (int dy = 0; dy < dh; dy++)
                {
                    int sy = sy0 + dy * sh / dh;
                    if (sy < 0 || sy >= (int)s->h || dy + dy0 < 0 || dy + dy0 >= (int)d->h) continue;
                    const uint8_t *sr = s->owner->shadow.data() + (size_t)sy * s->w * sbpp;
                    uint8_t *dr = d->owner->shadow.data() + (size_t)(dy + dy0) * d->w * dbpp;
                    for (int dx = 0; dx < dw; dx++)
                    {
                        int sx = sx0 + dx * sw / dw;
                        if (sx < 0 || sx >= (int)s->w || dx + dx0 < 0 || dx + dx0 >= (int)d->w) continue;
                        uint8_t rgba[4];
                        nativeToRGBA8(s->fmt, sr + (size_t)sx * sbpp, rgba, 1);
                        rgba8ToNative(d->fmt, rgba, dr + (size_t)(dx + dx0) * dbpp, 1);
                    }
                }
            }
        }
        d->owner->upload();
    }
    return S_OK;
}

extern "C" HRESULT D3DXLoadSurfaceFromFileInMemory(IDirect3DSurface8 *dst, const PALETTEENTRY *, const RECT *,
                                                   const void *src, UINT srcSize, const RECT *, DWORD, D3DCOLOR ck,
                                                   D3DXIMAGE_INFO *info)
{
    GLSurface *d = static_cast<GLSurface *>(dst);
    std::vector<uint8_t> rgba;
    int W = 0, H = 0;
    if (d && d->owner && decodeImage((const uint8_t *)src, srcSize, rgba, W, H))
    {
        applyColorKey(rgba, ck);
        for (int y = 0; y < H && y < (int)d->h; y++)
            rgba8ToNative(d->fmt, rgba.data() + (size_t)y * W * 4,
                          d->owner->shadow.data() + (size_t)y * d->w * d->owner->bpp, (W < (int)d->w) ? W : d->w);
        d->owner->upload();
        if (info) { memset(info, 0, sizeof(*info)); info->Width = W; info->Height = H; info->Format = d->fmt; }
    }
    return S_OK;
}
