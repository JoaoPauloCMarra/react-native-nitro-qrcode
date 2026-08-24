export type QRCodeColor = `#${string}`;

export type QRCodeBackgroundColor = QRCodeColor | "transparent";

export const DEFAULT_FOREGROUND = "#000000";

export const DEFAULT_BACKGROUND = "#FFFFFF";

export const DEFAULT_STROKE = "#000000";

export const DEFAULT_EYE = "#000000";

export const DEFAULT_EYE_STROKE = "#000000";

export const DEFAULT_EYEBALL = "#000000";

export function sanitizeColor(value: string, name: string): QRCodeColor {
  return sanitizeHexColor(value, name);
}

export function sanitizeBackgroundColor(
  value: string,
  name: string,
): QRCodeBackgroundColor {
  if (value.toLowerCase() === "transparent") {
    return "transparent";
  }
  return sanitizeHexColor(value, name);
}

export function sanitizeHexColor(value: string, name: string): QRCodeColor {
  if (/^#[0-9A-Fa-f]{3}([0-9A-Fa-f])?$/.test(value)) {
    const hex = value.slice(1);
    return `#${hex
      .split("")
      .map((character) => character + character)
      .join("")}`.toUpperCase() as QRCodeColor;
  }
  if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value)) {
    throw new Error(
      `${name} must be #RGB, #RGBA, #RRGGBB, or #RRGGBBAA.`,
    );
  }
  return value.toUpperCase() as QRCodeColor;
}

export type ParsedRgbaColor = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

export function parseRgbaColor(value: string): ParsedRgbaColor {
  if (value.toLowerCase() === "transparent") {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }
  const rawHex = value.slice(1);
  const hex =
    rawHex.length === 3 || rawHex.length === 4
      ? rawHex
          .split("")
          .map((character) => character + character)
          .join("")
      : rawHex;
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
    alpha: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
  };
}

export function areRgbaColorsEqual(first: string, second: string): boolean {
  const firstColor = parseRgbaColor(first);
  const secondColor = parseRgbaColor(second);
  return (
    firstColor.red === secondColor.red &&
    firstColor.green === secondColor.green &&
    firstColor.blue === secondColor.blue &&
    firstColor.alpha === secondColor.alpha
  );
}

export function isFullyTransparent(value: string): boolean {
  return parseRgbaColor(value).alpha === 0;
}

export function rgbaColorBytes(value: string): [number, number, number, number] {
  const color = parseRgbaColor(value);
  return [color.red, color.green, color.blue, color.alpha];
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

export function toSvgColor(value: string): string {
  const color = parseRgbaColor(value);
  const rgb = `#${toHexByte(color.red)}${toHexByte(color.green)}${toHexByte(
    color.blue,
  )}`;
  return color.alpha === 255 ? rgb : `${rgb}${toHexByte(color.alpha)}`;
}

export function parseHexColor(color: string): {
  red: number;
  green: number;
  blue: number;
} {
  const hex = color.replace(/^#/, "");
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const alpha =
    hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return {
    red: Math.round(red * alpha + 255 * (1 - alpha)),
    green: Math.round(green * alpha + 255 * (1 - alpha)),
    blue: Math.round(blue * alpha + 255 * (1 - alpha)),
  };
}

export function linearizeChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: {
  red: number;
  green: number;
  blue: number;
}): number {
  return (
    0.2126 * linearizeChannel(color.red) +
    0.7152 * linearizeChannel(color.green) +
    0.0722 * linearizeChannel(color.blue)
  );
}

export function contrastRatio(
  first: { red: number; green: number; blue: number },
  second: { red: number; green: number; blue: number },
): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const light = Math.max(firstLuminance, secondLuminance);
  const dark = Math.min(firstLuminance, secondLuminance);
  return (light + 0.05) / (dark + 0.05);
}
