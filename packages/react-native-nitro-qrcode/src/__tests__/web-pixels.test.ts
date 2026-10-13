import jsQR from "jsqr";

import { PRESET_SHAPE_OPTIONS } from "../defaults";
import * as Web from "../index.web";
import { installRasterCanvas } from "./helpers/raster-canvas";

afterEach(() => {
  Web.clearQRCodeCache();
});

describe("transparent finder layers on web", () => {
  it("erases the finder hole for a transparent background with a styled preset", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      backgroundColor: "transparent",
      shapeOptions: PRESET_SHAPE_OPTIONS.rounded,
    });
    const hole = canvas.pixelAt(4 * 10 + 15, 4 * 10 + 15);
    expect(hole[3]).toBe(0);
    const frame = canvas.pixelAt(4 * 10 + 2, 4 * 10 + 30);
    expect(frame[3]).toBe(255);
  });

  it("decodes the composited image when the background is transparent", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      backgroundColor: "transparent",
      shapeOptions: PRESET_SHAPE_OPTIONS.rounded,
    });
    const decoded = jsQR(
      canvas.compositeOverWhite(),
      canvas.size(),
      canvas.size(),
    );
    expect(decoded?.data).toBe("hello");
  });

  it("erases a fully transparent finder inner colour on an opaque background", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      eyeColor: "#FF0000",
      finderInnerColor: "#00000000",
    });
    expect(canvas.pixelAt(4 * 10 + 15, 4 * 10 + 15)[3]).toBe(0);
  });

  it("erases the inner eye-stroke frame when the eye colour is fully transparent", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      eyeColor: "#FF000000",
      eyeStrokeColor: "#0000FF",
    });
    expect(canvas.pixelAt(4 * 10 + 5, 4 * 10 + 30)[3]).toBe(0);
    expect(canvas.pixelAt(4 * 10 + 1, 4 * 10 + 30)).toEqual([0, 0, 255, 255]);
  });
});

describe("grouped finder edges on web", () => {
  it("starts the finder frame on the floored quiet-zone edge", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 100,
      quietZone: 4,
      quietZoneColor: "#00FF00",
      eyeColor: "#FF0000",
    });
    const edge = Math.floor((4 * 100) / 29);
    expect(canvas.pixelAt(edge - 1, edge + 12)).toEqual([0, 255, 0, 255]);
    expect(canvas.pixelAt(edge, edge + 12)).toEqual([255, 0, 0, 255]);
  });
});
