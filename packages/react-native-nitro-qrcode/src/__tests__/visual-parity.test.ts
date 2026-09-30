import * as Web from "../index.web";
import { createRenderPlan } from "../render-plan";
import { normalizeOptions, validateOptions } from "../validation";

type FillCall = { op: string; args: number[]; fill: unknown };

function installRecordingCanvas(): FillCall[] {
  const calls: FillCall[] = [];
  const context: Record<string, unknown> = {
    fillStyle: "",
    globalCompositeOperation: "source-over",
  };
  const record = (op: string) =>
    jest.fn((...args: number[]) => {
      calls.push({ op, args, fill: context.fillStyle });
    });
  const gradient = () => ({ kind: "gradient", addColorStop: jest.fn() });
  Object.assign(context, {
    arc: jest.fn(),
    beginPath: jest.fn(),
    clearRect: record("clearRect"),
    closePath: jest.fn(),
    createLinearGradient: jest.fn(gradient),
    createRadialGradient: jest.fn(gradient),
    ellipse: jest.fn(),
    fill: record("fill"),
    fillRect: record("fillRect"),
    lineTo: jest.fn(),
    moveTo: record("moveTo"),
    quadraticCurveTo: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
  });
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context),
    toDataURL: jest.fn(() => "data:image/png;base64,recorded"),
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: jest.fn(() => canvas) },
  });
  return calls;
}

function allDarkModel(size = 21) {
  return { modules: { size, data: new Array(size * size).fill(true) } };
}

afterEach(() => {
  Web.clearQRCodeCache();
});

describe("layer color defaults", () => {
  it("resolves unset finder and stroke colors to the foreground", () => {
    const normalized = normalizeOptions({
      value: "red",
      foregroundColor: "#FF0000",
    });
    expect(normalized.eyeColor).toBe("#FF0000");
    expect(normalized.eyeballColor).toBe("#FF0000");
    expect(normalized.eyeStrokeColor).toBe("#FF0000");
    expect(normalized.strokeColor).toBe("#FF0000");
  });

  it("resolves an unset eye stroke to the finder frame color", () => {
    const normalized = normalizeOptions({
      value: "blue-eye",
      eyeColor: "#1E40AF",
    });
    expect(normalized.eyeStrokeColor).toBe("#1E40AF");
    expect(normalized.eyeballColor).toBe("#000000");
  });

  it("keeps foreground-colored finders on the plain module path", () => {
    const plan = createRenderPlan(
      normalizeOptions({ value: "red-plan", foregroundColor: "#FF0000" }),
      allDarkModel(),
      128,
    );
    expect(plan.drawGroupedFinders).toBe(false);
    expect(
      plan.rows.flatMap((row) => row.modules).some((module) => module.stroke),
    ).toBe(false);
  });

  it("never paints default finders black when the foreground is red", () => {
    for (const logoAreaSize of [0, 16]) {
      const calls = installRecordingCanvas();
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
    const calls = installRecordingCanvas();
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
      .filter((module) => module.stroke !== undefined);
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
    const calls = installRecordingCanvas();
    Web.toPngDataUri({ value: "hole", size: 65, logoAreaSize: 20 });
    const hole = calls.filter((call) => call.op === "moveTo").at(-1);
    expect(hole?.args).toEqual([Math.floor((65 - 20) / 2), Math.floor((65 - 20) / 2)]);
  });

  it("paints the quiet zone and inner background on floor edges", () => {
    const calls = installRecordingCanvas();
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
    const calls = installRecordingCanvas();
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
