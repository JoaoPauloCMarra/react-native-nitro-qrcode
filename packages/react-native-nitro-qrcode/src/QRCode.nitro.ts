import type { HybridObject } from "react-native-nitro-modules";

export interface GenerateOptions {
  value: string;
  size: number;
  quietZone: number;
  errorCorrectionLevel: string;
  foregroundColor: string;
  backgroundColor: string;
  strokeColor: string;
  eyeColor: string;
  eyeStrokeColor: string;
  eyeballColor: string;
  minVersion: number;
  maxVersion: number;
  mask: number;
  boostEcl: boolean;
  moduleShape: string;
  eyePatternShape: string;
  eyeballShape: string;
  gap: number;
  eyePatternGap: number;
  bodyDensity: string;
  cornerRadius: number;
  eyePatternCornerRadius: number;
  layout: string;
  logoAreaSize: number;
  logoAreaBorderRadius: number;
  gradientType: string;
  gradientColors: string[];
  gradientLocations: number[];
  gradientStartX: number;
  gradientStartY: number;
  gradientEndX: number;
  gradientEndY: number;
}

export interface MatrixObject {
  size: number;
  packedBase64: string;
}

export interface QRCode extends HybridObject<{ ios: "c++"; android: "c++" }> {
  generatePngBase64Object(options: GenerateOptions): string;

  generatePngBase64AsyncObject(options: GenerateOptions): Promise<string>;

  generatePngDataUriObject(options: GenerateOptions): string;

  generatePngDataUriAsyncObject(options: GenerateOptions): Promise<string>;

  /** @deprecated Use generatePngBase64Object instead. */
  generatePngBase64(
    value: string,
    size: number,
    quietZone: number,
    errorCorrectionLevel: string,
    foregroundColor: string,
    backgroundColor: string,
    strokeColor: string,
    eyeColor: string,
    eyeStrokeColor: string,
    eyeballColor: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
    moduleShape: string,
    eyePatternShape: string,
    eyeballShape: string,
    gap: number,
    eyePatternGap: number,
    bodyDensity: string,
    cornerRadius: number,
    eyePatternCornerRadius: number,
    layout: string,
    logoAreaSize: number,
    logoAreaBorderRadius: number,
    gradientType: string,
    gradientColors: string[],
    gradientLocations: number[],
    gradientStartX: number,
    gradientStartY: number,
    gradientEndX: number,
    gradientEndY: number,
  ): string;

  /** @deprecated Use generatePngBase64AsyncObject instead. */
  generatePngBase64Async(
    value: string,
    size: number,
    quietZone: number,
    errorCorrectionLevel: string,
    foregroundColor: string,
    backgroundColor: string,
    strokeColor: string,
    eyeColor: string,
    eyeStrokeColor: string,
    eyeballColor: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
    moduleShape: string,
    eyePatternShape: string,
    eyeballShape: string,
    gap: number,
    eyePatternGap: number,
    bodyDensity: string,
    cornerRadius: number,
    eyePatternCornerRadius: number,
    layout: string,
    logoAreaSize: number,
    logoAreaBorderRadius: number,
    gradientType: string,
    gradientColors: string[],
    gradientLocations: number[],
    gradientStartX: number,
    gradientStartY: number,
    gradientEndX: number,
    gradientEndY: number,
  ): Promise<string>;

  /** @deprecated Use generatePngDataUriObject instead. */
  generatePngDataUri(
    value: string,
    size: number,
    quietZone: number,
    errorCorrectionLevel: string,
    foregroundColor: string,
    backgroundColor: string,
    strokeColor: string,
    eyeColor: string,
    eyeStrokeColor: string,
    eyeballColor: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
    moduleShape: string,
    eyePatternShape: string,
    eyeballShape: string,
    gap: number,
    eyePatternGap: number,
    bodyDensity: string,
    cornerRadius: number,
    eyePatternCornerRadius: number,
    layout: string,
    logoAreaSize: number,
    logoAreaBorderRadius: number,
    gradientType: string,
    gradientColors: string[],
    gradientLocations: number[],
    gradientStartX: number,
    gradientStartY: number,
    gradientEndX: number,
    gradientEndY: number,
  ): string;

  /** @deprecated Use generatePngDataUriAsyncObject instead. */
  generatePngDataUriAsync(
    value: string,
    size: number,
    quietZone: number,
    errorCorrectionLevel: string,
    foregroundColor: string,
    backgroundColor: string,
    strokeColor: string,
    eyeColor: string,
    eyeStrokeColor: string,
    eyeballColor: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
    moduleShape: string,
    eyePatternShape: string,
    eyeballShape: string,
    gap: number,
    eyePatternGap: number,
    bodyDensity: string,
    cornerRadius: number,
    eyePatternCornerRadius: number,
    layout: string,
    logoAreaSize: number,
    logoAreaBorderRadius: number,
    gradientType: string,
    gradientColors: string[],
    gradientLocations: number[],
    gradientStartX: number,
    gradientStartY: number,
    gradientEndX: number,
    gradientEndY: number,
  ): Promise<string>;

  generateSvgString(
    value: string,
    quietZone: number,
    errorCorrectionLevel: string,
    foregroundColor: string,
    backgroundColor: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
    gradientType: string,
    gradientColors: string[],
    gradientLocations: number[],
    gradientStartX: number,
    gradientStartY: number,
    gradientEndX: number,
    gradientEndY: number,
  ): string;

  getMatrixPackedBase64(
    value: string,
    errorCorrectionLevel: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
  ): string;

  getMatrixSize(
    value: string,
    errorCorrectionLevel: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
  ): number;

  getMatrixObject(
    value: string,
    errorCorrectionLevel: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
  ): MatrixObject;

  clearCache(): void;
  getCacheSize(): number;
  getCacheBytes(): number;
}
