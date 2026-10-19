import {
  NitroQRCode,
  PRESET_SHAPE_OPTIONS,
  clearQRCodeCache,
  getQRCodeCacheBytes,
  getQRCodeCacheSize,
  getQRCodeMetrics,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
  toPngArrayBuffer,
  toPngArrayBufferAsync,
  toPngBase64,
  toPngBase64Async,
  toPngDataUri,
  toPngDataUriAsync,
  toSvgString,
  getMatrix,
  type QRCodeBodyShape,
  type QRCodeOptions,
  type QRCodePreset,
} from "react-native-nitro-qrcode";
import { PRESETS } from "./presets";

const SHAPES: readonly QRCodeBodyShape[] = [
  "square",
  "circle",
  "rounded",
  "diamond",
  "squircle",
  "classy",
];

const ECLS = ["L", "M", "Q", "H"] as const;
const DENSITIES = ["sparse", "balanced", "dense"] as const;
const COLOR_MODES = ["solid", "linear", "radial"] as const;
const CACHE_MAX_ENTRIES = 128;
const CACHE_MAX_BYTES = 4 * 1024 * 1024;

type ComboGroup = "shapes" | "core" | "errors";

type ComboCase = {
  id: string;
  group: ComboGroup;
  options: QRCodeOptions;
  expectError?: boolean;
};

type ComboFailure = {
  id: string;
  method: string;
  message: string;
};

export type ComboReport = {
  total: number;
  ok: number;
  failed: number;
  elapsedMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  cacheEntries: number;
  cacheBytes: number;
  heapBefore?: number;
  heapAfter?: number;
  heapDelta?: number;
  raceOk: boolean;
  leakOk: boolean;
  failures: ComboFailure[];
  metrics: ReturnType<typeof getQRCodeMetrics>;
};

type VisualSpecimen = {
  id: string;
  label: string;
  options: QRCodeOptions;
  preset?: QRCodePreset;
  logo?: boolean;
};

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function heapUsed(): number | undefined {
  const memory = (
    globalThis.performance as { memory?: { usedJSHeapSize?: number } } | undefined
  )?.memory;
  return memory?.usedJSHeapSize;
}

function percentile(samples: number[], fraction: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index]!;
}

function checkPngBase64(output: unknown): string | undefined {
  return typeof output === "string" && output.startsWith("iVBOR")
    ? undefined
    : "not a PNG base64 payload";
}

function checkPngUri(output: unknown): string | undefined {
  return typeof output === "string" &&
    output.startsWith("data:image/png;base64,iVBOR")
    ? undefined
    : "not a PNG data URI";
}

function checkPngBuffer(output: unknown): string | undefined {
  if (!(output instanceof ArrayBuffer)) {
    return "not a PNG ArrayBuffer";
  }
  const bytes = new Uint8Array(output);
  return bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
    ? undefined
    : "not a PNG ArrayBuffer";
}

function checkSvg(output: unknown): string | undefined {
  return String(output).includes("<svg") ? undefined : "not an SVG document";
}

function checkMatrix(output: unknown): string | undefined {
  const matrix = output as { size?: number; packedBase64?: string } | undefined;
  return matrix !== undefined &&
    typeof matrix.size === "number" &&
    matrix.size >= 21 &&
    typeof matrix.packedBase64 === "string" &&
    matrix.packedBase64.length > 0
    ? undefined
    : `invalid matrix ${matrix?.size}`;
}

function applyColorMode(
  options: QRCodeOptions,
  mode: (typeof COLOR_MODES)[number],
): QRCodeOptions {
  if (mode === "linear") {
    return {
      ...options,
      gradient: { type: "linear", colors: ["#111827", "#4338CA"] },
    };
  }
  if (mode === "radial") {
    return {
      ...options,
      gradient: { type: "radial", colors: ["#0F172A", "#0F766E"] },
    };
  }
  return options;
}

function buildGenerationCases(): ComboCase[] {
  const cases: ComboCase[] = [];

  for (const shape of SHAPES) {
    for (const eyeFrameShape of SHAPES) {
      for (const eyeballShape of SHAPES) {
        for (const alignmentShape of SHAPES) {
          for (const timingShape of SHAPES) {
            cases.push({
              id: `shape:${shape}/${eyeFrameShape}/${eyeballShape}/${alignmentShape}/${timingShape}`,
              group: "shapes",
              options: {
                value: `shape-${shape}-${eyeFrameShape}-${eyeballShape}-${alignmentShape}-${timingShape}`,
                size: 96,
                shapeOptions: {
                  shape,
                  eyeFrameShape,
                  eyeballShape,
                  alignmentShape,
                  timingShape,
                },
              },
            });
          }
        }
      }
    }
  }

  for (const preset of PRESETS) {
    for (const logo of [false, true]) {
      for (const colorMode of COLOR_MODES) {
        for (const ecl of ECLS) {
          cases.push({
            id: `preset:${preset}:logo=${logo}:${colorMode}:${ecl}`,
            group: "core",
            options: applyColorMode(
              {
                value: `preset-${preset}-${colorMode}-${ecl}-${logo ? "logo" : "plain"}`,
                size: 128,
                errorCorrectionLevel: ecl,
                logoAreaSize: logo ? 36 : 0,
                logoAreaBorderRadius: logo ? 8 : 0,
                shapeOptions: PRESET_SHAPE_OPTIONS[preset],
              },
              colorMode,
            ),
          });
        }
      }
    }
  }

  const payloads: readonly { id: string; value: string }[] = [
    { id: "short", value: "Hi" },
    { id: "url", value: "https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode" },
    { id: "unicode", value: "QR · 日本語 · café · 😀" },
    { id: "numeric", value: "12345678901234567890" },
    { id: "long", value: `https://nitro.dev/combo?${"abcd0123".repeat(40)}` },
  ];
  for (const payload of payloads) {
    for (const size of [64, 128, 256] as const) {
      cases.push({
        id: `payload:${payload.id}:${size}`,
        group: "core",
        options: { value: payload.value, size, errorCorrectionLevel: "H" },
      });
    }
  }

  for (const quietZone of [0, 2, 4, 8] as const) {
    cases.push({
      id: `quiet:${quietZone}`,
      group: "core",
      options: { value: `quiet-${quietZone}`, size: 128, quietZone },
    });
  }

  for (const scanSafe of [false, true, "strict"] as const) {
    cases.push({
      id: `scan:${String(scanSafe)}`,
      group: "core",
      options: {
        value: `scan-${String(scanSafe)}`,
        size: 128,
        scanSafe,
        foregroundColor: "#111827",
        backgroundColor: "#FFFFFF",
      },
    });
  }

  for (const density of DENSITIES) {
    cases.push({
      id: `density:${density}`,
      group: "core",
      options: {
        value: `density-${density}`,
        size: 128,
        shapeOptions: { bodyDensity: density, shape: "rounded" },
      },
    });
  }

  for (const mask of [-1, 0, 1, 2, 3, 4, 5, 6, 7] as const) {
    cases.push({
      id: `mask:${mask}`,
      group: "core",
      options: { value: `mask-${mask}`, size: 96, mask },
    });
  }

  cases.push(
    {
      id: "regions:custom",
      group: "core",
      options: {
        value: "regions-custom",
        size: 160,
        errorCorrectionLevel: "H",
        foregroundColor: "#111827",
        backgroundColor: "#FFFFFF",
        alignmentColor: "#B45309",
        timingColor: "#0F766E",
        quietZoneColor: "#E2E8F0",
        finderInnerColor: "#FFF7ED",
        eyeColor: "#1E40AF",
        eyeballColor: "#0F172A",
        shapeOptions: {
          shape: "classy",
          eyeFrameShape: "rounded",
          eyeballShape: "circle",
          alignmentShape: "diamond",
          timingShape: "circle",
        },
      },
    },
    {
      id: "transparent:light",
      group: "core",
      options: {
        value: "transparent-light",
        size: 128,
        backgroundColor: "transparent",
      },
    },
    {
      id: "transparent:dark",
      group: "core",
      options: {
        value: "transparent-dark",
        size: 128,
        foregroundColor: "#FFFFFF",
        backgroundColor: "transparent",
      },
    },
    {
      id: "error:empty",
      group: "errors",
      expectError: true,
      options: { value: "", size: 96 },
    },
    {
      id: "error:strict-contrast",
      group: "errors",
      expectError: true,
      options: {
        value: "low-contrast",
        size: 96,
        foregroundColor: "#EEEEEE",
        backgroundColor: "#FFFFFF",
        scanSafe: "strict",
      },
    },
  );

  return cases;
}

export function buildVisualSpecimens(): VisualSpecimen[] {
  const specimens: VisualSpecimen[] = [];

  for (const preset of PRESETS) {
    specimens.push(
      {
        id: `${preset}-plain`,
        label: `${preset} · no logo`,
        options: {
          value: `visual-${preset}`,
          size: 112,
        },
        preset,
      },
      {
        id: `${preset}-logo`,
        label: `${preset} · logo`,
        options: {
          value: `visual-${preset}-logo`,
          size: 112,
          errorCorrectionLevel: "H",
          logoAreaSize: 28,
          logoAreaBorderRadius: 6,
        },
        preset,
        logo: true,
      },
    );
  }

  for (const shape of SHAPES) {
    specimens.push({
      id: `body-${shape}`,
      label: `body ${shape}`,
      options: {
        value: `body-${shape}`,
        size: 96,
        shapeOptions: { shape },
      },
    });
  }

  for (const eyeFrameShape of SHAPES) {
    specimens.push({
      id: `eye-${eyeFrameShape}`,
      label: `eye ${eyeFrameShape}`,
      options: {
        value: `eye-${eyeFrameShape}`,
        size: 96,
        shapeOptions: { eyeFrameShape, eyeballShape: "square" },
      },
    });
  }

  for (const alignmentShape of SHAPES) {
    specimens.push({
      id: `align-${alignmentShape}`,
      label: `align ${alignmentShape}`,
      options: {
        value: `align-${alignmentShape}-payload-for-version`,
        size: 96,
        errorCorrectionLevel: "H",
        alignmentColor: "#B45309",
        shapeOptions: { alignmentShape, shape: "square" },
      },
    });
  }

  for (const timingShape of SHAPES) {
    specimens.push({
      id: `timing-${timingShape}`,
      label: `timing ${timingShape}`,
      options: {
        value: `timing-${timingShape}`,
        size: 96,
        timingColor: "#0F766E",
        shapeOptions: { timingShape, shape: "square" },
      },
    });
  }

  specimens.push(
    {
      id: "linear",
      label: "linear gradient",
      options: {
        value: "visual-linear",
        size: 112,
        gradient: { type: "linear", colors: ["#111827", "#4338CA"] },
      },
    },
    {
      id: "radial",
      label: "radial gradient",
      options: {
        value: "visual-radial",
        size: 112,
        gradient: { type: "radial", colors: ["#0F172A", "#075985"] },
      },
    },
    {
      id: "regions",
      label: "custom regions",
      options: {
        value: "visual-regions-version-enough",
        size: 112,
        errorCorrectionLevel: "H",
        alignmentColor: "#B45309",
        timingColor: "#0F766E",
        quietZoneColor: "#E2E8F0",
        finderInnerColor: "#FFF7ED",
        eyeColor: "#1E40AF",
        eyeballColor: "#0F172A",
        shapeOptions: {
          shape: "classy",
          alignmentShape: "diamond",
          timingShape: "circle",
        },
      },
    },
    {
      id: "unicode",
      label: "unicode",
      options: { value: "QR · 日本語 · café", size: 96 },
    },
    {
      id: "transparent",
      label: "transparent bg",
      options: {
        value: "visual-transparent",
        size: 96,
        backgroundColor: "transparent",
      },
    },
  );

  return specimens;
}

const EVERY_GROUP: readonly ComboGroup[] = ["shapes", "core", "errors"];
const FULL_GROUPS: readonly ComboGroup[] = ["core", "errors"];
const CORE_GROUP: readonly ComboGroup[] = ["core"];

type OutputMethod = {
  name: string;
  async: boolean;
  groups: readonly ComboGroup[];
  run: (options: QRCodeOptions) => unknown;
  check: (output: unknown) => string | undefined;
};

const METHODS: readonly OutputMethod[] = [
  { name: "png-b64", async: false, groups: EVERY_GROUP, run: toPngBase64, check: checkPngBase64 },
  { name: "png-uri", async: false, groups: FULL_GROUPS, run: toPngDataUri, check: checkPngUri },
  { name: "png-buf", async: false, groups: FULL_GROUPS, run: toPngArrayBuffer, check: checkPngBuffer },
  { name: "svg", async: false, groups: FULL_GROUPS, run: toSvgString, check: checkSvg },
  { name: "matrix", async: false, groups: EVERY_GROUP, run: getMatrix, check: checkMatrix },
  { name: "png-b64-async", async: true, groups: CORE_GROUP, run: toPngBase64Async, check: checkPngBase64 },
  { name: "png-uri-async", async: true, groups: CORE_GROUP, run: toPngDataUriAsync, check: checkPngUri },
  { name: "png-buf-async", async: true, groups: CORE_GROUP, run: toPngArrayBufferAsync, check: checkPngBuffer },
];

function failureFor(
  method: OutputMethod,
  id: string,
  expectError: boolean | undefined,
  output: unknown,
): ComboFailure | undefined {
  if (expectError === true) {
    return { id, method: method.name, message: "expected error, got success" };
  }
  const message = method.check(output);
  return message === undefined ? undefined : { id, method: method.name, message };
}

function failureFromError(
  method: OutputMethod,
  id: string,
  expectError: boolean | undefined,
  error: unknown,
): ComboFailure | undefined {
  if (expectError === true) {
    return undefined;
  }
  return {
    id,
    method: method.name,
    message: error instanceof Error ? error.message : String(error),
  };
}

function assertOutput(
  method: OutputMethod,
  current: ComboCase,
): ComboFailure | undefined {
  try {
    return failureFor(method, current.id, current.expectError, method.run(current.options));
  } catch (error) {
    return failureFromError(method, current.id, current.expectError, error);
  }
}

async function assertOutputAsync(
  method: OutputMethod,
  current: ComboCase,
): Promise<ComboFailure | undefined> {
  try {
    return failureFor(
      method,
      current.id,
      current.expectError,
      await method.run(current.options),
    );
  } catch (error) {
    return failureFromError(method, current.id, current.expectError, error);
  }
}

async function runRace(): Promise<boolean> {
  const values = Array.from({ length: 32 }, (_, index) => `race-${index}`);
  const asyncResults = await Promise.all(
    values.map((value) => toPngBase64Async({ value, size: 80 })),
  );
  const syncResults = values.map((value) => toPngBase64({ value, size: 80 }));
  return asyncResults.every(
    (value, index) =>
      checkPngBase64(value) === undefined && value === syncResults[index],
  );
}

function runLeakCycles(): boolean {
  clearQRCodeCache();
  for (let cycle = 0; cycle < 3; cycle += 1) {
    for (let index = 0; index < 200; index += 1) {
      toPngBase64({
        value: `leak-${cycle}-${index}-${"x".repeat(12)}`,
        size: 128,
      });
    }
  }
  return (
    getQRCodeCacheSize() <= CACHE_MAX_ENTRIES &&
    getQRCodeCacheBytes() <= CACHE_MAX_BYTES
  );
}

export async function runComboSweep(
  onProgress?: (done: number, total: number) => void,
): Promise<ComboReport> {
  const cases = buildGenerationCases();
  const failures: ComboFailure[] = [];
  const samples: number[] = [];
  const started = nowMs();
  const heapBefore = heapUsed();

  setQRCodeMetricsEnabled(true);
  resetQRCodeMetrics();
  clearQRCodeCache();

  let done = 0;
  for (const current of cases) {
    const caseStarted = nowMs();
    const applicable = METHODS.filter((method) =>
      method.groups.includes(current.group),
    );

    for (const method of applicable) {
      if (!method.async) {
        const failure = assertOutput(method, current);
        if (failure !== undefined) {
          failures.push(failure);
        }
      }
    }

    const asyncFailures = await Promise.all(
      applicable
        .filter((method) => method.async)
        .map((method) => assertOutputAsync(method, current)),
    );
    for (const failure of asyncFailures) {
      if (failure !== undefined) {
        failures.push(failure);
      }
    }

    samples.push(nowMs() - caseStarted);
    done += 1;
    if (done % 64 === 0) {
      onProgress?.(done, cases.length);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  const raceOk = await runRace();
  if (!raceOk) {
    failures.push({
      id: "race:overlap",
      method: "async",
      message: "overlapping async PNG results drifted from sync",
    });
  }

  const leakOk = runLeakCycles();
  if (!leakOk) {
    failures.push({
      id: "leak:cache",
      method: "cache",
      message: `cache grew to ${getQRCodeCacheSize()} / ${getQRCodeCacheBytes()} B`,
    });
  }

  const heapAfter = heapUsed();
  const elapsedMs = nowMs() - started;
  onProgress?.(cases.length, cases.length);

  return {
    total: cases.length,
    ok: cases.length - new Set(failures.map((failure) => failure.id)).size,
    failed: new Set(failures.map((failure) => failure.id)).size,
    elapsedMs,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    maxMs: percentile(samples, 1),
    cacheEntries: getQRCodeCacheSize(),
    cacheBytes: getQRCodeCacheBytes(),
    heapBefore,
    heapAfter,
    heapDelta:
      heapBefore === undefined || heapAfter === undefined
        ? undefined
        : heapAfter - heapBefore,
    raceOk,
    leakOk,
    failures: failures.slice(0, 40),
    metrics: NitroQRCode.getQRCodeMetrics(),
  };
}

