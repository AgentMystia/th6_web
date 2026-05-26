// <direct.h> shim: directory helpers (config/score/replay paths map to IDBFS/MEMFS).
#pragma once

#ifdef __cplusplus
extern "C"
{
#endif
    int _mkdir(const char *path);
    char *_getcwd(char *buffer, int maxlen);
    int _chdir(const char *path);
#ifdef __cplusplus
}
#endif
