# Benchmarks

`bun run benchmark:cpp` measures only this package's optimized C++ generator.
The runner verifies the package identity, compiles a fresh executable in a
temporary directory, runs that executable in a separate process, reports the
CSV metrics plus package/runtime metadata, and removes the temporary build
directory before exiting.

Use the smoke budget in CI or a quick local check:

```sh
bun run benchmark:cpp:smoke
```

The smoke build runs 32 fast cases, 8 render cases, and 2 parallel batches per
benchmark, and rejects any average above 1,000,000 microseconds. Full-run
timings are directional and should be repeated on the same machine before a
performance change is considered stable.

The benchmark covers matrix generation, packed base64, cold and cache-hit PNG
rendering, gradients, styled previews, SVG, base64 encoding, and parallel PNG
work. It is not a React Native mount or device benchmark; measure those
separately in the example app.
