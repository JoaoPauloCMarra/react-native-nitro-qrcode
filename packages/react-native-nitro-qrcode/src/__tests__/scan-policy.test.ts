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
