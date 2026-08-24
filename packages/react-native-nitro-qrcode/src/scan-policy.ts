import { contrastRatio, isFullyTransparent, parseHexColor } from "./colors";
import type { NormalizedOptions } from "./validation";

export type QRCodeScanabilityWarning = {
  code:
    | "low-contrast"
    | "too-small-size"
    | "logo-too-large"
    | "low-ecl-for-logo"
    | "bad-quiet-zone";
  message: string;
};

export const SCANABILITY_MINIMUM_SIZE = 120;

export const SCANABILITY_QUIET_ZONE_MINIMUM = 2;

export const SCAN_SAFE_QUIET_ZONE_MINIMUM = 4;

export const SCANABILITY_QUIET_ZONE_MAXIMUM = 12;

export const SCANABILITY_LOGO_SIZE_LIMIT = 0.3;

export const SCANABILITY_LOW_CONTRAST = 2.5;

export function scanabilityWarnings(
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

  if (!isFullyTransparent(options.backgroundColor)) {
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
  }

  return warnings;
}
