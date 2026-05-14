import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockHybridObject = {
  generatePngBase64: jest.fn(() => "png-base64"),
  generatePngBase64Async: jest.fn(async () => "png-base64"),
  generatePngDataUri: jest.fn(() => "data:image/png;base64,png-base64"),
  generatePngDataUriAsync: jest.fn(
    async () => "data:image/png;base64,png-base64",
  ),
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
  getQRCodeCacheSize,
  NitroQRCode,
  QRCode,
  type QRCodeRef,
  toPngBase64,
  toPngBase64Async,
  toPngDataUri,
  toPngDataUriAsync,
  toSvgString,
} from "../index";
import * as Web from "../index.web";

describe("native QRCode API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHybridObject.generatePngBase64Async.mockImplementation(
      async () => "png-base64",
    );
    mockHybridObject.generatePngDataUriAsync.mockImplementation(
      async () => "data:image/png;base64,png-base64",
    );
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
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      1,
      40,
      -1,
      true,
      "square",
      "square",
      "square",
      0,
      0,
      "dense",
      -1,
      -1,
      "matrix",
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
    expect(mockHybridObject.generatePngDataUri).toHaveBeenCalledWith(
      "Hello",
      256,
      2,
      "H",
      "#111111",
      "#EEEEEE",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      2,
      8,
      3,
      false,
      "rounded",
      "rounded",
      "rounded",
      2,
      1,
      "balanced",
      3,
      4,
      "matrix",
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
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      1,
      40,
      -1,
      true,
      "square",
      "square",
      "square",
      0,
      0,
      "dense",
      -1,
      -1,
      "matrix",
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

    expect(mockHybridObject.generatePngBase64).toHaveBeenLastCalledWith(
      "layers",
      512,
      4,
      "M",
      "#000000",
      "#FFFFFF",
      "#FF0000FF",
      "#111111",
      "#333333",
      "#555555",
      1,
      40,
      -1,
      true,
      "square",
      "square",
      "square",
      0,
      0,
      "dense",
      -1,
      -1,
      "matrix",
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

  it("exposes async PNG helpers through the native bridge", async () => {
    await expect(toPngBase64Async({ value: "async" })).resolves.toBe(
      "png-base64",
    );
    await expect(toPngDataUriAsync({ value: "async" })).resolves.toBe(
      "data:image/png;base64,png-base64",
    );
    expect(mockHybridObject.generatePngBase64Async).toHaveBeenCalled();
    expect(mockHybridObject.generatePngDataUriAsync).toHaveBeenCalled();
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

    expect(mockHybridObject.generatePngBase64).toHaveBeenLastCalledWith(
      "radial",
      512,
      4,
      "M",
      "#000000",
      "#FFFFFF",
      "#000000",
      "#000000",
      "#000000",
      "#000000",
      1,
      40,
      -1,
      true,
      "square",
      "square",
      "square",
      0,
      0,
      "dense",
      -1,
      -1,
      "matrix",
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

  it("keeps the orbit prop on the scan-safe native matrix layout", () => {
    toPngBase64({ value: "orbit", orbit: true });
    const calls = mockHybridObject.generatePngBase64.mock.calls as unknown[][];
    expect(calls.at(-1)?.[22]).toBe("matrix");
  });

  it("hardens native output when scanSafe is enabled", () => {
    toPngBase64({
      value: "scan-safe",
      quietZone: 0,
      errorCorrectionLevel: "L",
      logoAreaSize: 32,
      scanSafe: true,
    });

    const calls = mockHybridObject.generatePngBase64.mock.calls as unknown[][];
    const lastCall = calls.at(-1);
    expect(lastCall?.[2]).toBe(4);
    expect(lastCall?.[3]).toBe("H");
  });

  it("generates SVG and matrix output", () => {
    expect(toSvgString({ value: "Hello" })).toBe("<svg />");
    expect(getMatrix({ value: "Hello" })).toEqual({
      size: 21,
      packedBase64: "matrix-base64",
    });
  });

  it("normalizes native error-correction aliases and colors", () => {
    toPngBase64({
      value: "low",
      errorCorrectionLevel: "low",
      foregroundColor: "#abcdef",
    });
    toPngBase64({ value: "medium", errorCorrectionLevel: "medium" });
    toPngBase64({ value: "quartile", errorCorrectionLevel: "quartile" });

    const calls = mockHybridObject.generatePngBase64.mock.calls as unknown[][];
    expect(calls.map((call) => call[3])).toEqual(["L", "M", "Q"]);
    expect(calls[0][4]).toBe("#ABCDEF");
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
    expect(() =>
      toPngBase64({ value: "x", minVersion: 3, maxVersion: 2 }),
    ).toThrow("minVersion and maxVersion");
    expect(() => toPngBase64({ value: "x", mask: 8 })).toThrow("mask must be");
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
      toPngBase64({
        value: "x",
        gradient: {
          colors: ["#000000", "nope"],
        },
      }),
    ).toThrow("gradient.colors[1] must be");
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
    const logoView = currentTree.root.findAll(
      (node) => node.props.pointerEvents === "none",
    )[0];
    expect(logoView.props.style).toEqual(
      expect.arrayContaining([
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
    const backgroundLogoView = currentTree.root.findAll(
      (node) => node.props.pointerEvents === "none",
    )[0];
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
    const defaultLogoView = currentTree.root.findAll(
      (node) => node.props.pointerEvents === "none",
    )[0];
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

  it("renders a placeholder instead of the logo while the async QR is pending", async () => {
    const pending = createDeferred<string>();
    mockHybridObject.generatePngDataUriAsync.mockImplementationOnce(
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
    mockHybridObject.generatePngDataUriAsync
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
    mockHybridObject.generatePngDataUriAsync
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
    mockHybridObject.generatePngDataUriAsync.mockImplementationOnce(
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
      mockHybridObject.generatePngDataUriAsync.mock.calls.length;

    await act(async () => {
      tree?.update(
        React.createElement(QRCode, {
          value: "stable-callbacks",
          onReady: secondReady,
        }),
      );
      await Promise.resolve();
    });

    expect(mockHybridObject.generatePngDataUriAsync).toHaveBeenCalledTimes(
      callsAfterInitialRender,
    );
    expect(firstReady).toHaveBeenCalledTimes(1);
    expect(secondReady).not.toHaveBeenCalled();
  });

  it("routes async native generation errors to onError when provided", async () => {
    const pending = createDeferred<never>();
    mockHybridObject.generatePngDataUriAsync.mockImplementationOnce(
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
    expect(mockHybridObject.generatePngDataUri).toHaveBeenCalled();
    expect(mockHybridObject.generatePngBase64).toHaveBeenCalled();
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
    expect(scanable.errors).toEqual([]);

    const invalid = NitroQRCode.validateOptions({ value: "" });
    expect(invalid.errors).toHaveLength(1);
    expect(invalid.errors[0]?.code).toBe("invalid");
    expect(invalid.errors[0]?.message).toContain("must not be empty");

    const invalidScanSafe = NitroQRCode.validateOptions({
      value: "https://example.com",
      scanSafe: "always" as unknown as true,
    });
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
  });

  it("ignores async completions after the component unmounts", async () => {
    const success = createDeferred<string>();
    const failure = createDeferred<string>();
    mockHybridObject.generatePngDataUriAsync
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

    expect(mockHybridObject.generatePngDataUriAsync).toHaveBeenCalledTimes(2);
  });

  it("surfaces async QR generation errors", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockHybridObject.generatePngDataUriAsync.mockImplementationOnce(() =>
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
    mockHybridObject.generatePngDataUriAsync.mockImplementationOnce(() =>
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
    fillStyle: string | MockGradient;
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
      fillStyle: "",
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
    expect(Web.toPngBase64({ value: "Hello orbit prop", orbit: true })).toBe(
      "web-png",
    );
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
    expect(() =>
      Web.toSvgString({ value: "x", minVersion: 3, maxVersion: 2 }),
    ).toThrow("minVersion and maxVersion");
    expect(() => Web.toSvgString({ value: "x", mask: 8 })).toThrow(
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
    act(() => {
      tree?.update(
        React.createElement(Web.QRCode, {
          value: "Hello",
          shapeOptions: { shape: "square", eyePatternGap: 1 },
        }),
      );
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
      await Promise.resolve();
    });

    expect(canvas.toDataURL).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledWith("data:image/png;base64,web-png");
    expect(qrRef.current).not.toBeNull();
    expect(qrRef.current?.toPngDataUri()).toContain(
      "data:image/png;base64,web-png",
    );
    expect(qrRef.current?.toPngBase64()).toBe("web-png");
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
    expect(scanable.errors).toEqual([]);

    const invalid = Web.NitroQRCode.validateOptions({ value: "" });
    expect(invalid.errors).toHaveLength(1);
    expect(invalid.errors[0]?.code).toBe("invalid");
    expect(invalid.errors[0]?.message).toContain("must not be empty");

    const invalidScanSafe = Web.NitroQRCode.validateOptions({
      value: "https://example.com",
      scanSafe: "always" as unknown as true,
    });
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
      await Promise.resolve();
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
      await Promise.resolve();
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
      await Promise.resolve();
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
      await Promise.resolve();
    });

    expect(
      tree.root.findAll(
        (node) => node.props.source?.uri === "data:image/png;base64,web-png",
      ),
    ).not.toHaveLength(0);
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
