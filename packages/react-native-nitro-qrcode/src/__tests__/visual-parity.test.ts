import * as Web from "../index.web";
import { createRenderPlan } from "../render-plan";
import {
  normalizeOptions,
  validateOptions,
  type QRCodeOptions,
} from "../validation";
import {
  createMockContext,
  installCanvas,
  installRecordingCanvas,
  type RecordedCall,
} from "./helpers/canvas";
import { allDarkModel } from "./helpers/matrix";

afterEach(() => {
  Web.clearQRCodeCache();
});

describe("layer color defaults", () => {
  it("inherits unset finder colors from the foreground and keeps strokes off", () => {
    const normalized = normalizeOptions({
      value: "red",
      foregroundColor: "#FF0000",
    });
    expect(normalized.eyeColor).toBe("#FF0000");
    expect(normalized.eyeballColor).toBe("#FF0000");
    expect(normalized.strokeColor).toBe("#000000");
    expect(normalized.eyeStrokeColor).toBe("#000000");
    expect(normalized.explicitColors).toEqual({
      stroke: false,
      eye: false,
      eyeStroke: false,
      eyeball: false,
      alignment: false,
      timing: false,
    });
  });

  it("marks explicitly set layer colors", () => {
    const normalized = normalizeOptions({
      value: "explicit",
      eyeColor: "#000000",
      alignmentColor: "#000000",
    });
    expect(normalized.explicitColors.eye).toBe(true);
    expect(normalized.explicitColors.alignment).toBe(true);
    expect(normalized.explicitColors.eyeball).toBe(false);
  });

  it("keeps foreground-colored finders on the plain module path", () => {
    const plan = createRenderPlan(
      normalizeOptions({ value: "red-plan", foregroundColor: "#FF0000" }),
      allDarkModel(),
      128,
    );
    expect(plan.drawGroupedFinders).toBe(false);
    expect(
      plan.rows.flatMap((row) => row.modules).some((module) => module.strokeGap !== undefined),
    ).toBe(false);
  });

  it("never paints default finders black when the foreground is red", () => {
    for (const logoAreaSize of [0, 16]) {
      const { calls } = installRecordingCanvas();
      Web.toPngDataUri({
        value: "red-web",
        size: 64,
        foregroundColor: "#FF0000",
        logoAreaSize,
      });
      const fills = calls
        .filter((call) => call.op === "fill" || call.op === "fillRect")
        .map((call) => call.fill);
      expect(fills).toContain("#FF0000");
      expect(fills).not.toContain("#000000");
      Web.clearQRCodeCache();
    }
  });

  it("paints default finders with the gradient fill", () => {
    const { calls } = installRecordingCanvas();
    Web.toPngDataUri({
      value: "gradient-web",
      size: 64,
      logoAreaSize: 16,
      gradient: { type: "linear", colors: ["#0000FF", "#00FF00"] },
    });
    const moduleFills = calls
      .slice(1)
      .filter((call) => call.op === "fill" || call.op === "fillRect")
      .map((call) => call.fill);
    expect(moduleFills.length).toBeGreaterThan(0);
    expect(moduleFills).not.toContain("#000000");
  });
});

describe("reviewer probes on web", () => {
  function fills(calls: RecordedCall[]): unknown[] {
    return calls
      .filter((call) => call.op === "fill" || call.op === "fillRect")
      .map((call) => call.fill);
  }

  it.each([
    ["unset", {}],
    [
      "explicit black strokes",
      { strokeColor: "#000000", eyeStrokeColor: "#000000" },
    ],
  ] as const)(
    "draws no black rings for the example defaults with %s",
    (_label, strokes) => {
      const { calls } = installRecordingCanvas();
      Web.toPngDataUri({
        value: "https://example.com/nitro",
        size: 128,
        foregroundColor: "#09090B",
        eyeColor: "#1E40AF",
        eyeballColor: "#0F172A",
        gradient: { type: "linear", colors: ["#09090B", "#1E3A8A"] },
        ...strokes,
      });
      const painted = fills(calls);
      expect(painted).toContain("#1E40AF");
      expect(painted).toContain("#0F172A");
      expect(painted).not.toContain("#000000");
    },
  );

  it("paints explicit black finders solid under a gradient", () => {
    const { calls } = installRecordingCanvas();
    Web.toPngDataUri({
      value: "https://example.com/nitro",
      size: 128,
      eyeColor: "#000000",
      eyeballColor: "#000000",
      gradient: { type: "linear", colors: ["#FF0000", "#0000FF"] },
    });
    expect(fills(calls)).toContain("#000000");
  });

  it("keeps grouped finder drawing when an explicit eye color equals the foreground", () => {
    const explicitPlan = createRenderPlan(
      normalizeOptions({
        value: "probe-e",
        foregroundColor: "#DC2626",
        eyeColor: "#DC2626",
        eyeballColor: "#DC2626",
      }),
      allDarkModel(),
      257,
    );
    const inheritedPlan = createRenderPlan(
      normalizeOptions({ value: "probe-e", foregroundColor: "#DC2626" }),
      allDarkModel(),
      257,
    );
    expect(explicitPlan.drawGroupedFinders).toBe(true);
    expect(inheritedPlan.drawGroupedFinders).toBe(false);
  });

  it("treats an explicit black stroke as no stroke on a red foreground", () => {
    const plan = createRenderPlan(
      normalizeOptions({
        value: "black-stroke",
        foregroundColor: "#DC2626",
        strokeColor: "#000000",
        eyeStrokeColor: "#000000",
        shapeOptions: { shape: "rounded" },
      }),
      allDarkModel(),
      128,
    );
    expect(
      plan.rows.flatMap((row) => row.modules).some((module) => module.strokeGap !== undefined),
    ).toBe(false);
    expect(plan.drawGroupedFinders).toBe(false);
  });
});

describe("layer color scanability", () => {
  it("accepts inverted codes whose finders follow the foreground", () => {
    expect(
      validateOptions({
        value: "inverted",
        size: 256,
        foregroundColor: "#FFFFFF",
        backgroundColor: "#000000",
        scanSafe: "strict",
      }),
    ).toEqual({ valid: true, warnings: [], errors: [] });
  });

  it("reports a low-contrast foreground once when finders follow it", () => {
    const result = validateOptions({
      value: "faint",
      size: 256,
      foregroundColor: "#EEEEEE",
    });
    expect(
      result.warnings.filter((warning) => warning.code === "low-contrast"),
    ).toHaveLength(1);
  });
});

describe("native pixel geometry parity", () => {
  it("places module edges with floor division like native", () => {
    const plan = createRenderPlan(
      normalizeOptions({ value: "floor", size: 360 }),
      allDarkModel(),
      360,
    );
    const firstRow = plan.rows[0]!;
    firstRow.modules.forEach((module, index) => {
      expect(module.x0).toBe(Math.floor(((index + 4) * 360) / 29));
      expect(module.x1).toBe(Math.floor(((index + 5) * 360) / 29));
    });
    expect(firstRow.modules[0]!.y0).toBe(Math.floor((4 * 360) / 29));
  });

  it("insets body strokes by an integer fifth of the module", () => {
    const plan = createRenderPlan(
      normalizeOptions({
        value: "stroke",
        size: 360,
        strokeColor: "#FF0000",
        shapeOptions: { shape: "rounded" },
      }),
      allDarkModel(25),
      360,
    );
    const stroked = plan.rows
      .flatMap((row) => row.modules)
      .filter((module) => module.strokeGap !== undefined);
    expect(stroked.length).toBeGreaterThan(0);
    for (const module of stroked) {
      expect(module.strokeGap).toBe(
        module.gap + Math.max(1, Math.floor((module.x1 - module.x0) / 5)),
      );
    }
  });

  it("centers the logo hole on the rendered pixel size", () => {
    const normalized = normalizeOptions({
      value: "tiny",
      size: 20,
      logoAreaSize: 8,
      scanSafe: false,
    });
    const plan = createRenderPlan(normalized, allDarkModel(), 29);
    expect(plan.logoArea).toEqual({ size: 8, borderRadius: 0 });
    const holeStart = Math.floor((29 - 8) / 2);
    const holeEnd = holeStart + 8;
    const drawn = new Set(
      plan.rows.flatMap((row) =>
        row.modules.map((module) => `${module.x0},${module.y0}`),
      ),
    );
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        const x0 = x + 4;
        const y0 = y + 4;
        const insideHole =
          x0 < holeEnd && x0 + 1 > holeStart && y0 < holeEnd && y0 + 1 > holeStart;
        expect(drawn.has(`${x0},${y0}`)).toBe(!insideHole);
      }
    }
  });

  it("clears the logo hole on whole pixels", () => {
    const { calls } = installRecordingCanvas();
    Web.toPngDataUri({ value: "hole", size: 65, logoAreaSize: 20 });
    const hole = calls.filter((call) => call.op === "moveTo").at(-1);
    expect(hole?.args).toEqual([Math.floor((65 - 20) / 2), Math.floor((65 - 20) / 2)]);
  });

  it("paints the quiet zone and inner background on floor edges", () => {
    const { calls } = installRecordingCanvas();
    Web.toPngDataUri({
      value: "Hello",
      size: 64,
      quietZoneColor: "#E2E8F0",
    });
    const inset = Math.floor((4 * 64) / 29);
    const inner = Math.floor((25 * 64) / 29) - inset;
    expect(calls[0]).toEqual({
      op: "fillRect",
      args: [0, 0, 64, 64],
      fill: "#E2E8F0",
    });
    expect(calls[1]).toEqual({
      op: "fillRect",
      args: [inset, inset, inner, inner],
      fill: "#FFFFFF",
    });
  });

  it("clears a transparent inner background inside the quiet zone", () => {
    const { calls } = installRecordingCanvas();
    Web.toPngDataUri({
      value: "Hello",
      size: 64,
      backgroundColor: "transparent",
      quietZoneColor: "#E2E8F0",
    });
    const inset = Math.floor((4 * 64) / 29);
    const inner = Math.floor((25 * 64) / 29) - inset;
    expect(calls[1]).toMatchObject({
      op: "clearRect",
      args: [inset, inset, inner, inner],
    });
  });
});

describe("web metrics", () => {
  it("counts web matrix generation like native", () => {
    Web.setQRCodeMetricsEnabled(true);
    Web.resetQRCodeMetrics();
    Web.getMatrix({ value: "matrix-metrics" });
    expect(Web.getQRCodeMetrics().requests).toBe(1);
  });
});

describe("svg and png gradient frames", () => {
  function linearT(
    [x1, y1, x2, y2]: number[],
    x: number,
    y: number,
  ): number {
    const dx = x2! - x1!;
    const dy = y2! - y1!;
    return ((x - x1!) * dx + (y - y1!) * dy) / (dx * dx + dy * dy);
  }

  it("svg gradient matches png at the top-left module", () => {
    const options: QRCodeOptions = {
      value: "Hello",
      size: 290,
      gradient: {
        type: "linear",
        colors: ["#0000FF", "#00FF00"],
        start: { x: 0.1, y: 0.2 },
        end: { x: 0.9, y: 0.8 },
      },
    };
    const svg = Web.toSvgString(options);
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    const svgCoords = ["x1", "y1", "x2", "y2"].map((name) =>
      Number(new RegExp(`${name}="([\\d.]+)"`).exec(svg)![1]),
    );

    const context = createMockContext();
    installCanvas(() => context);
    Web.toPngDataUri(options);
    const pngCoords = context.createLinearGradient.mock.calls[0]!;

    const moduleCenter = 4.5;
    expect(linearT(svgCoords, moduleCenter, moduleCenter)).toBeCloseTo(
      linearT(pngCoords, moduleCenter * 10, moduleCenter * 10),
      2,
    );
  });

  it("scales radial svg gradients to the full image", () => {
    const svg = Web.toSvgString({
      value: "Hello",
      gradient: { type: "radial", colors: ["#0000FF", "#00FF00"] },
    });
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    expect(svg).toContain('cx="14.50" cy="14.50" r="20.51"');
  });
});
