import type { HybridObject } from "react-native-nitro-modules";

export interface QRCode extends HybridObject<{ ios: "c++"; android: "c++" }> {
  generatePngBase64(
    value: string,
    size: number,
    quietZone: number,
    errorCorrectionLevel: string,
    foregroundColor: string,
    backgroundColor: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
    moduleShape: string,
    eyePatternShape: string,
    gap: number,
    eyePatternGap: number,
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

  generatePngDataUri(
    value: string,
    size: number,
    quietZone: number,
    errorCorrectionLevel: string,
    foregroundColor: string,
    backgroundColor: string,
    minVersion: number,
    maxVersion: number,
    mask: number,
    boostEcl: boolean,
    moduleShape: string,
    eyePatternShape: string,
    gap: number,
    eyePatternGap: number,
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

  clearCache(): void;
  getCacheSize(): number;
}
