# Changelog

## 0.5.0 - 2026-08-12

### Changes

- **Breaking changes:** None. The deprecated no-op `orbit` option remains
  accepted for source compatibility, synchronous PNG helpers retain the
  established 4096-pixel bound, and hidden native-only shapes remain outside
  the public contract.
- Updated package compatibility to Nitro Modules 0.36.4, Expo SDK 57, and
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

## 0.4.3 - 2026-07-30

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

## 0.4.2

- Shipped the current package artifact with the README, badges, compatibility
  table, option reference, and TypeScript guidance aligned to the package API.
- Kept native and web QR component behavior consistent by sharing option
  normalization, validation, and component generation logic across entrypoints.
- Hardened public TypeScript contracts for QRCode colors, gradients, versions,
  masks, layouts, and component props.

## 0.4.1

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

## 0.4.0

- Updated the package to Expo SDK 56, React Native 0.85, React 19.2, TypeScript 6, and Nitro Modules 0.35.7.
- Raised the iOS deployment target to 16.4 to match the Expo SDK 56 native baseline.
- Strengthened public TypeScript types for QR colors, gradient tuples, QR versions, and mask patterns so invalid options are caught earlier in IDEs and AI-assisted edits.
- Added `QRCodeBackgroundColor` with `"transparent"` background support while keeping foreground, stroke, eye, eyeball, and gradient colors hex-only.
- Added `#RGB` and `#RGBA` shorthand normalization for QR colors across native and web paths.
- Reserved the full logo footprint in PNG output before drawing modules, then cleared that footprint to transparency so QR modules do not sit under transparent or rounded logo corners.
- Updated the README API reference, TypeScript guidance, and logo/background documentation to match the current package behavior.

## 0.3.0

- Added `shapeOptions.bodyDensity` with `"sparse"`, `"balanced"`, and `"dense"` output density controls across native and web renderers.
- Kept `"dense"` as the default QR body density for scanability and platform parity.
- Reduced component raster cost while preserving output quality.
- Added scan-safe option normalization, stricter scanability validation coverage, and hashed cache keys so QR payload values are not stored in cache metadata.
- Documented the new density controls in the README.

## 0.2.2

- Shipped a package-level Watchman config to ignore Android CMake/build output.
- Added validation coverage for low-contrast scanability and gradient coordinate errors.

## 0.2.1

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

## 0.2.0

- Added rounded body modules with `shapeOptions.shape: "rounded"` on native and web.
- Added `shapeOptions.cornerRadius` for square module rounding and `shapeOptions.eyePatternCornerRadius` support for finder eyes.
- Added `logoBackgroundColor` so logo safe areas can differ from the QR background color.

## 0.1.0

- Added branded QR styling with foreground gradients, custom eye colors, module gaps, and centered logo safe areas.
- Added async PNG export helpers for non-blocking QR generation in React Native UI flows.
- Kept the public QR layout scan-safe by validating output through the matrix layout boundary.
- Removed package test sources from Android and iOS app builds.

## 0.0.2

- Normalize JS-side QR options consistently across native and web before generation.
- Validate invalid error-correction levels and inverted version ranges before crossing native or web QR generation boundaries.

## 0.0.1

- Initial QR-only Nitro module.
- Added shared C++ QR generation through Project Nayuki's encoder.
- Added native PNG base64/data URI generation with deterministic caching.
- Added SVG string and packed matrix export helpers.
- Added React Native `Image`-backed `QRCode` component.
- Added web fallback for Expo web demos.
