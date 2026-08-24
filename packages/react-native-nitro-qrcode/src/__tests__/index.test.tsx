import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import jsQR from "jsqr";
import * as fs from "node:fs";
import * as path from "node:path";

const mockHybridObject = {
  generatePngBase64Object: jest.fn(() => "png-base64"),
  generatePngBase64AsyncObject: jest.fn(async () => "png-base64"),
  generatePngDataUriObject: jest.fn(() => "data:image/png;base64,png-base64"),
  generatePngDataUriAsyncObject: jest.fn(
    async () => "data:image/png;base64,png-base64",
  ),
  generateSvgString: jest.fn(() => "<svg />"),
  getMatrixObject: jest.fn(() => ({ size: 21, packedBase64: "matrix-base64" })),
  getMatrixPackedBase64: jest.fn(() => "matrix-base64"),
  getMatrixSize: jest.fn(() => 21),
  clearCache: jest.fn(),
  getCacheSize: jest.fn(() => 2),
  getCacheBytes: jest.fn(() => 256),
};

jest.mock("react-native-nitro-modules", () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => mockHybridObject),
  },
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function flushMacrotasks(rounds = 1): Promise<void> {
  let pending = Promise.resolve();
  for (let index = 0; index < rounds; index++) {
    pending = pending.then(
      () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
    );
  }
  return pending;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (this.state.error !== null) {
      return React.createElement("error-boundary", {
        message: this.state.error.message,
      });
    }
    return this.props.children;
  }
}

import {
  clearQRCodeCache,
  type ErrorCorrectionLevel,
  getMatrix,
  getQRCodeCacheBytes,
  getQRCodeCacheSize,
  NitroQRCode,
  QRCode,
  type QRCodeRef,
  toPngBase64,
  toPngBase64Async,
  toPngDataUri,
  toPngDataUriAsync,
  toSvgString,
  validateOptions,
} from "../index";
import * as Web from "../index.web";
import { validateLogoDimensions } from "../validation";

function nativeOptions(options: unknown): Parameters<typeof toPngBase64>[0] {
  return options as Parameters<typeof toPngBase64>[0];
}

function webOptions(options: unknown): Parameters<typeof Web.toSvgString>[0] {
  return options as Parameters<typeof Web.toSvgString>[0];
}

function hasStylePointerEvents(node: TestRenderer.ReactTestInstance): boolean {
  return (
    Array.isArray(node.props.style) &&
    node.props.style.some(
      (style: unknown) =>
        typeof style === "object" &&
        style !== null &&
        "pointerEvents" in style,
    )
  );
}

describe("entrypoint export parity", () => {
  it("re-exports validateOptions on both entrypoints", () => {
    expect(validateOptions).toBe(NitroQRCode.validateOptions);
    expect(Web.validateOptions).toBe(Web.NitroQRCode.validateOptions);
  });
});

describe("native QRCode API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHybridObject.generatePngBase64AsyncObject.mockImplementation(
      async () => "png-base64",
    );
    mockHybridObject.generatePngDataUriAsyncObject.mockImplementation(
      async () => "data:image/png;base64,png-base64",
    );
  });

  it("generates PNG base64 with normalized defaults", () => {
    expect(toPngBase64({ value: "https://example.com" })).toBe("png-base64");
    expect(mockHybridObject.generatePngBase64Object).toHaveBeenCalledWith({
      value: "https://example.com",
      size: 512,
      quietZone: 4,
      errorCorrectionLevel: "M",
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
      strokeColor: "#000000",
      eyeColor: "#000000",
      eyeStrokeColor: "#000000",
      eyeballColor: "#000000",
      minVersion: 1,
      maxVersion: 40,
      mask: -1,
      boostEcl: true,
      moduleShape: "square",
      eyePatternShape: "square",
      eyeballShape: "square",
      gap: 0,
      eyePatternGap: 0,
      bodyDensity: "dense",
      cornerRadius: -1,
      eyePatternCornerRadius: -1,
      layout: "matrix",
      logoAreaSize: 0,
      logoAreaBorderRadius: 0,
      gradientType: "none",
      gradientColors: [],
      gradientLocations: [],
      gradientStartX: 0,
      gradientStartY: 0,
      gradientEndX: 1,
      gradientEndY: 1,
    });
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
          layout: "matrix",
          shape: "rounded",
          eyeFrameShape: "rounded",
          eyeballShape: "rounded",
          gap: 2,
          eyePatternGap: 1,
          bodyDensity: "balanced",
          cornerRadius: 3,
          eyePatternCornerRadius: 4,
        },
        logoAreaSize: 48,
        logoAreaBorderRadius: 8,
      }),
    ).toBe("data:image/png;base64,png-base64");
    expect(mockHybridObject.generatePngDataUriObject).toHaveBeenCalledWith({
      value: "Hello",
      size: 256,
      quietZone: 2,
      errorCorrectionLevel: "H",
      foregroundColor: "#111111",
      backgroundColor: "#EEEEEE",
      strokeColor: "#000000",
      eyeColor: "#000000",
      eyeStrokeColor: "#000000",
      eyeballColor: "#000000",
      minVersion: 2,
      maxVersion: 8,
      mask: 3,
      boostEcl: false,
      moduleShape: "rounded",
      eyePatternShape: "rounded",
      eyeballShape: "rounded",
      gap: 2,
      eyePatternGap: 1,
      bodyDensity: "balanced",
      cornerRadius: 3,
      eyePatternCornerRadius: 4,
      layout: "matrix",
      logoAreaSize: 48,
      logoAreaBorderRadius: 8,
      gradientType: "none",
      gradientColors: [],
      gradientLocations: [],
      gradientStartX: 0,
      gradientStartY: 0,
      gradientEndX: 1,
      gradientEndY: 1,
    });
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

    expect(mockHybridObject.generatePngBase64Object).toHaveBeenLastCalledWith({
      value: "gradient",
      size: 512,
      quietZone: 4,
      errorCorrectionLevel: "M",
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
      strokeColor: "#000000",
      eyeColor: "#000000",
      eyeStrokeColor: "#000000",
      eyeballColor: "#000000",
      minVersion: 1,
      maxVersion: 40,
      mask: -1,
      boostEcl: true,
      moduleShape: "square",
      eyePatternShape: "square",
      eyeballShape: "square",
      gap: 0,
      eyePatternGap: 0,
      bodyDensity: "dense",
      cornerRadius: -1,
      eyePatternCornerRadius: -1,
      layout: "matrix",
      logoAreaSize: 0,
      logoAreaBorderRadius: 0,
      gradientType: "linear",
      gradientColors: ["#4AA8FF", "#28D17C"],
      gradientLocations: [0, 1],
      gradientStartX: 0.1,
      gradientStartY: 0.2,
      gradientEndX: 0.9,
      gradientEndY: 0.8,
    });
  });

  it("passes custom layer colors through the native bridge", () => {
    expect(
      toPngBase64({
        value: "layers",
        strokeColor: "#FF0000FF",
        eyeColor: "#111111",
        eyeStrokeColor: "#333333",
        eyeballColor: "#555555",
      }),
    ).toBe("png-base64");

    expect(mockHybridObject.generatePngBase64Object).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "layers",
        strokeColor: "#FF0000FF",
        eyeColor: "#111111",
        eyeStrokeColor: "#333333",
        eyeballColor: "#555555",
        backgroundColor: "#FFFFFF",
        layout: "matrix",
      }),
    );
  });

  it("exposes async PNG helpers through the native bridge", async () => {
    await expect(toPngBase64Async({ value: "async" })).resolves.toBe(
      "png-base64",
    );
    await expect(toPngDataUriAsync({ value: "async" })).resolves.toBe(
      "data:image/png;base64,png-base64",
    );
    expect(mockHybridObject.generatePngBase64AsyncObject).toHaveBeenCalled();
    expect(mockHybridObject.generatePngDataUriAsyncObject).toHaveBeenCalled();
  });

  it("rejects async PNG helpers when native options are invalid", async () => {
    await expect(toPngBase64Async({ value: "" })).rejects.toThrow(
      "must not be empty",
    );
    await expect(toPngDataUriAsync({ value: "" })).rejects.toThrow(
      "must not be empty",
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

    expect(mockHybridObject.generatePngBase64Object).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "radial",
        gradientType: "radial",
        gradientColors: ["#4AA8FF", "#28D17C"],
        gradientLocations: [],
        gradientStartX: 0.5,
        gradientStartY: 0.5,
        gradientEndX: 1,
        gradientEndY: 1,
      }),
    );
   });

   it("hardens native output when scanSafe is enabled", () => {
    toPngBase64({
      value: "scan-safe",
      quietZone: 0,
      errorCorrectionLevel: "L",
      logoAreaSize: 32,
      scanSafe: true,
    });

    const calls = mockHybridObject.generatePngBase64Object.mock
      .calls as unknown[][];
    const lastCall = calls.at(-1)?.[0] as
      | { quietZone?: number; errorCorrectionLevel?: string }
      | undefined;
    expect(lastCall?.quietZone).toBe(4);
    expect(lastCall?.errorCorrectionLevel).toBe("H");
  });

  it("generates SVG and matrix output", () => {
    expect(toSvgString({ value: "Hello" })).toBe("<svg />");
    expect(getMatrix({ value: "Hello" })).toEqual({
      size: 21,
      packedBase64: "matrix-base64",
    });
    expect(mockHybridObject.getMatrixObject).toHaveBeenCalledTimes(1);
    expect(mockHybridObject.getMatrixSize).not.toHaveBeenCalled();
    expect(mockHybridObject.getMatrixPackedBase64).not.toHaveBeenCalled();
  });

  it("normalizes native error-correction aliases and colors", () => {
    toPngBase64({
      value: "low",
      errorCorrectionLevel: "low",
      foregroundColor: "#abc",
      backgroundColor: "#1234",
    });
    toPngBase64({ value: "medium", errorCorrectionLevel: "medium" });
    toPngBase64({ value: "quartile", errorCorrectionLevel: "quartile" });
    toPngBase64({ value: "transparent", backgroundColor: "transparent" });

    const calls = mockHybridObject.generatePngBase64Object.mock.calls as unknown[][];
    expect(
      calls.map((call) => (call[0] as { errorCorrectionLevel?: string })
        .errorCorrectionLevel),
    ).toEqual(["L", "M", "Q", "M"]);
    expect(
      (calls[0]?.[0] as { foregroundColor?: string }).foregroundColor,
    ).toBe("#AABBCC");
    expect(
      (calls[0]?.[0] as { backgroundColor?: string }).backgroundColor,
    ).toBe("#11223344");
    expect(
      (calls[3]?.[0] as { backgroundColor?: string }).backgroundColor,
    ).toBe("transparent");
  });

  it("exposes cache helpers and grouped API", () => {
    clearQRCodeCache();
    expect(mockHybridObject.clearCache).toHaveBeenCalled();
    expect(getQRCodeCacheSize()).toBe(2);
    expect(getQRCodeCacheBytes()).toBe(256);
    expect(mockHybridObject.getCacheBytes).toHaveBeenCalled();
    expect(NitroQRCode.toPngBase64({ value: "Hello" })).toBe("png-base64");
    expect(NitroQRCode.getCacheSize()).toBe(2);
  });

  it("validates empty values and integer ranges", () => {
    expect(() => toPngBase64({ value: "" })).toThrow("must not be empty");
    expect(() => toPngBase64({ value: "x", size: 0 })).toThrow("size must be");
    expect(() => toPngBase64({ value: "x", size: 2048 })).not.toThrow();
    expect(() => toPngBase64({ value: "x", size: 4096 })).not.toThrow();
    expect(() => toPngBase64Async({ value: "x", size: 4096 })).not.toThrow();
    expect(() => toPngBase64({ value: "x", size: 4097 })).toThrow(
      "size must be",
    );
    expect(() => toPngBase64({ value: "x", quietZone: 33 })).toThrow(
      "quietZone must be",
    );
    expect(() =>
      toPngBase64(nativeOptions({ value: "x", minVersion: 0 })),
    ).toThrow("minVersion must be");
    expect(() =>
      toPngBase64(nativeOptions({ value: "x", maxVersion: 41 })),
    ).toThrow(
      "maxVersion must be",
    );
    expect(() =>
      toPngBase64({ value: "x", minVersion: 3, maxVersion: 2 }),
    ).toThrow("minVersion and maxVersion");
    expect(() => toPngBase64(nativeOptions({ value: "x", mask: 8 }))).toThrow(
      "mask must be",
    );
    expect(() =>
      toPngBase64({
        value: "x",
        errorCorrectionLevel: "bad" as ErrorCorrectionLevel,
      }),
    ).toThrow("errorCorrectionLevel must be");
    expect(() => toPngBase64({ value: "x", size: 1.5 })).toThrow(
      "size must be",
    );
    expect(() =>
      toPngBase64({
        value: "x",
        shapeOptions: { shape: "triangle" as "square" },
      }),
    ).toThrow("shape must be square, circle, or rounded");
    expect(() =>
      toPngBase64({ value: "x", shapeOptions: { gap: 257 } }),
    ).toThrow("gap must be");
    expect(() =>
      toPngBase64({ value: "x", shapeOptions: { cornerRadius: 257 } }),
    ).toThrow("cornerRadius must be");
    expect(() =>
      toPngBase64({
        value: "x",
        shapeOptions: { layout: "spiral" as "matrix" },
      }),
    ).toThrow("layout must be");
    expect(() =>
      toPngBase64({
        value: "x",
        shapeOptions: { eyePatternShape: "triangle" as "square" },
      }),
    ).toThrow("eyeFrameShape must be square, circle, or rounded");
    expect(() =>
      toPngBase64({
        value: "x",
        shapeOptions: { eyeballShape: "triangle" as "square" },
      }),
    ).toThrow("eyeballShape must be square, circle, or rounded");
    expect(() =>
      toPngBase64({
        value: "x",
        shapeOptions: { bodyDensity: "crowded" as "dense" },
      }),
    ).toThrow("bodyDensity must be sparse, balanced, or dense");
    expect(() => toPngBase64({ value: "x", logoAreaSize: 4097 })).toThrow(
      "logoAreaSize must be",
    );
    expect(() =>
      toPngBase64({ value: "x", size: 128, logoAreaSize: 129 }),
    ).toThrow("logoAreaSize must be between 0 and size");
    expect(() =>
      toPngBase64({ value: "x", size: 128, logoAreaBorderRadius: 65 }),
    ).toThrow("logoAreaBorderRadius must be between 0 and half the size");
    expect(() =>
      toPngBase64({ value: "x", size: 4096, logoAreaBorderRadius: 2048 }),
    ).not.toThrow();
    expect(() =>
      toPngBase64({ value: "x", size: 4096, logoAreaBorderRadius: 2049 }),
    ).toThrow("logoAreaBorderRadius must be an integer between 0 and 2048");
    expect(() =>
      toPngBase64(nativeOptions({
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
      })),
    ).toThrow("gradient.colors must contain");
    expect(() =>
      toPngBase64(nativeOptions({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          locations: [0],
        },
      })),
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
          colors: ["#000000", "#FFFFFF"],
          start: { x: 0, y: 2 },
        },
      }),
    ).toThrow("gradient.start.y must be");
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          end: { x: -1, y: 1 },
        },
      }),
    ).toThrow("gradient.end.x must be");
    expect(() =>
      toPngBase64({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          end: { x: 1, y: Number.NaN },
        },
      }),
    ).toThrow("gradient.end.y must be");
    expect(() =>
      toPngBase64(nativeOptions({
        value: "x",
        gradient: {
          colors: ["#000000", "nope"],
        },
      })),
    ).toThrow("gradient.colors[1] must be");
  });

  it("keeps the absolute and relative logo radius bounds aligned", () => {
    expect(() => validateLogoDimensions(0, 2048, 4096)).not.toThrow();
    expect(() => validateLogoDimensions(0, 2049, 4096)).toThrow(
      "logoAreaBorderRadius must be an integer between 0 and 2048",
    );
    expect(() => validateLogoDimensions(0, 65, 128)).toThrow(
      "logoAreaBorderRadius must be between 0 and half the size",
    );
  });

  it("renders an Image-backed QR component", async () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          value: "https://example.com",
          size: 144,
          shapeOptions: {
            shape: "square",
            gap: 1,
            eyePatternGap: 2,
            cornerRadius: 3,
            eyePatternCornerRadius: 4,
          },
          logo: React.createElement("logo"),
          logoBackgroundColor: "#101112",
          testID: "qr",
        }),
      );
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }
    const currentTree = tree;
    const qrView = tree.root.findAll(
      (node) => node.props.testID === "qr" && Array.isArray(node.props.style),
    )[0];
    expect(qrView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 144, height: 144 }),
      ]),
    );
    expect(
      currentTree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,png-base64",
      ),
    ).not.toHaveLength(0);
    const logoView = currentTree.root.findAll(hasStylePointerEvents)[0];
    expect(logoView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointerEvents: "none" }),
        expect.objectContaining({ backgroundColor: "#101112" }),
      ]),
    );
    await act(async () => {
      currentTree.update(
        React.createElement(QRCode, {
          value: "https://example.com",
          backgroundColor: "#ABCDEF",
          logo: React.createElement("logo"),
        }),
      );
    });
    const backgroundLogoView =
      currentTree.root.findAll(hasStylePointerEvents)[0];
    expect(backgroundLogoView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: "#ABCDEF" }),
      ]),
    );
    await act(async () => {
      currentTree.update(
        React.createElement(QRCode, {
          value: "https://example.com",
          logo: React.createElement("logo"),
        }),
      );
    });
    const defaultLogoView = currentTree.root.findAll(hasStylePointerEvents)[0];
    expect(defaultLogoView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: "#FFFFFF" }),
      ]),
    );
    await act(async () => {
      currentTree.update(
        React.createElement(QRCode, {
          value: "https://example.com",
          shapeOptions: { shape: "circle" },
        }),
      );
    });
  });

  it.each([
    ["negative", -1],
    ["zero", 0],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["above maximum", 2049],
  ])(
    "rejects %s component size before native generation",
    async (_caseName, size) => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      let tree: TestRenderer.ReactTestRenderer | undefined;

      await act(async () => {
        tree = TestRenderer.create(
          React.createElement(
            ErrorBoundary,
            undefined,
            React.createElement(QRCode, { value: "invalid-size", size }),
          ),
        );
      });

      if (tree === undefined) {
        throw new Error("Expected QRCode test renderer to be created.");
      }

      expect(
        tree.root.find((node) => String(node.type) === "error-boundary").props
          .message,
      ).toBe(
        "QRCode component size must be an integer between 1 and 2048 points.",
      );
      expect(
        mockHybridObject.generatePngDataUriAsyncObject,
      ).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    },
  );

  it("accepts the maximum component size", async () => {
    await act(async () => {
      TestRenderer.create(
        React.createElement(QRCode, {
          value: "maximum-component-size",
          size: 2048,
        }),
      );
    });

    const call = mockHybridObject.generatePngDataUriAsyncObject.mock
      .calls.at(-1) as
      | readonly unknown[]
      | undefined;
    const options = call?.[0] as
      | { value?: string; size?: number }
      | undefined;
    expect(options?.value).toBe("maximum-component-size");
    expect(options?.size).toBe(4096);
  });

  it("renders a placeholder instead of the logo while the async QR is pending", async () => {
    const pending = createDeferred<string>();
    mockHybridObject.generatePngDataUriAsyncObject.mockImplementationOnce(
      () => pending.promise,
    );

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          value: "pending",
          logo: React.createElement("logo"),
          placeholder: React.createElement("placeholder"),
        }),
      );
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }
    const currentTree = tree;

    expect(
      currentTree.root.findAll((node) => String(node.type) === "placeholder"),
    ).toHaveLength(1);
    expect(
      currentTree.root.findAll((node) => String(node.type) === "logo"),
    ).toHaveLength(0);

    await act(async () => {
      pending.resolve("data:image/png;base64,pending");
      await Promise.resolve();
    });

    expect(
      currentTree.root.findAll((node) => String(node.type) === "placeholder"),
    ).toHaveLength(0);
    expect(
      currentTree.root.findAll((node) => String(node.type) === "logo"),
    ).toHaveLength(1);
    expect(
      currentTree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,pending",
      ),
    ).not.toHaveLength(0);
  });

  it("keeps the previous image while the next async QR is pending", async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    mockHybridObject.generatePngDataUriAsyncObject
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(QRCode, { value: "one" }));
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }
    const currentTree = tree;

    await act(async () => {
      first.resolve("data:image/png;base64,first");
      await Promise.resolve();
    });
    expect(
      currentTree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,first",
      ),
    ).not.toHaveLength(0);

    await act(async () => {
      currentTree.update(React.createElement(QRCode, { value: "two" }));
    });
    expect(
      currentTree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,first",
      ),
    ).not.toHaveLength(0);

    await act(async () => {
      second.resolve("data:image/png;base64,second");
      await Promise.resolve();
    });
    expect(
      currentTree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,second",
      ),
    ).not.toHaveLength(0);
  });

  it("clears the QR image when keepPreviousImage is false", async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    mockHybridObject.generatePngDataUriAsyncObject
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          value: "one",
          keepPreviousImage: false,
        }),
      );
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }
    const currentTree = tree;

    await act(async () => {
      first.resolve("data:image/png;base64,one");
      await Promise.resolve();
    });
    expect(
      currentTree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,one",
      ),
    ).not.toHaveLength(0);

    await act(async () => {
      currentTree.update(
        React.createElement(QRCode, {
          value: "two",
          keepPreviousImage: false,
        }),
      );
    });
    expect(
      currentTree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,one",
      ),
    ).toHaveLength(0);

    await act(async () => {
      second.resolve("data:image/png;base64,two");
      await Promise.resolve();
    });
    expect(
      currentTree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,two",
      ),
    ).not.toHaveLength(0);
  });

  it("calls onReady when native async generation succeeds", async () => {
    const pending = createDeferred<string>();
    mockHybridObject.generatePngDataUriAsyncObject.mockImplementationOnce(
      () => pending.promise,
    );
    const onReady = jest.fn();

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, { value: "ready", onReady }),
      );
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }

    await act(async () => {
      pending.resolve("data:image/png;base64,ready");
      await Promise.resolve();
    });

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith("data:image/png;base64,ready");
  });

  it("does not regenerate native QR output when callback identity changes", async () => {
    const firstReady = jest.fn();
    const secondReady = jest.fn();

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          value: "stable-callbacks",
          onReady: firstReady,
        }),
      );
      await Promise.resolve();
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }

    const callsAfterInitialRender =
      mockHybridObject.generatePngDataUriAsyncObject.mock.calls.length;

    await act(async () => {
      tree?.update(
        React.createElement(QRCode, {
          value: "stable-callbacks",
          onReady: secondReady,
        }),
      );
      await Promise.resolve();
    });

    expect(mockHybridObject.generatePngDataUriAsyncObject).toHaveBeenCalledTimes(
      callsAfterInitialRender,
    );
    expect(firstReady).toHaveBeenCalledTimes(1);
    expect(secondReady).not.toHaveBeenCalled();
  });

  it("does not regenerate native QR output when nested option identity changes without value changes", async () => {
    const firstReady = jest.fn();
    const secondReady = jest.fn();

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          value: "stable-nested-options",
          shapeOptions: { shape: "rounded", gap: 1 },
          gradient: {
            colors: ["#000000", "#FFFFFF"],
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
          },
          onReady: firstReady,
        }),
      );
      await Promise.resolve();
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }

    const callsAfterInitialRender =
      mockHybridObject.generatePngDataUriAsyncObject.mock.calls.length;

    await act(async () => {
      tree?.update(
        React.createElement(QRCode, {
          value: "stable-nested-options",
          shapeOptions: { shape: "rounded", gap: 1 },
          gradient: {
            colors: ["#000000", "#FFFFFF"],
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
          },
          onReady: secondReady,
        }),
      );
      await Promise.resolve();
    });

    expect(mockHybridObject.generatePngDataUriAsyncObject).toHaveBeenCalledTimes(
      callsAfterInitialRender,
    );
    expect(firstReady).toHaveBeenCalledTimes(1);
    expect(secondReady).not.toHaveBeenCalled();
  });

  it("keeps native gradient locations stable without explicit endpoints", async () => {
    const firstReady = jest.fn();
    const secondReady = jest.fn();

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          value: "stable-gradient-locations",
          gradient: {
            colors: ["#000000", "#FFFFFF"],
            locations: [0, 1],
          },
          onReady: firstReady,
        }),
      );
      await Promise.resolve();
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }

    const callsAfterInitialRender =
      mockHybridObject.generatePngDataUriAsyncObject.mock.calls.length;

    await act(async () => {
      tree?.update(
        React.createElement(QRCode, {
          value: "stable-gradient-locations",
          gradient: {
            colors: ["#000000", "#FFFFFF"],
            locations: [0, 1],
          },
          onReady: secondReady,
        }),
      );
      await Promise.resolve();
    });

    expect(mockHybridObject.generatePngDataUriAsyncObject).toHaveBeenCalledTimes(
      callsAfterInitialRender,
    );
    expect(firstReady).toHaveBeenCalledTimes(1);
    expect(secondReady).not.toHaveBeenCalled();
  });

  it("preserves native component gradient tuples from three to eight stops", async () => {
    const scenarios = [
      {
        colors: ["#111111", "#222222", "#333333"],
        locations: [0, 0.5, 1],
      },
      {
        colors: ["#111111", "#222222", "#333333", "#444444"],
        locations: [0, 0.33, 0.66, 1],
      },
      {
        colors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
        locations: [0, 0.25, 0.5, 0.75, 1],
      },
      {
        colors: [
          "#111111",
          "#222222",
          "#333333",
          "#444444",
          "#555555",
          "#666666",
        ],
        locations: [0, 0.2, 0.4, 0.6, 0.8, 1],
      },
      {
        colors: [
          "#111111",
          "#222222",
          "#333333",
          "#444444",
          "#555555",
          "#666666",
          "#777777",
        ],
        locations: [0, 0.17, 0.34, 0.5, 0.67, 0.84, 1],
      },
      {
        colors: [
          "#111111",
          "#222222",
          "#333333",
          "#444444",
          "#555555",
          "#666666",
          "#777777",
          "#888888",
        ],
        locations: [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1],
      },
    ] as const;

    for (const [index, scenario] of scenarios.entries()) {
      await act(async () => {
        TestRenderer.create(
          React.createElement(QRCode, {
            value: `gradient-${index}`,
            gradient: scenario,
          }),
        );
        await Promise.resolve();
      });

      const call = mockHybridObject.generatePngDataUriAsyncObject.mock
        .calls.at(-1) as
        | readonly unknown[]
        | undefined;
      const options = call?.[0] as
        | { gradientColors?: readonly unknown[]; gradientLocations?: readonly unknown[] }
        | undefined;
      expect(options?.gradientColors).toEqual(scenario.colors);
      expect(options?.gradientLocations).toEqual(scenario.locations);
    }
  });

  it("routes async native generation errors to onError when provided", async () => {
    const pending = createDeferred<never>();
    mockHybridObject.generatePngDataUriAsyncObject.mockImplementationOnce(
      () => pending.promise,
    );
    const onError = jest.fn();

    await act(async () => {
      TestRenderer.create(
        React.createElement(QRCode, {
          value: "broken",
          onError,
        }),
      );
      pending.reject(new Error("native-boom"));
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0]?.[0]?.message).toBe("native-boom");
  });

  it("exposes imperative export methods on the QR component", async () => {
    const qrRef = React.createRef<QRCodeRef>();
    let tree: TestRenderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          ref: qrRef,
          value: "imperative",
        }),
      );
    });

    if (tree === undefined || qrRef.current === null) {
      throw new Error("Expected QRCode ref to be attached.");
    }

    expect(qrRef.current.toPngDataUri()).toBe(
      "data:image/png;base64,png-base64",
    );
    expect(qrRef.current.toPngBase64()).toBe("png-base64");
    expect(mockHybridObject.generatePngDataUriObject).toHaveBeenCalled();
    expect(mockHybridObject.generatePngBase64Object).toHaveBeenCalled();
  });

  it("validates scanability warnings and errors", () => {
    const scanable = NitroQRCode.validateOptions({
      value: "https://example.com",
      size: 96,
      quietZone: 0,
      errorCorrectionLevel: "M",
      logoAreaSize: 40,
      foregroundColor: "#AABBCC",
      backgroundColor: "#CCDDEE",
    });
    expect(scanable.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "too-small-size" }),
        expect.objectContaining({ code: "bad-quiet-zone" }),
        expect.objectContaining({ code: "logo-too-large" }),
        expect.objectContaining({ code: "low-ecl-for-logo" }),
        expect.objectContaining({ code: "low-contrast" }),
      ]),
    );
    expect(scanable.valid).toBe(true);
    expect(scanable.errors).toEqual([]);

    const invalid = NitroQRCode.validateOptions({ value: "" });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toHaveLength(1);
    expect(invalid.errors[0]?.code).toBe("invalid");
    expect(invalid.errors[0]?.message).toContain("must not be empty");

    const invalidScanSafe = NitroQRCode.validateOptions({
      value: "https://example.com",
      scanSafe: "always" as unknown as true,
    });
    expect(invalidScanSafe.valid).toBe(false);
    expect(invalidScanSafe.errors[0]?.message).toContain("scanSafe must be");

    expect(
      NitroQRCode.validateOptions({
        value: "https://example.com",
        quietZone: 16,
        foregroundColor: "#00000080",
        backgroundColor: "#000000",
      }).warnings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "bad-quiet-zone",
        }),
      ]),
    );

    const strict = NitroQRCode.validateOptions({
      value: "https://example.com",
      size: 96,
      foregroundColor: "#AABBCC",
      backgroundColor: "#CCDDEE",
      scanSafe: "strict",
    });
    expect(strict.valid).toBe(false);
    expect(strict.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "too-small-size" }),
        expect.objectContaining({ code: "low-contrast" }),
      ]),
    );

    expect(
      NitroQRCode.validateOptions({
        value: "https://example.com",
        size: 200,
        quietZone: 0,
        errorCorrectionLevel: "L",
        logoAreaSize: 50,
        scanSafe: true,
      }).warnings,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "bad-quiet-zone" }),
        expect.objectContaining({ code: "low-ecl-for-logo" }),
      ]),
    );
    expect(
      NitroQRCode.validateOptions({
        value: "https://example.com",
        foregroundColor: "#000000",
        backgroundColor: "transparent",
      }).warnings,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "low-contrast" })]),
    );
  });

  it("ignores async completions after the component unmounts", async () => {
    const success = createDeferred<string>();
    const failure = createDeferred<string>();
    mockHybridObject.generatePngDataUriAsyncObject
      .mockImplementationOnce(() => success.promise)
      .mockImplementationOnce(() => failure.promise);

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(QRCode, { value: "one" }));
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }
    const currentTree = tree;

    await act(async () => {
      currentTree.update(React.createElement(QRCode, { value: "two" }));
    });
    await act(async () => {
      currentTree.unmount();
    });

    await act(async () => {
      success.resolve("data:image/png;base64,late-success");
      failure.reject(new Error("late-error"));
      await Promise.resolve();
    });

    expect(mockHybridObject.generatePngDataUriAsyncObject).toHaveBeenCalledTimes(2);
  });

  it("surfaces async QR generation errors", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockHybridObject.generatePngDataUriAsyncObject.mockImplementationOnce(() =>
      Promise.reject("boom"),
    );

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(
          ErrorBoundary,
          undefined,
          React.createElement(QRCode, { value: "broken" }),
        ),
      );
      await Promise.resolve();
    });

    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }

    const fallback = tree.root.findAll(
      (node) => node.props.message === "boom",
    )[0];
    expect(fallback.props.message).toBe("boom");
    consoleErrorSpy.mockRestore();
  });

  it("surfaces native Error instances from async QR generation", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockHybridObject.generatePngDataUriAsyncObject.mockImplementationOnce(() =>
      Promise.reject(new Error("native-boom")),
    );

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(
          ErrorBoundary,
          undefined,
          React.createElement(QRCode, { value: "broken-native" }),
        ),
      );
      await Promise.resolve();
    });

    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }

    const fallback = tree.root.findAll(
      (node) => node.props.message === "native-boom",
    )[0];
    expect(fallback.props.message).toBe("native-boom");
    consoleErrorSpy.mockRestore();
  });

  it("exposes QR meaning and generation state through accessibility props", async () => {
    const pending = createDeferred<string>();
    mockHybridObject.generatePngDataUriAsyncObject.mockImplementationOnce(
      () => pending.promise,
    );
    let tree: TestRenderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(QRCode, {
          value: "https://example.com/accessible",
          logo: React.createElement("logo"),
          placeholder: React.createElement("placeholder"),
        }),
      );
      await Promise.resolve();
    });
    if (tree === undefined) {
      throw new Error("Expected QRCode test renderer to be created.");
    }
    const currentTree = tree;

    const containerWhilePending = currentTree.root.findAll(
      (node) => node.props.testID === undefined && node.props.accessible === true,
    )[0];
    expect(containerWhilePending.props.accessibilityRole).toBe("image");
    expect(containerWhilePending.props.accessibilityLabel).toBe(
      "Generating QR code",
    );
    expect(containerWhilePending.props.accessibilityState).toEqual({
      busy: true,
    });

    await act(async () => {
      pending.resolve("data:image/png;base64,accessible");
      await Promise.resolve();
    });

    const image = currentTree.root.findAll(
      (node) =>
        node.props.source?.uri === "data:image/png;base64,accessible",
    )[0];
    expect(image).toBeDefined();
    expect(image.props.accessible).toBe(true);
    expect(image.props.accessibilityRole).toBe("image");
    expect(image.props.accessibilityLabel).toBe(
      "QR code for https://example.com/accessible",
    );

    const logo = currentTree.root.findAll(
      (node) => node.props.accessible === false,
    )[0];
    expect(logo).toBeDefined();
    expect(logo.props.accessibilityElementsHidden).toBe(true);
    expect(logo.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("uses the default component size", async () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
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

  const originalDocument = globalThis.document;
  const originalBtoa = globalThis.btoa;

  function createMockGradient(): MockGradient {
    return {
      addColorStop: jest.fn(),
    };
  }

  function createMockContext(): MockContext {
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
      Web.toSvgString({ value: "Hello", backgroundColor: "#333" }),
    ).toContain("#333333");
    expect(Web.toSvgString({ value: "Hello", foregroundColor: "#1234" }))
      .toContain("#11223344");
    expect(
      Web.toSvgString({ value: "Hello", backgroundColor: "transparent" }),
    ).toContain('fill="#00000000"');
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
        eyeballShape: "rounded",
        gap: 1,
        eyePatternGap: 0,
        bodyDensity: "balanced",
        cornerRadius: 2,
        eyePatternCornerRadius: 3,
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
          shape: "square",
          eyePatternShape: "circle",
          gap: 0,
        },
      }),
    ).toBe("web-png");
    expect(
      Web.toPngBase64({
        value: "Hello rounded eyes",
        size: 64,
        quietZone: 1,
        shapeOptions: {
          shape: "square",
          eyePatternShape: "rounded",
          cornerRadius: 2,
        },
      }),
    ).toBe("web-png");
    expect(
      Web.toPngBase64({
        value: "Hello rounded modules",
        size: 96,
        shapeOptions: {
          shape: "rounded",
          bodyDensity: "sparse",
        },
      }),
    ).toBe("web-png");
    expect(
      Web.toPngBase64({
        value: "Hello custom layer colors",
        size: 96,
        strokeColor: "#FF0000FF",
        eyeColor: "#111111",
        eyeStrokeColor: "#333333",
        eyeballColor: "#555555",
        shapeOptions: {
          shape: "square",
          eyePatternShape: "rounded",
          gap: 1,
          cornerRadius: 2,
          eyePatternCornerRadius: 2,
        },
      }),
    ).toBe("web-png");
    expect(
      Web.toPngBase64({
        value: "Hello custom eye color",
        size: 96,
        eyeColor: "#224466",
        shapeOptions: {
          shape: "square",
          eyePatternShape: "rounded",
        },
      }),
    ).toBe("web-png");
    expect(
      Web.toPngBase64({
        value: "Hello custom square eye stroke",
        size: 96,
        eyeStrokeColor: "#884422",
        shapeOptions: {
          shape: "square",
          eyeFrameShape: "square",
          eyeballShape: "square",
        },
      }),
    ).toBe("web-png");
    expect(
      Web.toPngBase64({
        value: "Hello full logo area",
        size: 64,
        shapeOptions: { shape: "square" },
        logoAreaSize: 64,
        logoAreaBorderRadius: 32,
      }),
    ).toBe("web-png");
    (["square", "circle", "rounded"] as const).forEach((eyeballShape) => {
      expect(
        Web.toPngBase64({
          value: `Hello ${eyeballShape}`,
          size: 96,
          shapeOptions: {
            eyeballShape,
          },
        }),
      ).toBe("web-png");
    });
    expect(canvas.getContext).toHaveBeenCalledWith("2d");
    expect(Web.getQRCodeCacheSize()).toBeGreaterThan(0);
    Web.clearQRCodeCache();
    expect(Web.getQRCodeCacheSize()).toBe(0);
    for (let index = 0; index < 140; index++) {
      Web.toSvgString({ value: `cache-entry-${index}` });
    }
    expect(Web.getQRCodeCacheSize()).toBe(128);
    Web.clearQRCodeCache();
    for (let index = 0; index < 140; index++) {
      Web.toPngDataUri({ value: `png-cache-entry-${index}` });
    }
    expect(Web.getQRCodeCacheSize()).toBe(128);
    Web.clearQRCodeCache();

    const matrix = Web.getMatrix({ value: "Hello" });
    expect(matrix.size).toBeGreaterThan(0);
    expect(matrix.packedBase64.length).toBeGreaterThan(0);
    expect(Web.NitroQRCode.getMatrix({ value: "Hello" }).size).toBe(
      matrix.size,
    );
  });

  it("exposes async web PNG helpers", async () => {
    installCanvas();
    await expect(Web.toPngBase64Async({ value: "Hello" })).resolves.toBe(
      "web-png",
    );
    await expect(Web.toPngDataUriAsync({ value: "Hello" })).resolves.toBe(
      "data:image/png;base64,web-png",
    );
  });

  it("yields between async web PNG render bands and matches sync output", async () => {
    const canvas = installCanvas();
    const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");
    const syncUri = Web.toPngDataUri({ value: "banded", size: 96 });
    Web.clearQRCodeCache();
    const syncCalls = setTimeoutSpy.mock.calls.length;

    const asyncUri = await Web.toPngDataUriAsync({ value: "banded", size: 96 });
    const asyncCalls = setTimeoutSpy.mock.calls.length;

    expect(asyncUri).toBe(syncUri);
    expect(canvas.toDataURL).toHaveBeenCalledTimes(2);
    expect(asyncCalls).toBeGreaterThan(syncCalls);
    setTimeoutSpy.mockRestore();
  });

  it("verifies cached web requests after an FNV key collision", () => {
    const first = Web.toSvgString({ value: "w5e0fhr-33w8" });
    const second = Web.toSvgString({ value: "w22z3ci-35rd" });

    expect(second).not.toBe(first);
    expect(Web.getQRCodeCacheSize()).toBe(1);
  });

  it("verifies cached web options after an FNV key collision", () => {
    const first = Web.toSvgString({
      value: "option-collision-new",
      foregroundColor: "#0B8E79",
    });
    const second = Web.toSvgString({
      value: "option-collision-new",
      foregroundColor: "#D9F104",
    });

    expect(second).not.toBe(first);
    expect(Web.getQRCodeCacheSize()).toBe(1);
  });

  it("uses parsed RGBA bytes as the web cache color identity", () => {
    const first = Web.toSvgString({
      value: "color-identity",
      backgroundColor: "transparent",
    });
    const second = Web.toSvgString({
      value: "color-identity",
      backgroundColor: "#00000000",
    });

    expect(second).toBe(first);
    expect(Web.getQRCodeCacheSize()).toBe(1);
  });

  it("canonicalizes SVG color spellings before rendering and caching", () => {
    const sixDigit = Web.toSvgString({
      value: "svg-color-identity",
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
    });
    const eightDigit = Web.toSvgString({
      value: "svg-color-identity",
      foregroundColor: "#000000FF",
      backgroundColor: "#FFFFFFFF",
    });

    expect(eightDigit).toBe(sixDigit);
    expect(sixDigit).toContain('<path fill="#FFFFFF"');
    expect(sixDigit).toContain('<path fill="#000000"');
    expect(Web.getQRCodeCacheSize()).toBe(1);

    const alpha = Web.toSvgString({
      value: "svg-alpha-color",
      foregroundColor: "#11223344",
    });
    expect(alpha).toContain('<path fill="#11223344"');
  });

  it("bounds the web cache by output bytes", () => {
    const canvas = installCanvas();
    canvas.toDataURL.mockReturnValue(
      `data:image/png;base64,${"A".repeat(150_000)}`,
    );
    for (let index = 0; index < 40; index++) {
      Web.toPngDataUri({ value: `large-cache-entry-${index}` });
    }

    expect(Web.getQRCodeCacheSize()).toBeLessThan(40);
    expect(Web.getQRCodeCacheBytes()).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it("does not retain a web cache entry larger than the byte budget", () => {
    const canvas = installCanvas();
    canvas.toDataURL.mockReturnValue(
      `data:image/png;base64,${"A".repeat(2_100_000)}`,
    );

    expect(Web.toPngDataUri({ value: "oversized-cache-entry" }).length).toBe(
      2_100_022,
    );
    expect(Web.getQRCodeCacheSize()).toBe(0);
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
    expect(() =>
      Web.toSvgString(webOptions({ value: "x", minVersion: 0 })),
    ).toThrow(
      "minVersion must be",
    );
    expect(() =>
      Web.toSvgString(webOptions({ value: "x", maxVersion: 41 })),
    ).toThrow(
      "maxVersion must be",
    );
    expect(() =>
      Web.toSvgString({ value: "x", minVersion: 3, maxVersion: 2 }),
    ).toThrow("minVersion and maxVersion");
    expect(() => Web.toSvgString(webOptions({ value: "x", mask: 8 }))).toThrow(
      "mask must be",
    );
    expect(() =>
      Web.toSvgString({
        value: "x",
        errorCorrectionLevel: "bad" as Web.ErrorCorrectionLevel,
      }),
    ).toThrow("errorCorrectionLevel must be");
    expect(() =>
      Web.toSvgString({
        value: "x",
        shapeOptions: { layout: "spiral" as "matrix" },
      }),
    ).toThrow("layout must be");
    expect(() =>
      Web.toSvgString({
        value: "x",
        shapeOptions: { shape: "triangle" as "square" },
      }),
    ).toThrow("shape must be square, circle, or rounded");
    expect(() =>
      Web.toSvgString({
        value: "x",
        shapeOptions: { eyePatternShape: "triangle" as "square" },
      }),
    ).toThrow("eyeFrameShape must be square, circle, or rounded");
    expect(() =>
      Web.toSvgString({
        value: "x",
        shapeOptions: { eyeballShape: "triangle" as "square" },
      }),
    ).toThrow("eyeballShape must be square, circle, or rounded");
    expect(() =>
      Web.toSvgString({
        value: "x",
        shapeOptions: { bodyDensity: "crowded" as "dense" },
      }),
    ).toThrow("bodyDensity must be sparse, balanced, or dense");
    expect(() =>
      Web.toSvgString({ value: "x", shapeOptions: { eyePatternGap: 257 } }),
    ).toThrow("eyePatternGap must be");
    expect(() =>
      Web.toSvgString({
        value: "x",
        shapeOptions: { eyePatternCornerRadius: 257 },
      }),
    ).toThrow("eyePatternCornerRadius must be");
    expect(() => Web.toSvgString({ value: "x", logoAreaSize: 4097 })).toThrow(
      "logoAreaSize must be",
    );
    expect(() =>
      Web.toSvgString({ value: "x", size: 128, logoAreaSize: 129 }),
    ).toThrow("logoAreaSize must be between 0 and size");
    expect(() =>
      Web.toSvgString({ value: "x", size: 128, logoAreaBorderRadius: 65 }),
    ).toThrow("logoAreaBorderRadius must be between 0 and half the size");
    expect(() =>
      Web.toSvgString({ value: "x", size: 4096, logoAreaBorderRadius: 2048 }),
    ).not.toThrow();
    expect(() =>
      Web.toSvgString({ value: "x", size: 4096, logoAreaBorderRadius: 2049 }),
    ).toThrow("logoAreaBorderRadius must be an integer between 0 and 2048");
    expect(() =>
      Web.toSvgString(webOptions({
        value: "x",
        foregroundColor: "bad",
      })),
    ).toThrow("foregroundColor must be");
    expect(() =>
      Web.toSvgString(webOptions({
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
      })),
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
      Web.toSvgString(webOptions({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          locations: [0],
        },
      })),
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
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          start: { x: 0, y: Number.POSITIVE_INFINITY },
        },
      }),
    ).toThrow("gradient.start.y must be");
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          end: { x: -1, y: 1 },
        },
      }),
    ).toThrow("gradient.end.x must be");
    expect(() =>
      Web.toSvgString({
        value: "x",
        gradient: {
          colors: ["#000000", "#FFFFFF"],
          end: { x: 1, y: 2 },
        },
      }),
    ).toThrow("gradient.end.y must be");
  });

  it("rejects missing async web canvas contexts", async () => {
    installCanvas(() => null);
    await expect(Web.toPngDataUriAsync({ value: "Hello" })).rejects.toThrow(
      "2D canvas",
    );
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

  it("reserves a transparent logo footprint on web PNG output", () => {
    const context = createMockContext();
    installCanvas(() => context);

    expect(
      Web.toPngDataUri({
        value: "Hello",
        size: 64,
        logoAreaSize: 12,
        logoAreaBorderRadius: 6,
      }),
    ).toBe("data:image/png;base64,web-png");

    expect(context.beginPath).toHaveBeenCalled();
    expect(context.quadraticCurveTo).toHaveBeenCalled();
    expect(context.fillRect).not.toHaveBeenCalledWith(26, 26, 12, 12);
    expect(context.restore).toHaveBeenCalled();
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

  it("renders the web Image-backed QR component", async () => {
    installCanvas();
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(Web.QRCode, {
          value: "Hello",
          size: 128,
          logo: React.createElement("logo"),
          shapeOptions: {
            shape: "circle",
            eyePatternShape: "rounded",
            eyeballShape: "rounded",
            gap: 1,
            cornerRadius: 2,
            eyePatternCornerRadius: 3,
          },
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
    await act(async () => {
      tree?.update(
        React.createElement(Web.QRCode, {
          value: "Hello",
          gradient: {
            colors: ["#000000", "#FFFFFF"],
            locations: [0, 1],
          },
          shapeOptions: { shape: "square", eyePatternGap: 1 },
        }),
      );
    });
    await act(async () => {
      await flushMacrotasks(50);
    });
  });

  it("calls onReady for web QR generation and can still export imperatively", async () => {
    const canvas = installCanvas();
    const onReady = jest.fn();
    const qrRef = React.createRef<QRCodeRef>();

    await act(async () => {
      TestRenderer.create(
        React.createElement(Web.QRCode, {
          ref: qrRef,
          value: "web-ready",
          onReady,
          placeholder: React.createElement("placeholder", undefined, "loading"),
        }),
      );
    });
    await act(async () => {
      await flushMacrotasks(50);
    });

    expect(canvas.toDataURL).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledWith("data:image/png;base64,web-png");
    expect(qrRef.current).not.toBeNull();
    expect(qrRef.current?.toPngDataUri()).toContain(
      "data:image/png;base64,web-png",
    );
    expect(qrRef.current?.toPngBase64()).toBe("web-png");
  });

  it("renders web component gradients with endpoints and default locations", async () => {
    installCanvas();
    const onReady = jest.fn();

    await act(async () => {
      TestRenderer.create(
        React.createElement(Web.QRCode, {
          value: "web-gradient-endpoints",
          gradient: {
            colors: ["#000000", "#FFFFFF"],
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
          },
          onReady,
        }),
      );
    });
    await act(async () => {
      await flushMacrotasks(50);
    });

    expect(onReady).toHaveBeenCalledWith("data:image/png;base64,web-png");
  });

  it("validates web scanability warnings and errors", () => {
    const scanable = Web.NitroQRCode.validateOptions({
      value: "https://example.com",
      size: 96,
      quietZone: 0,
      errorCorrectionLevel: "M",
      logoAreaSize: 40,
      foregroundColor: "#AABBCC80",
      backgroundColor: "#CCDDEE",
    });

    expect(scanable.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "too-small-size" }),
        expect.objectContaining({ code: "bad-quiet-zone" }),
        expect.objectContaining({ code: "logo-too-large" }),
        expect.objectContaining({ code: "low-ecl-for-logo" }),
        expect.objectContaining({ code: "low-contrast" }),
      ]),
    );
    expect(scanable.valid).toBe(true);
    expect(scanable.errors).toEqual([]);

    const invalid = Web.NitroQRCode.validateOptions({ value: "" });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toHaveLength(1);
    expect(invalid.errors[0]?.code).toBe("invalid");
    expect(invalid.errors[0]?.message).toContain("must not be empty");

    const invalidScanSafe = Web.NitroQRCode.validateOptions({
      value: "https://example.com",
      scanSafe: "always" as unknown as true,
    });
    expect(invalidScanSafe.valid).toBe(false);
    expect(invalidScanSafe.errors[0]?.message).toContain("scanSafe must be");

    expect(
      Web.NitroQRCode.validateOptions({
        value: "https://example.com",
        quietZone: 16,
      }).warnings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "bad-quiet-zone" }),
      ]),
    );

    const strict = Web.NitroQRCode.validateOptions({
      value: "https://example.com",
      size: 96,
      foregroundColor: "#AABBCC",
      backgroundColor: "#CCDDEE",
      scanSafe: "strict",
    });
    expect(strict.valid).toBe(false);
    expect(strict.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "too-small-size" }),
        expect.objectContaining({ code: "low-contrast" }),
      ]),
    );

    expect(
      Web.NitroQRCode.validateOptions({
        value: "https://example.com",
        size: 200,
        quietZone: 0,
        errorCorrectionLevel: "L",
        logoAreaSize: 50,
        scanSafe: true,
      }).warnings,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "bad-quiet-zone" }),
        expect.objectContaining({ code: "low-ecl-for-logo" }),
      ]),
    );
    expect(
      Web.NitroQRCode.validateOptions({
        value: "https://example.com",
        foregroundColor: "#000000",
        backgroundColor: "transparent",
      }).warnings,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "low-contrast" })]),
    );
  });

  it("surfaces web QR generation errors when no onError handler is provided", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(
          ErrorBoundary,
          undefined,
          React.createElement(Web.QRCode, { value: "" }),
        ),
      );
      await Promise.resolve();
    });

    if (tree === undefined) {
      throw new Error("Expected web QRCode test renderer to be created.");
    }
    expect(
      tree.root.find((node) => String(node.type) === "error-boundary").props
        .message,
    ).toContain("must not be empty");

    consoleErrorSpy.mockRestore();
  });

  it("routes web QR generation errors to onError when provided", async () => {
    const onError = jest.fn();

    await act(async () => {
      TestRenderer.create(
        React.createElement(Web.QRCode, {
          value: "",
          onError,
        }),
      );
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0]?.[0]?.message).toContain("must not be empty");
  });

  it("normalizes non-Error web generation failures", async () => {
    installCanvas(() => {
      throw "web-boom";
    });
    const onError = jest.fn();

    await act(async () => {
      TestRenderer.create(
        React.createElement(Web.QRCode, {
          value: "web-boom",
          onError,
        }),
      );
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0]?.[0]?.message).toBe("web-boom");
  });

  it("does not rerun web QR generation when callback identity changes", async () => {
    installCanvas();
    const firstReady = jest.fn();
    const secondReady = jest.fn();

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(Web.QRCode, {
          value: "web-stable-callbacks",
          onReady: firstReady,
        }),
      );
    });
    await act(async () => {
      await flushMacrotasks(50);
    });
    if (tree === undefined) {
      throw new Error("Expected web QRCode test renderer to be created.");
    }

    await act(async () => {
      tree?.update(
        React.createElement(Web.QRCode, {
          value: "web-stable-callbacks",
          onReady: secondReady,
        }),
      );
    });
    await act(async () => {
      await flushMacrotasks(50);
    });

    expect(firstReady).toHaveBeenCalledTimes(1);
    expect(secondReady).not.toHaveBeenCalled();
  });

  it("clears the previous web QR image when keepPreviousImage is false", async () => {
    installCanvas();
    let tree: TestRenderer.ReactTestRenderer | undefined;

    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(Web.QRCode, {
          value: "web-one",
          keepPreviousImage: false,
        }),
      );
    });
    await act(async () => {
      await flushMacrotasks(50);
    });
    if (tree === undefined) {
      throw new Error("Expected web QRCode test renderer to be created.");
    }

    await act(async () => {
      tree?.update(
        React.createElement(Web.QRCode, {
          value: "web-two",
          keepPreviousImage: false,
        }),
      );
    });
    await act(async () => {
      await flushMacrotasks(50);
    });

    expect(
      tree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,web-png",
      ),
    ).not.toHaveLength(0);
  });

  it("uses the default web component size", async () => {
    installCanvas();
    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(Web.QRCode, { value: "Hello" }),
      );
    });
    await act(async () => {
      await flushMacrotasks(50);
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
type ParityCorpusEntry = {
  value: string;
  ecl: string;
  minVersion: number;
  maxVersion: number;
  mask: number;
  boostEcl: boolean;
  size: number;
  packedBase64: string;
};

function readParityCorpus(): ParityCorpusEntry[] {
  const fixturePath = path.join(
    __dirname,
    "fixtures",
    "parity-corpus.json",
  );
  return JSON.parse(fs.readFileSync(fixturePath, "utf8")) as ParityCorpusEntry[];
}

function unpackMatrix(matrix: { size: number; packedBase64: string }) {
  const bytes = Buffer.from(matrix.packedBase64, "base64");
  const modules: boolean[] = [];
  for (const byte of bytes) {
    for (let bit = 0; bit < 8; bit++) {
      modules.push(((byte >> (7 - bit)) & 1) === 1);
    }
  }
  return modules;
}

function matrixToRgba(matrix: { size: number; packedBase64: string }) {
  const modules = unpackMatrix(matrix);
  const modulePixels = 8;
  const quietModules = 4;
  const width =
    (matrix.size + quietModules * 2) * modulePixels;
  const rgba = new Uint8ClampedArray(width * width * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = 255;
    rgba[index + 1] = 255;
    rgba[index + 2] = 255;
    rgba[index + 3] = 255;
  }
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!modules[y * matrix.size + x]) {
        continue;
      }
      for (let py = 0; py < modulePixels; py++) {
        for (let px = 0; px < modulePixels; px++) {
          const outX = (x + quietModules) * modulePixels + px;
          const outY = (y + quietModules) * modulePixels + py;
          const offset = (outY * width + outX) * 4;
          rgba[offset] = 0;
          rgba[offset + 1] = 0;
          rgba[offset + 2] = 0;
          rgba[offset + 3] = 255;
        }
      }
    }
  }
  return { rgba, width };
}

function decodeMatrix(matrix: { size: number; packedBase64: string }) {
  const { rgba, width } = matrixToRgba(matrix);
  return jsQR(rgba, width, width);
}

describe("encoder parity corpus", () => {
  const corpus = readParityCorpus();

  it("feeds the same corpus scenarios to the native adapter", () => {
    for (const entry of corpus) {
      const options = {
        value: entry.value,
        errorCorrectionLevel: entry.ecl as Web.ErrorCorrectionLevel,
        minVersion: entry.minVersion as Web.QRCodeVersion,
        maxVersion: entry.maxVersion as Web.QRCodeVersion,
        mask: entry.mask as Web.QRCodeMaskPattern,
        boostEcl: entry.boostEcl,
      };
      Web.getMatrix(options);
      toPngDataUri(options);
      const call = (mockHybridObject.generatePngDataUriObject.mock
        .calls as unknown[][]).at(-1)?.[0] as
        | {
            value?: string;
            errorCorrectionLevel?: string;
            minVersion?: number;
            maxVersion?: number;
            mask?: number;
            boostEcl?: boolean;
          }
        | undefined;
      expect(call?.value).toBe(entry.value);
      expect(call?.errorCorrectionLevel).toBe(entry.ecl);
      expect(call?.minVersion).toBe(entry.minVersion);
      expect(call?.maxVersion).toBe(entry.maxVersion);
      expect(call?.mask).toBe(entry.mask);
      expect(call?.boostEcl).toBe(entry.boostEcl);
    }
  });

  it("matches the committed native/web golden corpus on web", () => {
    for (const entry of corpus) {
      const options = {
        value: entry.value,
        errorCorrectionLevel: entry.ecl as Web.ErrorCorrectionLevel,
        minVersion: entry.minVersion as Web.QRCodeVersion,
        maxVersion: entry.maxVersion as Web.QRCodeVersion,
        mask: entry.mask as Web.QRCodeMaskPattern,
        boostEcl: entry.boostEcl,
      };
      const matrix = Web.getMatrix(options);
      expect({
        size: matrix.size,
        packedBase64: matrix.packedBase64,
      }).toEqual({
        size: entry.size,
        packedBase64: entry.packedBase64,
      });
    }
  });

  it("decode-backs every corpus entry including UTF-8, numeric, and alphanumeric", () => {
    for (const entry of corpus) {
      const decoded = decodeMatrix({
        size: entry.size,
        packedBase64: entry.packedBase64,
      });
      expect(decoded).not.toBeNull();
      expect(decoded?.data).toBe(entry.value);
    }
  });

  it("decode-backs a high-error-correction matrix with a logo hole", () => {
    const matrix = Web.getMatrix({
      value: "https://example.com/logo-scan",
      errorCorrectionLevel: "H",
      mask: 2,
    });
    const { rgba, width } = matrixToRgba(matrix);
    const holeModules = Math.round(matrix.size * 0.3);
    const holeStart = (matrix.size - holeModules) / 2;
    const holeEnd = holeStart + holeModules;
    const modulePixels = 8;
    const quietModules = 4;
    for (let y = holeStart; y < holeEnd; y++) {
      for (let x = holeStart; x < holeEnd; x++) {
        for (let py = 0; py < modulePixels; py++) {
          for (let px = 0; px < modulePixels; px++) {
            const outX = (x + quietModules) * modulePixels + px;
            const outY = (y + quietModules) * modulePixels + py;
            const offset = (outY * width + outX) * 4;
            rgba[offset] = 255;
            rgba[offset + 1] = 255;
            rgba[offset + 2] = 255;
            rgba[offset + 3] = 255;
          }
        }
      }
    }
    const decoded = jsQR(rgba, width, width);
    expect(decoded?.data).toBe("https://example.com/logo-scan");
  });

  it("honors boostEcl on web by boosting to the highest fitting level", () => {
    const options = {
      value: "boost tiny",
      errorCorrectionLevel: "L" as Web.ErrorCorrectionLevel,
    };
    const boosted = Web.getMatrix({ ...options, boostEcl: true });
    const unboosted = Web.getMatrix({ ...options, boostEcl: false });
    expect(boosted.packedBase64).not.toBe(unboosted.packedBase64);
    const corpusEntry = corpus.find(
      (entry) =>
        entry.value === "boost tiny" &&
        entry.ecl === "L" &&
        entry.boostEcl === true,
    );
    expect(boosted.packedBase64).toBe(corpusEntry?.packedBase64);
    expect(Web.getMatrix({ ...options, boostEcl: false }).packedBase64).toBe(
      corpus.find(
        (entry) =>
          entry.value === "boost tiny" &&
          entry.ecl === "L" &&
          entry.boostEcl === false,
      )?.packedBase64,
    );
  });

  it("keeps the requested error correction level when boosting is impossible", () => {
    const unboosted = Web.getMatrix({
      value: "hello, world!",
      errorCorrectionLevel: "M",
      mask: 0,
      boostEcl: false,
    });
    const boosted = Web.getMatrix({
      value: "hello, world!",
      errorCorrectionLevel: "M",
      mask: 0,
      boostEcl: true,
    });
    const corpusEntry = corpus.find(
      (entry) =>
        entry.value === "hello, world!" && entry.ecl === "M" && entry.mask === 0,
    );
    expect(corpusEntry?.boostEcl).toBe(true);
    expect(boosted.packedBase64).toBe(corpusEntry?.packedBase64);
    expect(boosted.packedBase64).toBe(unboosted.packedBase64);
  });
});

describe("web transparent and geometry rendering", () => {
  it("clears transparent web PNG backgrounds instead of filling black", () => {
    const context = createMockContext();
    installCanvas(() => context);

    expect(
      Web.toPngDataUri({
        value: "Hello",
        size: 64,
        backgroundColor: "transparent",
      }),
    ).toBe("data:image/png;base64,web-png");

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 64, 64);
    expect(context.fillStyle).not.toBe("transparent");
  });

  it("fills opaque web PNG backgrounds with the background color", () => {
    const context = createMockContext();
    installCanvas(() => context);
    let fillStyleAtBackground: unknown = null;
    context.fillRect.mockImplementation((x, y, width, height) => {
      if (x === 0 && y === 0 && width === 64 && height === 64) {
        fillStyleAtBackground = context.fillStyle;
      }
    });

    Web.toPngDataUri({ value: "Hello", size: 64 });

    expect(context.clearRect).not.toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 64, 64);
    expect(fillStyleAtBackground).toBe("#FFFFFF");
  });

  it("clamps the web canvas to the module grid like native output", () => {
    const canvas = installCanvas();

    Web.toPngDataUri({ value: "Hello", size: 8 });
    expect(canvas.width).toBe(29);
    expect(canvas.height).toBe(29);

    Web.clearQRCodeCache();
    Web.toPngDataUri({ value: "Hello", size: 64 });
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
  });

  it("draws circle modules as inscribed ellipses matching native geometry", () => {
    const context = createMockContext();
    installCanvas(() => context);

    Web.toPngDataUri({
      value: "Hello",
      size: 64,
      shapeOptions: { shape: "circle", eyeFrameShape: "circle" },
    });

    expect(context.ellipse).toHaveBeenCalled();
    for (const call of context.ellipse.mock.calls) {
      const [centerX, centerY, radiusX, radiusY, rotation, startAngle, endAngle] =
        call;
      expect(centerX).toBeGreaterThanOrEqual(0);
      expect(centerY).toBeGreaterThanOrEqual(0);
      expect(radiusX).toBeGreaterThan(0);
      expect(radiusY).toBeGreaterThan(0);
      expect(rotation).toBe(0);
      expect(startAngle).toBe(0);
      expect(endAngle).toBe(Math.PI * 2);
    }
  });
});
});
