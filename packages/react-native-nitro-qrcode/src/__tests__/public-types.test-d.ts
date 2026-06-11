import type {
  QRCodeBackgroundColor,
  QRCodeColor,
  QRCodeGradient,
  QRCodeMaskPattern,
  QRCodeOptions,
  QRCodeProps,
  QRCodeVersion,
} from "../index";

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
  foregroundColor: hexColor,
  backgroundColor: transparentBackground,
  gradient: validGradient,
  minVersion: version,
  mask,
};

const validProps: QRCodeProps = {
  ...validOptions,
  logoBackgroundColor: "transparent",
  preset: "branded",
};

void validProps;

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
