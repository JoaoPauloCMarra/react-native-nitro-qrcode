# Changelog

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
