# react-native-nitro-qrcode

[![npm version](https://img.shields.io/npm/v/react-native-nitro-qrcode?color=f97316&label=npm)](https://www.npmjs.com/package/react-native-nitro-qrcode)
[![npm downloads](https://img.shields.io/npm/dm/react-native-nitro-qrcode?color=22c55e&label=downloads)](https://www.npmjs.com/package/react-native-nitro-qrcode)
[![CI](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/actions/workflows/ci.yml/badge.svg)](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/react-native-nitro-qrcode?color=007ec6)](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/blob/main/LICENSE)
[![React Native](https://img.shields.io/badge/react--native-%3E%3D0.75-61dafb)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/expo-SDK%2056-000020)](https://docs.expo.dev/)
[![Nitro Modules](https://img.shields.io/badge/nitro--modules-%3E%3D0.35.7-black)](https://nitro.margelo.com/)
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
| Nitro Modules | `>=0.35.7 <0.36.0` |
| Expo | SDK 56 development builds |
| React Native Web | `>=0.19.0 <1.0.0` |
| Node | `>=18.0.0` |

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
  `QRCodeMatrix`, `QRCodeValidationResult`, `QRCodeColor`,
  `QRCodeBackgroundColor`, `QRCodeGradient`, and `QRCodeShapeOptions`.

## Component Options

| Option | Description |
| --- | --- |
| `value` | QR payload string. Required. |
| `size` | Rendered component size in points. |
| `quietZone` | Quiet-zone width in QR modules. |
| `errorCorrectionLevel` | `L`, `M`, `Q`, `H`, or their long-form aliases. |
| `scanSafe` | Raises unsafe defaults; `"strict"` turns scanability warnings into errors. |
| `foregroundColor` | `#RGB`, `#RGBA`, `#RRGGBB`, or `#RRGGBBAA` foreground color. |
| `backgroundColor` | `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, or `"transparent"`. |
| `strokeColor` | Optional body-module stroke color. |
| `eyeColor` | Finder frame fill color. |
| `eyeStrokeColor` | Finder frame stroke color. |
| `eyeballColor` | Finder center color. |
| `gradient` | Linear or radial foreground gradient. |
| `shapeOptions` | Body, finder, gap, density, and radius controls. |
| `preset` | `default`, `rounded`, `dots`, or `branded`. |
| `logo` | React node rendered above the reserved logo safe area. |
| `logoAreaSize` | Reserved center logo area in points. |
| `logoAreaBorderRadius` | Radius for the reserved logo safe area. |
| `logoPadding` | Padding around the rendered logo node. |
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

`qrcode` is bundled for the web fallback. Consumers do not need
`react-native-svg`, Skia, canvas packages, or another QR package.

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
packaging files. Use `bun run example:smoke -- --strict` when a release must
fail if no Android device or booted iOS simulator is available.

## Links

- [npm package](https://www.npmjs.com/package/react-native-nitro-qrcode)
- [GitHub repository](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode)
- [Issues](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/issues)
- [Changelog](https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/blob/main/CHANGELOG.md)

## License

MIT
