import React, {
  type ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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

export type QRCodeGradient = {
  type?: QRCodeGradientType;
  colors: readonly [string, string, ...string[]];
  locations?: readonly number[];
  start?: QRCodeGradientPoint;
  end?: QRCodeGradientPoint;
};

export type QRCodePreset = "default" | "rounded" | "dots" | "branded";

export type QRCodeOptions = {
  value: string;
  size?: number;
  quietZone?: number;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  scanSafe?: boolean | "strict";
  foregroundColor?: string;
  backgroundColor?: string;
  strokeColor?: string;
  eyeColor?: string;
  eyeStrokeColor?: string;
  eyeballColor?: string;
  gradient?: QRCodeGradient;
  minVersion?: number;
  maxVersion?: number;
  mask?: number;
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

export type QRCodeProps = QRCodeOptions & {
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  logo?: ReactNode;
  placeholder?: ReactNode;
  preset?: QRCodePreset;
  keepPreviousImage?: boolean;
  hideLogoUntilReady?: boolean;
  onReady?: (uri: string) => void;
  onError?: (error: Error) => void;
  logoPadding?: number;
  logoBackgroundColor?: string;
  testID?: string;
};

export type QRCodeScanabilityWarning = {
  code:
    | "low-contrast"
    | "too-small-size"
    | "logo-too-large"
    | "low-ecl-for-logo"
    | "bad-quiet-zone";
  message: string;
};

export type QRCodeValidationError = {
  code: string;
  message: string;
};

export type QRCodeValidationResult = {
  warnings: QRCodeScanabilityWarning[];
  errors: QRCodeValidationError[];
};

export type QRCodeRef = {
  toPngDataUri: () => string;
  toPngBase64: () => string;
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
}>;

const DEFAULT_SIZE = 512;
const DEFAULT_QUIET_ZONE = 4;
const DEFAULT_ECL: ErrorCorrectionLevel = "M";
const DEFAULT_FOREGROUND = "#000000";
const DEFAULT_BACKGROUND = "#FFFFFF";
const DEFAULT_STROKE = "#000000";
const DEFAULT_EYE = "#000000";
const DEFAULT_EYE_STROKE = "#000000";
const DEFAULT_EYEBALL = "#000000";
const DEFAULT_MIN_VERSION = 1;
const DEFAULT_MAX_VERSION = 40;
const DEFAULT_MASK = -1;
const DEFAULT_BOOST_ECL = true;
const DEFAULT_SHAPE: QRCodeBodyShape = "square";
const DEFAULT_EYE_FRAME_SHAPE: QRCodeEyeFrameShape = "square";
const DEFAULT_EYEBALL_SHAPE: QRCodeEyeBallShape = "square";
const DEFAULT_BODY_DENSITY: QRCodeBodyDensity = "dense";
const DEFAULT_LAYOUT: QRCodeLayout = "matrix";
const DEFAULT_LOGO_AREA_SIZE = 0;
const DEFAULT_LOGO_AREA_BORDER_RADIUS = 0;
const COMPONENT_RASTER_MULTIPLIER = 2;
const MIN_COMPONENT_RASTER_SIZE = 96;
const DEFAULT_LINEAR_START: QRCodeGradientPoint = { x: 0, y: 0 };
const DEFAULT_LINEAR_END: QRCodeGradientPoint = { x: 1, y: 1 };
const DEFAULT_RADIAL_START: QRCodeGradientPoint = { x: 0.5, y: 0.5 };
const DEFAULT_RADIAL_END: QRCodeGradientPoint = { x: 1, y: 1 };
const DEFAULT_KEEP_PREVIOUS_IMAGE = true;
const DEFAULT_HIDE_LOGO_UNTIL_READY = true;
const SCANABILITY_MINIMUM_SIZE = 120;
const SCANABILITY_QUIET_ZONE_MINIMUM = 2;
const SCAN_SAFE_QUIET_ZONE_MINIMUM = 4;
const SCANABILITY_QUIET_ZONE_MAXIMUM = 12;
const SCANABILITY_LOGO_SIZE_LIMIT = 0.3;
const SCANABILITY_LOW_CONTRAST = 2.5;

const PRESET_SHAPE_OPTIONS: Record<QRCodePreset, QRCodeShapeOptions> = {
  default: {
    shape: "square",
    eyeFrameShape: "square",
    eyeballShape: "square",
  },
  rounded: {
    shape: "rounded",
    eyeFrameShape: "rounded",
    eyeballShape: "rounded",
    cornerRadius: 8,
    eyePatternCornerRadius: 8,
  },
  dots: {
    shape: "circle",
    eyeFrameShape: "circle",
    eyeballShape: "circle",
    gap: 1,
    eyePatternGap: 1,
    cornerRadius: 0,
    eyePatternCornerRadius: 0,
  },
  branded: {
    shape: "rounded",
    eyeFrameShape: "square",
    eyeballShape: "rounded",
    gap: 1,
    eyePatternGap: 1,
    cornerRadius: 6,
    eyePatternCornerRadius: 6,
  },
};

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
    normalized.strokeColor,
    normalized.eyeColor,
    normalized.eyeStrokeColor,
    normalized.eyeballColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.shapeOptions.shape,
    normalized.shapeOptions.eyeFrameShape,
    normalized.shapeOptions.eyeballShape,
    normalized.shapeOptions.gap,
    normalized.shapeOptions.eyePatternGap,
    normalized.shapeOptions.bodyDensity,
    normalized.shapeOptions.cornerRadius,
    normalized.shapeOptions.eyePatternCornerRadius,
    normalized.shapeOptions.layout,
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
    normalized.strokeColor,
    normalized.eyeColor,
    normalized.eyeStrokeColor,
    normalized.eyeballColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.shapeOptions.shape,
    normalized.shapeOptions.eyeFrameShape,
    normalized.shapeOptions.eyeballShape,
    normalized.shapeOptions.gap,
    normalized.shapeOptions.eyePatternGap,
    normalized.shapeOptions.bodyDensity,
    normalized.shapeOptions.cornerRadius,
    normalized.shapeOptions.eyePatternCornerRadius,
    normalized.shapeOptions.layout,
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

export async function toPngBase64Async(
  options: QRCodeOptions,
): Promise<string> {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngBase64Async(
    normalized.value,
    normalized.size,
    normalized.quietZone,
    normalized.errorCorrectionLevel,
    normalized.foregroundColor,
    normalized.backgroundColor,
    normalized.strokeColor,
    normalized.eyeColor,
    normalized.eyeStrokeColor,
    normalized.eyeballColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.shapeOptions.shape,
    normalized.shapeOptions.eyeFrameShape,
    normalized.shapeOptions.eyeballShape,
    normalized.shapeOptions.gap,
    normalized.shapeOptions.eyePatternGap,
    normalized.shapeOptions.bodyDensity,
    normalized.shapeOptions.cornerRadius,
    normalized.shapeOptions.eyePatternCornerRadius,
    normalized.shapeOptions.layout,
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

export async function toPngDataUriAsync(
  options: QRCodeOptions,
): Promise<string> {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngDataUriAsync(
    normalized.value,
    normalized.size,
    normalized.quietZone,
    normalized.errorCorrectionLevel,
    normalized.foregroundColor,
    normalized.backgroundColor,
    normalized.strokeColor,
    normalized.eyeColor,
    normalized.eyeStrokeColor,
    normalized.eyeballColor,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
    normalized.shapeOptions.shape,
    normalized.shapeOptions.eyeFrameShape,
    normalized.shapeOptions.eyeballShape,
    normalized.shapeOptions.gap,
    normalized.shapeOptions.eyePatternGap,
    normalized.shapeOptions.bodyDensity,
    normalized.shapeOptions.cornerRadius,
    normalized.shapeOptions.eyePatternCornerRadius,
    normalized.shapeOptions.layout,
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

export function validateOptions(
  options: QRCodeOptions,
): QRCodeValidationResult {
  try {
    const normalized = normalizeOptions(options);
    const warnings = scanabilityWarnings(normalized);
    return {
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
      warnings: [],
      errors: [{ code: "invalid", message: toError(error).message }],
    };
  }
}

export const QRCode = forwardRef<QRCodeRef, QRCodeProps>(function QRCode(
  {
    value,
    size = 180,
    quietZone,
    errorCorrectionLevel,
    scanSafe,
    foregroundColor,
    backgroundColor,
    strokeColor,
    eyeColor,
    eyeStrokeColor,
    eyeballColor,
    gradient,
    minVersion,
    maxVersion,
    mask,
    boostEcl,
    orbit,
    shapeOptions,
    logoAreaSize,
    logoAreaBorderRadius,
    preset,
    keepPreviousImage = DEFAULT_KEEP_PREVIOUS_IMAGE,
    hideLogoUntilReady = DEFAULT_HIDE_LOGO_UNTIL_READY,
    onReady,
    onError,
    style,
    imageStyle,
    logo,
    placeholder,
    logoPadding,
    logoBackgroundColor,
    testID,
  }: QRCodeProps,
  ref: React.Ref<QRCodeRef>,
) {
  const [uri, setUri] = useState<string>();
  const [generationError, setGenerationError] = useState<Error>();
  const generationId = useRef(0);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
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
      scanSafe,
      foregroundColor,
      backgroundColor,
      strokeColor,
      eyeColor,
      eyeStrokeColor,
      eyeballColor,
      gradient,
      minVersion,
      maxVersion,
      mask,
      boostEcl,
      orbit,
      shapeOptions: scaleShapeOptions(
        mergePresetShapeOptions(shapeOptions, preset),
        rasterScale,
      ),
      logoAreaSize: Math.round(resolvedLogoAreaSize * rasterScale),
      logoAreaBorderRadius: Math.round(
        (logoAreaBorderRadius ?? DEFAULT_LOGO_AREA_BORDER_RADIUS) * rasterScale,
      ),
    }),
    [
      value,
      rasterSize,
      shapeOptions,
      quietZone,
      errorCorrectionLevel,
      scanSafe,
      foregroundColor,
      backgroundColor,
      strokeColor,
      eyeColor,
      eyeStrokeColor,
      eyeballColor,
      gradient,
      minVersion,
      maxVersion,
      mask,
      boostEcl,
      orbit,
      preset,
      rasterScale,
      resolvedLogoAreaSize,
      logoAreaBorderRadius,
    ],
  );

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onError, onReady]);

  useEffect(() => {
    let isMounted = true;
    const request = ++generationId.current;
    if (!keepPreviousImage) {
      setUri(undefined);
    }

    void toPngDataUriAsync(options).then(
      (nextUri) => {
        if (!isMounted || request !== generationId.current) {
          return;
        }
        setGenerationError(undefined);
        setUri(nextUri);
        onReadyRef.current?.(nextUri);
      },
      (error: unknown) => {
        if (!isMounted || request !== generationId.current) {
          return;
        }
        const nextError = toError(error);
        const onErrorCallback = onErrorRef.current;
        if (onErrorCallback === undefined) {
          setGenerationError(nextError);
          return;
        }
        onErrorCallback(nextError);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [keepPreviousImage, options]);

  useImperativeHandle(
    ref,
    () => ({
      toPngDataUri: () => toPngDataUri(options),
      toPngBase64: () => toPngBase64(options),
    }),
    [options],
  );

  const showLogo =
    logo !== undefined && (!hideLogoUntilReady || uri !== undefined);

  if (generationError !== undefined) {
    throw generationError;
  }

  return React.createElement(
    View,
    {
      style: [styles.frame, { width: size, height: size }, style],
      testID,
    },
    uri === undefined && placeholder,
    uri !== undefined &&
      React.createElement(Image, {
        source: { uri },
        resizeMode: "contain",
        style: [styles.image, imageStyle],
        accessibilityIgnoresInvertColors: Platform.OS !== "web",
      }),
    showLogo &&
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
              backgroundColor:
                logoBackgroundColor ?? backgroundColor ?? DEFAULT_BACKGROUND,
              padding: Math.max(0, logoPadding ?? 0),
            },
          ],
        },
        logo,
      ),
  );
});

export const NitroQRCode: NitroQRCodeApi = {
  toPngBase64,
  toPngDataUri,
  toPngBase64Async,
  toPngDataUriAsync,
  toSvgString,
  getMatrix,
  validateOptions,
  clearCache: clearQRCodeCache,
  getCacheSize: getQRCodeCacheSize,
};

type NormalizedOptions = Required<
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
    backgroundColor: sanitizeColor(
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
    mask: sanitizeInteger(options.mask, DEFAULT_MASK, "mask", -1, 7),
    boostEcl: options.boostEcl ?? DEFAULT_BOOST_ECL,
    shapeOptions: normalizeShapeOptions(options.shapeOptions, options.orbit),
    logoAreaSize,
    logoAreaBorderRadius,
  };
}

function normalizeScanSafe(
  value: QRCodeOptions["scanSafe"] | undefined,
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
  _orbit: boolean | undefined,
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

function mergePresetShapeOptions(
  options: QRCodeShapeOptions | undefined,
  preset: QRCodePreset | undefined,
): QRCodeShapeOptions {
  return { ...PRESET_SHAPE_OPTIONS[preset ?? "default"], ...options };
}

function scanabilityWarnings(
  options: NormalizedOptions,
): QRCodeScanabilityWarning[] {
  const warnings: QRCodeScanabilityWarning[] = [];

  if (options.size < SCANABILITY_MINIMUM_SIZE) {
    warnings.push({
      code: "too-small-size",
      message:
        "QRCode size is below 120; tiny modules reduce scan range and increase read failures.",
    });
  }

  if (options.quietZone < SCANABILITY_QUIET_ZONE_MINIMUM) {
    warnings.push({
      code: "bad-quiet-zone",
      message:
        "quietZone is low; using at least 2 quiet modules improves scan reliability.",
    });
  }

  if (options.quietZone > SCANABILITY_QUIET_ZONE_MAXIMUM) {
    warnings.push({
      code: "bad-quiet-zone",
      message:
        "quietZone is high and may reduce symbol density on small symbol sizes.",
    });
  }

  if (options.logoAreaSize > options.size * SCANABILITY_LOGO_SIZE_LIMIT) {
    warnings.push({
      code: "logo-too-large",
      message:
        "logoAreaSize is large; keep the logo under ~30% for better scan reliability.",
    });
  }

  if (
    options.logoAreaSize > 0 &&
    (options.errorCorrectionLevel === "L" ||
      options.errorCorrectionLevel === "M") &&
    options.logoAreaSize > options.size * 0.2
  ) {
    warnings.push({
      code: "low-ecl-for-logo",
      message:
        "errorCorrectionLevel is low for a large logo. Use Q/H to reduce decode failures.",
    });
  }

  const contrast = contrastRatio(
    parseHexColor(options.foregroundColor),
    parseHexColor(options.backgroundColor),
  );
  if (contrast < SCANABILITY_LOW_CONTRAST) {
    warnings.push({
      code: "low-contrast",
      message:
        "foregroundColor and backgroundColor contrast is low; low-contrast codes are harder to scan.",
    });
  }

  return warnings;
}

function sanitizeLayout(value: QRCodeLayout | undefined): QRCodeLayout {
  const resolved = value ?? DEFAULT_LAYOUT;
  if (resolved !== "matrix") {
    throw new Error("layout must be matrix; radial layouts are not scan-safe.");
  }
  return resolved;
}

function sanitizeShape(
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

function sanitizeEyeFrameShape(
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

function sanitizeEyeballShape(
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

function sanitizeBodyDensity(
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

function parseHexColor(color: string): {
  red: number;
  green: number;
  blue: number;
} {
  const hex = color.replace(/^#/, "");
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const alpha =
    hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return {
    red: Math.round(red * alpha + 255 * (1 - alpha)),
    green: Math.round(green * alpha + 255 * (1 - alpha)),
    blue: Math.round(blue * alpha + 255 * (1 - alpha)),
  };
}

function linearizeChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: {
  red: number;
  green: number;
  blue: number;
}): number {
  return (
    0.2126 * linearizeChannel(color.red) +
    0.7152 * linearizeChannel(color.green) +
    0.0722 * linearizeChannel(color.blue)
  );
}

function contrastRatio(
  first: { red: number; green: number; blue: number },
  second: { red: number; green: number; blue: number },
): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const light = Math.max(firstLuminance, secondLuminance);
  const dark = Math.min(firstLuminance, secondLuminance);
  return (light + 0.05) / (dark + 0.05);
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

function sanitizeOptionalInteger(
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
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
  },
});

export type { HybridQRCode };
