import {
  getQRCodeMetrics,
  isQRCodeMetricsEnabled,
  nowMilliseconds,
  recordCacheLookup,
  recordGenerationRequest,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
} from "../metrics";

const mockHybridObject = {
  generatePngBase64: jest.fn(() => "png-base64"),
  generatePngBase64Object: jest.fn(() => "png-base64"),
  generatePngBase64Async: jest.fn(async () => "png-base64"),
  generatePngBase64AsyncObject: jest.fn(async () => "png-base64"),
  generatePngDataUri: jest.fn(() => "data:image/png;base64,png-base64"),
  generatePngDataUriObject: jest.fn(() => "data:image/png;base64,png-base64"),
  generatePngDataUriAsync: jest.fn(
    async () => "data:image/png;base64,png-base64",
  ),
  generatePngDataUriAsyncObject: jest.fn(
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

import {
  clearQRCodeCache,
  getQRCodeMetrics as nativeGetQRCodeMetrics,
  NitroQRCode,
  resetQRCodeMetrics as nativeResetQRCodeMetrics,
  setQRCodeMetricsEnabled as nativeSetQRCodeMetricsEnabled,
  toPngBase64,
  toPngBase64Async,
} from "../index";
import * as Web from "../index.web";

describe("generation metrics", () => {
  afterEach(() => {
    setQRCodeMetricsEnabled(false);
    resetQRCodeMetrics();
  });

  it("records sync and async native requests with timing and failures", async () => {
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();

    toPngBase64({ value: "metrics-sync" });
    await toPngBase64Async({ value: "metrics-async" });

    const snapshot = getQRCodeMetrics();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.requests).toBe(2);
    expect(snapshot.asyncRequests).toBe(1);
    expect(snapshot.failedRequests).toBe(0);
    expect(snapshot.lastGenerationMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.totalGenerationMs).toBeGreaterThanOrEqual(
      snapshot.lastGenerationMs ?? 0,
    );
  });

  it("handles disabled and failed native generation paths", async () => {
    setQRCodeMetricsEnabled(false);
    resetQRCodeMetrics();
    expect(toPngBase64({ value: "metrics-disabled" })).toBe("png-base64");
    await toPngBase64Async({ value: "metrics-disabled-async" });
    expect(getQRCodeMetrics().requests).toBe(0);

    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();
    mockHybridObject.generatePngBase64Object.mockImplementationOnce(() => {
      throw new Error("native-metrics-fail");
    });
    expect(() => toPngBase64({ value: "metrics-failing" })).toThrow(
      "native-metrics-fail",
    );
    const snapshot = getQRCodeMetrics();
    expect(snapshot.requests).toBe(1);
    expect(snapshot.failedRequests).toBe(1);
  });

  it("is disabled by default outside development and reports zeroed state", () => {
    setQRCodeMetricsEnabled(false);
    resetQRCodeMetrics();
    const snapshot = getQRCodeMetrics();
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.requests).toBe(0);
    expect(snapshot.cacheHits).toBe(0);
    expect(snapshot.cacheMisses).toBe(0);
    expect(snapshot.cacheBytes).toBe(0);
    expect(snapshot.lastGenerationMs).toBeUndefined();
    expect(isQRCodeMetricsEnabled()).toBe(false);
  });

  it("does not record while disabled", () => {
    setQRCodeMetricsEnabled(false);
    resetQRCodeMetrics();
    recordGenerationRequest({ async: false, durationMs: 5, failed: false });
    recordCacheLookup(true);
    expect(getQRCodeMetrics().requests).toBe(0);
    expect(getQRCodeMetrics().cacheBytes).toBe(0);
  });

  it("tracks cache lookups and byte counts on web", () => {
    clearQRCodeCache();
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();

    Web.toSvgString({ value: "web-metrics" });
    Web.toSvgString({ value: "web-metrics" });

    const snapshot = Web.NitroQRCode.getQRCodeMetrics();
    expect(snapshot.cacheMisses).toBe(1);
    expect(snapshot.cacheHits).toBe(1);
    expect(snapshot.cacheBytes).toBeGreaterThan(0);
  });

  it("measures and counts failed web generations", () => {
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: jest.fn(() => ({
          width: 0,
          height: 0,
          getContext: jest.fn(() => null),
          toDataURL: jest.fn(() => "data:image/png;base64,web-png"),
        })),
      },
    });

    expect(() => Web.toPngDataUri({ value: "web-fail" })).toThrow(
      "2D canvas",
    );

    const snapshot = Web.NitroQRCode.getQRCodeMetrics();
    expect(snapshot.failedRequests).toBe(1);
    expect(snapshot.requests).toBe(1);

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  });

  it("does not count validation failures as generation requests", () => {
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();

    expect(() => Web.toSvgString({ value: "" })).toThrow("must not be empty");

    expect(Web.NitroQRCode.getQRCodeMetrics().requests).toBe(0);
  });

  it("exposes metrics through the native entry and NitroQRCode API", () => {
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();
    toPngBase64({ value: "metrics-api" });

    expect(nativeGetQRCodeMetrics().requests).toBe(1);
    expect(NitroQRCode.getQRCodeMetrics().requests).toBe(1);
    NitroQRCode.resetQRCodeMetrics();
    expect(NitroQRCode.getQRCodeMetrics().requests).toBe(0);
    NitroQRCode.setQRCodeMetricsEnabled(false);
    expect(nativeGetQRCodeMetrics().enabled).toBe(false);
    nativeSetQRCodeMetricsEnabled(true);
    expect(nativeGetQRCodeMetrics().enabled).toBe(true);
    nativeResetQRCodeMetrics();
  });

  it("defaults to disabled when __DEV__ is not a boolean global", () => {
    const originalDev = (globalThis as { __DEV__?: unknown }).__DEV__;
    Object.defineProperty(globalThis, "__DEV__", {
      configurable: true,
      value: undefined,
    });
    jest.isolateModules(() => {
      const fresh = jest.requireActual("../metrics") as typeof import("../metrics");
      expect(fresh.isQRCodeMetricsEnabled()).toBe(false);
      fresh.setQRCodeMetricsEnabled(true);
      expect(fresh.isQRCodeMetricsEnabled()).toBe(true);
      fresh.resetQRCodeMetrics();
    });
    Object.defineProperty(globalThis, "__DEV__", {
      configurable: true,
      value: originalDev,
    });
  });

  it("exposes metrics helpers through the web entry", () => {
    Web.setQRCodeMetricsEnabled(true);
    Web.resetQRCodeMetrics();
    Web.toSvgString({ value: "web-entry-metrics" });
    expect(Web.getQRCodeMetrics().requests).toBe(1);
    Web.setQRCodeMetricsEnabled(false);
  });

  it("measures elapsed time with a monotonic clock", () => {
    const start = nowMilliseconds();
    expect(nowMilliseconds()).toBeGreaterThanOrEqual(start);
  });

  it("falls back to Date.now when performance is unavailable", () => {
    const originalPerformance = globalThis.performance;
    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      value: undefined,
    });
    expect(nowMilliseconds()).toBeGreaterThanOrEqual(0);
    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      value: originalPerformance,
    });
  });

  it("skips web measurement and cache bytes while disabled", async () => {
    setQRCodeMetricsEnabled(false);
    resetQRCodeMetrics();
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: jest.fn(() => ({
          width: 0,
          height: 0,
          getContext: jest.fn(() => ({
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
            createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
            createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
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
          })),
          toDataURL: jest.fn(() => "data:image/png;base64,web-png"),
        })),
      },
    });
    clearQRCodeCache();

    expect(Web.toPngDataUri({ value: "web-disabled" })).toBe(
      "data:image/png;base64,web-png",
    );
    await Web.toPngDataUriAsync({ value: "web-disabled-async" });
    expect(Web.NitroQRCode.getQRCodeMetrics().enabled).toBe(false);
    expect(Web.NitroQRCode.getQRCodeMetrics().requests).toBe(0);

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  });
});
