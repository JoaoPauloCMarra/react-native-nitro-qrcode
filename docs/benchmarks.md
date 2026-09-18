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
separately in the example app (`apps/example/app/e2e-png-bench.tsx`).

## iPhone 17e PNG export (cold cache)

Device: iPhone 17e, iOS 27.0 (24A437), personal team `W7FC2HV876`.
Method: 3 warmup + 20 timed iterations, `clearQRCodeCache` before each sample,
`performance.now()`. Payloads: `small-text` (`Hi`, 128 px), `medium-url`
(GitHub URL, 256 px), `large-high-res` (240-character URL, 1024 px).

Before (v0.7.2, base64-only):

| payload | method | median ms | bytes |
| --- | --- | ---: | ---: |
| small-text | sync-base64 | 1.935 | 456 |
| small-text | async-base64 | 1.216 | 456 |
| medium-url | sync-base64 | 2.755 | 948 |
| medium-url | async-base64 | 2.771 | 948 |
| large-high-res | sync-base64 | 18.093 | 4696 |
| large-high-res | async-base64 | 18.163 | 4696 |

After (0.8.0 ArrayBuffer path; base64 remains a wrapper over PNG bytes):

| payload | method | median ms | bytes |
| --- | --- | ---: | ---: |
| small-text | sync-base64 | 1.969 | 456 |
| small-text | async-base64 | 1.214 | 456 |
| small-text | sync-arraybuffer | 1.027 | 340 |
| small-text | async-arraybuffer | 1.049 | 340 |
| medium-url | sync-base64 | 2.750 | 948 |
| medium-url | async-base64 | 2.772 | 948 |
| medium-url | sync-arraybuffer | 2.737 | 709 |
| medium-url | async-arraybuffer | 2.765 | 709 |
| large-high-res | sync-base64 | 18.005 | 4696 |
| large-high-res | async-base64 | 18.326 | 4696 |
| large-high-res | sync-arraybuffer | 18.072 | 3520 |
| large-high-res | async-arraybuffer | 18.903 | 3520 |

ArrayBuffer `bytes` are raw PNG length; base64 `bytes` are the encoded string
length. Encode work dominates medium and large payloads, so those medians sit
inside run-to-run noise of the previous base64 path. The small-text sync
ArrayBuffer median was 1.027 ms on this device versus 1.935 ms for the
previous sync base64 path.
