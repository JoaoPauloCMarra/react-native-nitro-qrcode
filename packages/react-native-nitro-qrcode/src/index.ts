import React, { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Image,
  type ImageStyle,
  Platform,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import { NitroModules } from "react-native-nitro-modules";
import type { QRCode as HybridQRCode } from "./QRCode.nitro";

export type ErrorCorrectionLevel =
  | "L"
  | "M"
  | "Q"
  | "H"
  | "low"
  | "medium"
  | "quartile"
  | "high";

export type QRCodeShape = "square" | "circle" | "rounded";

export type QRCodeShapeOptions = {
  shape?: QRCodeShape;
  eyePatternShape?: QRCodeShape;
  gap?: number;
  eyePatternGap?: number;
};

export type QRCodeGradientType = "linear" | "radial";

export type QRCodeGradientPoint = {
  x: number;
  y: number;
};

export type QRCodeGradient = {
  type?: QRCodeGradientType;
  colors: readonly [string, string, ...string[]];
  locations?: readonly number[];
  start?: QRCodeGradientPoint;
  end?: QRCodeGradientPoint;
};

export type QRCodeOptions = {
  value: string;
  size?: number;
  quietZone?: number;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  foregroundColor?: string;
  backgroundColor?: string;
  gradient?: QRCodeGradient;
  minVersion?: number;
  maxVersion?: number;
  mask?: number;
  boostEcl?: boolean;
  shapeOptions?: QRCodeShapeOptions;
  logoAreaSize?: number;
  logoAreaBorderRadius?: number;
};

export type QRCodeMatrix = {
  size: number;
  packedBase64: string;
};

export type QRCodeProps = QRCodeOptions & {
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  logo?: ReactNode;
  testID?: string;
};

const DEFAULT_SIZE = 512;
const DEFAULT_QUIET_ZONE = 4;
const DEFAULT_ECL: ErrorCorrectionLevel = "M";
const DEFAULT_FOREGROUND = "#000000";
const DEFAULT_BACKGROUND = "#FFFFFF";
const DEFAULT_MIN_VERSION = 1;
const DEFAULT_MAX_VERSION = 40;
const DEFAULT_MASK = -1;
const DEFAULT_BOOST_ECL = true;
const DEFAULT_SHAPE: QRCodeShape = "square";
const DEFAULT_LOGO_AREA_SIZE = 0;
const DEFAULT_LOGO_AREA_BORDER_RADIUS = 0;
const COMPONENT_RASTER_MULTIPLIER = 2;
const MIN_COMPONENT_RASTER_SIZE = 96;
const DEFAULT_LINEAR_START: QRCodeGradientPoint = { x: 0, y: 0 };
const DEFAULT_LINEAR_END: QRCodeGradientPoint = { x: 1, y: 1 };
const DEFAULT_RADIAL_START: QRCodeGradientPoint = { x: 0.5, y: 0.5 };
const DEFAULT_RADIAL_END: QRCodeGradientPoint = { x: 1, y: 1 };

const NativeQRCode = NitroModules.createHybridObject<HybridQRCode>("QRCode");

export function toPngBase64(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngBase64(
    normalized.value,
    normalized.size,
    normalized.quietZone,
    normalized.errorCorrectionLevel,
    normalized.foregroundColor,
    normalized.backgroundColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.shapeOptions.shape,
    normalized.shapeOptions.eyePatternShape,
    normalized.shapeOptions.gap,
    normalized.shapeOptions.eyePatternGap,
    normalized.logoAreaSize,
    normalized.logoAreaBorderRadius,
    normalized.gradient.type,
    normalized.gradient.colors,
    normalized.gradient.locations,
    normalized.gradient.startX,
    normalized.gradient.startY,
    normalized.gradient.endX,
    normalized.gradient.endY,
  );
}

export function toPngDataUri(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngDataUri(
    normalized.value,
    normalized.size,
    normalized.quietZone,
    normalized.errorCorrectionLevel,
    normalized.foregroundColor,
    normalized.backgroundColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.shapeOptions.shape,
    normalized.shapeOptions.eyePatternShape,
    normalized.shapeOptions.gap,
    normalized.shapeOptions.eyePatternGap,
    normalized.logoAreaSize,
    normalized.logoAreaBorderRadius,
    normalized.gradient.type,
    normalized.gradient.colors,
    normalized.gradient.locations,
    normalized.gradient.startX,
    normalized.gradient.startY,
    normalized.gradient.endX,
    normalized.gradient.endY,
  );
}

export function toPngBase64Async(options: QRCodeOptions): Promise<string> {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngBase64Async(
    normalized.value,
    normalized.size,
    normalized.quietZone,
    normalized.errorCorrectionLevel,
    normalized.foregroundColor,
    normalized.backgroundColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.shapeOptions.shape,
    normalized.shapeOptions.eyePatternShape,
    normalized.shapeOptions.gap,
    normalized.shapeOptions.eyePatternGap,
    normalized.logoAreaSize,
    normalized.logoAreaBorderRadius,
    normalized.gradient.type,
    normalized.gradient.colors,
    normalized.gradient.locations,
    normalized.gradient.startX,
    normalized.gradient.startY,
    normalized.gradient.endX,
    normalized.gradient.endY,
  );
}

export function toPngDataUriAsync(options: QRCodeOptions): Promise<string> {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngDataUriAsync(
    normalized.value,
    normalized.size,
    normalized.quietZone,
    normalized.errorCorrectionLevel,
    normalized.foregroundColor,
    normalized.backgroundColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.shapeOptions.shape,
    normalized.shapeOptions.eyePatternShape,
    normalized.shapeOptions.gap,
    normalized.shapeOptions.eyePatternGap,
    normalized.logoAreaSize,
    normalized.logoAreaBorderRadius,
    normalized.gradient.type,
    normalized.gradient.colors,
    normalized.gradient.locations,
    normalized.gradient.startX,
    normalized.gradient.startY,
    normalized.gradient.endX,
    normalized.gradient.endY,
  );
}

export function toSvgString(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generateSvgString(
    normalized.value,
    normalized.quietZone,
    normalized.errorCorrectionLevel,
    normalized.foregroundColor,
    normalized.backgroundColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.gradient.type,
    normalized.gradient.colors,
    normalized.gradient.locations,
    normalized.gradient.startX,
    normalized.gradient.startY,
    normalized.gradient.endX,
    normalized.gradient.endY,
  );
}

export function getMatrix(options: QRCodeOptions): QRCodeMatrix {
  const normalized = normalizeOptions(options);
  const size = NativeQRCode.getMatrixSize(
    normalized.value,
    normalized.errorCorrectionLevel,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
  );
  const packedBase64 = NativeQRCode.getMatrixPackedBase64(
    normalized.value,
    normalized.errorCorrectionLevel,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
  );
  return { size, packedBase64 };
}

export function clearQRCodeCache(): void {
  NativeQRCode.clearCache();
}

export function getQRCodeCacheSize(): number {
  return NativeQRCode.getCacheSize();
}

export function QRCode({
  value,
  size = 180,
  quietZone,
  errorCorrectionLevel,
  foregroundColor,
  backgroundColor,
  gradient,
  minVersion,
  maxVersion,
  mask,
  boostEcl,
  shapeOptions,
  logoAreaSize,
  logoAreaBorderRadius,
  style,
  imageStyle,
  logo,
  testID,
}: QRCodeProps) {
  const [uri, setUri] = useState<string>();
  const [generationError, setGenerationError] = useState<Error>();
  const rasterSize = Math.max(
    Math.ceil(size * COMPONENT_RASTER_MULTIPLIER),
    MIN_COMPONENT_RASTER_SIZE,
  );
  const rasterScale = rasterSize / size;
  const resolvedLogoAreaSize =
    logoAreaSize ?? (logo !== undefined ? Math.round(size * 0.28) : 0);

  const options = useMemo<QRCodeOptions>(
    () => ({
      value,
      size: rasterSize,
      quietZone,
      errorCorrectionLevel,
      foregroundColor,
      backgroundColor,
      gradient,
      minVersion,
      maxVersion,
      mask,
      boostEcl,
      shapeOptions: scaleShapeOptions(shapeOptions, rasterScale),
      logoAreaSize: Math.round(resolvedLogoAreaSize * rasterScale),
      logoAreaBorderRadius: Math.round(
        (logoAreaBorderRadius ?? DEFAULT_LOGO_AREA_BORDER_RADIUS) * rasterScale,
      ),
    }),
    [
      value,
      rasterSize,
      quietZone,
      errorCorrectionLevel,
      foregroundColor,
      backgroundColor,
      gradient,
      minVersion,
      maxVersion,
      mask,
      boostEcl,
      shapeOptions,
      rasterScale,
      resolvedLogoAreaSize,
      logoAreaBorderRadius,
    ],
  );

  useEffect(() => {
    let isMounted = true;

    void toPngDataUriAsync(options).then(
      (nextUri) => {
        if (!isMounted) {
          return;
        }
        setGenerationError(undefined);
        setUri(nextUri);
      },
      (error: unknown) => {
        if (!isMounted) {
          return;
        }
        setGenerationError(toError(error));
      },
    );

    return () => {
      isMounted = false;
    };
  }, [options]);

  if (generationError !== undefined) {
    throw generationError;
  }

  return React.createElement(
    View,
    {
      style: [styles.frame, { width: size, height: size }, style],
      testID,
    },
    uri !== undefined &&
      React.createElement(Image, {
        source: { uri },
        resizeMode: "contain",
        style: [styles.image, imageStyle],
        accessibilityIgnoresInvertColors: Platform.OS !== "web",
      }),
    logo !== undefined &&
      React.createElement(
        View,
        {
          pointerEvents: "none",
          style: [
            styles.logo,
            {
              width: resolvedLogoAreaSize,
              height: resolvedLogoAreaSize,
              left: (size - resolvedLogoAreaSize) / 2,
              top: (size - resolvedLogoAreaSize) / 2,
              borderRadius:
                logoAreaBorderRadius ?? DEFAULT_LOGO_AREA_BORDER_RADIUS,
            },
          ],
        },
        logo,
      ),
  );
}

export const NitroQRCode = {
  toPngBase64,
  toPngDataUri,
  toPngBase64Async,
  toPngDataUriAsync,
  toSvgString,
  getMatrix,
  clearCache: clearQRCodeCache,
  getCacheSize: getQRCodeCacheSize,
};

type NormalizedOptions = Required<
  Omit<QRCodeOptions, "errorCorrectionLevel" | "shapeOptions" | "gradient">
> & {
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  shapeOptions: Required<QRCodeShapeOptions>;
  gradient: NormalizedGradient;
};

type NormalizedGradient = {
  type: QRCodeGradientType | "none";
  colors: string[];
  locations: number[];
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

function normalizeOptions(options: QRCodeOptions): NormalizedOptions {
  if (options.value.length === 0) {
    throw new Error("QRCode value must not be empty.");
  }

  const size = sanitizeInteger(options.size, DEFAULT_SIZE, "size", 1, 4096);
  const logoAreaSize = sanitizeInteger(
    options.logoAreaSize,
    DEFAULT_LOGO_AREA_SIZE,
    "logoAreaSize",
    0,
    4096,
  );
  const logoAreaBorderRadius = sanitizeInteger(
    options.logoAreaBorderRadius,
    DEFAULT_LOGO_AREA_BORDER_RADIUS,
    "logoAreaBorderRadius",
    0,
    2048,
  );
  validateLogoDimensions(logoAreaSize, logoAreaBorderRadius, size);
  const minVersion = sanitizeInteger(
    options.minVersion,
    DEFAULT_MIN_VERSION,
    "minVersion",
    1,
    40,
  );
  const maxVersion = sanitizeInteger(
    options.maxVersion,
    DEFAULT_MAX_VERSION,
    "maxVersion",
    1,
    40,
  );
  validateVersionRange(minVersion, maxVersion);

  return {
    value: options.value,
    size,
    quietZone: sanitizeInteger(
      options.quietZone,
      DEFAULT_QUIET_ZONE,
      "quietZone",
      0,
      32,
    ),
    errorCorrectionLevel: normalizeEcl(
      options.errorCorrectionLevel ?? DEFAULT_ECL,
    ),
    foregroundColor: sanitizeColor(
      options.foregroundColor ?? DEFAULT_FOREGROUND,
      "foregroundColor",
    ),
    backgroundColor: sanitizeColor(
      options.backgroundColor ?? DEFAULT_BACKGROUND,
      "backgroundColor",
    ),
    gradient: normalizeGradient(options.gradient),
    minVersion,
    maxVersion,
    mask: sanitizeInteger(options.mask, DEFAULT_MASK, "mask", -1, 7),
    boostEcl: options.boostEcl ?? DEFAULT_BOOST_ECL,
    shapeOptions: normalizeShapeOptions(options.shapeOptions),
    logoAreaSize,
    logoAreaBorderRadius,
  };
}

function normalizeGradient(
  gradient: QRCodeGradient | undefined,
): NormalizedGradient {
  if (gradient === undefined) {
    return {
      type: "none",
      colors: [],
      locations: [],
      startX: DEFAULT_LINEAR_START.x,
      startY: DEFAULT_LINEAR_START.y,
      endX: DEFAULT_LINEAR_END.x,
      endY: DEFAULT_LINEAR_END.y,
    };
  }

  const type = sanitizeGradientType(gradient.type);
  const colors = gradient.colors.map((color, index) =>
    sanitizeColor(color, `gradient.colors[${index}]`),
  );
  if (colors.length < 2 || colors.length > 8) {
    throw new Error("gradient.colors must contain between 2 and 8 colors.");
  }

  const locations = normalizeGradientLocations(
    gradient.locations,
    colors.length,
  );
  const start = sanitizeGradientPoint(
    gradient.start,
    type === "radial" ? DEFAULT_RADIAL_START : DEFAULT_LINEAR_START,
    "gradient.start",
  );
  const end = sanitizeGradientPoint(
    gradient.end,
    type === "radial" ? DEFAULT_RADIAL_END : DEFAULT_LINEAR_END,
    "gradient.end",
  );

  return {
    type,
    colors,
    locations,
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
  };
}

function normalizeShapeOptions(
  options: QRCodeShapeOptions | undefined,
): Required<QRCodeShapeOptions> {
  return {
    shape: sanitizeShape(options?.shape, "shape"),
    eyePatternShape: sanitizeShape(options?.eyePatternShape, "eyePatternShape"),
    gap: sanitizeInteger(options?.gap, 0, "gap", 0, 256),
    eyePatternGap: sanitizeInteger(
      options?.eyePatternGap,
      options?.gap ?? 0,
      "eyePatternGap",
      0,
      256,
    ),
  };
}

function sanitizeShape(
  value: QRCodeShape | undefined,
  name: string,
): QRCodeShape {
  const resolved = value ?? DEFAULT_SHAPE;
  if (
    resolved !== "square" &&
    resolved !== "circle" &&
    resolved !== "rounded"
  ) {
    throw new Error(`${name} must be square, circle, or rounded.`);
  }
  return resolved;
}

function sanitizeGradientType(
  value: QRCodeGradientType | undefined,
): QRCodeGradientType {
  const resolved = value ?? "linear";
  if (resolved !== "linear" && resolved !== "radial") {
    throw new Error("gradient.type must be linear or radial.");
  }
  return resolved;
}

function normalizeGradientLocations(
  value: readonly number[] | undefined,
  colorCount: number,
): number[] {
  if (value === undefined) {
    return [];
  }
  if (value.length !== colorCount) {
    throw new Error(
      "gradient.locations must match gradient.colors length when provided.",
    );
  }

  return value.map((location, index) => {
    if (!Number.isFinite(location) || location < 0 || location > 1) {
      throw new Error(
        "gradient.locations entries must be finite numbers between 0 and 1.",
      );
    }
    const previous = value[index - 1];
    if (previous !== undefined && location < previous) {
      throw new Error("gradient.locations must be in non-decreasing order.");
    }
    return location;
  });
}

function sanitizeGradientPoint(
  value: QRCodeGradientPoint | undefined,
  fallback: QRCodeGradientPoint,
  name: string,
): QRCodeGradientPoint {
  const point = value ?? fallback;
  return {
    x: sanitizeUnitNumber(point.x, `${name}.x`),
    y: sanitizeUnitNumber(point.y, `${name}.y`),
  };
}

function sanitizeUnitNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a finite number between 0 and 1.`);
  }
  return value;
}

function sanitizeColor(value: string, name: string): string {
  if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value)) {
    throw new Error(`${name} must be #RRGGBB or #RRGGBBAA.`);
  }
  return value.toUpperCase();
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function validateLogoDimensions(
  logoAreaSize: number,
  logoAreaBorderRadius: number,
  size: number,
): void {
  if (logoAreaSize > size) {
    throw new Error("logoAreaSize must be between 0 and size.");
  }
  if (logoAreaBorderRadius > size / 2) {
    throw new Error(
      "logoAreaBorderRadius must be between 0 and half the size.",
    );
  }
}

function validateVersionRange(minVersion: number, maxVersion: number): void {
  if (minVersion > maxVersion) {
    throw new Error(
      "minVersion and maxVersion must be between 1 and 40, with minVersion <= maxVersion.",
    );
  }
}

function scaleShapeOptions(
  options: QRCodeShapeOptions | undefined,
  scale: number,
): QRCodeShapeOptions | undefined {
  if (options === undefined) {
    return undefined;
  }

  return {
    shape: options.shape,
    eyePatternShape: options.eyePatternShape,
    gap:
      options.gap === undefined ? undefined : Math.round(options.gap * scale),
    eyePatternGap:
      options.eyePatternGap === undefined
        ? undefined
        : Math.round(options.eyePatternGap * scale),
  };
}

function normalizeEcl(value: ErrorCorrectionLevel): "L" | "M" | "Q" | "H" {
  if (value === "L" || value === "M" || value === "Q" || value === "H") {
    return value;
  }
  if (value === "low") return "L";
  if (value === "medium") return "M";
  if (value === "quartile") return "Q";
  if (value === "high") return "H";
  throw new Error(
    "errorCorrectionLevel must be L, M, Q, H, low, medium, quartile, or high.",
  );
}

function sanitizeInteger(
  value: number | undefined,
  fallback: number,
  name: string,
  min: number,
  max: number,
): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < min || resolved > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return resolved;
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  logo: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
  },
});

export type { HybridQRCode };
