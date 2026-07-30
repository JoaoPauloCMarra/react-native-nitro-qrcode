import type {
  ErrorCorrectionLevel,
  NitroQRCodeApi,
  QRCodeBackgroundColor,
  QRCodeBodyDensity,
  QRCodeBodyShape,
  QRCodeColor,
  QRCodeGradient,
  QRCodeGradientColors,
  QRCodeGradientLocations,
  QRCodeMatrix,
  QRCodeMaskPattern,
  QRCodeOptions,
  QRCodePreset,
  QRCodeProps,
  QRCodeRef,
  QRCodeValidationResult,
  QRCodeVersion,
} from "../index";
import {
  NitroQRCode,
  getMatrix,
  toPngBase64,
  toPngBase64Async,
  toPngDataUri,
  toPngDataUriAsync,
  toSvgString,
  validateOptions,
} from "../index";

type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false;

function expectFalse<Value extends false>(value?: Value): void {
  void value;
}

const hexColor: QRCodeColor = "#AABBCC";
const transparentBackground: QRCodeBackgroundColor = "transparent";
const version: QRCodeVersion = 40;
const mask: QRCodeMaskPattern = -1;

const validGradient: QRCodeGradient = {
  colors: ["#000000", "#FFFFFF"],
  locations: [0, 1],
};

const validOptions: QRCodeOptions = {
  value: "https://example.com",
  size: 4096,
  foregroundColor: hexColor,
  backgroundColor: transparentBackground,
  gradient: validGradient,
  minVersion: version,
  mask,
};

const validProps: QRCodeProps = {
  ...validOptions,
  size: 2048,
  logoBackgroundColor: "transparent",
  preset: "branded",
  onReady(uri: string) {
    void uri;
  },
  onError(error: Error) {
    void error;
  },
};

void validProps;

const pngBase64: string = toPngBase64(validOptions);
const pngDataUri: string = toPngDataUri(validOptions);
const svg: string = toSvgString(validOptions);
const matrix: QRCodeMatrix = getMatrix(validOptions);
const validation: QRCodeValidationResult = validateOptions(validOptions);
const asyncPngBase64: Promise<string> = toPngBase64Async(validOptions);
const asyncPngDataUri: Promise<string> = toPngDataUriAsync(validOptions);
const api: NitroQRCodeApi = NitroQRCode;
const ref: QRCodeRef = {
  toPngDataUri: () => pngDataUri,
  toPngBase64: () => pngBase64,
};

void svg;
void matrix;
void validation;
void asyncPngBase64;
void asyncPngDataUri;
void api;
void ref;

// @ts-expect-error foreground colors must be hex colors.
const badForeground: QRCodeColor = "black";

const badForegroundOption: QRCodeOptions = {
  value: "x",
  // @ts-expect-error only backgrounds can be transparent.
  foregroundColor: "transparent",
};

void badForegroundOption;

const badGradientTooShort: QRCodeGradient = {
  // @ts-expect-error gradient colors require at least two entries.
  colors: ["#000000"],
};

void badGradientTooShort;

expectFalse<
  IsAssignable<
    readonly [
      "#000000",
      "#111111",
      "#222222",
      "#333333",
      "#444444",
      "#555555",
      "#666666",
      "#777777",
      "#888888",
    ],
    QRCodeGradientColors
  >
>();
expectFalse<
  IsAssignable<
    readonly [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 1],
    QRCodeGradientLocations
  >
>();

// @ts-expect-error QR versions are limited to 1 through 40.
const badVersion: QRCodeVersion = 41;

// @ts-expect-error mask patterns are -1 or 0 through 7.
const badMask: QRCodeMaskPattern = 8;

const badLayout: QRCodeOptions = {
  value: "x",
  shapeOptions: {
    // @ts-expect-error radial layouts are not part of the public scan-safe API.
    layout: "radial",
  },
};

void badForeground;
void badVersion;
void badMask;
void badLayout;

expectFalse<IsAssignable<"maximum", ErrorCorrectionLevel>>();
expectFalse<IsAssignable<"solid", QRCodeBodyDensity>>();
expectFalse<IsAssignable<"diamond", QRCodeBodyShape>>();
expectFalse<IsAssignable<"custom", QRCodePreset>>();
expectFalse<IsAssignable<"always", NonNullable<QRCodeOptions["scanSafe"]>>>();
expectFalse<
  IsAssignable<
    (uri: number) => void,
    NonNullable<QRCodeProps["onReady"]>
  >
>();
