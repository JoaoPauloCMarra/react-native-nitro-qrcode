import { createBoundedCache } from "./cache";
import {
  getQRCodeMetrics,
  isQRCodeMetricsEnabled,
  nowMilliseconds,
  recordCacheLookup,
  recordGenerationRequest,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
} from "./metrics";
import {
  DEFAULT_EYE,
  DEFAULT_EYEBALL,
  DEFAULT_EYE_STROKE,
  DEFAULT_STROKE,
  areRgbaColorsEqual,
  rgbaColorBytes,
  toSvgColor,
} from "./colors";
import { createRenderPlan, type RenderPlan } from "./render-plan";
import {
  normalizeOptions,
  validateOptions,
  type NitroQRCodeApi,
  type NormalizedGradient,
  type NormalizedOptions,
  type QRCodeMatrix,
  type QRCodeOptions,
  type QRCodeShape,
  type QRCodeShapeOptions,
} from "./validation";
import { createQRCodeComponent } from "./qrcode-component";
import type { QRCodeProps, QRCodeRef } from "./qrcode-component";
import * as QRCodeJS from "qrcode";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
export type { QRCode as HybridQRCode } from "./QRCode.nitro";
export type {
  ErrorCorrectionLevel,
  NitroQRCodeApi,
  QRCodeBodyDensity,
  QRCodeBodyShape,
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
  QRCodeShape,
  QRCodeShapeOptions,
  QRCodeValidationError,
  QRCodeValidationErrorCode,
  QRCodeValidationResult,
  QRCodeVersion,
} from "./validation";
export type {
  QRCodeBackgroundColor,
  QRCodeColor,
} from "./colors";
export type { QRCodeScanabilityWarning } from "./scan-policy";
export type { QRCodePreset } from "./defaults";
export type { QRCodeProps, QRCodeRef } from "./qrcode-component";
export {
  validateOptions,
} from "./validation";
export {
  getQRCodeMetrics,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
  type QRCodeMetricsSnapshot,
} from "./metrics";

function measuredSync<T>(async: boolean, generate: () => T): T {
  if (!isQRCodeMetricsEnabled()) {
    return generate();
  }
  const started = nowMilliseconds();
  try {
    const result = generate();
    recordGenerationRequest({
      async,
      durationMs: nowMilliseconds() - started,
      failed: false,
    });
    return result;
  } catch (error) {
    recordGenerationRequest({
      async,
      durationMs: nowMilliseconds() - started,
      failed: true,
    });
    throw error;
  }
}

async function measuredAsync<T>(generate: () => Promise<T>): Promise<T> {
  if (!isQRCodeMetricsEnabled()) {
    return generate();
  }
  const started = nowMilliseconds();
  try {
    const result = await generate();
    recordGenerationRequest({
      async: true,
      durationMs: nowMilliseconds() - started,
      failed: false,
    });
    return result;
  } catch (error) {
    recordGenerationRequest({
      async: true,
      durationMs: nowMilliseconds() - started,
      failed: true,
    });
    throw error;
  }
}

function webGetQRCodeMetrics() {
  const snapshot = getQRCodeMetrics();
  if (!snapshot.enabled) {
    return snapshot;
  }
  return { ...snapshot, cacheBytes: webCache.bytes() };
}

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
const ASYNC_BAND_ROWS = 8;
const webCache = createBoundedCache<string>(
  MAX_CACHE_ENTRIES,
  MAX_CACHE_BYTES,
  (key, request, value) => (key.length + request.length + value.length) * 2,
);
const qrcode = QRCodeJS as unknown as QRCodeFactory;

export function toPngBase64(options: QRCodeOptions): string {
  const uri = toPngDataUri(options);
  return uri.slice("data:image/png;base64,".length);
}
export function toPngDataUri(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  const request = cacheRequest(normalized, "png");
  const key = hashCachePart(request);
  const cached = webCache.get(key, request);
  recordCacheLookup(cached !== undefined);
  if (cached !== undefined) {
    return cached;
  }

  return measuredSync(false, () => {
    const model = createModel(normalized);
    const pixelSize = renderPixelSize(normalized, model);
    const canvas = createCanvas(pixelSize);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Unable to create 2D canvas context for QRCode rendering.");
    }

    const plan = createRenderPlan(normalized, model, pixelSize);
    const { foregroundFill, useLayerColors } = preparePngCanvas(
      context,
      plan,
      normalized,
    );
    if (
      canDrawSquareRuns(normalized.shapeOptions) &&
      !useLayerColors &&
      normalized.logoAreaSize === 0
    ) {
      drawSquareRuns(
        context,
        model,
        normalized.quietZone,
        plan.totalModules,
        plan.pixelSize,
        0,
        model.modules.size,
      );
    } else {
      drawPlanRows(context, plan, normalized, foregroundFill, 0, plan.matrixSize);
    }
    finishPng(context, plan, normalized, foregroundFill);

    const output = canvas.toDataURL("image/png");
    webCache.set(key, request, output);
    return output;
  });
}

export async function toPngBase64Async(
  options: QRCodeOptions,
): Promise<string> {
  const uri = await toPngDataUriAsync(options);
  return uri.slice("data:image/png;base64,".length);
}

export async function toPngDataUriAsync(
  options: QRCodeOptions,
): Promise<string> {
  const normalized = normalizeOptions(options);
  const request = cacheRequest(normalized, "png");
  const key = hashCachePart(request);
  const cached = webCache.get(key, request);
  recordCacheLookup(cached !== undefined);
  if (cached !== undefined) {
    return cached;
  }

  return measuredAsync(async () => {
    const model = createModel(normalized);
    const pixelSize = renderPixelSize(normalized, model);
    const canvas = createCanvas(pixelSize);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Unable to create 2D canvas context for QRCode rendering.");
    }

    const plan = createRenderPlan(normalized, model, pixelSize);
    const { foregroundFill, useLayerColors } = preparePngCanvas(
      context,
      plan,
      normalized,
    );
    const moduleCount = model.modules.size;
    const useSquareRuns =
      canDrawSquareRuns(normalized.shapeOptions) &&
      !useLayerColors &&
      normalized.logoAreaSize === 0;
    for (let startRow = 0; startRow < moduleCount; startRow += ASYNC_BAND_ROWS) {
      const endRow = Math.min(startRow + ASYNC_BAND_ROWS, moduleCount);
      if (useSquareRuns) {
        drawSquareRuns(
          context,
          model,
          normalized.quietZone,
          plan.totalModules,
          plan.pixelSize,
          startRow,
          endRow,
        );
      } else {
        drawPlanRows(context, plan, normalized, foregroundFill, startRow, endRow);
      }
      await yieldToMainThread();
    }
    finishPng(context, plan, normalized, foregroundFill);

    const output = canvas.toDataURL("image/png");
    webCache.set(key, request, output);
    return output;
  });
}

export function toSvgString(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  const request = cacheRequest(normalized, "svg");
  const key = hashCachePart(request);
  const cached = webCache.get(key, request);
  recordCacheLookup(cached !== undefined);
  if (cached !== undefined) {
    return cached;
  }

  return measuredSync(false, () => {
    const model = createModel(normalized);
    const totalSize = model.modules.size + normalized.quietZone * 2;
    let path = "";
    for (let y = 0; y < model.modules.size; y++) {
      let x = 0;
      while (x < model.modules.size) {
        while (x < model.modules.size && !isDark(model, x, y)) {
          x++;
        }
        const runStart = x;
        while (x < model.modules.size && isDark(model, x, y)) {
          x++;
        }
        if (runStart < x) {
          const runLength = x - runStart;
          path += `M${runStart + normalized.quietZone},${y + normalized.quietZone}h${runLength}v1h-${runLength}z`;
        }
      }
    }

    const gradientMarkup = createSvgGradient(normalized);
    const foregroundFill =
      gradientMarkup === ""
        ? toSvgColor(normalized.foregroundColor)
        : "url(#nitro-qrcode-gradient)";
    const output = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">${gradientMarkup}<path fill="${toSvgColor(normalized.backgroundColor)}" d="M0,0h${totalSize}v${totalSize}H0z"/><path fill="${foregroundFill}" d="${path}"/></svg>`;
    webCache.set(key, request, output);
    return output;
  });
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
}

export function getQRCodeCacheSize(): number {
  return webCache.size();
}

export function getQRCodeCacheBytes(): number {
  return webCache.bytes();
}

export const QRCode: ForwardRefExoticComponent<
  QRCodeProps & RefAttributes<QRCodeRef>
> = createQRCodeComponent({
  toPngDataUri,
  toPngBase64,
  toPngDataUriAsync,
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
  getCacheBytes: getQRCodeCacheBytes,
  getQRCodeMetrics: webGetQRCodeMetrics,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
};

function preparePngCanvas(
  context: CanvasRenderingContext2D,
  plan: RenderPlan,
  options: NormalizedOptions,
): {
  foregroundFill: CanvasFill;
  useLayerColors: boolean;
} {
  const pixelSize = plan.pixelSize;
  if (plan.background.type === "transparent") {
    context.clearRect(0, 0, pixelSize, pixelSize);
  } else {
    context.fillStyle = toSvgColor(plan.background.color);
    context.fillRect(0, 0, pixelSize, pixelSize);
  }
  const foregroundFill = createForegroundFill(
    context,
    options,
    plan.pixelSize,
  );
  const useLayerColors = hasCustomLayerColors(options);
  context.fillStyle = foregroundFill;
  return { foregroundFill, useLayerColors };
}

function finishPng(
  context: CanvasRenderingContext2D,
  plan: RenderPlan,
  options: NormalizedOptions,
  foregroundFill: CanvasFill,
): void {
  if (plan.drawGroupedFinders) {
    drawGroupedFinders(
      context,
      plan.matrixSize,
      plan.quietZone,
      plan.totalModules,
      plan.pixelSize,
      options,
    );
  }
  clearLogoArea(context, plan, foregroundFill);
}

function drawPlanRows(
  context: CanvasRenderingContext2D,
  plan: RenderPlan,
  options: NormalizedOptions,
  foregroundFill: CanvasFill,
  startRow: number,
  endRow: number,
): void {
  for (const row of plan.rows) {
    if (row.moduleY < startRow || row.moduleY >= endRow) {
      continue;
    }
    for (const module of row.modules) {
      if (module.stroke !== undefined && module.strokeGap !== undefined) {
        context.fillStyle = toSvgColor(options.strokeColor);
        drawModule(
          context,
          module.x0,
          module.y0,
          module.x1,
          module.y1,
          module.shape,
          module.gap,
          module.cornerRadius,
        );
        context.fillStyle = resolvePlanFill(
          options,
          foregroundFill,
          module.layer,
        );
        drawModule(
          context,
          module.x0,
          module.y0,
          module.x1,
          module.y1,
          module.shape,
          module.strokeGap,
          module.cornerRadius,
        );
        continue;
      }
      context.fillStyle = resolvePlanFill(
        options,
        foregroundFill,
        module.layer,
      );
      drawModule(
        context,
        module.x0,
        module.y0,
        module.x1,
        module.y1,
        module.shape,
        module.gap,
        module.cornerRadius,
      );
    }
  }
}

function resolvePlanFill(
  options: NormalizedOptions,
  foregroundFill: CanvasFill,
  layer: "foreground" | "stroke" | "eye" | "eyeball",
): CanvasFill {
  if (layer === "eyeball") {
    return toSvgColor(options.eyeballColor);
  }
  if (layer === "eye") {
    return toSvgColor(options.eyeColor);
  }
  return foregroundFill;
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createModel(options: NormalizedOptions): QRCodeModel {
  const base = createModelAt(options, options.errorCorrectionLevel);
  if (!options.boostEcl || options.errorCorrectionLevel === "H") {
    return base;
  }
  const version = (base.modules.size - 17) / 4;
  let boosted: QRCodeModel | undefined;
  for (const candidate of ["Q", "H"] as const) {
    try {
      boosted = createModelAt(options, candidate, version);
    } catch {
      break;
    }
  }
  return boosted ?? base;
}

function renderPixelSize(
  options: NormalizedOptions,
  model: QRCodeModel,
): number {
  return Math.max(
    options.size,
    model.modules.size + options.quietZone * 2,
  );
}

function createModelAt(
  options: NormalizedOptions,
  errorCorrectionLevel: "L" | "M" | "Q" | "H",
  version?: number,
): QRCodeModel {
  return qrcode.create(options.value, {
    errorCorrectionLevel,
    version: version ?? (options.minVersion === options.maxVersion ? options.minVersion : undefined),
    maskPattern: options.mask >= 0 ? options.mask : undefined,
  });
}

function createForegroundFill(
  context: CanvasRenderingContext2D,
  options: NormalizedOptions,
  pixelSize: number,
): CanvasFill {
  if (options.gradient.type === "none") {
    return toSvgColor(options.foregroundColor);
  }

  const locations = resolveGradientLocations(options.gradient);
  if (options.gradient.type === "radial") {
    const centerX = options.gradient.startX * pixelSize;
    const centerY = options.gradient.startY * pixelSize;
    const radius = Math.max(
      Math.hypot(
        (options.gradient.endX - options.gradient.startX) * pixelSize,
        (options.gradient.endY - options.gradient.startY) * pixelSize,
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
    options.gradient.startX * pixelSize,
    options.gradient.startY * pixelSize,
    options.gradient.endX * pixelSize,
    options.gradient.endY * pixelSize,
  );
  addGradientStops(gradient, options.gradient.colors, locations);
  return gradient;
}

function hasCustomLayerColors(options: NormalizedOptions): boolean {
  return (
    !areRgbaColorsEqual(options.strokeColor, DEFAULT_STROKE) ||
    !areRgbaColorsEqual(options.eyeColor, DEFAULT_EYE) ||
    !areRgbaColorsEqual(options.eyeStrokeColor, DEFAULT_EYE_STROKE) ||
    !areRgbaColorsEqual(options.eyeballColor, DEFAULT_EYEBALL)
  );
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

function drawSquareRuns(
  context: CanvasRenderingContext2D,
  model: QRCodeModel,
  quietZone: number,
  totalModules: number,
  pixelSize: number,
  startRow: number,
  endRow: number,
): void {
  const matrixSize = model.modules.size;
  for (let moduleY = startRow; moduleY < endRow; moduleY++) {
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
    areRgbaColorsEqual(options.eyeStrokeColor, DEFAULT_EYE_STROKE)
      ? toSvgColor(options.eyeColor)
      : toSvgColor(options.eyeStrokeColor);

  drawFinderShape(
    context,
    rect(0, 7),
    frameShape,
    outerColor,
    options.shapeOptions.eyePatternCornerRadius,
  );
  if (!areRgbaColorsEqual(options.eyeStrokeColor, DEFAULT_EYE_STROKE)) {
    drawFinderShape(
      context,
      rect(strokeInset, 7 - strokeInset * 2),
      frameShape,
      toSvgColor(options.eyeColor),
      options.shapeOptions.eyePatternCornerRadius,
    );
  }
  drawFinderShape(
    context,
    rect(1, 5),
    frameShape,
    toSvgColor(options.backgroundColor),
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
    toSvgColor(options.eyeballColor),
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
    drawEllipse(context, left, top, width, height);
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
  plan: RenderPlan,
  foregroundFill: CanvasFill,
): void {
  if (plan.logoArea === undefined) {
    return;
  }
  const { size: areaSize, borderRadius } = plan.logoArea;
  const left = (plan.pixelSize - areaSize) / 2;
  const top = (plan.pixelSize - areaSize) / 2;
  context.save();
  context.globalCompositeOperation = "destination-out";
  drawRoundedRect(context, left, top, areaSize, areaSize, borderRadius);
  context.restore();
  context.fillStyle = foregroundFill;
}

function drawEllipse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.beginPath();
  context.ellipse(
    x + width / 2,
    y + height / 2,
    width / 2,
    height / 2,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
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
      gradient.addColorStop(location, toSvgColor(color));
    }
  });
}

function getSvgStopMarkup(location: number, color: string): string {
  const svgColor = toSvgColor(color);
  const stop = svgColor.slice(0, 7);
  const opacity =
    svgColor.length === 9
      ? ` stop-opacity="${(parseInt(svgColor.slice(7, 9), 16) / 255).toFixed(3)}"`
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
    rgbaColorBytes(options.foregroundColor),
    rgbaColorBytes(options.backgroundColor),
    rgbaColorBytes(options.strokeColor),
    rgbaColorBytes(options.eyeColor),
    rgbaColorBytes(options.eyeStrokeColor),
    rgbaColorBytes(options.eyeballColor),
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
    options.gradient.colors.map(rgbaColorBytes),
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
