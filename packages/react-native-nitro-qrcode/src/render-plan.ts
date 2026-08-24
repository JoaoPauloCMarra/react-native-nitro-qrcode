import {
  DEFAULT_EYE,
  DEFAULT_EYE_STROKE,
  DEFAULT_EYEBALL,
  DEFAULT_STROKE,
  areRgbaColorsEqual,
  isFullyTransparent,
  toSvgColor,
} from "./colors";
import type { NormalizedOptions, QRCodeShape } from "./validation";

export type RenderLayer =
  | "foreground"
  | "stroke"
  | "eye"
  | "eyeball";

export type RenderModulePlan = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  shape: QRCodeShape;
  gap: number;
  cornerRadius: number;
  layer: RenderLayer;
  stroke?: RenderLayer;
  strokeGap?: number;
};

export type RenderBackground =
  | { type: "transparent" }
  | { type: "color"; color: string };

export type RenderPlanRow = {
  moduleY: number;
  modules: RenderModulePlan[];
};

export type RenderPlan = {
  background: RenderBackground;
  rows: RenderPlanRow[];
  drawGroupedFinders: boolean;
  logoArea:
    | { size: number; borderRadius: number }
    | undefined;
  matrixSize: number;
  quietZone: number;
  totalModules: number;
  pixelSize: number;
};

export type QRCodeModuleModel = {
  modules: { size: number; data: ArrayLike<boolean | number> };
};

export type RenderPixelGeometry = {
  modulePixel: (moduleIndex: number) => number;
  totalModules: number;
};

export function createRenderPlan(
  options: NormalizedOptions,
  model: QRCodeModuleModel,
  pixelSize: number,
): RenderPlan {
  const totalModules = model.modules.size + options.quietZone * 2;
  const modulePixel = (moduleIndex: number): number =>
    Math.round((moduleIndex * pixelSize) / totalModules);
  const geometry: RenderPixelGeometry = { modulePixel, totalModules };
  const rows = buildModuleRows(options, model, geometry);
  return {
    background:
      isFullyTransparent(options.backgroundColor)
        ? { type: "transparent" }
        : { type: "color", color: toSvgColor(options.backgroundColor) },
    rows,
    drawGroupedFinders: shouldDrawGroupedFinderEyes(options),
    logoArea:
      options.logoAreaSize === 0
        ? undefined
        : {
            size: Math.min(options.logoAreaSize, options.size),
            borderRadius: options.logoAreaBorderRadius,
          },
    matrixSize: model.modules.size,
    quietZone: options.quietZone,
    totalModules,
    pixelSize,
  };
}

function isDark(model: QRCodeModuleModel, x: number, y: number): boolean {
  return Boolean(model.modules.data[y * model.modules.size + x]);
}

function isEyeModule(x: number, y: number, matrixSize: number): boolean {
  const top = y >= 0 && y < 7;
  const left = x >= 0 && x < 7;
  const right = x >= matrixSize - 7 && x < matrixSize;
  const bottom = y >= matrixSize - 7 && y < matrixSize;
  return (top && left) || (top && right) || (bottom && left);
}

function getEyeOrigin(
  x: number,
  y: number,
  matrixSize: number,
): { x: number; y: number } {
  if (x < 7 && y < 7) {
    return { x: 0, y: 0 };
  }
  if (x >= matrixSize - 7 && y < 7) {
    return { x: matrixSize - 7, y: 0 };
  }
  return { x: 0, y: matrixSize - 7 };
}

function isEyeBallModule(x: number, y: number, matrixSize: number): boolean {
  const origin = getEyeOrigin(x, y, matrixSize);
  const localX = x - origin.x;
  const localY = y - origin.y;
  return localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
}

function intersectsLogoArea(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  options: NormalizedOptions,
): boolean {
  if (options.logoAreaSize === 0) {
    return false;
  }
  const areaSize = Math.min(options.logoAreaSize, options.size);
  const left = (options.size - areaSize) / 2;
  const top = (options.size - areaSize) / 2;
  return x0 < left + areaSize && x1 > left && y0 < top + areaSize && y1 > top;
}

function shouldDrawGroupedFinderEyes(
  options: NormalizedOptions,
): boolean {
  return (
    options.shapeOptions.eyeFrameShape !== "square" ||
    options.shapeOptions.eyeballShape !== "square" ||
    !areRgbaColorsEqual(options.eyeColor, DEFAULT_EYE) ||
    !areRgbaColorsEqual(options.eyeStrokeColor, DEFAULT_EYE_STROKE) ||
    !areRgbaColorsEqual(options.eyeballColor, DEFAULT_EYEBALL)
  );
}

function resolveBodyGap(
  options: NormalizedOptions,
  width: number,
  height: number,
): number {
  if (options.shapeOptions.bodyDensity === "dense") {
    return options.shapeOptions.gap;
  }
  const moduleSize = Math.max(1, Math.min(width, height));
  const densityGap =
    options.shapeOptions.bodyDensity === "sparse"
      ? Math.round(moduleSize * 0.22)
      : Math.round(moduleSize * 0.12);
  return Math.max(options.shapeOptions.gap, densityGap);
}

function buildModuleRows(
  options: NormalizedOptions,
  model: QRCodeModuleModel,
  geometry: RenderPixelGeometry,
): RenderPlanRow[] {
  const rows: RenderPlanRow[] = [];
  const drawGroupedFinderEyes = shouldDrawGroupedFinderEyes(options);
  const matrixSize = model.modules.size;

  for (let moduleY = 0; moduleY < matrixSize; moduleY++) {
    const y0 = geometry.modulePixel(moduleY + options.quietZone);
    const y1 = geometry.modulePixel(moduleY + options.quietZone + 1);
    const rowModules: RenderModulePlan[] = [];
    for (let moduleX = 0; moduleX < matrixSize; moduleX++) {
      if (!isDark(model, moduleX, moduleY)) {
        continue;
      }
      const eyeModule = isEyeModule(moduleX, moduleY, matrixSize);
      if (drawGroupedFinderEyes && eyeModule) {
        continue;
      }
      const x0 = geometry.modulePixel(moduleX + options.quietZone);
      const x1 = geometry.modulePixel(moduleX + options.quietZone + 1);
      if (intersectsLogoArea(x0, y0, x1, y1, options)) {
        continue;
      }
      const eyeballModule = isEyeBallModule(moduleX, moduleY, matrixSize);
      const shape: QRCodeShape = eyeballModule
        ? options.shapeOptions.eyeballShape
        : eyeModule
          ? options.shapeOptions.eyeFrameShape
          : options.shapeOptions.shape;
      const gap = eyeModule
        ? options.shapeOptions.eyePatternGap
        : resolveBodyGap(options, x1 - x0, y1 - y0);
      const cornerRadius = eyeModule
        ? options.shapeOptions.eyePatternCornerRadius
        : options.shapeOptions.cornerRadius;
      const layer: RenderLayer = eyeballModule
        ? "eyeball"
        : eyeModule
          ? "eye"
          : "foreground";
      const plan: RenderModulePlan = {
        x0,
        y0,
        x1,
        y1,
        shape,
        gap,
        cornerRadius,
        layer,
      };
      if (!eyeModule && !areRgbaColorsEqual(options.strokeColor, DEFAULT_STROKE)) {
        plan.stroke = "stroke";
        plan.strokeGap = gap + Math.max(1, (x1 - x0) * 0.18);
      }
      rowModules.push(plan);
    }
    rows.push({ moduleY, modules: rowModules });
  }
  return rows;
}
