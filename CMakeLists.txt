# TH06 Web — C++ WASM build (port of the GensokyoClub/th06 decompilation).
#
# Configure/build with Emscripten:
#   export PATH=$PATH:/usr/lib/emscripten
#   export EM_CACHE=$PWD/build/emcache        # sandbox: ~/.cache is read-only
#   emcmake cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
#   cmake --build build
# Output: build/th06.js + build/th06.wasm
#
# A native (headless, stub backend) build is also supported for the golden /
# boot validation; it requires 32-bit pointers to match wasm32:
#   cmake -S . -B build-native -DCMAKE_CXX_FLAGS=-m32 && cmake --build build-native
cmake_minimum_required(VERSION 3.16)
project(th06_web CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Engine sources (the vendored decompilation). auto_stubbed.cpp is #included by
# stubs.cpp, so it must not be compiled as its own translation unit.
file(GLOB ENGINE_SOURCES CONFIGURE_DEPENDS "${CMAKE_SOURCE_DIR}/src/native/engine/*.cpp")
list(FILTER ENGINE_SOURCES EXCLUDE REGEX "auto_stubbed\\.cpp$")
file(GLOB ENGINE_PBG3 CONFIGURE_DEPENDS "${CMAKE_SOURCE_DIR}/src/native/engine/pbg3/*.cpp")

# Platform layer (web backend + entry). Currently dx_stub provides inert
# DirectX/DSound/DInput so the engine links & boots; the real WebGL2/WebAudio/
# keyboard backends replace dx_stub.cpp milestone by milestone.
set(PLATFORM_SOURCES
    "${CMAKE_SOURCE_DIR}/src/native/platform/web_main.cpp"
    "${CMAKE_SOURCE_DIR}/src/native/platform/win32_runtime.cpp"
    "${CMAKE_SOURCE_DIR}/src/native/platform/dx_stub.cpp"
    "${CMAKE_SOURCE_DIR}/src/native/platform/gl_device.cpp")

add_executable(th06 ${ENGINE_SOURCES} ${ENGINE_PBG3} ${PLATFORM_SOURCES})

target_include_directories(th06 PRIVATE
    "${CMAKE_SOURCE_DIR}/src/native/engine"
    "${CMAKE_SOURCE_DIR}/src/native/platform/shim-include")

# The decompilation is MSVC-flavoured C++: it takes the address of temporaries
# (allowed by MSVC). Downgrade that to a warning. Do NOT define DIFFBUILD/
# DLLBUILD/BINARYMATCHBUILD — those enable struct-size asserts against the
# original binary that our shim structs need not satisfy.
target_compile_options(th06 PRIVATE -Wno-error=address-of-temporary -fno-strict-aliasing)

if(EMSCRIPTEN)
    set_target_properties(th06 PROPERTIES OUTPUT_NAME "th06" SUFFIX ".js")
    # gl_device.cpp needs libpng (texture decode) and GLES3 (WebGL2).
    target_compile_options(th06 PRIVATE -sUSE_LIBPNG=1)
    target_link_options(th06 PRIVATE
        -sUSE_WEBGL2=1
        -sFULL_ES3=1
        -sUSE_LIBPNG=1
        -sALLOW_MEMORY_GROWTH=1
        -sFORCE_FILESYSTEM=1
        -sEXPORTED_FUNCTIONS=_main,_th06_init,_th06_run,_th06_key_state_ptr
        -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,FS,HEAPU8
    )
endif()
