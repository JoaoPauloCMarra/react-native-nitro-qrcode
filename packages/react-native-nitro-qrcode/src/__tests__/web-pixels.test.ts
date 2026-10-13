import jsQR from "jsqr";

import { PRESET_SHAPE_OPTIONS } from "../defaults";
import * as Web from "../index.web";
import { installRecordingCanvas } from "./helpers/canvas";
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

  it("shows the opaque background through a fully transparent finder inner colour", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      eyeColor: "#FF0000",
      finderInnerColor: "#00000000",
    });
    expect(canvas.pixelAt(4 * 10 + 15, 4 * 10 + 15)).toEqual([255, 255, 255, 255]);
  });

  it("shows the opaque background through a fully transparent eye color over the eye stroke", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      eyeColor: "#FF000000",
      eyeStrokeColor: "#0000FF",
    });
    expect(canvas.pixelAt(4 * 10 + 5, 4 * 10 + 30)).toEqual([255, 255, 255, 255]);
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

describe("translucent layer colors on web", () => {
  const near = (actual: number[], expected: number[]) =>
    actual.every((value, index) => Math.abs(value - (expected[index] ?? 0)) <= 1);

  it("composites a translucent layer color over the background", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      backgroundColor: "#FFFFFF",
      eyeColor: "#FF000080",
    });
    expect(near(canvas.pixelAt(41, 70), [255, 127, 127, 255])).toBe(true);
  });

  it("composites a translucent foreground over the background", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      foregroundColor: "#00000080",
    });
    expect(near(canvas.pixelAt(41, 70), [127, 127, 127, 255])).toBe(true);
  });

  it("keeps the layer alpha over a transparent background", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      backgroundColor: "transparent",
      foregroundColor: "#00000080",
    });
    expect(near(canvas.pixelAt(41, 70), [0, 0, 0, 128])).toBe(true);
  });
});

describe("stacked translucent layers on web", () => {
  const near = (actual: number[], expected: number[]) =>
    actual.every((value, index) => Math.abs(value - (expected[index] ?? 0)) <= 1);

  function bodyModulePixel() {
    const matrix = Web.getMatrix({ value: "hello" });
    const bytes = Buffer.from(matrix.packedBase64, "base64");
    for (let y = 8; y < matrix.size - 8; y++) {
      for (let x = 8; x < matrix.size - 8; x++) {
        const index = y * matrix.size + x;
        if (x !== 6 && y !== 6 && ((bytes[index >> 3] ?? 0) >> (7 - (index & 7))) & 1) {
          return [(x + 4) * 10 + 5, (y + 4) * 10 + 5] as const;
        }
      }
    }
    throw new Error("no body module");
  }

  it("blends a translucent body module over the background, not over its stroke", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      foregroundColor: "#0000FF80",
      strokeColor: "#FF0000",
    });
    const [x, y] = bodyModulePixel();
    expect(near(canvas.pixelAt(x, y), [127, 127, 255, 255])).toBe(true);
  });

  it("blends a translucent eye color over the background, not over the eye stroke", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      eyeColor: "#0000FF80",
      eyeStrokeColor: "#FF0000",
    });
    expect(near(canvas.pixelAt(45, 70), [127, 127, 255, 255])).toBe(true);
  });
});

describe("translucent modules over a transparent web background", () => {
  it("keeps the module alpha without repainting a background", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      backgroundColor: "transparent",
      foregroundColor: "#00000080",
      shapeOptions: { gap: 1 },
    });
    const covered = Array.from({ length: 290 }, (_, x) => canvas.pixelAt(x, 45)).filter(
      (pixel) => pixel[3] > 0,
    );
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((pixel) => Math.abs(pixel[3] - 128) <= 1)).toBe(true);
  });
});

describe("translucent backgrounds and opaque-path painting on web", () => {
  const near = (actual: number[], expected: number[]) =>
    actual.every((value, index) => Math.abs(value - (expected[index] ?? 0)) <= 1);

  it("paints a translucent background once inside the finder hole", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      backgroundColor: "#FFFFFF80",
      eyeColor: "#FF0000",
    });
    expect(near(canvas.pixelAt(4 * 10 + 15, 4 * 10 + 35), [255, 255, 255, 128])).toBe(true);
  });

  it("shows a translucent background through a fully transparent layer", () => {
    const canvas = installRasterCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      backgroundColor: "#FFFFFF80",
      eyeColor: "#FF000000",
      eyeStrokeColor: "#0000FF",
    });
    expect(near(canvas.pixelAt(4 * 10 + 5, 4 * 10 + 30), [255, 255, 255, 128])).toBe(true);
  });

  it("paints pre-blended opaque colors without erasing on an opaque background", () => {
    const { calls } = installRecordingCanvas();
    Web.toPngDataUri({
      value: "hello",
      size: 290,
      quietZone: 4,
      eyeColor: "#FF000080",
      shapeOptions: { eyeFrameShape: "rounded", eyeballShape: "rounded" },
    });
    const fills = calls.filter((call) => call.op === "fill").map((call) => call.fill);
    expect(fills).toContain("#FF7F7F");
    expect(fills).not.toContain("#FF000080");
    expect(calls.some((call) => call.op === "save")).toBe(false);
  });
});
