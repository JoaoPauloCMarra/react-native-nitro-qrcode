# fpng

Vendored from [richgel999/fpng](https://github.com/richgel999/fpng) for
RGBA PNG export only. Indexed 1-bit QR PNGs still use the package zlib writer.

- Pinned upstream commit: `925796543b9d26b8edfcdcecd94c1dac280f29fc`
- License: Unlicense (see the footer in `fpng.cpp`)
- Synchronization policy: copy `src/fpng.cpp` and `src/fpng.h` verbatim; do
  not edit them in place. Wrap compiler-warning suppression and the
  documented x86/x64 `-msse4.1 -mpclmul` target in `fpng_unity.cpp`.

The host bake-off on Apple Silicon (ARM64, `-O2`) used
`FPNG_ENCODE_SLOWER` because the single-pass mode wrote substantially larger
files. SSE4.1 is unavailable on this architecture; the scalar path still beat
the previous zlib RGBA writer. See `docs/benchmarks.md`.
