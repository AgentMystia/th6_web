// Entry point for the TH06 WASM/native port.
//
// Replaces the original Win32 WinMain message-pump loop (src/main.cpp in the
// decomp) with: a one-time init that mirrors WinMain's setup, then a per-frame
// callback driven by emscripten_set_main_loop (requestAnimationFrame, fps=0 →
// vsync-paced, lowest latency). Natively it falls back to a plain loop so the
// headless golden/boot build runs without a browser.
//
// The engine's own 60 Hz timing inside GameWindow::Render() gates logic steps,
// so calling Render() at the display refresh rate matches the original cadence.
#include "th06.hpp"
#include <cstdio>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

using namespace th06;

// Headless boot instrumentation (TH06_BOOT_TRACE): log init + early frames and
// auto-stop, so a node run gives positive confirmation the engine is advancing.
#ifdef TH06_BOOT_TRACE
static int g_traceFrame = 0;
#endif

static void th06_frame(void)
{
#ifdef TH06_BOOT_TRACE
    if (g_traceFrame < 8 || g_traceFrame % 300 == 0)
        fprintf(stderr, "[th06] call %d: curState=%d curFrame=%u enemies=%d\n", g_traceFrame,
                (int)g_Supervisor.curState, (unsigned)g_GameWindow.curFrame,
                (int)g_EnemyManager.enemyCount);
    g_traceFrame++;
#endif
    if (g_GameWindow.isAppClosing)
    {
#ifdef __EMSCRIPTEN__
        emscripten_cancel_main_loop();
#endif
        return;
    }

    // On the web there is no D3D device loss; the stub TestCooperativeLevel
    // returns D3D_OK. Keep the call so the original control flow is preserved.
    if (g_Supervisor.d3dDevice->TestCooperativeLevel() == D3D_OK)
    {
        if (g_GameWindow.Render() != RENDER_RESULT_KEEP_RUNNING)
        {
            g_GameWindow.isAppClosing = 1;
        }
    }
}

// Called by the JS glue after the original .dat assets are mounted into MEMFS.
extern "C" int th06_init(void)
{
    g_Supervisor.hInstance = (HINSTANCE)1;

    if (g_Supervisor.LoadConfig((char *)TH_CONFIG_FILE) != ZUN_SUCCESS)
    {
        // Missing config is non-fatal: the engine initializes defaults.
        g_GameErrorContext.Flush();
    }

    // Force the DrawPrimitiveUP path (no vertex buffers for 2D/3D draws). This
    // path includes per-vertex DIFFUSE color, which is essential for sprite tinting
    // (menu mandala, player, enemies, bullets all get their color from vertex diffuse).
    // The vertex-buffer path uses XYZRHW|TEX1 (no diffuse) and relies on TEXTUREFACTOR
    // for coloring, but TEXTUREFACTOR is only wired to the combiner in the GCOS_USE_D3D_
    // HW_TEXTURE_BLENDING fallback mode (for GPUs lacking ADD support). Since our WebGL2
    // device supports ADD, the normal path uses COLORARG2=DIFFUSE, so we MUST provide
    // per-vertex diffuse — which this flag enables.
    g_Supervisor.cfg.opts |= (1 << GCOS_DONT_USE_VERTEX_BUF);

    // The web build always runs windowed. This also matters for the frame loop:
    // GameWindow::Render() only advances logic past frame 0 when
    // (cfg.windowed || ShouldRunAt60Fps()) holds; with a default/zeroed config
    // both are false, which would freeze the state machine at its initial state.
    g_Supervisor.cfg.windowed = 1;

    if (GameWindow::InitD3dInterface())
    {
        g_GameErrorContext.Flush();
        return 1;
    }

    GameWindow::CreateGameWindow(g_Supervisor.hInstance);

    // The web "window" is always active. Without this, GameWindow::Render()
    // early-returns every frame (it gates on lastActiveAppValue, normally set by
    // the Win32 WM_ACTIVATEAPP message we never deliver), freezing all logic.
    g_GameWindow.lastActiveAppValue = 1;
    g_GameWindow.isAppActive = 1;

    if (GameWindow::InitD3dRendering())
    {
        g_GameErrorContext.Flush();
        return 1;
    }

    g_SoundPlayer.InitializeDSound(g_GameWindow.window);
    Controller::GetJoystickCaps();
    Controller::ResetKeyboard();

    g_AnmManager = new AnmManager();

    if (Supervisor::RegisterChain() != ZUN_SUCCESS)
    {
        return 1;
    }

    g_GameWindow.curFrame = 0;
#ifdef TH06_BOOT_TRACE
    fprintf(stderr, "[th06] init OK (config+D3D+sound+chain), entering frame loop\n");
#endif
    return 0;
}

// Called by the JS glue (or main()) to start the frame loop.
extern "C" void th06_run(void)
{
#ifdef __EMSCRIPTEN__
    // fps = 0 → requestAnimationFrame paced. simulate_infinite_loop = 0 so this
    // returns to JS after registering the loop (JS drives init/run timing).
    emscripten_set_main_loop(th06_frame, 0, 0);
#else
    while (!g_GameWindow.isAppClosing)
    {
        th06_frame();
    }
#endif
}

int main(void)
{
#ifdef __EMSCRIPTEN__
    // In the browser the JS glue mounts the original .dat into MEMFS first, then
    // calls th06_init()/th06_run() via ccall. So main() does nothing here.
    return 0;
#else
    if (th06_init() != 0)
    {
        return 1;
    }
    th06_run();
    return 0;
#endif
}
