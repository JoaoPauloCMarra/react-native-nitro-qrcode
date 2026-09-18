import { createRenderPlan } from "../render-plan";
import type { QRCodeBackgroundColor } from "../colors";
import { normalizeOptions } from "../validation";

function model() {
  return {
    modules: {
      size: 21,
      data: new Array(21 * 21).fill(true),
    },
  };
}

describe("render plan color identity", () => {
  it("treats equivalent opaque spellings as the default stroke and finder colors", () => {
    const plan = createRenderPlan(
      normalizeOptions({
        value: "equivalent-opaque-colors",
        strokeColor: "#000000FF",
        eyeColor: "#000000FF",
        eyeStrokeColor: "#000000FF",
        eyeballColor: "#000000FF",
        shapeOptions: { shape: "rounded" },
      }),
      model(),
      128,
    );

    expect(plan.drawGroupedFinders).toBe(false);
    expect(
      plan.rows.flatMap((row) => row.modules).some((module) => module.stroke),
    ).toBe(false);
  });

  it("preserves grouping and stroke decisions when RGBA differs", () => {
    const plan = createRenderPlan(
      normalizeOptions({
        value: "different-alpha",
        strokeColor: "#00000080",
        eyeColor: "#00000080",
        eyeStrokeColor: "#00000080",
        eyeballColor: "#00000080",
        shapeOptions: { shape: "rounded" },
      }),
      model(),
      128,
    );

    expect(plan.drawGroupedFinders).toBe(true);
    expect(
      plan.rows.flatMap((row) => row.modules).some((module) => module.stroke),
    ).toBe(true);
  });

  it("canonicalizes equivalent opaque background spellings in the plan", () => {
    const sixDigit = createRenderPlan(
      normalizeOptions({ value: "plan-background", backgroundColor: "#FFFFFF" }),
      model(),
      128,
    );
    const eightDigit = createRenderPlan(
      normalizeOptions({
        value: "plan-background",
        backgroundColor: "#FFFFFFFF",
      }),
      model(),
      128,
    );

    expect(eightDigit).toEqual(sixDigit);
  });

  it.each(
    ["transparent", "#00000000", "#0000", "#12340000", "#1230"] as QRCodeBackgroundColor[],
  )(
    "plans %s as a transparent background",
    (backgroundColor) => {
      const plan = createRenderPlan(
        normalizeOptions({ value: `transparent-${backgroundColor}`, backgroundColor }),
        model(),
        128,
      );

      expect(plan.background).toEqual({ type: "transparent" });
    },
  );
});

function filledModel(size: number) {
  return {
    modules: {
      size,
      data: new Array(size * size).fill(true),
    },
  };
}

describe("render plan region tokens", () => {
  it("styles alignment and timing independently from body modules", () => {
    const plan = createRenderPlan(
      normalizeOptions({
        value: "region-tokens",
        alignmentColor: "#CC0000",
        timingColor: "#00AA00",
        shapeOptions: {
          shape: "square",
          alignmentShape: "diamond",
          timingShape: "circle",
        },
      }),
      filledModel(25),
      200,
    );
    const modules = plan.rows.flatMap((row) => row.modules);

    expect(
      modules.some(
        (module) => module.layer === "alignment" && module.shape === "diamond",
      ),
    ).toBe(true);
    expect(
      modules.some(
        (module) => module.layer === "timing" && module.shape === "circle",
      ),
    ).toBe(true);
    expect(
      modules.some(
        (module) => module.layer === "foreground" && module.shape === "square",
      ),
    ).toBe(true);
    expect(plan.quietZoneFill).toBeUndefined();
  });

  it("keeps version 1 codes free of alignment modules", () => {
    const plan = createRenderPlan(
      normalizeOptions({
        value: "version-1-regions",
        shapeOptions: { alignmentShape: "diamond" },
      }),
      filledModel(21),
      128,
    );
    const modules = plan.rows.flatMap((row) => row.modules);

    expect(modules.some((module) => module.layer === "alignment")).toBe(false);
    expect(modules.some((module) => module.layer === "timing")).toBe(true);
  });

  it("plans a distinct quiet-zone fill when it differs from the background", () => {
    const plan = createRenderPlan(
      normalizeOptions({
        value: "quiet-zone-color",
        backgroundColor: "#FFFFFF",
        quietZoneColor: "#E2E8F0",
      }),
      filledModel(21),
      128,
    );

    expect(plan.quietZoneFill).toEqual({ type: "color", color: "#E2E8F0" });
  });
});
