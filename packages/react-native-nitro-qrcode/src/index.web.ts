import React, { type ReactNode, useMemo } from "react";
import {
  Image,
  type ImageStyle,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import * as QRCodeJS from "qrcode";

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

export type QRCodeOptions = {
  value: string;
  size?: number;
  quietZone?: number;
  errorCorrectionLevel?: ErrorCorrectionLevel;
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
  logoPadding?: number;
  logoBackgroundColor?: string;
  testID?: string;
};

const COMPONENT_RASTER_MULTIPLIER = 3;
const MIN_COMPONENT_RASTER_SIZE = 96;

type QRCodeModuleData = {
  size: number;
  data: ArrayLike<boolean | number>;
};

type QRCodeModel = {
  modules: QRCodeModuleData;
};

type QRCodeFactory = {
  create(
    value: string,
    options: {
      errorCorrectionLevel: "L" | "M" | "Q" | "H";
      version?: number;
      maskPattern?: number;
    },
  ): QRCodeModel;
};

type NormalizedOptions = Required<
  Omit<
    QRCodeOptions,
    "errorCorrectionLevel" | "shapeOptions" | "gradient" | "orbit"
  >
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

type CanvasFill = string | CanvasGradient;

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
const DEFAULT_LAYOUT: QRCodeLayout = "matrix";
const DEFAULT_LOGO_AREA_SIZE = 0;
const DEFAULT_LOGO_AREA_BORDER_RADIUS = 0;
const DEFAULT_LINEAR_START: QRCodeGradientPoint = { x: 0, y: 0 };
const DEFAULT_LINEAR_END: QRCodeGradientPoint = { x: 1, y: 1 };
const DEFAULT_RADIAL_START: QRCodeGradientPoint = { x: 0.5, y: 0.5 };
const DEFAULT_RADIAL_END: QRCodeGradientPoint = { x: 1, y: 1 };
const MAX_CACHE_ENTRIES = 128;
const webCache = new Map<string, string>();
const qrcode = QRCodeJS as unknown as QRCodeFactory;

export function toPngBase64(options: QRCodeOptions): string {
  const uri = toPngDataUri(options);
  return uri.slice("data:image/png;base64,".length);
}

export function toPngDataUri(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  const key = cacheKey(normalized, "png");
  const cached = webCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const canvas = createCanvas(normalized.size);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Unable to create 2D canvas context for QRCode rendering.");
  }

  const model = createModel(normalized);
  const totalModules = model.modules.size + normalized.quietZone * 2;
  const pixelSize = normalized.size;
  context.fillStyle = normalized.backgroundColor;
  context.fillRect(0, 0, pixelSize, pixelSize);
  const foregroundFill = createForegroundFill(context, normalized);
  const useLayerColors = hasCustomLayerColors(normalized);
  context.fillStyle = foregroundFill;

  if (canDrawSquareRuns(normalized.shapeOptions) && !useLayerColors) {
    drawSquareRuns(
      context,
      model,
      normalized.quietZone,
      totalModules,
      pixelSize,
    );
    clearLogoArea(context, normalized, foregroundFill);
    const output = canvas.toDataURL("image/png");
    webCache.set(key, output);
    return output;
  }

  const drawGroupedFinderEyes = shouldDrawGroupedFinderEyes(
    normalized.shapeOptions,
    normalized,
  );

  for (let moduleY = 0; moduleY < model.modules.size; moduleY++) {
    const y0 = modulePixel(
      moduleY + normalized.quietZone,
      pixelSize,
      totalModules,
    );
    const y1 = modulePixel(
      moduleY + normalized.quietZone + 1,
      pixelSize,
      totalModules,
    );
    for (let moduleX = 0; moduleX < model.modules.size; moduleX++) {
      if (isDark(model, moduleX, moduleY)) {
        const eyeModule = isEyeModule(moduleX, moduleY, model.modules.size);
        if (drawGroupedFinderEyes && eyeModule) {
          continue;
        }
        const x0 = modulePixel(
          moduleX + normalized.quietZone,
          pixelSize,
          totalModules,
        );
        const x1 = modulePixel(
          moduleX + normalized.quietZone + 1,
          pixelSize,
          totalModules,
        );
        const shape: QRCodeShape = isEyeBallModule(
          moduleX,
          moduleY,
          model.modules.size,
        )
          ? normalized.shapeOptions.eyeballShape
          : eyeModule
            ? normalized.shapeOptions.eyeFrameShape
            : normalized.shapeOptions.shape;
        const gap = eyeModule
          ? normalized.shapeOptions.eyePatternGap
          : normalized.shapeOptions.gap;
        const cornerRadius = eyeModule
          ? normalized.shapeOptions.eyePatternCornerRadius
          : normalized.shapeOptions.cornerRadius;
        const moduleFill = getModuleFill(
          normalized,
          foregroundFill,
          moduleX,
          moduleY,
          model.modules.size,
        );
        if (!eyeModule && normalized.strokeColor !== DEFAULT_STROKE) {
          context.fillStyle = normalized.strokeColor;
          drawModule(context, x0, y0, x1, y1, shape, gap, cornerRadius);
          context.fillStyle = moduleFill;
          drawModule(
            context,
            x0,
            y0,
            x1,
            y1,
            shape,
            gap + Math.max(1, (x1 - x0) * 0.18),
            cornerRadius,
          );
          continue;
        }
        context.fillStyle = moduleFill;
        drawModule(context, x0, y0, x1, y1, shape, gap, cornerRadius);
      }
    }
  }
  if (drawGroupedFinderEyes) {
    drawGroupedFinders(
      context,
      model.modules.size,
      normalized.quietZone,
      totalModules,
      pixelSize,
      normalized,
    );
  }
  clearLogoArea(context, normalized, foregroundFill);

  const output = canvas.toDataURL("image/png");
  setCacheEntry(key, output);
  return output;
}

export async function toPngBase64Async(
  options: QRCodeOptions,
): Promise<string> {
  return toPngBase64(options);
}

export async function toPngDataUriAsync(
  options: QRCodeOptions,
): Promise<string> {
  return toPngDataUri(options);
}

export function toSvgString(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  const key = cacheKey(normalized, "svg");
  const cached = webCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const model = createModel(normalized);
  const totalSize = model.modules.size + normalized.quietZone * 2;
  let path = "";
  for (let y = 0; y < model.modules.size; y++) {
    for (let x = 0; x < model.modules.size; x++) {
      if (isDark(model, x, y)) {
        path += `M${x + normalized.quietZone},${y + normalized.quietZone}h1v1h-1z`;
      }
    }
  }

  const gradientMarkup = createSvgGradient(normalized);
  const foregroundFill =
    gradientMarkup === ""
      ? normalized.foregroundColor
      : "url(#nitro-qrcode-gradient)";
  const output = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">${gradientMarkup}<path fill="${normalized.backgroundColor}" d="M0,0h${totalSize}v${totalSize}H0z"/><path fill="${foregroundFill}" d="${path}"/></svg>`;
  setCacheEntry(key, output);
  return output;
}

export function getMatrix(options: QRCodeOptions): QRCodeMatrix {
  const normalized = normalizeOptions(options);
  const model = createModel(normalized);
  const packed = new Uint8Array(
    Math.ceil((model.modules.size * model.modules.size) / 8),
  );

  for (let y = 0; y < model.modules.size; y++) {
    for (let x = 0; x < model.modules.size; x++) {
      const index = y * model.modules.size + x;
      if (isDark(model, x, y)) {
        packed[Math.floor(index / 8)] |= 1 << (7 - (index % 8));
      }
    }
  }

  return {
    size: model.modules.size,
    packedBase64: base64Encode(packed),
  };
}

export function clearQRCodeCache(): void {
  webCache.clear();
}

export function getQRCodeCacheSize(): number {
  return webCache.size;
}

export function QRCode({
  value,
  size = 180,
  quietZone,
  errorCorrectionLevel,
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
  style,
  imageStyle,
  logo,
  logoPadding,
  logoBackgroundColor,
  testID,
}: QRCodeProps) {
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
      rasterScale,
      resolvedLogoAreaSize,
      logoAreaBorderRadius,
    ],
  );
  const uri = useMemo(() => toPngDataUri(options), [options]);

  return React.createElement(
    View,
    {
      style: [styles.frame, { width: size, height: size }, style],
      testID,
    },
    React.createElement(Image, {
      source: { uri },
      resizeMode: "contain",
      style: [styles.image, imageStyle],
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
              backgroundColor:
                logoBackgroundColor ?? backgroundColor ?? DEFAULT_BACKGROUND,
              padding: Math.max(0, logoPadding ?? 0),
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

function setCacheEntry(key: string, value: string): void {
  webCache.set(key, value);
  if (webCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = webCache.keys().next().value as string;
    webCache.delete(firstKey);
  }
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
    layout: options.layout,
    shape: options.shape,
    eyeFrameShape: options.eyeFrameShape,
    eyeballShape: options.eyeballShape,
    eyePatternShape: options.eyePatternShape,
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

function createModel(options: NormalizedOptions): QRCodeModel {
  return qrcode.create(options.value, {
    errorCorrectionLevel: options.errorCorrectionLevel,
    version:
      options.minVersion === options.maxVersion
        ? options.minVersion
        : undefined,
    maskPattern: options.mask >= 0 ? options.mask : undefined,
  });
}

function createForegroundFill(
  context: CanvasRenderingContext2D,
  options: NormalizedOptions,
): CanvasFill {
  if (options.gradient.type === "none") {
    return options.foregroundColor;
  }

  const size = options.size;
  const locations = resolveGradientLocations(options.gradient);
  if (options.gradient.type === "radial") {
    const centerX = options.gradient.startX * size;
    const centerY = options.gradient.startY * size;
    const radius = Math.max(
      Math.hypot(
        (options.gradient.endX - options.gradient.startX) * size,
        (options.gradient.endY - options.gradient.startY) * size,
      ),
      1,
    );
    const gradient = context.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius,
    );
    addGradientStops(gradient, options.gradient.colors, locations);
    return gradient;
  }

  const gradient = context.createLinearGradient(
    options.gradient.startX * size,
    options.gradient.startY * size,
    options.gradient.endX * size,
    options.gradient.endY * size,
  );
  addGradientStops(gradient, options.gradient.colors, locations);
  return gradient;
}

function hasCustomLayerColors(options: NormalizedOptions): boolean {
  return (
    options.strokeColor !== DEFAULT_STROKE ||
    options.eyeColor !== DEFAULT_EYE ||
    options.eyeStrokeColor !== DEFAULT_EYE_STROKE ||
    options.eyeballColor !== DEFAULT_EYEBALL
  );
}

function getModuleFill(
  options: NormalizedOptions,
  foregroundFill: CanvasFill,
  moduleX: number,
  moduleY: number,
  matrixSize: number,
): CanvasFill {
  if (!isEyeModule(moduleX, moduleY, matrixSize)) {
    return foregroundFill;
  }
  if (isEyeBallModule(moduleX, moduleY, matrixSize)) {
    return options.eyeballColor;
  }
  return options.eyeColor;
}

function createCanvas(size: number): HTMLCanvasElement {
  if (typeof document === "undefined") {
    throw new Error("QRCode PNG generation on web requires a browser canvas.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function isDark(model: QRCodeModel, x: number, y: number): boolean {
  return Boolean(model.modules.data[y * model.modules.size + x]);
}

function modulePixel(
  moduleIndex: number,
  pixelSize: number,
  totalModules: number,
): number {
  return Math.round((moduleIndex * pixelSize) / totalModules);
}

function isEyeModule(x: number, y: number, matrixSize: number): boolean {
  const top = y >= 0 && y < 7;
  const left = x >= 0 && x < 7;
  const right = x >= matrixSize - 7 && x < matrixSize;
  const bottom = y >= matrixSize - 7 && y < matrixSize;
  return (top && left) || (top && right) || (bottom && left);
}

function getEyeOrigin(
  x: number,
  y: number,
  matrixSize: number,
): { x: number; y: number } {
  if (x < 7 && y < 7) {
    return { x: 0, y: 0 };
  }
  if (x >= matrixSize - 7 && y < 7) {
    return { x: matrixSize - 7, y: 0 };
  }
  return { x: 0, y: matrixSize - 7 };
}

function isEyeBallModule(x: number, y: number, matrixSize: number): boolean {
  const origin = getEyeOrigin(x, y, matrixSize);
  const localX = x - origin.x;
  const localY = y - origin.y;
  return localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
}

function canDrawSquareRuns(options: Required<QRCodeShapeOptions>): boolean {
  return (
    options.shape === "square" &&
    options.eyeFrameShape === "square" &&
    options.eyeballShape === "square" &&
    options.gap === 0 &&
    options.eyePatternGap === 0
  );
}

function shouldDrawGroupedFinderEyes(
  options: Required<QRCodeShapeOptions>,
  normalized: NormalizedOptions,
): boolean {
  return (
    options.eyeFrameShape !== "square" ||
    options.eyeballShape !== "square" ||
    normalized.eyeColor !== DEFAULT_EYE ||
    normalized.eyeStrokeColor !== DEFAULT_EYE_STROKE ||
    normalized.eyeballColor !== DEFAULT_EYEBALL
  );
}

function drawSquareRuns(
  context: CanvasRenderingContext2D,
  model: QRCodeModel,
  quietZone: number,
  totalModules: number,
  pixelSize: number,
): void {
  const matrixSize = model.modules.size;
  for (let moduleY = 0; moduleY < matrixSize; moduleY++) {
    let runStart = -1;
    const y0 = modulePixel(moduleY + quietZone, pixelSize, totalModules);
    const y1 = modulePixel(moduleY + quietZone + 1, pixelSize, totalModules);
    for (let moduleX = 0; moduleX <= matrixSize; moduleX++) {
      const dark = moduleX < matrixSize && isDark(model, moduleX, moduleY);
      if (dark && runStart < 0) {
        runStart = moduleX;
      }
      if ((!dark || moduleX === matrixSize) && runStart >= 0) {
        const x0 = modulePixel(runStart + quietZone, pixelSize, totalModules);
        const x1 = modulePixel(moduleX + quietZone, pixelSize, totalModules);
        context.fillRect(x0, y0, x1 - x0, y1 - y0);
        runStart = -1;
      }
    }
  }
}

function drawGroupedFinders(
  context: CanvasRenderingContext2D,
  matrixSize: number,
  quietZone: number,
  totalModules: number,
  pixelSize: number,
  options: NormalizedOptions,
): void {
  drawGroupedFinder(context, 0, 0, quietZone, totalModules, pixelSize, options);
  drawGroupedFinder(
    context,
    matrixSize - 7,
    0,
    quietZone,
    totalModules,
    pixelSize,
    options,
  );
  drawGroupedFinder(
    context,
    0,
    matrixSize - 7,
    quietZone,
    totalModules,
    pixelSize,
    options,
  );
}

function drawGroupedFinder(
  context: CanvasRenderingContext2D,
  moduleX: number,
  moduleY: number,
  quietZone: number,
  totalModules: number,
  pixelSize: number,
  options: NormalizedOptions,
): void {
  const rect = (offset: number, span: number) => {
    const x = Math.round(
      ((moduleX + quietZone + offset) * pixelSize) / totalModules,
    );
    const y = Math.round(
      ((moduleY + quietZone + offset) * pixelSize) / totalModules,
    );
    const end = Math.round(
      ((moduleX + quietZone + offset + span) * pixelSize) / totalModules,
    );
    return { x, y, size: end - x };
  };
  const frameShape = options.shapeOptions.eyeFrameShape;
  const strokeInset = frameShape === "square" ? 0.3 : 0.65;
  const outerColor =
    options.eyeStrokeColor === DEFAULT_EYE_STROKE
      ? options.eyeColor
      : options.eyeStrokeColor;

  drawFinderShape(
    context,
    rect(0, 7),
    frameShape,
    outerColor,
    options.shapeOptions.eyePatternCornerRadius,
  );
  if (options.eyeStrokeColor !== DEFAULT_EYE_STROKE) {
    drawFinderShape(
      context,
      rect(strokeInset, 7 - strokeInset * 2),
      frameShape,
      options.eyeColor,
      options.shapeOptions.eyePatternCornerRadius,
    );
  }
  drawFinderShape(
    context,
    rect(1, 5),
    frameShape,
    options.backgroundColor,
    options.shapeOptions.eyePatternCornerRadius,
  );
  const useCircleFrameSquareEyeball =
    frameShape === "circle" && options.shapeOptions.eyeballShape === "square";
  const eyeballOffset =
    options.shapeOptions.eyeballShape === "circle"
      ? 1.75
      : useCircleFrameSquareEyeball
        ? 2.25
        : 2;
  const eyeballSpan =
    options.shapeOptions.eyeballShape === "circle"
      ? 3.5
      : useCircleFrameSquareEyeball
        ? 2.5
        : 3;
  drawFinderShape(
    context,
    rect(eyeballOffset, eyeballSpan),
    options.shapeOptions.eyeballShape,
    options.eyeballColor,
    options.shapeOptions.eyePatternCornerRadius,
  );
}

function drawFinderShape(
  context: CanvasRenderingContext2D,
  rect: { x: number; y: number; size: number },
  shape: QRCodeShape,
  fill: CanvasFill,
  cornerRadius: number,
): void {
  context.fillStyle = fill;
  if (shape === "circle") {
    context.beginPath();
    context.arc(
      rect.x + rect.size / 2,
      rect.y + rect.size / 2,
      rect.size / 2,
      0,
      Math.PI * 2,
    );
    context.fill();
    return;
  }
  if (shape === "rounded" || cornerRadius >= 0) {
    drawRoundedRect(
      context,
      rect.x,
      rect.y,
      rect.size,
      rect.size,
      cornerRadius >= 0 ? cornerRadius : rect.size * 0.22,
    );
    return;
  }
  context.fillRect(rect.x, rect.y, rect.size, rect.size);
}

function drawModule(
  context: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  shape: QRCodeShape,
  gap: number,
  cornerRadius: number,
): void {
  const maxGap = Math.max(0, (Math.min(x1 - x0, y1 - y0) - 1) / 2);
  const inset = Math.min(gap, maxGap);
  const left = x0 + inset;
  const top = y0 + inset;
  const width = Math.max(0, x1 - x0 - inset * 2);
  const height = Math.max(0, y1 - y0 - inset * 2);
  if (shape === "circle") {
    drawRoundedRect(context, left, top, width, height, width * 0.36);
    return;
  }
  if (shape === "rounded" || cornerRadius >= 0) {
    drawRoundedRect(
      context,
      left,
      top,
      width,
      height,
      cornerRadius >= 0 ? cornerRadius : Math.min(width, height) / 3,
    );
    return;
  }

  context.fillRect(left, top, width, height);
}

function clearLogoArea(
  context: CanvasRenderingContext2D,
  options: NormalizedOptions,
  foregroundFill: CanvasFill,
): void {
  if (options.logoAreaSize === 0) {
    return;
  }
  const areaSize = Math.min(options.logoAreaSize, options.size);
  const left = (options.size - areaSize) / 2;
  const top = (options.size - areaSize) / 2;
  context.fillStyle = options.backgroundColor;
  drawRoundedRect(
    context,
    left,
    top,
    areaSize,
    areaSize,
    options.logoAreaBorderRadius,
  );
  context.fillStyle = foregroundFill;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const corner = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - corner,
    y + height,
  );
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.fill();
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(binary, "binary").toString("base64");
}

function addGradientStops(
  gradient: CanvasGradient,
  colors: string[],
  locations: number[],
): void {
  locations.forEach((location, index) => {
    gradient.addColorStop(location, colors[index]);
  });
}

function getSvgStopMarkup(location: number, color: string): string {
  const stop = color.length === 9 ? color.slice(0, 7) : color;
  const opacity =
    color.length === 9
      ? ` stop-opacity="${(parseInt(color.slice(7, 9), 16) / 255).toFixed(3)}"`
      : "";
  return `<stop offset="${formatPercent(location)}" stop-color="${stop}"${opacity}/>`;
}

function resolveGradientLocations(gradient: NormalizedGradient): number[] {
  if (gradient.locations.length > 0) {
    return gradient.locations;
  }

  return gradient.colors.map(
    (_, index) => index / (gradient.colors.length - 1),
  );
}

function createSvgGradient(options: NormalizedOptions): string {
  if (options.gradient.type === "none") {
    return "";
  }

  const locations = resolveGradientLocations(options.gradient);
  const stops = options.gradient.colors
    .map((color, index) => getSvgStopMarkup(locations[index], color))
    .join("");

  if (options.gradient.type === "radial") {
    const radius = Math.max(
      Math.hypot(
        options.gradient.endX - options.gradient.startX,
        options.gradient.endY - options.gradient.startY,
      ),
      0.01,
    );
    return `<defs><radialGradient id="nitro-qrcode-gradient" cx="${formatPercent(options.gradient.startX)}" cy="${formatPercent(options.gradient.startY)}" r="${formatPercent(radius)}">${stops}</radialGradient></defs>`;
  }

  return `<defs><linearGradient id="nitro-qrcode-gradient" x1="${formatPercent(options.gradient.startX)}" y1="${formatPercent(options.gradient.startY)}" x2="${formatPercent(options.gradient.endX)}" y2="${formatPercent(options.gradient.endY)}">${stops}</linearGradient></defs>`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function cacheKey(options: NormalizedOptions, output: string): string {
  return [
    output,
    options.value,
    options.size,
    options.quietZone,
    options.errorCorrectionLevel,
    options.foregroundColor,
    options.backgroundColor,
    options.strokeColor,
    options.eyeColor,
    options.eyeStrokeColor,
    options.eyeballColor,
    options.minVersion,
    options.maxVersion,
    options.mask,
    options.boostEcl,
    options.shapeOptions.shape,
    options.shapeOptions.eyeFrameShape,
    options.shapeOptions.eyeballShape,
    options.shapeOptions.gap,
    options.shapeOptions.eyePatternGap,
    options.shapeOptions.cornerRadius,
    options.shapeOptions.eyePatternCornerRadius,
    options.shapeOptions.layout,
    options.logoAreaSize,
    options.logoAreaBorderRadius,
    options.gradient.type,
    options.gradient.colors.join(","),
    options.gradient.locations.join(","),
    options.gradient.startX,
    options.gradient.startY,
    options.gradient.endX,
    options.gradient.endY,
  ].join("|");
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
