import * as Web from "../index.web";
import type { QRCodeOptions } from "../validation";
import corpus from "./fixtures/parity-corpus.json";

afterEach(() => {
  Web.clearQRCodeCache();
});

describe("parity corpus", () => {
  it.each(corpus.map((entry, index) => [index, entry] as const))(
    "web encoder reproduces corpus entry %i",
    (_index, entry) => {
      const options: QRCodeOptions = {
        value: entry.value,
        errorCorrectionLevel: entry.ecl as QRCodeOptions["errorCorrectionLevel"],
        minVersion: entry.minVersion as QRCodeOptions["minVersion"],
        maxVersion: entry.maxVersion as QRCodeOptions["maxVersion"],
        mask: entry.mask as QRCodeOptions["mask"],
        boostEcl: entry.boostEcl,
      };
      const matrix = Web.getMatrix(options);
      expect(matrix.size).toBe(entry.size);
      expect(matrix.packedBase64).toBe(entry.packedBase64);
    },
  );

  it("encodes mixed-mode text as one segment like the native encoder", () => {
    const value =
      "https://example.com/" + "A".repeat(40) + "1234567890123456789012345";
    expect(
      Web.getMatrix({ value, errorCorrectionLevel: "L", boostEcl: false }).size,
    ).toBe(37);
    expect(
      Web.getMatrix({ value, errorCorrectionLevel: "M", boostEcl: false }).size,
    ).toBe(41);
  });
});
