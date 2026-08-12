import type { QRCodeShapeOptions } from "./validation";

export type QRCodePreset = "default" | "rounded" | "dots" | "branded";

export const DEFAULT_SIZE = 512;

export const DEFAULT_QUIET_ZONE = 4;

export const DEFAULT_ECL = "M";

export const DEFAULT_MIN_VERSION = 1;

export const DEFAULT_MAX_VERSION = 40;

export const DEFAULT_MASK = -1;

export const DEFAULT_BOOST_ECL = true;

export const DEFAULT_SHAPE = "square";

export const DEFAULT_EYE_FRAME_SHAPE = "square";

export const DEFAULT_EYEBALL_SHAPE = "square";

export const DEFAULT_BODY_DENSITY = "dense";

export const DEFAULT_LAYOUT = "matrix";

export const DEFAULT_LOGO_AREA_SIZE = 0;

export const DEFAULT_LOGO_AREA_BORDER_RADIUS = 0;

export const COMPONENT_RASTER_MULTIPLIER = 2;

export const MIN_COMPONENT_RASTER_SIZE = 96;

export const DEFAULT_LINEAR_START = { x: 0, y: 0 };

export const DEFAULT_LINEAR_END = { x: 1, y: 1 };

export const DEFAULT_RADIAL_START = { x: 0.5, y: 0.5 };

export const DEFAULT_RADIAL_END = { x: 1, y: 1 };

export const DEFAULT_KEEP_PREVIOUS_IMAGE = true;

export const DEFAULT_HIDE_LOGO_UNTIL_READY = true;

export const PRESET_SHAPE_OPTIONS: Record<QRCodePreset, QRCodeShapeOptions> = {
  default: {
    shape: "square",
    eyeFrameShape: "square",
    eyeballShape: "square",
  },
  rounded: {
    shape: "rounded",
    eyeFrameShape: "rounded",
    eyeballShape: "rounded",
    cornerRadius: 8,
    eyePatternCornerRadius: 8,
  },
  dots: {
    shape: "circle",
    eyeFrameShape: "circle",
    eyeballShape: "circle",
    gap: 1,
    eyePatternGap: 1,
    cornerRadius: 0,
    eyePatternCornerRadius: 0,
  },
  branded: {
    shape: "rounded",
    eyeFrameShape: "square",
    eyeballShape: "rounded",
    gap: 1,
    eyePatternGap: 1,
    cornerRadius: 6,
    eyePatternCornerRadius: 6,
  },
};

export function mergePresetShapeOptions(
  options: QRCodeShapeOptions | undefined,
  preset: QRCodePreset | undefined,
): QRCodeShapeOptions {
  return { ...PRESET_SHAPE_OPTIONS[preset ?? "default"], ...options };
}
