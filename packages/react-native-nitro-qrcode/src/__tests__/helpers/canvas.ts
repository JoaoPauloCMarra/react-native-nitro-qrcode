export type MockGradient = {
  addColorStop: jest.Mock<void, [number, string]>;
};

export type MockContext = {
  arc: jest.Mock<void, [number, number, number, number, number]>;
  clearRect: jest.Mock<void, [number, number, number, number]>;
  fillStyle: string | MockGradient;
  globalCompositeOperation: GlobalCompositeOperation;
  lineCap: CanvasLineCap;
  lineWidth: number;
  strokeStyle: string | MockGradient;
  beginPath: jest.Mock<void, []>;
  bezierCurveTo: jest.Mock<
    void,
    [number, number, number, number, number, number]
  >;
  closePath: jest.Mock<void, []>;
  createLinearGradient: jest.Mock<
    MockGradient,
    [number, number, number, number]
  >;
  createRadialGradient: jest.Mock<
    MockGradient,
    [number, number, number, number, number, number]
  >;
  ellipse: jest.Mock<
    void,
    [number, number, number, number, number, number, number]
  >;
  fill: jest.Mock<void, []>;
  fillRect: jest.Mock<void, [number, number, number, number]>;
  lineTo: jest.Mock<void, [number, number]>;
  moveTo: jest.Mock<void, [number, number]>;
  quadraticCurveTo: jest.Mock<void, [number, number, number, number]>;
  restore: jest.Mock<void, []>;
  rotate: jest.Mock<void, [number]>;
  save: jest.Mock<void, []>;
  stroke: jest.Mock<void, []>;
  translate: jest.Mock<void, [number, number]>;
};

function createMockGradient(): MockGradient {
  return {
    addColorStop: jest.fn(),
  };
}

export function createMockContext(): MockContext {
  return {
    arc: jest.fn(),
    clearRect: jest.fn(),
    fillStyle: "",
    globalCompositeOperation: "source-over",
    lineCap: "butt",
    lineWidth: 1,
    strokeStyle: "",
    beginPath: jest.fn(),
    bezierCurveTo: jest.fn(),
    closePath: jest.fn(),
    createLinearGradient: jest
      .fn<MockGradient, [number, number, number, number]>()
      .mockImplementation(() => createMockGradient()),
    createRadialGradient: jest
      .fn<MockGradient, [number, number, number, number, number, number]>()
      .mockImplementation(() => createMockGradient()),
    ellipse: jest.fn(),
    fill: jest.fn(),
    fillRect: jest.fn(),
    lineTo: jest.fn(),
    moveTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    restore: jest.fn(),
    rotate: jest.fn(),
    save: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
  };
}

export function installCanvas(
  getContext: () => MockContext | null = createMockContext,
  dataUrl = "data:image/png;base64,web-png",
) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(getContext),
    toDataURL: jest.fn(() => dataUrl),
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: jest.fn(() => canvas),
    },
  });
  return canvas;
}

export type RecordedCall = { op: string; args: unknown[]; fill: unknown };

export function installRecordingCanvas() {
  const calls: RecordedCall[] = [];
  const context: Record<string, unknown> = {
    fillStyle: "",
    globalCompositeOperation: "source-over",
  };
  const record = (op: string) =>
    jest.fn((...args: unknown[]) => {
      calls.push({ op, args, fill: context.fillStyle });
    });
  const gradient = () => ({ kind: "gradient", addColorStop: jest.fn() });
  Object.assign(context, {
    arc: jest.fn(),
    beginPath: record("beginPath"),
    clearRect: record("clearRect"),
    closePath: jest.fn(),
    createLinearGradient: jest.fn(gradient),
    createRadialGradient: jest.fn(gradient),
    ellipse: jest.fn(),
    fill: record("fill"),
    fillRect: record("fillRect"),
    lineTo: record("lineTo"),
    moveTo: record("moveTo"),
    quadraticCurveTo: record("quadraticCurveTo"),
    restore: record("restore"),
    save: record("save"),
  });
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context),
    toDataURL: jest.fn(
      () =>
        `data:image/png;base64,${Buffer.from(
          calls
            .map((call) => `${call.op}:${call.args.join(",")}:fill=${String(call.fill)}`)
            .join("|"),
          "utf8",
        ).toString("base64")}`,
    ),
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: jest.fn(() => canvas) },
  });
  return { calls, canvas };
}
