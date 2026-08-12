import {
  isQRCodeMetricsEnabled,
  nowMilliseconds,
  recordGenerationRequest,
  getQRCodeMetrics,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
} from "./metrics";
import {
  normalizeOptions,
  validateOptions,
  type NitroQRCodeApi,
  type NormalizedOptions,
  type QRCodeMatrix,
  type QRCodeOptions,
} from "./validation";
import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";
import type {
  GenerateOptions as NativeGenerateOptions,
  QRCode as HybridQRCode,
} from "./QRCode.nitro";
import { createQRCodeComponent } from "./qrcode-component";
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

const NativeQRCode = NitroModules.createHybridObject<HybridQRCode>("QRCode");

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

type NativeSvgArgs = Parameters<HybridQRCode["generateSvgString"]>;
type NativeMatrixArgs = Parameters<HybridQRCode["getMatrixSize"]>;

function toNativeGenerateOptions(
  normalized: NormalizedOptions,
): NativeGenerateOptions {
  return {
    value: normalized.value,
    size: normalized.size,
    quietZone: normalized.quietZone,
    errorCorrectionLevel: normalized.errorCorrectionLevel,
    foregroundColor: normalized.foregroundColor,
    backgroundColor: normalized.backgroundColor,
    strokeColor: normalized.strokeColor,
    eyeColor: normalized.eyeColor,
    eyeStrokeColor: normalized.eyeStrokeColor,
    eyeballColor: normalized.eyeballColor,
    minVersion: normalized.minVersion,
    maxVersion: normalized.maxVersion,
    mask: normalized.mask,
    boostEcl: normalized.boostEcl,
    moduleShape: normalized.shapeOptions.shape,
    eyePatternShape: normalized.shapeOptions.eyeFrameShape,
    eyeballShape: normalized.shapeOptions.eyeballShape,
    gap: normalized.shapeOptions.gap,
    eyePatternGap: normalized.shapeOptions.eyePatternGap,
    bodyDensity: normalized.shapeOptions.bodyDensity,
    cornerRadius: normalized.shapeOptions.cornerRadius,
    eyePatternCornerRadius: normalized.shapeOptions.eyePatternCornerRadius,
    layout: normalized.shapeOptions.layout,
    logoAreaSize: normalized.logoAreaSize,
    logoAreaBorderRadius: normalized.logoAreaBorderRadius,
    gradientType: normalized.gradient.type,
    gradientColors: normalized.gradient.colors,
    gradientLocations: normalized.gradient.locations,
    gradientStartX: normalized.gradient.startX,
    gradientStartY: normalized.gradient.startY,
    gradientEndX: normalized.gradient.endX,
    gradientEndY: normalized.gradient.endY,
  };
}

function toNativeSvgArgs(normalized: NormalizedOptions): NativeSvgArgs {
  return [
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
  ];
}

function toNativeMatrixArgs(normalized: NormalizedOptions): NativeMatrixArgs {
  return [
    normalized.value,
    normalized.errorCorrectionLevel,
    normalized.minVersion,
    normalized.maxVersion,
    normalized.mask,
    normalized.boostEcl,
  ];
}

export function toPngBase64(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  return measuredSync(false, () =>
    NativeQRCode.generatePngBase64Object(toNativeGenerateOptions(normalized)),
  );
}

export function toPngDataUri(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  return measuredSync(false, () =>
    NativeQRCode.generatePngDataUriObject(toNativeGenerateOptions(normalized)),
  );
}

export async function toPngBase64Async(
  options: QRCodeOptions,
): Promise<string> {
  const normalized = normalizeOptions(options);
  return measuredAsync(() =>
    NativeQRCode.generatePngBase64AsyncObject(
      toNativeGenerateOptions(normalized),
    ),
  );
}

export async function toPngDataUriAsync(
  options: QRCodeOptions,
): Promise<string> {
  const normalized = normalizeOptions(options);
  return measuredAsync(() =>
    NativeQRCode.generatePngDataUriAsyncObject(
      toNativeGenerateOptions(normalized),
    ),
  );
}

export function toSvgString(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  return measuredSync(false, () =>
    NativeQRCode.generateSvgString(...toNativeSvgArgs(normalized)),
  );
}

export function getMatrix(options: QRCodeOptions): QRCodeMatrix {
  const normalized = normalizeOptions(options);
  const nativeArgs = toNativeMatrixArgs(normalized);
  return measuredSync(false, () => {
    const size = NativeQRCode.getMatrixSize(...nativeArgs);
    const packedBase64 = NativeQRCode.getMatrixPackedBase64(...nativeArgs);
    return { size, packedBase64 };
  });
}

export function clearQRCodeCache(): void {
  NativeQRCode.clearCache();
}

export function getQRCodeCacheSize(): number {
  return NativeQRCode.getCacheSize();
}

export const QRCode = createQRCodeComponent({
  toPngDataUri,
  toPngBase64,
  toPngDataUriAsync,
  accessibilityIgnoresInvertColors: Platform.OS !== "web",
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
  getQRCodeMetrics,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
};

export type { HybridQRCode };
