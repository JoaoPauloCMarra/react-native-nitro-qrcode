import {
  DEFAULT_BACKGROUND,
  DEFAULT_EYE,
  DEFAULT_EYE_STROKE,
  DEFAULT_EYEBALL,
  DEFAULT_FOREGROUND,
  DEFAULT_STROKE,
  sanitizeBackgroundColor,
  sanitizeColor,
  type QRCodeBackgroundColor,
  type QRCodeColor,
} from "./colors";
import {
  DEFAULT_BOOST_ECL,
  DEFAULT_BODY_DENSITY,
  DEFAULT_ECL,
  DEFAULT_EYEBALL_SHAPE,
  DEFAULT_EYE_FRAME_SHAPE,
  DEFAULT_LAYOUT,
  DEFAULT_LINEAR_END,
  DEFAULT_LINEAR_START,
  DEFAULT_LOGO_AREA_BORDER_RADIUS,
  DEFAULT_LOGO_AREA_SIZE,
  DEFAULT_MASK,
  DEFAULT_MAX_VERSION,
  DEFAULT_MIN_VERSION,
  DEFAULT_QUIET_ZONE,
  DEFAULT_RADIAL_END,
  DEFAULT_RADIAL_START,
  DEFAULT_SHAPE,
  DEFAULT_SIZE,
} from "./defaults";
import type { QRCodeMetricsSnapshot } from "./metrics";
import {
  scanabilityWarnings,
  SCAN_SAFE_QUIET_ZONE_MINIMUM,
  type QRCodeScanabilityWarning,
} from "./scan-policy";

export type ErrorCorrectionLevel =
  | "L"
  | "M"
  | "Q"
  | "H"
  | "low"
  | "medium"
  | "quartile"
  | "high";

export type QRCodeBodyShape = "square" | "circle" | "rounded";

export type QRCodeShape = QRCodeBodyShape;

export type QRCodeEyeFrameShape = "square" | "circle" | "rounded";

export type QRCodeEyeBallShape = "square" | "circle" | "rounded";

export type QRCodeEyePatternShape = QRCodeEyeFrameShape;

export type QRCodeBodyDensity = "sparse" | "balanced" | "dense";

export type QRCodeLayout = "matrix";

export type QRCodeShapeOptions = {
  layout?: QRCodeLayout;
  shape?: QRCodeBodyShape;
  eyeFrameShape?: QRCodeEyeFrameShape;
  eyeballShape?: QRCodeEyeBallShape;
  /** @deprecated Use eyeFrameShape. */
  eyePatternShape?: QRCodeEyePatternShape;
  gap?: number;
  eyePatternGap?: number;
  bodyDensity?: QRCodeBodyDensity;
  cornerRadius?: number;
  eyePatternCornerRadius?: number;
};

export type QRCodeGradientType = "linear" | "radial";

export type QRCodeGradientPoint = {
  x: number;
  y: number;
};

export type Tuple2To8<T> =
  | readonly [T, T]
  | readonly [T, T, T]
  | readonly [T, T, T, T]
  | readonly [T, T, T, T, T]
  | readonly [T, T, T, T, T, T]
  | readonly [T, T, T, T, T, T, T]
  | readonly [T, T, T, T, T, T, T, T];

export type QRCodeGradientColors = Tuple2To8<QRCodeColor>;

export type QRCodeGradientLocations = Tuple2To8<number>;

export type QRCodeGradient = {
  type?: QRCodeGradientType;
  colors: QRCodeGradientColors;
  locations?: QRCodeGradientLocations;
  start?: QRCodeGradientPoint;
  end?: QRCodeGradientPoint;
};

export type QRCodeMaskPattern = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type QRCodeVersion =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32
  | 33
  | 34
  | 35
  | 36
  | 37
  | 38
  | 39
  | 40;

export type QRCodeOptions = {
  value: string;
  size?: number;
  quietZone?: number;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  scanSafe?: boolean | "strict";
  foregroundColor?: QRCodeColor;
  backgroundColor?: QRCodeBackgroundColor;
  strokeColor?: QRCodeColor;
  eyeColor?: QRCodeColor;
  eyeStrokeColor?: QRCodeColor;
  eyeballColor?: QRCodeColor;
  gradient?: QRCodeGradient;
  minVersion?: QRCodeVersion;
  maxVersion?: QRCodeVersion;
  mask?: QRCodeMaskPattern;
  boostEcl?: boolean;
  orbit?: boolean;
  shapeOptions?: QRCodeShapeOptions;
  logoAreaSize?: number;
  logoAreaBorderRadius?: number;
};

export type QRCodeMatrix = {
  size: number;
  packedBase64: string;
};

export type QRCodeValidationErrorCode =
  | "invalid"
  | QRCodeScanabilityWarning["code"];

export type QRCodeValidationError = {
  code: QRCodeValidationErrorCode;
  message: string;
};

export type QRCodeValidationResult = {
  valid: boolean;
  warnings: QRCodeScanabilityWarning[];
  errors: QRCodeValidationError[];
};

export type NormalizedGradient = {
  type: QRCodeGradientType | "none";
  colors: string[];
  locations: number[];
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type NormalizedOptions = Required<
  Omit<
    QRCodeOptions,
    "errorCorrectionLevel" | "scanSafe" | "shapeOptions" | "gradient" | "orbit"
  >
> & {
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  scanSafe: false | "standard" | "strict";
  shapeOptions: Required<QRCodeShapeOptions>;
  gradient: NormalizedGradient;
};

export type NitroQRCodeApi = Readonly<{
  toPngBase64: (options: QRCodeOptions) => string;
  toPngDataUri: (options: QRCodeOptions) => string;
  toPngBase64Async: (options: QRCodeOptions) => Promise<string>;
  toPngDataUriAsync: (options: QRCodeOptions) => Promise<string>;
  toSvgString: (options: QRCodeOptions) => string;
  getMatrix: (options: QRCodeOptions) => QRCodeMatrix;
  validateOptions: (options: QRCodeOptions) => QRCodeValidationResult;
  clearCache: () => void;
  getCacheSize: () => number;
  getQRCodeMetrics: () => QRCodeMetricsSnapshot;
  resetQRCodeMetrics: () => void;
  setQRCodeMetricsEnabled: (enabled: boolean) => void;
}>;

export function validateOptions(
  options: QRCodeOptions,
): QRCodeValidationResult {
  try {
    const normalized = normalizeOptions(options);
    const warnings = scanabilityWarnings(normalized);
    return {
      valid: normalized.scanSafe !== "strict" || warnings.length === 0,
      warnings,
      errors:
        normalized.scanSafe === "strict"
          ? warnings.map((warning) => ({
              code: warning.code,
              message: warning.message,
            }))
          : [],
    };
  } catch (error: unknown) {
    return {
      valid: false,
      warnings: [],
      errors: [{ code: "invalid", message: toError(error).message }],
    };
  }
}

export function normalizeOptions(options: QRCodeOptions): NormalizedOptions {
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
  const minVersion = sanitizeVersion(
    options.minVersion,
    DEFAULT_MIN_VERSION,
    "minVersion",
  );
  const maxVersion = sanitizeVersion(
    options.maxVersion,
    DEFAULT_MAX_VERSION,
    "maxVersion",
  );
  validateVersionRange(minVersion, maxVersion);

  const scanSafe = normalizeScanSafe(options.scanSafe);
  const requestedQuietZone = sanitizeInteger(
    options.quietZone,
    DEFAULT_QUIET_ZONE,
    "quietZone",
    0,
    32,
  );
  const requestedEcl = normalizeEcl(
    options.errorCorrectionLevel ?? DEFAULT_ECL,
  );
  const quietZone =
    scanSafe === false
      ? requestedQuietZone
      : Math.max(requestedQuietZone, SCAN_SAFE_QUIET_ZONE_MINIMUM);
  const errorCorrectionLevel =
    scanSafe !== false && logoAreaSize > 0 ? "H" : requestedEcl;

  return {
    value: options.value,
    size,
    quietZone,
    errorCorrectionLevel,
    scanSafe,
    foregroundColor: sanitizeColor(
      options.foregroundColor ?? DEFAULT_FOREGROUND,
      "foregroundColor",
    ),
    backgroundColor: sanitizeBackgroundColor(
      options.backgroundColor ?? DEFAULT_BACKGROUND,
      "backgroundColor",
    ),
    strokeColor: sanitizeColor(
      options.strokeColor ?? DEFAULT_STROKE,
      "strokeColor",
    ),
    eyeColor: sanitizeColor(options.eyeColor ?? DEFAULT_EYE, "eyeColor"),
    eyeStrokeColor: sanitizeColor(
      options.eyeStrokeColor ?? DEFAULT_EYE_STROKE,
      "eyeStrokeColor",
    ),
    eyeballColor: sanitizeColor(
      options.eyeballColor ?? DEFAULT_EYEBALL,
      "eyeballColor",
    ),
    gradient: normalizeGradient(options.gradient),
    minVersion,
    maxVersion,
    mask: sanitizeMask(options.mask, DEFAULT_MASK),
    boostEcl: options.boostEcl ?? DEFAULT_BOOST_ECL,
    shapeOptions: normalizeShapeOptions(options.shapeOptions),
    logoAreaSize,
    logoAreaBorderRadius,
  };
}

export function normalizeGradient(
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

export function normalizeShapeOptions(
  options: QRCodeShapeOptions | undefined,
): Required<QRCodeShapeOptions> {
  return {
    layout: sanitizeLayout(options?.layout),
    shape: sanitizeShape(options?.shape, "shape"),
    eyeFrameShape: sanitizeEyeFrameShape(
      options?.eyeFrameShape ?? options?.eyePatternShape,
    ),
    eyeballShape: sanitizeEyeballShape(options?.eyeballShape),
    eyePatternShape: sanitizeEyeFrameShape(
      options?.eyeFrameShape ?? options?.eyePatternShape,
    ),
    gap: sanitizeInteger(options?.gap, 0, "gap", 0, 256),
    eyePatternGap: sanitizeInteger(
      options?.eyePatternGap,
      options?.gap ?? 0,
      "eyePatternGap",
      0,
      256,
    ),
    bodyDensity: sanitizeBodyDensity(options?.bodyDensity),
    cornerRadius: sanitizeOptionalInteger(
      options?.cornerRadius,
      "cornerRadius",
      0,
      256,
    ),
    eyePatternCornerRadius: sanitizeOptionalInteger(
      options?.eyePatternCornerRadius,
      "eyePatternCornerRadius",
      0,
      256,
    ),
  };
}

export function normalizeScanSafe(
  value: QRCodeOptions["scanSafe"],
): false | "standard" | "strict" {
  if (value === undefined || value === false) {
    return false;
  }
  if (value === true) {
    return "standard";
  }
  if (value === "strict") {
    return "strict";
  }
  throw new Error("scanSafe must be true, false, or strict.");
}

export function sanitizeLayout(value: QRCodeLayout | undefined): QRCodeLayout {
  const resolved = value ?? DEFAULT_LAYOUT;
  if (resolved !== "matrix") {
    throw new Error("layout must be matrix; radial layouts are not scan-safe.");
  }
  return resolved;
}

export function sanitizeShape(
  value: QRCodeBodyShape | undefined,
  name: string,
): QRCodeBodyShape {
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

export function sanitizeEyeFrameShape(
  value: QRCodeEyeFrameShape | undefined,
): QRCodeEyeFrameShape {
  const resolved = value ?? DEFAULT_EYE_FRAME_SHAPE;
  if (
    resolved !== "square" &&
    resolved !== "circle" &&
    resolved !== "rounded"
  ) {
    throw new Error("eyeFrameShape must be square, circle, or rounded.");
  }
  return resolved;
}

export function sanitizeEyeballShape(
  value: QRCodeEyeBallShape | undefined,
): QRCodeEyeBallShape {
  const resolved = value ?? DEFAULT_EYEBALL_SHAPE;
  if (
    resolved !== "square" &&
    resolved !== "circle" &&
    resolved !== "rounded"
  ) {
    throw new Error("eyeballShape must be square, circle, or rounded.");
  }
  return resolved;
}

export function sanitizeBodyDensity(
  value: QRCodeBodyDensity | undefined,
): QRCodeBodyDensity {
  const resolved = value ?? DEFAULT_BODY_DENSITY;
  if (
    resolved !== "sparse" &&
    resolved !== "balanced" &&
    resolved !== "dense"
  ) {
    throw new Error("bodyDensity must be sparse, balanced, or dense.");
  }
  return resolved;
}

export function sanitizeGradientType(
  value: QRCodeGradientType | undefined,
): QRCodeGradientType {
  const resolved = value ?? "linear";
  if (resolved !== "linear" && resolved !== "radial") {
    throw new Error("gradient.type must be linear or radial.");
  }
  return resolved;
}

export function normalizeGradientLocations(
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

export function sanitizeGradientPoint(
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

export function sanitizeUnitNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a finite number between 0 and 1.`);
  }
  return value;
}

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function validateLogoDimensions(
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

export function validateVersionRange(
  minVersion: number,
  maxVersion: number,
): void {
  if (minVersion > maxVersion) {
    throw new Error(
      "minVersion and maxVersion must be between 1 and 40, with minVersion <= maxVersion.",
    );
  }
}

export function scaleShapeOptions(
  options: QRCodeShapeOptions,
  scale: number,
): QRCodeShapeOptions {
  return {
    layout: options.layout,
    shape: options.shape,
    eyeFrameShape: options.eyeFrameShape,
    eyeballShape: options.eyeballShape,
    eyePatternShape: options.eyePatternShape,
    bodyDensity: options.bodyDensity,
    gap:
      options.gap === undefined ? undefined : Math.round(options.gap * scale),
    eyePatternGap:
      options.eyePatternGap === undefined
        ? undefined
        : Math.round(options.eyePatternGap * scale),
    cornerRadius:
      options.cornerRadius === undefined
        ? undefined
        : Math.round(options.cornerRadius * scale),
    eyePatternCornerRadius:
      options.eyePatternCornerRadius === undefined
        ? undefined
        : Math.round(options.eyePatternCornerRadius * scale),
  };
}

export function normalizeEcl(
  value: ErrorCorrectionLevel,
): "L" | "M" | "Q" | "H" {
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

export function sanitizeInteger(
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

export function sanitizeVersion(
  value: QRCodeVersion | undefined,
  fallback: QRCodeVersion,
  name: string,
): QRCodeVersion {
  return sanitizeInteger(value, fallback, name, 1, 40) as QRCodeVersion;
}

export function sanitizeMask(
  value: QRCodeMaskPattern | undefined,
  fallback: QRCodeMaskPattern,
): QRCodeMaskPattern {
  return sanitizeInteger(value, fallback, "mask", -1, 7) as QRCodeMaskPattern;
}

export function sanitizeOptionalInteger(
  value: number | undefined,
  name: string,
  min: number,
  max: number,
): number {
  if (value === undefined) {
    return -1;
  }
  return sanitizeInteger(value, -1, name, min, max);
}
