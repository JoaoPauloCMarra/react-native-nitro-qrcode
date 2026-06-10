# Changelog

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
- Updated the Expo example patch dependencies to current SDK 56-compatible
  versions.
- Hardened the C++ test harness so compiler and LLVM tooling resolve through
  the active Xcode toolchain when PATH lookup is insufficient.

## 0.4.0

- Updated the repo, package, and Expo example to Expo SDK 56, React Native 0.85, React 19.2, TypeScript 6, and Nitro Modules 0.35.7.
- Raised the iOS deployment target to 16.4 to match the Expo SDK 56 native baseline.
- Switched the lint and Jest setup to SDK 56-compatible packages, including the external React Native Jest preset.
- Enabled React Compiler in the Expo example and isolated the FPS metric so it no longer re-renders the whole QR builder.
- Strengthened public TypeScript types for QR colors, gradient tuples, QR versions, and mask patterns so invalid options are caught earlier in IDEs and AI-assisted edits.
- Added `QRCodeBackgroundColor` with `"transparent"` background support while keeping foreground, stroke, eye, eyeball, and gradient colors hex-only.
- Added `#RGB` and `#RGBA` shorthand normalization for QR colors across native and web paths.
- Reserved the full logo footprint in PNG output before drawing modules, then cleared that footprint to transparency so QR modules do not sit under transparent or rounded logo corners.
- Updated the README API reference, TypeScript guidance, and logo/background documentation to match the current package behavior.
- Added the C++ ASan/UBSan sanitizer pass to release verification.
- Removed stale template dependencies and regenerated the Expo example native projects cleanly for SDK 56.

## 0.3.0

- Added `shapeOptions.bodyDensity` with `"sparse"`, `"balanced"`, and `"dense"` output density controls across native and web renderers.
- Kept `"dense"` as the default QR body density for scanability and platform parity.
- Reduced component raster cost while preserving output quality for live example rendering.
- Added scan-safe option normalization, stricter scanability validation coverage, and hashed cache keys so QR payload values are not stored in cache metadata.
- Updated native bridge, generated Nitro bindings, C++ tests, benchmarks, and the Expo example for the body-density option.
- Replaced README screenshots with a single current demo image and documented the new density controls.

## 0.2.2

- Updated the Expo example to the current SDK 55 patch recommendations.
- Shipped a package-level Watchman config to ignore Android CMake/build output.
- Added C++ bridge option mapping tests for native boundary argument conversion.
- Added validation coverage for low-contrast scanability and gradient coordinate errors.
- Added package tarball auditing and example smoke scripts for release verification.
- Added an Expo example config plugin to keep generated Android Gradle files on assignment syntax.

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
- Extended docs and example app to cover loading placeholders, exports, presets, and validation guidance.
- Reduced native generation lock contention by moving cache synchronization into the C++ output cache and updating LRU order on cache hits.
- Added native benchmark and sanitizer scripts for C++ QR render, cache, matrix, SVG, base64, and parallel paths.

## 0.2.0

- Added rounded body modules with `shapeOptions.shape: "rounded"` on native and web.
- Added `shapeOptions.cornerRadius` for square module rounding and `shapeOptions.eyePatternCornerRadius` support for finder eyes.
- Added `logoBackgroundColor` so logo safe areas can differ from the QR background color.
- Updated the Expo example to the current Expo SDK 55 patch recommendation.

## 0.1.0

- Added branded QR styling with foreground gradients, custom eye colors, module gaps, and centered logo safe areas.
- Added async PNG export helpers for non-blocking QR generation in React Native UI flows.
- Added an upgraded Expo example app with color, shape, logo, performance, matrix, and cache controls.
- Kept the public QR layout scan-safe by validating output through the matrix layout boundary.
- Removed package test sources from Android and iOS app builds.
- Updated the package build target, generated Nitro bindings, README screenshots, and release metadata.

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
- Added Jest coverage at 100% for TypeScript entrypoints.
- Added C++ core tests.
