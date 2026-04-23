import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockHybridObject = {
  generatePngBase64: jest.fn(() => "png-base64"),
  generatePngDataUri: jest.fn(() => "data:image/png;base64,png-base64"),
  generateSvgString: jest.fn(() => "<svg />"),
  getMatrixPackedBase64: jest.fn(() => "matrix-base64"),
  getMatrixSize: jest.fn(() => 21),
  clearCache: jest.fn(),
  getCacheSize: jest.fn(() => 2),
};

jest.mock("react-native-nitro-modules", () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => mockHybridObject),
  },
}));

import {
  clearQRCodeCache,
  getMatrix,
  getQRCodeCacheSize,
  NitroQRCode,
  QRCode,
  toPngBase64,
  toPngDataUri,
  toSvgString,
} from "../index";
import * as Web from "../index.web";

describe("native QRCode API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates PNG base64 with normalized defaults", () => {
    expect(toPngBase64({ value: "https://example.com" })).toBe("png-base64");
    expect(mockHybridObject.generatePngBase64).toHaveBeenCalledWith(
      "https://example.com",
      512,
      4,
      "M",
      "#000000",
      "#FFFFFF",
      1,
      40,
      -1,
      true,
      "square",
      "square",
      0,
      0,
      0,
      0,
      "none",
      [],
      [],
      0,
      0,
      1,
      1,
    );
  });

  it("generates PNG data URI with custom options", () => {
    expect(
      toPngDataUri({
        value: "Hello",
        size: 256,
        quietZone: 2,
        errorCorrectionLevel: "high",
        foregroundColor: "#111111",
        backgroundColor: "#EEEEEE",
        minVersion: 2,
        maxVersion: 8,
        mask: 3,
        boostEcl: false,
        shapeOptions: {
          shape: "circle",
          eyePatternShape: "rounded",
          gap: 2,
          eyePatternGap: 1,
        },
        logoAreaSize: 48,
        logoAreaBorderRadius: 8,
      }),
    ).toBe("data:image/png;base64,png-base64");
    expect(mockHybridObject.generatePngDataUri).toHaveBeenCalledWith(
      "Hello",
      256,
      2,
      "high",
      "#111111",
      "#EEEEEE",
      2,
      8,
      3,
      false,
      "circle",
      "rounded",
      2,
      1,
      48,
      8,
      "none",
      [],
      [],
      0,
      0,
      1,
      1,
    );
  });

  it("passes gradient options through the native bridge", () => {
    expect(
      toPngBase64({
        value: "gradient",
        gradient: {
          colors: ["#4AA8FF", "#28D17C"],
          locations: [0, 1],
          start: { x: 0.1, y: 0.2 },
          end: { x: 0.9, y: 0.8 },
        },
      }),
    ).toBe("png-base64");

    expect(mockHybridObject.generatePngBase64).toHaveBeenLastCalledWith(
      "gradient",
      512,
      4,
      "M",
      "#000000",
      "#FFFFFF",
      1,
      40,
      -1,
      true,
      "square",
      "square",
      0,
      0,
      0,
      0,
      "linear",
      ["#4AA8FF", "#28D17C"],
      [0, 1],
      0.1,
      0.2,
      0.9,
      0.8,
    );
  });

  it("uses radial gradient defaults on the native bridge", () => {
    expect(
      toPngBase64({
        value: "radial",
        gradient: {
          type: "radial",
          colors: ["#4AA8FF", "#28D17C"],
        },
      }),
    ).toBe("png-base64");

    expect(mockHybridObject.generatePngBase64).toHaveBeenLastCalledWith(
      "radial",
      512,
      4,
      "M",
      "#000000",
      "#FFFFFF",
      1,
      40,
      -1,
      true,
      "square",
      "square",
      0,
      0,
      0,
      0,
      "radial",
      ["#4AA8FF", "#28D17C"],
      [],
      0.5,
      0.5,
      1,
      1,
    );
  });

  it("generates SVG and matrix output", () => {
    expect(toSvgString({ value: "Hello" })).toBe("<svg />");
    expect(getMatrix({ value: "Hello" })).toEqual({
      size: 21,
      packedBase64: "matrix-base64",
    });
  });

  it("exposes cache helpers and grouped API", () => {
    clearQRCodeCache();
    expect(mockHybridObject.clearCache).toHaveBeenCalled();
    expect(getQRCodeCacheSize()).toBe(2);
    expect(NitroQRCode.toPngBase64({ value: "Hello" })).toBe("png-base64");
    expect(NitroQRCode.getCacheSize()).toBe(2);
  });

  it("validates empty values and integer ranges", () => {
    expect(() => toPngBase64({ value: "" })).toThrow("must not be empty");
    expect(() => toPngBase64({ value: "x", size: 0 })).toThrow("size must be");
    expect(() => toPngBase64({ value: "x", quietZone: 33 })).toThrow(
      "quietZone must be",
    );
    expect(() => toPngBase64({ value: "x", minVersion: 0 })).toThrow(
      "minVersion must be",
    );
    expect(() => toPngBase64({ value: "x", maxVersion: 41 })).toThrow(
      "maxVersion must be",
    );
    expect(() => toPngBase64({ value: "x", mask: 8 })).toThrow("mask must be");
    expect(() => toPngBase64({ value: "x", size: 1.5 })).toThrow(
      "size must be",
    );
    expect(() =>
      toPngBase64({
        value: "x",
        shapeOptions: { shape: "triangle" as "square" },
      }),
    ).toThrow("shape must be");
    expect(() =>
      toPngBase64({ value: "x", shapeOptions: { gap: 257 } }),
    ).toThrow("gap must be");
    expect(() => toPngBase64({ value: "x", logoAreaSize: 4097 })).toThrow(
      "logoAreaSize must be",
    );
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          colors: [
            "#000000",
            "#111111",
            "#222222",
            "#333333",
            "#444444",
            "#555555",
            "#666666",
            "#777777",
            "#888888",
          ],
        },
      }),
    ).toThrow("gradient.colors must contain");
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          locations: [0],
        },
      }),
    ).toThrow("gradient.locations must match");
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          type: "diagonal" as "linear",
          colors: ["#000000", "#FFFFFF"],
        },
      }),
    ).toThrow("gradient.type must be");
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          locations: [0, 2],
        },
      }),
    ).toThrow("gradient.locations entries must be");
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          locations: [0.8, 0.2],
        },
      }),
    ).toThrow("gradient.locations must be in non-decreasing order");
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          start: { x: 2, y: 0 },
        },
      }),
    ).toThrow("gradient.start.x must be");
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          colors: ["#000000", "nope"],
        },
      }),
    ).toThrow("gradient.colors[1] must be");
  });

  it("renders an Image-backed QR component", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          value: "https://example.com",
          size: 144,
          shapeOptions: { shape: "rounded", gap: 1, eyePatternGap: 2 },
          logo: React.createElement("logo"),
          testID: "qr",
        }),
      );
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }
    const qrView = tree.root.findAll(
      (node) => node.props.testID === "qr" && Array.isArray(node.props.style),
    )[0];
    expect(qrView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 144, height: 144 }),
      ]),
    );
    const currentTree = tree;
    act(() => {
      currentTree.update(
        React.createElement(QRCode, {
          value: "https://example.com",
          shapeOptions: { shape: "circle" },
        }),
      );
    });
  });

  it("uses the default component size", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(QRCode, { value: "https://example.com" }),
      );
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }
    const qrView = tree.root.findAll((node) =>
      Array.isArray(node.props.style),
    )[0];
    expect(qrView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 180, height: 180 }),
      ]),
    );
  });
});

describe("web QRCode API", () => {
  type MockGradient = {
    addColorStop: jest.Mock<void, [number, string]>;
  };

  type MockContext = {
    fillStyle: string | MockGradient;
    beginPath: jest.Mock<void, []>;
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
  };

  const originalDocument = globalThis.document;
  const originalBtoa = globalThis.btoa;

  function createMockGradient(): MockGradient {
    return {
      addColorStop: jest.fn(),
    };
  }

  function createMockContext(): MockContext {
    return {
      fillStyle: "",
      beginPath: jest.fn(),
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
    };
  }

  function installCanvas(
    getContext: () => MockContext | null = createMockContext,
  ) {
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(getContext),
      toDataURL: jest.fn(() => "data:image/png;base64,web-png"),
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: jest.fn(() => canvas),
      },
    });
    return canvas;
  }

  afterEach(() => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "btoa", {
      configurable: true,
      value: originalBtoa,
    });
    Web.clearQRCodeCache();
  });

  it("generates SVG, matrix, and cached PNG data on web", () => {
    const canvas = installCanvas();

    expect(
      Web.toSvgString({ value: "Hello", errorCorrectionLevel: "low" }),
    ).toContain("<svg");
    expect(
      Web.toSvgString({ value: "Hello", errorCorrectionLevel: "low" }),
    ).toContain("<svg");
    expect(
      Web.toSvgString({ value: "Hello", errorCorrectionLevel: "medium" }),
    ).toContain("shape-rendering");
    expect(
      Web.toSvgString({ value: "Hello", errorCorrectionLevel: "quartile" }),
    ).toContain("<path");
    expect(
      Web.toSvgString({ value: "Hello", errorCorrectionLevel: "high" }),
    ).toContain("#FFFFFF");
    expect(
      Web.toSvgString({
        value: "Hello",
        gradient: {
          colors: ["#4AA8FF", "#28D17C"],
        },
      }),
    ).toContain("linearGradient");
    expect(
      Web.toSvgString({
        value: "Hello",
        gradient: {
          type: "radial",
          colors: ["#4AA8FF", "#28D17C"],
        },
      }),
    ).toContain("radialGradient");
    expect(
      Web.toSvgString({
        value: "Hello",
        gradient: {
          colors: ["#4AA8FFAA", "#28D17C"],
        },
      }),
    ).toContain("stop-opacity=");
    expect(
      Web.toSvgString({
        value: "Hello",
        minVersion: 2,
        maxVersion: 2,
        mask: 1,
      }),
    ).toContain("<svg");

    const styledPngOptions = {
      value: "Hello",
      size: 64,
      quietZone: 1,
      shapeOptions: {
        shape: "circle",
        eyePatternShape: "rounded",
        gap: 1,
        eyePatternGap: 0,
      },
      logoAreaSize: 12,
      logoAreaBorderRadius: 3,
    } satisfies Web.QRCodeOptions;
    const uri = Web.toPngDataUri(styledPngOptions);
    expect(uri).toBe("data:image/png;base64,web-png");
    expect(Web.toPngDataUri(styledPngOptions)).toBe(uri);
    expect(
      Web.toPngBase64({
        value: "Hello",
        size: 64,
        quietZone: 1,
        shapeOptions: {
          shape: "rounded",
          eyePatternShape: "circle",
          gap: 0,
        },
      }),
    ).toBe("web-png");
    expect(canvas.getContext).toHaveBeenCalledWith("2d");
    expect(Web.getQRCodeCacheSize()).toBeGreaterThan(0);
    Web.clearQRCodeCache();
    expect(Web.getQRCodeCacheSize()).toBe(0);

    const matrix = Web.getMatrix({ value: "Hello" });
    expect(matrix.size).toBeGreaterThan(0);
    expect(matrix.packedBase64.length).toBeGreaterThan(0);
    expect(Web.NitroQRCode.getMatrix({ value: "Hello" }).size).toBe(
      matrix.size,
    );
  });

  it("uses btoa when available for web matrix output", () => {
    installCanvas();
    Object.defineProperty(globalThis, "btoa", {
      configurable: true,
      value: jest.fn(() => "encoded-by-btoa"),
    });
    expect(Web.getMatrix({ value: "Hello" }).packedBase64).toBe(
      "encoded-by-btoa",
    );
  });

  it("falls back to Buffer for web matrix base64 output", () => {
    installCanvas();
    Object.defineProperty(globalThis, "btoa", {
      configurable: true,
      value: undefined,
    });
    expect(
      Web.getMatrix({ value: "Hello" }).packedBase64.length,
    ).toBeGreaterThan(0);
  });

  it("validates web inputs and canvas availability", () => {
    expect(() => Web.toPngDataUri({ value: "Hello" })).toThrow(
      "browser canvas",
    );

    installCanvas(() => null);
    expect(() => Web.toPngDataUri({ value: "Hello" })).toThrow("2D canvas");

    installCanvas();
    expect(() => Web.toSvgString({ value: "" })).toThrow("must not be empty");
    expect(() => Web.toSvgString({ value: "x", size: 0 })).toThrow(
      "size must be",
    );
    expect(() => Web.toSvgString({ value: "x", quietZone: 33 })).toThrow(
      "quietZone must be",
    );
    expect(() => Web.toSvgString({ value: "x", minVersion: 0 })).toThrow(
      "minVersion must be",
    );
    expect(() => Web.toSvgString({ value: "x", maxVersion: 41 })).toThrow(
      "maxVersion must be",
    );
    expect(() => Web.toSvgString({ value: "x", mask: 8 })).toThrow(
      "mask must be",
    );
    expect(() =>
      Web.toSvgString({
        value: "x",
        shapeOptions: { eyePatternShape: "triangle" as "square" },
      }),
    ).toThrow("eyePatternShape must be");
    expect(() =>
      Web.toSvgString({ value: "x", shapeOptions: { eyePatternGap: 257 } }),
    ).toThrow("eyePatternGap must be");
    expect(() => Web.toSvgString({ value: "x", logoAreaSize: 4097 })).toThrow(
      "logoAreaSize must be",
    );
    expect(() =>
      Web.toSvgString({
        value: "x",
        foregroundColor: "bad",
      }),
    ).toThrow("foregroundColor must be");
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          colors: [
            "#000000",
            "#111111",
            "#222222",
            "#333333",
            "#444444",
            "#555555",
            "#666666",
            "#777777",
            "#888888",
          ],
        },
      }),
    ).toThrow("gradient.colors must contain");
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          type: "diagonal" as "linear",
          colors: ["#000000", "#FFFFFF"],
        },
      }),
    ).toThrow("gradient.type must be");
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          locations: [0],
        },
      }),
    ).toThrow("gradient.locations must match");
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          locations: [0, 2],
        },
      }),
    ).toThrow("gradient.locations entries must be");
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          locations: [0.8, 0.2],
        },
      }),
    ).toThrow("gradient.locations must be in non-decreasing order");
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          start: { x: 2, y: 0 },
        },
      }),
    ).toThrow("gradient.start.x must be");
  });

  it("uses the square-run fast path for default web PNG output", () => {
    const context = createMockContext();
    installCanvas(() => context);

    expect(Web.toPngDataUri({ value: "Hello", size: 64 })).toBe(
      "data:image/png;base64,web-png",
    );
    expect(context.fillRect).toHaveBeenCalled();
    expect(context.beginPath).not.toHaveBeenCalled();
    expect(context.ellipse).not.toHaveBeenCalled();
    expect(context.quadraticCurveTo).not.toHaveBeenCalled();
  });

  it("uses a linear gradient fill on web", () => {
    const context = createMockContext();
    installCanvas(() => context);

    expect(
      Web.toPngDataUri({
        value: "Hello",
        size: 64,
        gradient: {
          colors: ["#4AA8FF", "#28D17C"],
          locations: [0, 1],
          start: { x: 0.2, y: 0.1 },
          end: { x: 0.8, y: 0.9 },
        },
      }),
    ).toBe("data:image/png;base64,web-png");

    expect(context.createLinearGradient).toHaveBeenCalledWith(
      12.8,
      6.4,
      51.2,
      57.6,
    );
    const gradient = context.createLinearGradient.mock.results[0]?.value;
    expect(gradient?.addColorStop).toHaveBeenNthCalledWith(1, 0, "#4AA8FF");
    expect(gradient?.addColorStop).toHaveBeenNthCalledWith(2, 1, "#28D17C");
  });

  it("uses a radial gradient fill on web", () => {
    const context = createMockContext();
    installCanvas(() => context);

    expect(
      Web.toPngDataUri({
        value: "Hello",
        size: 64,
        gradient: {
          type: "radial",
          colors: ["#4AA8FF", "#28D17C"],
          start: { x: 0.5, y: 0.5 },
          end: { x: 1, y: 0.5 },
        },
      }),
    ).toBe("data:image/png;base64,web-png");

    expect(context.createRadialGradient).toHaveBeenCalledWith(
      32,
      32,
      0,
      32,
      32,
      32,
    );
  });

  it("renders the web Image-backed QR component", () => {
    installCanvas();
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(Web.QRCode, {
          value: "Hello",
          size: 128,
          logo: React.createElement("logo"),
          shapeOptions: { shape: "circle", gap: 1 },
          testID: "web-qr",
        }),
      );
    });
    if (tree === undefined) {
      throw new Error("Expected web QRCode test renderer to be created.");
    }
    const qrView = tree.root.findAll(
      (node) =>
        node.props.testID === "web-qr" && Array.isArray(node.props.style),
    )[0];
    expect(qrView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 128, height: 128 }),
      ]),
    );
    expect(Web.NitroQRCode.toPngDataUri({ value: "Hello" })).toContain(
      "data:image/png;base64,",
    );
    act(() => {
      tree?.update(
        React.createElement(Web.QRCode, {
          value: "Hello",
          shapeOptions: { shape: "rounded", eyePatternGap: 1 },
        }),
      );
    });
  });

  it("uses the default web component size", () => {
    installCanvas();
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(Web.QRCode, { value: "Hello" }),
      );
    });
    if (tree === undefined) {
      throw new Error("Expected web QRCode test renderer to be created.");
    }
    const qrView = tree.root.findAll((node) =>
      Array.isArray(node.props.style),
    )[0];
    expect(qrView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 180, height: 180 }),
      ]),
    );
  });
});
