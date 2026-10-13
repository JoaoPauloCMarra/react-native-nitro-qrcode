import { scanabilityWarnings } from "../scan-policy";
import type { QRCodeBackgroundColor } from "../colors";
import {
  normalizeOptions,
  validateOptions,
} from "../validation";

describe("scanability color policy", () => {
  it.each(
    ["transparent", "#00000000", "#0000", "#12340000", "#1230"] as QRCodeBackgroundColor[],
  )(
    "does not warn about contrast for fully transparent background %s",
    (backgroundColor) => {
      const options = normalizeOptions({
        value: `transparent-background-${backgroundColor}`,
        foregroundColor: "#FFFFFF",
        backgroundColor,
      });

      expect(
        scanabilityWarnings(options).some(
          (warning) => warning.code === "low-contrast",
        ),
      ).toBe(false);
      expect(validateOptions({
        value: `validated-transparent-background-${backgroundColor}`,
        foregroundColor: "#FFFFFF",
        backgroundColor,
      }).warnings).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "low-contrast" })]),
      );
    },
  );

  it("warns when alignment or timing contrast against the background is low", () => {
    const options = normalizeOptions({
      value: "region-contrast",
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
      alignmentColor: "#F5F5F5",
      timingColor: "#FAFAFA",
    });

    expect(
      scanabilityWarnings(options).filter(
        (warning) => warning.code === "low-contrast",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("keeps contrast warnings for translucent nontransparent backgrounds", () => {
    const options = normalizeOptions({
      value: "translucent-background",
      foregroundColor: "#FFFFFF",
      backgroundColor: "#FFFFFF80",
    });

    expect(
      scanabilityWarnings(options).some(
        (warning) => warning.code === "low-contrast",
      ),
    ).toBe(true);
  });
});

describe("scanability logo policy", () => {
  const codes = (
    errorCorrectionLevel: "L" | "M" | "Q" | "H",
    logoAreaSize: number,
  ) =>
    scanabilityWarnings(
      normalizeOptions({
        value: "logo-policy",
        size: 512,
        errorCorrectionLevel,
        logoAreaSize,
      }),
    ).map((warning) => warning.code);

  it("defaults the error correction level to H when a logo area is reserved", () => {
    expect(
      normalizeOptions({ value: "logo-default", logoAreaSize: 64 })
        .errorCorrectionLevel,
    ).toBe("H");
    expect(
      normalizeOptions({ value: "no-logo-default" }).errorCorrectionLevel,
    ).toBe("M");
    expect(
      normalizeOptions({
        value: "logo-explicit",
        logoAreaSize: 64,
        errorCorrectionLevel: "L",
      }).errorCorrectionLevel,
    ).toBe("L");
  });

  it.each([
    ["L", 96],
    ["M", 128],
    ["Q", 154],
  ] as const)(
    "warns when %s error correction cannot recover a %i px logo area",
    (level, logo) => {
      expect(codes(level, logo)).toContain("low-ecl-for-logo");
    },
  );

  it.each([
    ["L", 64],
    ["M", 96],
    ["Q", 128],
    ["H", 150],
  ] as const)(
    "accepts %s error correction with a %i px logo area",
    (level, logo) => {
      expect(codes(level, logo)).not.toContain("low-ecl-for-logo");
    },
  );
});
