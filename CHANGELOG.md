# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Breaking changes are always listed first in each release section.

## [0.10.0] - 2026-10-03

### Breaking changes

No API changes. Two behavior changes can affect existing callers:

- An image decoding failure without an `onError` handler now throws to the nearest error boundary, the same as a generation error. In 0.9.1 the component rendered blank. Migration: pass `onError` or wrap the component in an error boundary.
- With `scanSafe: "strict"`, a gradient with a stop that has low contrast against the background is now rejected, and `scanSafe: true` warns and names the stop as `gradient.colors[i]`. In 0.9.1 only the unused solid foreground color was checked. Migration: raise the contrast of the named gradient stop, or use `scanSafe: true` to keep the gradient with a warning.

### Added

- The QRCode component accepts an optional `accessibilityLabel` for localized descriptions that do not expose the encoded payload.

### Fixed

- Scan-safe contrast validation checks the configured gradient stops instead of the unused solid foreground color when a gradient is active.
- The default accessibility label describes the loaded image, and its busy state stays active while the next PNG loads. The existing `onReady` callback still reports generation completion.
- Image decoding failures reach `onError`, or the nearest error boundary when no handler is supplied. Errors from a replaced image are ignored.

## [0.9.1] - 2026-10-01

### Breaking changes

None.

### Changed

- Native gradient PNGs larger than 1024 px are written by a streaming encoder. Peak native memory for a 4096 px gradient drops from about 320 MiB to about 18 MiB. These PNGs decode to the same pixels as in 0.9.0, but their bytes and file size differ (15 to 35% larger for opaque gradients in host measurements), and encoding took 35 to 45% longer in the same measurements. Gradients of 1024 px or smaller, and all two-color and palette PNGs, are byte-identical to 0.9.0.

### Fixed

- The native cache no longer becomes inconsistent, or crashes during eviction, when a memory allocation fails while it stores an entry.
- PNG buffers returned by the `generatePngArrayBuffer*` methods are sized to the PNG instead of keeping the encoder's working capacity, which could be several megabytes for a gradient.
- Native PNG generation releases an internal buffer before encoding, which lowers peak memory by 2 to 8 MiB at 4096 px for two-color and palette PNGs.
- Values of 65,536 bytes or more are rejected immediately with the same `Segment too long` error, without first copying the value.
- The podspec excludes C++ test sources, so path and git installs no longer compile them into the pod.
- The native RGBA PNG size check is overflow-safe on 32-bit Android. The JavaScript API could not reach the overflow.
- The README documents that the deprecated positional async native methods throw synchronously for invalid numeric and color options.

## [0.9.0] - 2026-09-30

### Breaking changes

- **React Native 0.77 or newer is required.** The `react-native` peer range is now `>=0.77.0 <1.0.0` (Expo SDK 53 or newer). `react-native-nitro-modules` 0.37 does not compile on React Native 0.76. Migration: upgrade React Native 0.75 and 0.76 apps to 0.77 or newer, or Expo SDK 52 apps to SDK 53 or newer.
- **Gradients now cover finders, eyeballs, timing, and alignment patterns by default.** An unset `eyeColor`, `eyeballColor`, `alignmentColor`, or `timingColor` follows the foreground fill, including a gradient, on iOS, Android, and web. In 0.8.1 these patterns were solid black on native gradient output. Migration: set `eyeColor`, `eyeballColor`, `alignmentColor`, and `timingColor` explicitly to keep solid patterns. An explicitly set layer color always paints solid, even when it equals `foregroundColor`.
- **Web PNG edges use floor rounding.** Web module, quiet-zone, stroke-inset, and logo-hole edges now use the same integer floor rules as native, so web PNG pixels move by up to one pixel at module edges. Migration: regenerate stored web PNG snapshots or golden images.
- **Resolvers without the `react-native` condition load the web entry.** `node`, `import`, `require`, and `default` now resolve to `lib/*/index.web.js` instead of the native entry. The web entry imports `react-native`, so it needs `react-native` aliased to `react-native-web` (Expo web and server rendering, Next.js). Migration: alias `react-native` to `react-native-web` in those environments; Jest setups that use the React Native preset keep the native entry.
- **Direct `HybridQRCode` callers:** `strokeColor`, `eyeColor`, `eyeStrokeColor`, and `eyeballColor` in the object-shaped `GenerateOptions` are now optional. Omitting a color means "inherit"; passing it means "paint solid". Migration: omit the field instead of passing `#000000` when the pattern should follow the foreground.

Strokes are unchanged from 0.8.1: `strokeColor` and `eyeStrokeColor` draw a stroke only when set to a color other than `#000000`. Plain black-on-white native PNGs are byte-identical to 0.8.1.

### Fixed

- Native finder colors no longer depend on which PNG encoder runs. A non-black `foregroundColor` previously turned unset finders black when a logo area, gradient, or custom layer color was added.
- Inverted codes (light foreground on a dark background) no longer report `low-contrast` for finders that follow the foreground, and a low-contrast foreground produces one warning instead of one per inherited pattern.
- The deprecated positional native PNG methods derive alignment, timing, quiet-zone, and finder-inner colors and shapes like the object methods, so both return identical bytes.
- `<QRCode>` honors the deprecated `shapeOptions.eyePatternShape` alias instead of letting the preset finder shape win.
- Web clears the logo hole at the center of the rendered canvas when `size` is smaller than the module count, so it no longer removes finder modules outside the hole.
- Native `toSvgString` keeps the full radial-gradient radius (for example `r="141.42%"`) to match web SVG and native PNG output.
- The component accessibility label and busy state describe the image on screen while a regeneration is pending or after it fails.
- Web `getMatrix` is counted in generation metrics like native.
- The package `exports` map lists `browser` before `react-native`, so React Native Web on bare Metro loads the web entry.
- The iOS podspec uses React Native's `min_ios_version_supported` (15.1 on React Native 0.77–0.86) instead of iOS 16.4, so default bare React Native and Expo SDK 53–55 apps install.

### Changed

- Native PNGs with layered colors or a logo area and no gradient use a 4-bit palette encoder with the same pixels as 0.8.1. A 4096 px logo-area PNG peaked at about 36 MB instead of about 355 MB in host measurements, and the files are smaller. Gradient PNGs keep the `fpng` RGBA encoder and still peak at about 355 MB at 4096 px.
- The Android library no longer pins `kotlin-stdlib`; the app's Kotlin version applies.
- `orbit` is marked `@deprecated` in the TypeScript types. It remains a no-op.
- The README documents component defaults, layer-color rules, validation codes, metrics availability, compatibility floors, and pixel-geometry rules.

## [0.8.1] - 2026-09-27

### Breaking changes

- None.

### Fixed

- Preserve embedded NUL bytes in native QR payloads.
- Honor web version bounds and choose the highest error correction level that fits the selected version.
- Preserve preset values when component props are undefined and retain styled geometry in synchronous and asynchronous web rendering.
- Clamp native gradient colors outside their declared stop range.
- Count successful and failed generation requests consistently across helpers and report web cache bytes through both metrics APIs.

## [0.8.0] - 2026-09-18

### Breaking changes

- None.

### Added

- Native and web `toPngArrayBuffer` / `toPngArrayBufferAsync` helpers, plus
  `generatePngArrayBufferObject` / `generatePngArrayBufferAsyncObject` on the
  Nitro HybridObject, return PNG bytes as an owning `ArrayBuffer` without a
  base64 string crossing the JSI boundary.
- Host C++ tests decode a real Nayuki matrix with vendored `quirc` so
  scan-back stays independent of the generator. `quirc` is test-only and is
  not linked into the published iOS or Android libraries.
- `diamond`, `squircle`, and `classy` module and finder shapes, plus `classy`,
  `mosaic`, and `fluid` presets. Classy rounds only outer corners so adjacent
  modules connect. Rust styling crates were measured and not vendored.
- Optional `alignmentColor`, `timingColor`, `quietZoneColor`, and
  `finderInnerColor`, plus `shapeOptions.alignmentShape` /
  `shapeOptions.timingShape`, so every QR region can be styled without moving
  the matrix. Omitted values keep the previous body/background look.

### Fixed

- Host C++ tests compile vendored `fpng` through `FPNG_NO_SSE` in
  `fpng_unity.cpp`, so clang 18 on baseline x86-64 no longer requires
  SSE4.1+pclmul for the whole binary.

### Changed

- Native `getQRCodeMetrics()` now reports live `cacheBytes` from the output
  cache, matching the web entry.
- Native `generatePngBase64Object` / `generatePngDataUriObject` (and their
  async and deprecated positional wrappers) now encode from the PNG byte path
  instead of caching a pre-encoded base64 string.
- Native RGBA PNG export (gradients, layered colors, and logo-area clearing)
  now uses vendored `fpng` two-pass encoding. Flat two-color QR codes still
  use the existing 1-bit indexed zlib writer. The Nayuki QR matrix encoder is
  unchanged.
- The example and workspace Expo pins follow SDK 57.0.24 (`expo-doctor` /
  `expo install --check`). React Native stays `0.86.3`.

## [0.7.2] - 2026-09-10

### Breaking changes

- None.

### Fixed

- iOS builds using static frameworks and source-built React Native now resolve
  Folly and React Native headers when compiling the Nitro Swift/C++ bridge.

## [0.7.1] - 2026-09-09

### Breaking changes

- None.

### Fixed

- Reject scanability warnings during generation with `scanSafe: "strict"`
  on native and web, including low-contrast colors.
- Keep the loaded QR visible until its replacement image loads and disable
  Android image fading, preventing blank or faded frames during value updates
  with `keepPreviousImage` enabled ([#25](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/issues/25)).
- Apply the Kotlin Android plugin only when the Gradle Kotlin extension is
  absent, so AGP 9 consumers that already ship built-in Kotlin can configure
  the library.

### Changed

- Built QR cache-request keys without intermediate `std::to_string`
  allocations while preserving the cache-key format.

## [0.7.0] - 2026-08-25

### Breaking changes

- None.

### Changed

- Replaced the native PNG encoder's byte-at-a-time CRC loop with zlib's
  optimized chunked `crc32` implementation; generated PNG bytes and validation
  behavior are unchanged.
- Cleared the QR preview's accessibility busy state after async generation so
  assistive technology receives the completed preview state.
- Restored the four positional native PNG methods as deprecated wrappers over
  the object-based methods, so existing native callers continue to work.
- Bounded the native matrix cache to 32 entries or 512 KiB and exposed a
  default combined native output/matrix cache bound of 4.5 MiB.
- Preserved native SVG serialization: one `1x1` path segment per dark module
  and the normalized color spelling in the returned string. Web SVG retains its
  horizontal-run serialization. SVG cache requests keep spelling-sensitive
  keys; PNG cache requests still use parsed color bytes.
- Added `getMatrixObject()` returning `{ size, packedBase64 }` in a single
  bridge crossing and `getCacheBytes()` for byte-accurate cache accounting;
  `getMatrixSize()` + `getMatrixPackedBase64()` remain available.
- Exposed the additive `QRCodeKnownValidationErrorCode` alias while preserving
  the established `QRCodeValidationError.code` and `QRCodeValidationErrorCode`
  literal union for strict TypeScript consumers.
- Direct upgrades from 0.5.x or earlier still require the Nitro Modules 0.37
  native rebuild documented in the 0.6.0 release.
- Clarified object-API compatibility, native/web SVG serialization, PNG-only
  logo-area clearing, scan-safe customization, and the isolated benchmark
  scope without changing defaults or encoded PNG/SVG bytes.

## [0.6.0] - 2026-08-20

### Breaking changes

- `react-native-nitro-modules` now requires
  `>=0.37.0 <0.38.0`; upgrade the Nitro peer before upgrading this package.

### Changed

- Updated the package compatibility baseline to Nitro Modules 0.37.0 while
  preserving the existing QR rendering and export APIs.
- Tightened the public validation-error code type to match the stable values
  returned by runtime validation.
- Added an explicit React Native 0.87 Strict TypeScript declaration check for
  the `QRCode` component props and ref types. The consumer-facing QRCode API
  is unchanged.

### Fixed

- Aligned the iOS pod module name with Nitro's `NitroQRCode` generated Swift
  bridge so CocoaPods consumers receive a stable native module import.
- Aligned the podspec source tag with the repository's `v<version>` release tag
  convention.
- Expanded the example app's developer API demonstration to cover validation,
  SVG export, PNG data-URI export, and packed matrix helpers.

## [0.5.0] - 2026-08-12

### Changes

- **Breaking changes:** None. The deprecated no-op `orbit` option remains
  accepted for source compatibility, synchronous PNG helpers retain the
  established 4096-pixel bound, and hidden native-only shapes remain outside
  the public contract.
- Updated package compatibility to Nitro Modules 0.36.5, Expo SDK 57, and
  React Native 0.86.
- Made native and web cache hits verify the full normalized request after
  hashed lookup, with limits of 128 entries or 4 MiB.
- Reused one native matrix generation across the existing size and packed-data
  bridge calls while preserving the Nitro ABI and public return shape.
- Rejected invalid component layout sizes before rendering or QR generation,
  while keeping direct generation helpers available through 4096 pixels.
- Fixed transparent web PNG generation: the background is cleared to real
  alpha instead of being filled with an invalid `"transparent"` color.
- Implemented `boostEcl` on web by raising the error correction level as high
  as the chosen version allows, matching native behavior.
- Unified circle module geometry to an inscribed ellipse on web, matching the
  native renderer, with a documented one-pixel golden tolerance.
- Added a committed native/web encoder parity corpus with decode-back tests
  covering UTF-8, numeric, alphanumeric, fixed-version, masked, boosted, and
  maximum-size inputs, plus golden reference checks in the C++ test gate.
- Kept synchronous native PNG helpers compatible through 4096 pixels while
  recommending async helpers for UI work.
- Made web async PNG helpers render in row bands and yield to the main thread
  between bands; the web component now generates asynchronously with
  staleness handling.
- Replaced the single-slot native matrix cache with a bounded 32-entry
  least-recently-used cache shared by both matrix bridge calls.
- Extracted independently tested bounded LRU modules on web (`src/cache.ts`)
  and native (`cpp/core/BoundedCache.hpp`).
- Added accessible semantics to the component: the image is labeled with the
  QR meaning, generation state is announced as busy, and the logo overlay is
  hidden from the accessibility tree.
- Added development-only generation metrics (`getQRCodeMetrics`,
  `resetQRCodeMetrics`, `setQRCodeMetricsEnabled`) with request, failure,
  timing, and web cache counters, gated off in production builds.
- Added an object-typed `GenerateOptions` native ABI
  (`generatePngBase64Object` and related methods) while keeping the positional
  methods for binary compatibility; the JavaScript layer now calls the object
  ABI, and the native class declares every object-ABI override in its header.
- Included `cpp/core/BoundedCache.hpp` in the iOS podspec sources so the
  packaged native library matches the Android CMake sources.
- Clamped the web PNG canvas to at least the full module grid, matching the
  native output size for small requested sizes.
- Exported the `HybridQRCode` type from the web entry, matching the native
  entry's public type surface.
- Removed the unused `setMetricsCacheBytes` metrics export; web cache byte
  counts come from the web cache itself.
- Recorded the vendored Nayuki encoder provenance (pinned upstream commit and
  checksums) with a synchronization policy and a parity-corpus generator.

## [0.4.3] - 2026-07-30

### Changes

- **Breaking changes:** None.
- Updated package compatibility to Nitro Modules 0.36.4, Expo SDK 57, and
  React Native 0.86.
- Made native and web cache hits verify the full normalized request after
  hashed lookup, with limits of 128 entries or 4 MiB.
- Reused one native matrix generation across the existing size and packed-data
  bridge calls while preserving the Nitro ABI and public return shape.
- Rejected invalid component layout sizes before rendering or QR generation,
  while keeping direct generation helpers available through 4096 pixels.

## [0.4.2]

- Shipped the current package artifact with the README, badges, compatibility
  table, option reference, and TypeScript guidance aligned to the package API.
- Kept native and web QR component behavior consistent by sharing option
  normalization, validation, and component generation logic across entrypoints.
- Hardened public TypeScript contracts for QRCode colors, gradients, versions,
  masks, layouts, and component props.

## [0.4.1]

- Avoided redundant `<QRCode />` regeneration when nested `shapeOptions` or
  `gradient` props are recreated with the same values.
- Removed an extra image-clearing render while preserving `keepPreviousImage`
  behavior on native and web.
- Added `valid` to `QRCodeValidationResult` so validation flows can branch on a
  typed boolean instead of checking the error array manually.
- Tightened `logoBackgroundColor` to the same typed background color surface as
  QR output.
- Updated README examples, badges, compatibility notes, option tables, and
  TypeScript guidance to match the current package API.

## [0.4.0]

- Updated the package to Expo SDK 56, React Native 0.85, React 19.2, TypeScript 6, and Nitro Modules 0.35.7.
- Raised the iOS deployment target to 16.4 to match the Expo SDK 56 native baseline.
- Strengthened public TypeScript types for QR colors, gradient tuples, QR versions, and mask patterns so invalid options are caught earlier in IDEs and AI-assisted edits.
- Added `QRCodeBackgroundColor` with `"transparent"` background support while keeping foreground, stroke, eye, eyeball, and gradient colors hex-only.
- Added `#RGB` and `#RGBA` shorthand normalization for QR colors across native and web paths.
- Reserved the full logo footprint in PNG output before drawing modules, then cleared that footprint to transparency so QR modules do not sit under transparent or rounded logo corners.
- Updated the README API reference, TypeScript guidance, and logo/background documentation to match the current package behavior.

## [0.3.0]

- Added `shapeOptions.bodyDensity` with `"sparse"`, `"balanced"`, and `"dense"` output density controls across native and web renderers.
- Kept `"dense"` as the default QR body density for scanability and platform parity.
- Reduced component raster cost while preserving output quality.
- Added scan-safe option normalization, stricter scanability validation coverage, and hashed cache keys so QR payload values are not stored in cache metadata.
- Documented the new density controls in the README.

## [0.2.2]

- Shipped a package-level Watchman config to ignore Android CMake/build output.
- Added validation coverage for low-contrast scanability and gradient coordinate errors.

## [0.2.1]

- Added `<QRCode />` loading callbacks and placeholders:
  - `onReady`, `onError`
  - `placeholder`, `keepPreviousImage`, `hideLogoUntilReady`
- Added explicit rendering presets:
  - `preset="default" | "rounded" | "dots" | "branded"`
- Added `NitroQRCode.validateOptions()` with scanability warnings and errors.
- Added imperative component exports:
  - `ref.current.toPngDataUri()`
  - `ref.current.toPngBase64()`
- Extended docs to cover loading placeholders, exports, presets, and validation guidance.
- Reduced native generation lock contention by moving cache synchronization into the C++ output cache and updating LRU order on cache hits.

## [0.2.0]

- Added rounded body modules with `shapeOptions.shape: "rounded"` on native and web.
- Added `shapeOptions.cornerRadius` for square module rounding and `shapeOptions.eyePatternCornerRadius` support for finder eyes.
- Added `logoBackgroundColor` so logo safe areas can differ from the QR background color.

## [0.1.0]

- Added branded QR styling with foreground gradients, custom eye colors, module gaps, and centered logo safe areas.
- Added async PNG export helpers for non-blocking QR generation in React Native UI flows.
- Kept the public QR layout scan-safe by validating output through the matrix layout boundary.
- Removed package test sources from Android and iOS app builds.

## [0.0.2]

- Normalize JS-side QR options consistently across native and web before generation.
- Validate invalid error-correction levels and inverted version ranges before crossing native or web QR generation boundaries.

## [0.0.1]

- Initial QR-only Nitro module.
- Added shared C++ QR generation through Project Nayuki's encoder.
- Added native PNG base64/data URI generation with deterministic caching.
- Added SVG string and packed matrix export helpers.
- Added React Native `Image`-backed `QRCode` component.
- Added web fallback for Expo web demos.
