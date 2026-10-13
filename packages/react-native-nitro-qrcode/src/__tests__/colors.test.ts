import {
  areRgbaColorsEqual,
  compositeOver,
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

describe("compositeOver", () => {
  const white = { red: 255, green: 255, blue: 255, alpha: 255 };

  it("matches the native integer blend", () => {
    expect(
      compositeOver({ red: 255, green: 0, blue: 0, alpha: 128 }, white),
    ).toEqual({ red: 255, green: 127, blue: 127, alpha: 255 });
    expect(
      compositeOver(
        { red: 0, green: 0, blue: 0, alpha: 128 },
        { red: 0, green: 0, blue: 0, alpha: 0 },
      ),
    ).toEqual({ red: 0, green: 0, blue: 0, alpha: 128 });
  });

  it("returns opaque sources unchanged and clears fully transparent blends", () => {
    const opaque = { red: 1, green: 2, blue: 3, alpha: 255 };
    expect(compositeOver(opaque, white)).toBe(opaque);
    expect(
      compositeOver(
        { red: 9, green: 9, blue: 9, alpha: 0 },
        { red: 0, green: 0, blue: 0, alpha: 0 },
      ),
    ).toEqual({ red: 0, green: 0, blue: 0, alpha: 0 });
    expect(
      compositeOver({ red: 9, green: 9, blue: 9, alpha: 0 }, white),
    ).toEqual(white);
  });
});
