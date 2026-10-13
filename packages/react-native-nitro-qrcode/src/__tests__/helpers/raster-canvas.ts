type Point = [number, number];
type Op = "source-over" | "destination-out";

export type RasterCanvas = {
  readonly pixels: Uint8ClampedArray;
  readonly size: () => number;
  pixelAt(x: number, y: number): [number, number, number, number];
  compositeOverWhite(): Uint8ClampedArray;
};

function parseFill(fill: unknown): [number, number, number, number] {
  const hex = String(fill).replace("#", "");
  const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    alpha,
  ];
}

function winding(subpaths: Point[][], px: number, py: number): number {
  let total = 0;
  for (const points of subpaths) {
    for (let index = 0; index < points.length; index++) {
      const [x0, y0] = points[index] as Point;
      const [x1, y1] = points[(index + 1) % points.length] as Point;
      if (y0 <= py) {
        if (y1 > py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) > 0) {
          total++;
        }
      } else if (y1 <= py && (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) < 0) {
        total--;
      }
    }
  }
  return total;
}

export function installRasterCanvas(): RasterCanvas {
  let width = 0;
  let pixels = new Uint8ClampedArray(0);
  let fillStyle: unknown = "#000000";
  let operation: Op = "source-over";
  const stack: { fillStyle: unknown; operation: Op }[] = [];
  let subpaths: Point[][] = [];

  const paint = (x: number, y: number, op: Op, color: number[]) => {
    const offset = (y * width + x) * 4;
    const sourceAlpha = (color[3] as number) / 255;
    const destAlpha = (pixels[offset + 3] as number) / 255;
    if (op === "destination-out") {
      pixels[offset + 3] = Math.round(destAlpha * (1 - sourceAlpha) * 255);
      return;
    }
    const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
    for (let channel = 0; channel < 3; channel++) {
      const source = color[channel] as number;
      const dest = pixels[offset + channel] as number;
      pixels[offset + channel] =
        outAlpha === 0
          ? 0
          : Math.round(
              (source * sourceAlpha + dest * destAlpha * (1 - sourceAlpha)) /
                outAlpha,
            );
    }
    pixels[offset + 3] = Math.round(outAlpha * 255);
  };

  const fillRect = (x: number, y: number, w: number, h: number) => {
    const color = parseFill(fillStyle);
    for (let py = Math.max(0, Math.round(y)); py < Math.min(width, Math.round(y + h)); py++) {
      for (let px = Math.max(0, Math.round(x)); px < Math.min(width, Math.round(x + w)); px++) {
        paint(px, py, operation, color);
      }
    }
  };

  const current = (): Point[] => {
    const last = subpaths[subpaths.length - 1];
    if (last === undefined) {
      const created: Point[] = [];
      subpaths.push(created);
      return created;
    }
    return last;
  };

  const arcPoints = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    from: number,
    to: number,
  ) => {
    const steps = 48;
    for (let step = 0; step <= steps; step++) {
      const angle = from + ((to - from) * step) / steps;
      current().push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
    }
  };

  const context = {
    set fillStyle(value: unknown) {
      fillStyle = value;
    },
    get fillStyle() {
      return fillStyle;
    },
    set globalCompositeOperation(value: Op) {
      operation = value;
    },
    get globalCompositeOperation() {
      return operation;
    },
    save: () => stack.push({ fillStyle, operation }),
    restore: () => {
      const saved = stack.pop();
      if (saved !== undefined) {
        fillStyle = saved.fillStyle;
        operation = saved.operation;
      }
    },
    clearRect: (x: number, y: number, w: number, h: number) => {
      const saved = { fillStyle, operation };
      fillStyle = "#000000";
      operation = "destination-out";
      fillRect(x, y, w, h);
      fillStyle = saved.fillStyle;
      operation = saved.operation;
    },
    fillRect,
    beginPath: () => {
      subpaths = [];
    },
    moveTo: (x: number, y: number) => {
      subpaths.push([[x, y]]);
    },
    lineTo: (x: number, y: number) => {
      current().push([x, y]);
    },
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => {
      const points = current();
      const [x0, y0] = points[points.length - 1] as Point;
      for (let step = 1; step <= 12; step++) {
        const t = step / 12;
        points.push([
          (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x,
          (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y,
        ]);
      }
    },
    arc: (x: number, y: number, r: number, from: number, to: number) => {
      subpaths.push([]);
      arcPoints(x, y, r, r, from, to);
    },
    ellipse: (
      x: number,
      y: number,
      rx: number,
      ry: number,
      _rotation: number,
      from: number,
      to: number,
    ) => {
      subpaths.push([]);
      arcPoints(x, y, rx, ry, from, to);
    },
    closePath: () => undefined,
    fill: () => {
      const color = parseFill(fillStyle);
      const all = subpaths.flat();
      if (all.length === 0) {
        return;
      }
      const xs = all.map((point) => point[0]);
      const ys = all.map((point) => point[1]);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)));
      const x1 = Math.min(width, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys)));
      const y1 = Math.min(width, Math.ceil(Math.max(...ys)));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          if (winding(subpaths, px + 0.5, py + 0.5) !== 0) {
            paint(px, py, operation, color);
          }
        }
      }
    },
  };

  const canvas = {
    set width(value: number) {
      width = value;
      pixels = new Uint8ClampedArray(width * width * 4);
    },
    get width() {
      return width;
    },
    height: 0,
    getContext: () => context,
    toDataURL: () => "data:image/png;base64,raster",
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => canvas },
  });

  return {
    get pixels() {
      return pixels;
    },
    size: () => width,
    pixelAt: (x, y) => {
      const offset = (y * width + x) * 4;
      return [
        pixels[offset] as number,
        pixels[offset + 1] as number,
        pixels[offset + 2] as number,
        pixels[offset + 3] as number,
      ];
    },
    compositeOverWhite: () => {
      const out = new Uint8ClampedArray(pixels.length);
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = (pixels[index + 3] as number) / 255;
        for (let channel = 0; channel < 3; channel++) {
          out[index + channel] = Math.round(
            (pixels[index + channel] as number) * alpha + 255 * (1 - alpha),
          );
        }
        out[index + 3] = 255;
      }
      return out;
    },
  };
}
