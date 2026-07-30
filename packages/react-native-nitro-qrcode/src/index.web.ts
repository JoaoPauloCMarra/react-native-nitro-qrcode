import {
  DEFAULT_EYE,
  DEFAULT_EYEBALL,
  DEFAULT_EYE_STROKE,
  DEFAULT_STROKE,
  normalizeOptions,
  validateOptions,
  type NitroQRCodeApi,
  type NormalizedGradient,
  type NormalizedOptions,
  type QRCodeMatrix,
  type QRCodeOptions,
  type QRCodeShape,
  type QRCodeShapeOptions,
} from "./shared";
import { createQRCodeComponent } from "./qrcode-component";
import * as QRCodeJS from "qrcode";
export type {
  ErrorCorrectionLevel,
  NitroQRCodeApi,
  QRCodeBackgroundColor,
  QRCodeBodyDensity,
  QRCodeBodyShape,
  QRCodeColor,
  QRCodeEyeBallShape,
  QRCodeEyeFrameShape,
  QRCodeEyePatternShape,
  QRCodeGradient,
  QRCodeGradientColors,
  QRCodeGradientLocations,
  QRCodeGradientPoint,
  QRCodeGradientType,
  QRCodeLayout,
  QRCodeMaskPattern,
  QRCodeMatrix,
  QRCodeOptions,
  QRCodePreset,
  QRCodeProps,
  QRCodeRef,
  QRCodeScanabilityWarning,
  QRCodeShape,
  QRCodeShapeOptions,
  QRCodeValidationError,
  QRCodeValidationResult,
  QRCodeVersion,
} from "./shared";
export {
  validateOptions,
} from "./shared";

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

type CanvasFill = string | CanvasGradient;

const MAX_CACHE_ENTRIES = 128;
const MAX_CACHE_BYTES = 4 * 1024 * 1024;
type WebCacheEntry = {
  request: string;
  value: string;
  bytes: number;
};
const webCache = new Map<string, WebCacheEntry>();
let webCacheBytes = 0;
const qrcode = QRCodeJS as unknown as QRCodeFactory;

export function toPngBase64(options: QRCodeOptions): string {
  const uri = toPngDataUri(options);
  return uri.slice("data:image/png;base64,".length);
}
export function toPngDataUri(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  const request = cacheRequest(normalized, "png");
  const key = hashCachePart(request);
  const cached = getCacheEntry(key, request);
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

  if (
    canDrawSquareRuns(normalized.shapeOptions) &&
    !useLayerColors &&
    normalized.logoAreaSize === 0
  ) {
    drawSquareRuns(
      context,
      model,
      normalized.quietZone,
      totalModules,
      pixelSize,
    );
    clearLogoArea(context, normalized, foregroundFill);
    const output = canvas.toDataURL("image/png");
    setCacheEntry(key, request, output);
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
        if (intersectsLogoArea(x0, y0, x1, y1, normalized)) {
          continue;
        }
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
          : resolveBodyGap(normalized.shapeOptions, x1 - x0, y1 - y0);
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
  setCacheEntry(key, request, output);
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
  const request = cacheRequest(normalized, "svg");
  const key = hashCachePart(request);
  const cached = getCacheEntry(key, request);
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
  setCacheEntry(key, request, output);
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
        const byteIndex = Math.floor(index / 8);
        packed[byteIndex] = packed[byteIndex]! | (1 << (7 - (index % 8)));
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
  webCacheBytes = 0;
}

export function getQRCodeCacheSize(): number {
  return webCache.size;
}

export const QRCode = createQRCodeComponent({
  toPngDataUri,
  toPngBase64,
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

function getCacheEntry(key: string, request: string): string | undefined {
  const cached = webCache.get(key);
  if (cached === undefined || cached.request !== request) {
    return undefined;
  }
  webCache.delete(key);
  webCache.set(key, cached);
  return cached.value;
}

function setCacheEntry(key: string, request: string, value: string): void {
  const bytes = (key.length + request.length + value.length) * 2;
  if (bytes > MAX_CACHE_BYTES) {
    return;
  }

  const existing = webCache.get(key);
  if (existing !== undefined) {
    webCacheBytes -= existing.bytes;
    webCache.delete(key);
  }
  webCache.set(key, { request, value, bytes });
  webCacheBytes += bytes;

  while (
    webCache.size > MAX_CACHE_ENTRIES ||
    webCacheBytes > MAX_CACHE_BYTES
  ) {
    const firstKey = webCache.keys().next().value as string;
    const removed = webCache.get(firstKey) as WebCacheEntry;
    webCacheBytes -= removed.bytes;
    webCache.delete(firstKey);
  }
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
    options.eyePatternGap === 0 &&
    options.bodyDensity === "dense"
  );
}

function resolveBodyGap(
  options: Required<QRCodeShapeOptions>,
  width: number,
  height: number,
): number {
  if (options.bodyDensity === "dense") {
    return options.gap;
  }
  const moduleSize = Math.max(1, Math.min(width, height));
  const densityGap =
    options.bodyDensity === "sparse"
      ? Math.round(moduleSize * 0.22)
      : Math.round(moduleSize * 0.12);
  return Math.max(options.gap, densityGap);
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
  context.save();
  context.globalCompositeOperation = "destination-out";
  drawRoundedRect(
    context,
    left,
    top,
    areaSize,
    areaSize,
    options.logoAreaBorderRadius,
  );
  context.restore();
  context.fillStyle = foregroundFill;
}

function intersectsLogoArea(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  options: NormalizedOptions,
): boolean {
  if (options.logoAreaSize === 0) {
    return false;
  }
  const areaSize = Math.min(options.logoAreaSize, options.size);
  const left = (options.size - areaSize) / 2;
  const top = (options.size - areaSize) / 2;
  return x0 < left + areaSize && x1 > left && y0 < top + areaSize && y1 > top;
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
    const color = colors[index];
    if (color !== undefined) {
      gradient.addColorStop(location, color);
    }
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
    .map((color, index) => getSvgStopMarkup(locations[index]!, color))
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

function cacheRequest(options: NormalizedOptions, output: string): string {
  return JSON.stringify([
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
    options.shapeOptions.bodyDensity,
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
  ]);
}

function hashCachePart(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}
