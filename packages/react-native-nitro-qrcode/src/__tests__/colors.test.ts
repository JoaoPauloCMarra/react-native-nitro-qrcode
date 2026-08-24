import {
  areRgbaColorsEqual,
  isFullyTransparent,
  parseRgbaColor,
} from "../colors";

describe("RGBA color helpers", () => {
  it("compares parsed RGBA values instead of their spellings", () => {
    expect(areRgbaColorsEqual("#000000", "#000000FF")).toBe(true);
    expect(areRgbaColorsEqual("#1234", "#11223344")).toBe(true);
    expect(areRgbaColorsEqual("#000000", "#00000080")).toBe(false);
  });

  it.each(["transparent", "#00000000", "#0000", "#12340000", "#1230"])(
    "recognizes fully transparent color %s",
    (value) => {
      expect(isFullyTransparent(value)).toBe(true);
      expect(parseRgbaColor(value).alpha).toBe(0);
    },
  );

  it("does not classify translucent or opaque colors as fully transparent", () => {
    expect(isFullyTransparent("#00000080")).toBe(false);
    expect(isFullyTransparent("#000000")).toBe(false);
  });
});
