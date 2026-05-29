# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TouhouWeb is a C++ WASM port of the Touhou 6 (東方紅魔郷 ~ the Embodiment of Scarlet Devil) decompilation by GensokyoClub/th06, compiled to WebAssembly via Emscripten. The engine renders through a D3D8→WebGL2 translation layer.

## Build Commands

```bash
# WASM build (requires Emscripten)
export EM_CACHE=$PWD/build/emcache        # sandbox: ~/.cache may be read-only
emcmake cmake -S . -B build/cmake -DCMAKE_BUILD_TYPE=Release
cmake --build build/cmake -j$(nproc)
# Output: build/cmake/th06.js + build/cmake/th06.wasm

# Native headless build (for boot validation, requires 32-bit pointers)
cmake -S . -B build-native -DCMAKE_CXX_FLAGS=-m32 && cmake --build build-native

# Deploy: copy build output to build/web/ and push
cp build/cmake/th06.js build/cmake/th06.wasm src/web/index.html assets/hitbox.png build/web/
```

## Architecture

### Rendering Pipeline

`gl_device.cpp` (`src/native/platform/`) is the core D3D8→WebGL2 translation layer. It implements:
- D3D fixed-function pipeline via GLSL shaders (texture combiners, alpha blend/test, depth, fog)
- Two vertex paths: **XYZRHW** (pre-transformed, 2D sprites) and **XYZ** (3D backgrounds with perspective)
- `DrawPrimitiveUP` → `glDrawArrays` with FVF-based vertex attribute setup
- `AnmManager::Draw2` (2D sprites) and `Draw3` (rotated/3D sprites) project 128×128 model-space corners through `D3DXVec3Project` to produce XYZRHW screen-space quads

### Engine Sources

`src/native/engine/` contains the vendored decompilation (100+ files). Key classes:
- **Supervisor** — window, D3D device, config, viewport
- **GameManager** — game state machine, camera setup, player/bullet/effect coordination
- **AnmManager** — sprite/animation system: ANM file loading, script execution, rendering
- **EnemyManager** — enemy lifecycle, ECL-driven behavior, multi-VM sprite slots
- **BulletManager** — bullet patterns and collision
- **Player** — player state, hitbox rendering, bomb handling
- **EclManager** — ECL bytecode interpreter for enemy AI

### Platform Layer

`src/native/platform/`:
- `web_main.cpp` — Entry point: `th06_init()` / `th06_run()` / `th06_key_state_ptr()` exported to JS
- `gl_device.cpp` — D3D8→WebGL2 device implementation
- `dx_stub.cpp` — Inert stubs for DirectX/DSound/DInput
- `win32_runtime.cpp` — Win32 compatibility (timing, file I/O)
- `shim-include/` — D3D/D3DX header shims with custom math implementations

### Asset Loading

- Original TH06 `.DAT` archives (PBG3 format) are embedded in the WASM binary at link time via `--embed-file`
- `FileSystem::OpenPath()` searches PBG3 archives first, falls back to `fopen()`
- Runtime assets (hitbox.png, th06font.ttf, audio) are fetched via HTTP at boot and written to Emscripten's MEMFS
- Boot HTML: `src/web/index.html` handles DAT fetch, font loading, keyboard→DIK scancode mapping

## CI/CD

Push to `main` triggers `.github/workflows/build-and-deploy.yml`:
1. Emscripten build + DAT embedding + re-link
2. Copies `index.html`, `th06.js`, `th06.wasm`, `th06font.ttf`, `hitbox.png`, audio to gh-pages
3. Force-pushes `gh-pages` branch for GitHub Pages

## Code Conventions

- Engine code is MSVC-flavoured C++ (address-of-temporary allowed, no DIFFBUILD/DLLBUILD defines)
- `#pragma var_order` blocks preserve original struct field ordering for decompilation compatibility
- `DIFFABLE_STATIC` macros create global statics matching the original binary layout
- Do not define `DIFFBUILD`/`DLLBUILD`/`BINARYMATCHBUILD` — those enable struct-size asserts against the original binary
- Compile with `-Wno-error=address-of-temporary -fno-strict-aliasing`

## Git Workflow

- Primary branch: `main`
- Development branch: `fresh-main`
- Push flow: commit to `fresh-main`, push to origin, then force-push `fresh-main:main` (requires sandbox elevation for git push)
