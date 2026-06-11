import {
  normalizeOptions,
  validateOptions,
  type NitroQRCodeApi,
  type NormalizedOptions,
  type QRCodeMatrix,
  type QRCodeOptions,
} from "./shared";
import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";
import type { QRCode as HybridQRCode } from "./QRCode.nitro";
import { createQRCodeComponent } from "./qrcode-component";
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

const NativeQRCode = NitroModules.createHybridObject<HybridQRCode>("QRCode");

type NativeGenerateArgs = Parameters<HybridQRCode["generatePngBase64"]>;
type NativeSvgArgs = Parameters<HybridQRCode["generateSvgString"]>;
type NativeMatrixArgs = Parameters<HybridQRCode["getMatrixSize"]>;

function toNativeGenerateArgs(
  normalized: NormalizedOptions,
): NativeGenerateArgs {
  return [
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
  ];
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
  return NativeQRCode.generatePngBase64(...toNativeGenerateArgs(normalized));
}

export function toPngDataUri(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngDataUri(...toNativeGenerateArgs(normalized));
}

export async function toPngBase64Async(
  options: QRCodeOptions,
): Promise<string> {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngBase64Async(
    ...toNativeGenerateArgs(normalized),
  );
}

export async function toPngDataUriAsync(
  options: QRCodeOptions,
): Promise<string> {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generatePngDataUriAsync(
    ...toNativeGenerateArgs(normalized),
  );
}

export function toSvgString(options: QRCodeOptions): string {
  const normalized = normalizeOptions(options);
  return NativeQRCode.generateSvgString(...toNativeSvgArgs(normalized));
}

export function getMatrix(options: QRCodeOptions): QRCodeMatrix {
  const normalized = normalizeOptions(options);
  const nativeArgs = toNativeMatrixArgs(normalized);
  const size = NativeQRCode.getMatrixSize(...nativeArgs);
  const packedBase64 = NativeQRCode.getMatrixPackedBase64(...nativeArgs);
  return { size, packedBase64 };
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
};

export type { HybridQRCode };
