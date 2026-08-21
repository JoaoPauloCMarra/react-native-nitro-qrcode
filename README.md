# react-native-nitro-qrcode

[![npm version](https://img.shields.io/npm/v/react-native-nitro-qrcode?color=f97316&label=npm)](https://www.npmjs.com/package/react-native-nitro-qrcode)
[![npm downloads](https://img.shields.io/npm/dm/react-native-nitro-qrcode?color=22c55e&label=downloads)](https://www.npmjs.com/package/react-native-nitro-qrcode)
[![CI](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/actions/workflows/ci.yml/badge.svg)](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/react-native-nitro-qrcode?color=007ec6)](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/blob/main/LICENSE)
[![React Native](https://img.shields.io/badge/react--native-0.87.0-61dafb)](https://reactnative.dev/docs/0.87/getting-started-without-a-framework)
[![Expo](https://img.shields.io/badge/expo-SDK%2057%20%28RN%200.86.2%29-000020)](https://docs.expo.dev/versions/v57.0.0/)
[![Nitro Modules](https://img.shields.io/badge/nitro--modules-%3E%3D0.37.0%20%3C0.38.0-black)](https://nitro.margelo.com/)
[![TypeScript](https://img.shields.io/badge/typescript-6.0-3178c6)](https://www.typescriptlang.org/)

Typed QR code generation for React Native, Expo development builds, and web.
The native iOS and Android paths use a shared C++ Nitro module and the web path
uses a JavaScript fallback. The component renders a PNG-backed React Native
`Image`, so apps do not need `react-native-svg`, Skia, or canvas packages.

Use it when you need a single package for live QR rendering, PNG export, SVG
export, packed matrix export, styling, logo safe areas, scanability checks, and
deterministic caching.

<p align="center">
  <img src="https://raw.githubusercontent.com/JoaoPauloCMarra/react-native-nitro-qrcode/main/docs/demo.png" alt="react-native-nitro-qrcode demo" width="500" />
</p>

## Install

Use your app's package manager to install the package and its Nitro peer:

```sh
bun add react-native-nitro-qrcode react-native-nitro-modules
```

For Expo development builds:

```sh
bunx expo install react-native-nitro-qrcode react-native-nitro-modules
bunx expo prebuild
```

For bare React Native apps:

```sh
cd ios && pod install
```

Expo Go cannot load Nitro native modules. Use an Expo development build or a
bare React Native app.

## Compatibility

| Package | Supported range |
| --- | --- |
| React | `>=18.2.0 <20.0.0` |
| React Native | `>=0.75.0 <1.0.0` |
| Nitro Modules | `>=0.37.0 <0.38.0` |
| Expo | SDK 57 development builds; Expo Go is not supported |
| React Native Web | `>=0.19.0 <1.0.0` |
| Node | `>=18.0.0` |

Version 0.6.0 uses React Native `0.87.0` for the standalone package gate and
React Native `0.86.2` in the Expo SDK 57 example. Expo SDK 57 is the latest
stable Expo line and selects RN `0.86.2`; do not override that version. Both
baselines use React `19.2.3` and Nitro Modules `0.37.0`. The wider ranges above
are the package's declared peer compatibility.

### Upgrade from 0.5.x

Version 0.6.0 requires `react-native-nitro-modules` `>=0.37.0 <0.38.0`.
Upgrade the Nitro peer before upgrading this package; Nitro Modules 0.36.x is
not compatible with the 0.6.0 native bindings. The QR rendering and export
APIs remain unchanged.

## Expo Config

No app config options are required.

The package includes a no-op config plugin for apps that keep every native
package in the Expo `plugins` array:

```js
export default {
  expo: {
    plugins: ["react-native-nitro-qrcode"],
  },
};
```

New apps can omit the plugin if they do not need that convention.

## Quick Start

```tsx
import { QRCode } from "react-native-nitro-qrcode";

export function PaymentCode() {
  return (
    <QRCode
      value="https://example.com/pay/invoice_123"
      size={220}
      foregroundColor="#111827"
      backgroundColor="#FFFFFF"
      errorCorrectionLevel="H"
      scanSafe
    />
  );
}
```

## Styled QR Codes

```tsx
import { Image, View } from "react-native";
import { QRCode } from "react-native-nitro-qrcode";

const logo = require("./logo.png");

export function BrandedCode() {
  return (
    <QRCode
      value="https://example.com/app"
      size={260}
      preset="branded"
      foregroundColor="#111827"
      backgroundColor="#FFFFFF"
      eyeColor="#1E40AF"
      eyeballColor="#0F172A"
      gradient={{
        type: "linear",
        colors: ["#111827", "#2563EB"],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      }}
      shapeOptions={{
        shape: "rounded",
        eyeFrameShape: "rounded",
        eyeballShape: "circle",
        gap: 1,
        bodyDensity: "dense",
      }}
      logoAreaSize={58}
      logoAreaBorderRadius={12}
      logoPadding={4}
      logo={
        <View>
          <Image
            source={logo}
            resizeMode="contain"
            style={{ width: 40, height: 40 }}
          />
        </View>
      }
      scanSafe
    />
  );
}
```

## Export Helpers

```ts
import {
  getMatrix,
  toPngBase64,
  toPngBase64Async,
  toPngDataUri,
  toSvgString,
} from "react-native-nitro-qrcode";

const options = {
  value: "https://example.com",
  size: 320,
  errorCorrectionLevel: "H",
  foregroundColor: "#111827",
  backgroundColor: "#FFFFFF",
} as const;

const png = toPngBase64(options);
const uri = toPngDataUri(options);
const asyncPng = await toPngBase64Async(options);
const svg = toSvgString(options);
const matrix = getMatrix(options);
```

Async PNG helpers are useful for UI flows that should yield before native
generation completes.

`getMatrix` returns the QR symbol size and a Base64-encoded, row-major bitset.
Each module uses one bit, most-significant bit first; dark modules are `1`.
Rendering-only options such as colors, size, shapes, gradients, and logo area do
not change this encoding result.

`toSvgString` exports the encoded matrix with quiet zone, background,
foreground, and gradient settings. Component-only logo nodes are not embedded
in PNG or SVG exports. Set `logoAreaSize` when an exported image needs a clear
center area for a logo added by another tool.

Native and web output caches verify the full normalized request after hashed
lookup. Each cache retains at most 128 entries or 4 MiB, whichever limit is
reached first, and evicts least-recently-used output. An output larger than 4
MiB is returned without being cached. Remounting `<QRCode>` with the same
normalized options is a cache hit; apps should not keep a second in-memory URI
map for that. Use `clearQRCodeCache()` to clear cached output and
`getQRCodeCacheSize()` to inspect the entry count.

Native matrix export reuses a small bounded least-recently-used cache (32
entries) across its existing size and packed-data bridge calls. No new
HybridObject method is required, preserving compatibility with existing native
binaries.

Development builds expose opt-in generation metrics through
`getQRCodeMetrics()`, `resetQRCodeMetrics()`, and
`setQRCodeMetricsEnabled()`. Metrics are enabled by default in development and
disabled in production builds; when disabled they return a zeroed snapshot.
The snapshot counts requests, async requests, failed generations, cache
hits/misses and cache bytes (web only), plus total and last generation
milliseconds. No production logging is performed.

## Encoding Parity And Limits

Native (Project Nayuki encoder) and web (`qrcode` encoder) output identical
matrices for inputs that are entirely numeric, entirely alphanumeric, or
entirely byte-mode without digits, uppercase letters, or `$%*+-./:` characters,
when version, error correction level, and mask are fixed. This contract is
enforced by a committed parity corpus (`src/__tests__/fixtures/parity-corpus.json`,
regenerable with `bun scripts/generate-parity-corpus.js`) plus decode-back
tests. Automatic mask selection (`mask: -1`) can pick different but equally
valid masks because the two encoders interpret the ISO N4 penalty rounding
differently; fixed masks always match.

`boostEcl` is honored on both platforms. On web the encoder tries the same
version at higher error correction levels and keeps the highest level that
fits, mirroring the native behavior.

Generation input bounds:

| Input | Accepted values |
| --- | --- |
| `value` | Non-empty string; maximum length is limited by QR version 40 capacity (about 2953 bytes, 4296 alphanumeric characters, or 7089 numeric digits) |
| `size` | Integer from 1 through 4096 for synchronous and asynchronous helpers |
| `quietZone` | Integer from 0 through 32 |
| `minVersion`, `maxVersion` | Integers from 1 through 40, with `minVersion <= maxVersion` |
| `mask` | `-1` for automatic selection, or integer 0 through 7 |
| `logoAreaSize` | Integer from 0 through 4096 and no larger than `size` |
| `logoAreaBorderRadius` | Integer from 0 through 2048 and no larger than half of `size` |
| Shape gaps and radii | Integers from 0 through 256 |
| Gradient colors | 2 through 8 valid hex colors |
| Gradient locations | Same count as colors, finite values from 0 through 1 in non-decreasing order |
| Gradient points | Finite `x` and `y` values from 0 through 1 |

Option loss and platform differences:

- **SVG output** encodes the matrix with quiet zone, background, foreground,
  and gradient only. Body shape, gaps, density, stroke, eye, and eyeball
  colors do not apply to the SVG path.
- **Web PNG transparency** uses an alpha-cleared background; transparent
  pixels are truly transparent instead of black.
- **Circle geometry** is defined as an ellipse inscribed in the module cell on
  both platforms; web rasterization uses the canvas ellipse primitive and the
  native renderer uses distance evaluation, so edge pixels can differ by at
  most one pixel per module (documented golden tolerance).
- **Colors** are normalized on the JavaScript side (`#RGB` and `#RGBA`
  shorthand expand to full hex before the native bridge). The native ABI
  itself accepts full `#RRGGBB`/`#RRGGBBAA` hex or `"transparent"` for the
  background.
- **Web async PNG helpers** render in row bands and yield to the main thread
  between bands so large canvas work does not block the UI in one step.
- **Native sync PNG helpers** remain available through 4096 pixels for
  compatibility; prefer `toPngBase64Async`/`toPngDataUriAsync` for UI flows.

## Rendering, Logos, And Errors

`QRCode` generates a PNG data URI and renders it through React Native `Image`
on iOS, Android, and web. Web PNG rendering requires a browser canvas. SVG is
available through `toSvgString`; the component itself remains PNG-backed.

The component exposes accessible semantics: the generated image is
announced as an image with the label `QR code for <value>`, the container
reports a busy state while generation is pending, and the logo overlay is
hidden from the accessibility tree. Screen readers announce the QR meaning
and its generation state on iOS and Android.

The `logo` prop is a React node layered above the generated image. Only
`logoAreaSize` clears QR pixels and reserves room in the encoded image.
`logoPadding` and `logoBackgroundColor` style the overlay but do not reserve
additional modules. When `logo` is present and `logoAreaSize` is omitted, the
component reserves 28% of `size`. Keep the logo area near or below 30% for
reliable scanning.

With `scanSafe`, quiet zones smaller than four modules are raised to four.
When a logo area is present, error correction is raised to `H`.
`scanSafe: "strict"` additionally converts scanability warnings into validation
errors.

Generation starts when normalized render options change. While it runs,
`placeholder` is shown if no current image is available. `keepPreviousImage`
keeps the prior QR visible, and `hideLogoUntilReady` delays the overlay.
`onReady` receives the successful PNG data URI. Stale or unmounted async
completions are ignored. Identical options on a later mount reuse the package
cache, so `onReady` can fire with the cached URI without a second encode.

Synchronous export helpers throw validation or generation errors. Async helpers
reject with them. The component calls `onError` when supplied; otherwise it
throws the error during render so the nearest React error boundary can handle
it. Invalid component layout sizes throw before rendering or QR generation.

## Validation And Scanability

```ts
import { validateOptions } from "react-native-nitro-qrcode";

const result = validateOptions({
  value: "https://example.com",
  size: 180,
  backgroundColor: "transparent",
  logoAreaSize: 64,
  scanSafe: "strict",
});

if (!result.valid) {
  console.log(result.errors);
}

console.log(result.warnings);
```

`validateOptions` reports invalid values as hard errors and scanability risks as
warnings. With `scanSafe: "strict"`, scanability warnings are also returned as
errors so forms and design tooling can block risky output before rendering.

Errors are deterministic: validation returns typed `QRCodeValidationResult`
entries with stable codes (`invalid` plus the scanability warning codes under
strict mode). Generation failures throw (or reject with) `Error` instances;
message text is never used for control flow. The JavaScript layer validates
all options before the native boundary, so the native side surfaces unexpected
failures as ordinary exceptions rather than a separate error envelope.

## TypeScript Guardrails

The public API is intentionally narrow so editors and AI-assisted changes catch
common mistakes before runtime:

- colors are typed as `#...` strings and validated as hex at runtime, with
  `"transparent"` allowed only for backgrounds;
- gradient color and location arrays require 2 to 8 entries;
- QR versions are limited to `1` through `40`;
- mask patterns are limited to `-1` or `0` through `7`;
- shapes, presets, density, layout, and error correction values are string
  literal unions;
- `logoBackgroundColor` uses the same background color type as the QR output.

These contracts are checked by the package's declaration tests, so changes to
the public types fail CI when they stop rejecting invalid options.

## API

Main exports:

- `QRCode` React component.
- `NitroQRCode` object with the same generation helpers.
- `toPngBase64`, `toPngDataUri`, `toSvgString`, and `getMatrix`.
- `toPngBase64Async` and `toPngDataUriAsync`.
- `validateOptions`.
- `clearQRCodeCache` and `getQRCodeCacheSize`.
- TypeScript types including `QRCodeOptions`, `QRCodeProps`, `QRCodeRef`,
  `QRCodeMatrix`, `QRCodeValidationResult`, `QRCodeValidationErrorCode`,
  `QRCodeColor`,
  `QRCodeBackgroundColor`, `QRCodeGradient`, and `QRCodeShapeOptions`.

## Component Options

| Option | Description |
| --- | --- |
| `value` | Non-empty QR payload string. Required. |
| `size` | Positive component layout size up to 2048 points; rasterized internally at at least 96 pixels and at least 2x (up to 4096 pixels). |
| `quietZone` | Quiet-zone width in QR modules; integer 0 through 32. |
| `errorCorrectionLevel` | `L`, `M`, `Q`, `H`, or their long-form aliases. |
| `scanSafe` | Raises unsafe defaults; `"strict"` turns scanability warnings into errors. |
| `foregroundColor` | `#RGB`, `#RGBA`, `#RRGGBB`, or `#RRGGBBAA` foreground color. |
| `backgroundColor` | `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, or `"transparent"`. |
| `strokeColor` | Optional body-module stroke color. |
| `eyeColor` | Finder frame fill color. |
| `eyeStrokeColor` | Finder frame stroke color. |
| `eyeballColor` | Finder center color. |
| `gradient` | Linear or radial foreground gradient with 2 through 8 colors. |
| `orbit` | Deprecated no-op retained for source compatibility. |
| `shapeOptions` | Body, finder, gap, density, and radius controls; component rasterization scales visual gaps and radii before generator bounds apply. |
| `preset` | `default`, `rounded`, `dots`, or `branded`. |
| `logo` | React node overlaid above the generated image; not embedded in exports. |
| `logoAreaSize` | Cleared center area in points; integer 0 through `size`. |
| `logoAreaBorderRadius` | Reserved-area radius; integer 0 through half of `size`. |
| `logoPadding` | Visual padding inside the logo overlay; does not enlarge the reserved area. |
| `logoBackgroundColor` | Overlay background color; does not change the generated PNG. |
| `keepPreviousImage` | Keeps the previous image visible while the next image generates. |
| `hideLogoUntilReady` | Delays logo rendering until the QR image is ready. |
| `onReady` | Called with the generated PNG data URI. |
| `onError` | Called when generation fails. |

## Platform Support

| Platform | Status |
| --- | --- |
| iOS | Native Nitro module with shared C++ QR engine. |
| Android | Native Nitro module with shared C++ QR engine. |
| Web | JavaScript fallback through React Native Web. |
| Expo | Development builds; Expo Go is not supported for native Nitro code. |

The `qrcode` npm package powers only the web entry
(`src/index.web.ts`). Native iOS and Android builds resolve the
platform-specific entry and never bundle it; web bundlers include it only for
web targets. Consumers do not need `react-native-svg`, Skia, canvas packages,
or another QR package.

## Troubleshooting

- **Expo Go error:** build a development client; Expo Go cannot load Nitro
  modules.
- **Logo makes the code hard to scan:** use `errorCorrectionLevel="H"`,
  `scanSafe`, and a smaller `logoAreaSize`.
- **Transparent background scans poorly:** validate contrast in the actual UI
  where the QR code appears.
- **Need SVG output:** use `toSvgString`; the component itself renders a
  PNG-backed `Image`.
- **Repeated renders in a parent screen:** memoize parent option objects or rely
  on the component's value-based option stabilization for `shapeOptions` and
  `gradient`.

## Development

```sh
bun install
bun run check
bun run test:types
bun run release:preflight
bun run example:android
bun run example:ios
```

Run native example builds before release when changing plugin, native, Nitro, or
packaging files. `bun run example:smoke` reports each platform as executed,
skipped (with a reason), or failed and never passes silently; use
`bun run example:smoke -- --strict` when a release must fail if no Android
device or booted iOS simulator is available. `bun run example:smoke:ci`
verifies the terminal-state reporting without devices and runs in `check`.

When changing encoder behavior, regenerate and verify the parity corpus with
`bun scripts/generate-parity-corpus.js` (and `--write` after the native side
is proven by `bun run --cwd packages/react-native-nitro-qrcode test:cpp`).

## Links

- [npm package](https://www.npmjs.com/package/react-native-nitro-qrcode)
- [GitHub repository](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode)
- [Issues](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/issues)
- [Changelog](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/blob/main/CHANGELOG.md)

## License

MIT
