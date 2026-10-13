import { normalizeOptions, type QRCodeOptions } from "../validation";

const SHAPE_LIST = "square, circle, rounded, diamond, squircle, or classy.";
const TWO_STOPS = ["#000000", "#FFFFFF"];
const NINE_STOPS = [
  "#000000",
  "#111111",
  "#222222",
  "#333333",
  "#444444",
  "#555555",
  "#666666",
  "#777777",
  "#888888",
];

function options(value: unknown): QRCodeOptions {
  return value as QRCodeOptions;
}

const invalidOptions: [string, unknown, string][] = [
  ["empty value", { value: "" }, "must not be empty"],
  ["zero size", { value: "x", size: 0 }, "size must be"],
  ["oversized size", { value: "x", size: 4097 }, "size must be"],
  ["fractional size", { value: "x", size: 1.5 }, "size must be"],
  ["quietZone", { value: "x", quietZone: 33 }, "quietZone must be"],
  ["minVersion", { value: "x", minVersion: 0 }, "minVersion must be"],
  ["maxVersion", { value: "x", maxVersion: 41 }, "maxVersion must be"],
  [
    "version order",
    { value: "x", minVersion: 3, maxVersion: 2 },
    "minVersion and maxVersion",
  ],
  ["mask", { value: "x", mask: 8 }, "mask must be"],
  [
    "errorCorrectionLevel",
    { value: "x", errorCorrectionLevel: "bad" },
    "errorCorrectionLevel must be",
  ],
  [
    "shape",
    { value: "x", shapeOptions: { shape: "triangle" } },
    `shape must be ${SHAPE_LIST}`,
  ],
  [
    "eyePatternShape alias",
    { value: "x", shapeOptions: { eyePatternShape: "triangle" } },
    `eyeFrameShape must be ${SHAPE_LIST}`,
  ],
  [
    "eyeballShape",
    { value: "x", shapeOptions: { eyeballShape: "triangle" } },
    `eyeballShape must be ${SHAPE_LIST}`,
  ],
  [
    "alignmentShape",
    { value: "x", shapeOptions: { alignmentShape: "triangle" } },
    `alignmentShape must be ${SHAPE_LIST}`,
  ],
  [
    "timingShape",
    { value: "x", shapeOptions: { timingShape: "triangle" } },
    `timingShape must be ${SHAPE_LIST}`,
  ],
  [
    "layout",
    { value: "x", shapeOptions: { layout: "spiral" } },
    "layout must be",
  ],
  [
    "bodyDensity",
    { value: "x", shapeOptions: { bodyDensity: "crowded" } },
    "bodyDensity must be sparse, balanced, or dense",
  ],
  ["gap", { value: "x", shapeOptions: { gap: 257 } }, "gap must be"],
  [
    "cornerRadius",
    { value: "x", shapeOptions: { cornerRadius: 257 } },
    "cornerRadius must be",
  ],
  [
    "eyePatternGap",
    { value: "x", shapeOptions: { eyePatternGap: 257 } },
    "eyePatternGap must be",
  ],
  [
    "eyePatternCornerRadius",
    { value: "x", shapeOptions: { eyePatternCornerRadius: 257 } },
    "eyePatternCornerRadius must be",
  ],
  ["logoAreaSize cap", { value: "x", logoAreaSize: 4097 }, "logoAreaSize must be"],
  [
    "logoAreaSize over size",
    { value: "x", size: 128, logoAreaSize: 129 },
    "logoAreaSize must be between 0 and size",
  ],
  [
    "logoAreaBorderRadius over half",
    { value: "x", size: 128, logoAreaBorderRadius: 65 },
    "logoAreaBorderRadius must be between 0 and half the size",
  ],
  [
    "logoAreaBorderRadius cap",
    { value: "x", size: 4096, logoAreaBorderRadius: 2049 },
    "logoAreaBorderRadius must be an integer between 0 and 2048",
  ],
  [
    "foregroundColor",
    { value: "x", foregroundColor: "bad" },
    "foregroundColor must be",
  ],
  [
    "gradient color count",
    { value: "x", gradient: { colors: NINE_STOPS } },
    "gradient.colors must contain",
  ],
  [
    "gradient color value",
    { value: "x", gradient: { colors: ["#000000", "nope"] } },
    "gradient.colors[1] must be",
  ],
  [
    "gradient location count",
    { value: "x", gradient: { colors: TWO_STOPS, locations: [0] } },
    "gradient.locations must match",
  ],
  [
    "gradient type",
    { value: "x", gradient: { type: "diagonal", colors: TWO_STOPS } },
    "gradient.type must be",
  ],
  [
    "gradient location range",
    { value: "x", gradient: { colors: TWO_STOPS, locations: [0, 2] } },
    "gradient.locations entries must be",
  ],
  [
    "gradient location order",
    { value: "x", gradient: { colors: TWO_STOPS, locations: [0.8, 0.2] } },
    "gradient.locations must be in non-decreasing order",
  ],
  [
    "gradient start x",
    { value: "x", gradient: { colors: TWO_STOPS, start: { x: 2, y: 0 } } },
    "gradient.start.x must be",
  ],
  [
    "gradient start y",
    { value: "x", gradient: { colors: TWO_STOPS, start: { x: 0, y: 2 } } },
    "gradient.start.y must be",
  ],
  [
    "gradient end x",
    { value: "x", gradient: { colors: TWO_STOPS, end: { x: -1, y: 1 } } },
    "gradient.end.x must be",
  ],
  [
    "gradient end y",
    {
      value: "x",
      gradient: { colors: TWO_STOPS, end: { x: 1, y: Number.NaN } },
    },
    "gradient.end.y must be",
  ],
];

const validOptions: [string, unknown][] = [
  ["size 2048", { value: "x", size: 2048 }],
  ["size 4096", { value: "x", size: 4096 }],
  [
    "logoAreaBorderRadius 2048 at size 4096",
    { value: "x", size: 4096, logoAreaBorderRadius: 2048 },
  ],
];

describe("option validation", () => {
  it.each(invalidOptions)("rejects %s", (_name, value, message) => {
    expect(() => normalizeOptions(options(value))).toThrow(message);
  });

  it.each(validOptions)("accepts %s", (_name, value) => {
    expect(() => normalizeOptions(options(value))).not.toThrow();
  });
});

describe("deprecated eyePatternShape alias", () => {
  it("maps onto eyeFrameShape and is not carried in normalized options", () => {
    const normalized = normalizeOptions({
      value: "alias",
      shapeOptions: { eyePatternShape: "circle" },
    });
    expect(normalized.shapeOptions.eyeFrameShape).toBe("circle");
    expect(Object.keys(normalized.shapeOptions)).not.toContain(
      "eyePatternShape",
    );
  });
});
