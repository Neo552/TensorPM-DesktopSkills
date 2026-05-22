# Third-Party Notices

This skill bundles `whisper-cli` built from `ggml-org/whisper.cpp` tag `v1.8.4`
at commit `9386f239401074690479731c1e41683fbbeac557`.

The bundled binary is built for macOS arm64 with:

```bash
cmake -B build-static-macos13-noblas -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0 -DGGML_BLAS=OFF
cmake --build build-static-macos13-noblas --config Release --target whisper-cli -j
```

The upstream MIT license text is included at
`assets/bin/darwin-arm64/WHISPER_CPP_LICENSE`.
