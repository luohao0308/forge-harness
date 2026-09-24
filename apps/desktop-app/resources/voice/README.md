# Desktop voice engine resources

Platform-specific, statically linked `whisper-cli` builds live under
`<electron-builder os>/<arch>/` with an `engine-manifest.json`. Electron Builder
copies only the current target directory to `resources/voice`; model files are
never stored here or bundled in the base application.

The macOS x64 engine is built from the pinned `whisper.cpp` `b4938` source
archive with static libraries, Apple Accelerate, `GGML_NATIVE=OFF`, Metal off,
and a macOS 13.3 deployment target. The source archive and executable hashes
are recorded in `engine-manifest.json`.

`npm run build:voice` verifies an existing engine or builds pinned `b4938`
source for the host platform. `npm run create:voice-pack -- --model <path>
--output <name>.hvoice` creates an independently importable, hash-verified
multilingual base-model pack.
