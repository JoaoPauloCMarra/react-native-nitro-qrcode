import * as Web from "../index.web";

type MockCanvas = {
  getContext: jest.Mock;
  toDataURL: jest.Mock;
};

function installRecordingCanvas(): MockCanvas {
  const operations: string[] = [];
  let context: Record<string, unknown>;
  const record = (name: string, args: unknown[] = []) => {
    operations.push(
      `${name}:${args.join(",")}:fill=${String(context.fillStyle)}`,
    );
  };
  const method = (name: string) =>
    jest.fn((...args: unknown[]) => {
      record(name, args);
    });
  context = {
    fillStyle: "",
    globalCompositeOperation: "source-over",
    clearRect: method("clearRect"),
    fillRect: method("fillRect"),
    beginPath: method("beginPath"),
    fill: method("fill"),
    lineTo: method("lineTo"),
    moveTo: method("moveTo"),
    quadraticCurveTo: method("quadraticCurveTo"),
    save: method("save"),
    restore: method("restore"),
  };
  const canvas: MockCanvas = {
    getContext: jest.fn(() => context),
    toDataURL: jest.fn(() =>
      `data:image/png;base64,${Buffer.from(operations.join("|"), "utf8").toString("base64")}`,
    ),
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: jest.fn(() => canvas) },
  });
  return canvas;
}

const equivalentOptions = {
  value: "equivalent-web-colors",
  size: 64,
  strokeColor: "#000000",
  eyeColor: "#000000",
  eyeStrokeColor: "#000000",
  eyeballColor: "#000000",
  shapeOptions: {
    shape: "rounded",
    eyeFrameShape: "rounded",
    eyeballShape: "rounded",
  },
} satisfies Web.QRCodeOptions;

const explicitOpaqueOptions = {
  ...equivalentOptions,
  strokeColor: "#000000FF",
  eyeColor: "#000000FF",
  eyeStrokeColor: "#000000FF",
  eyeballColor: "#000000FF",
} satisfies Web.QRCodeOptions;

afterEach(() => {
  Web.clearQRCodeCache();
});

describe("web color-equivalent PNG rendering", () => {
  it("keeps rounded modules, stroke, grouped finders, output, and cache identity equivalent in either order", () => {
    const firstCanvas = installRecordingCanvas();
    const sixDigitOutput = Web.toPngDataUri(equivalentOptions);
    expect(Web.toPngDataUri(explicitOpaqueOptions)).toBe(sixDigitOutput);
    expect(firstCanvas.toDataURL).toHaveBeenCalledTimes(1);
    expect(Web.getQRCodeCacheSize()).toBe(1);

    Web.clearQRCodeCache();
    const secondCanvas = installRecordingCanvas();
    const eightDigitOutput = Web.toPngDataUri(explicitOpaqueOptions);
    expect(Web.toPngDataUri(equivalentOptions)).toBe(eightDigitOutput);
    expect(eightDigitOutput).toBe(sixDigitOutput);
    expect(secondCanvas.toDataURL).toHaveBeenCalledTimes(1);
    expect(Web.getQRCodeCacheSize()).toBe(1);
  });

  it("keeps a genuinely translucent stroke distinct", () => {
    const canvas = installRecordingCanvas();
    const opaqueOutput = Web.toPngDataUri(equivalentOptions);
    const translucentOutput = Web.toPngDataUri({
      ...equivalentOptions,
      strokeColor: "#00000080",
    });

    expect(translucentOutput).not.toBe(opaqueOutput);
    expect(canvas.toDataURL).toHaveBeenCalledTimes(2);
    expect(Web.getQRCodeCacheSize()).toBe(2);
  });
});
