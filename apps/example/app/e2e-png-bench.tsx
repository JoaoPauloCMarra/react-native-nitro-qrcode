import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import {
  clearQRCodeCache,
  toPngArrayBuffer,
  toPngArrayBufferAsync,
  toPngBase64,
  toPngBase64Async,
  type QRCodeOptions,
} from "react-native-nitro-qrcode";
import { E2eScreen, e2eStyles } from "../components/e2e-screen";

type BenchRow = {
  payload: string;
  method: string;
  medianMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  bytes: number;
  mbPerSec: number;
  samples: number[];
};

const LARGE_PAYLOAD = `https://example.com/nitro-qrcode/bench?${"A".repeat(240)}`;
const WARMUP = 3;
const ITERATIONS = 20;
const PAYLOADS: readonly { id: string; options: QRCodeOptions }[] = [
  { id: "small-text", options: { value: "Hi", size: 128 } },
  {
    id: "medium-url",
    options: {
      value: "https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode",
      size: 256,
    },
  },
  { id: "large-high-res", options: { value: LARGE_PAYLOAD, size: 1024 } },
  {
    id: "classy",
    options: {
      value: "https://example.com/classy",
      size: 256,
      shapeOptions: { shape: "classy", eyeFrameShape: "rounded" },
    },
  },
  {
    id: "mosaic-logo",
    options: {
      value: "https://example.com/mosaic-logo",
      size: 256,
      shapeOptions: { shape: "diamond", eyeFrameShape: "rounded" },
      logoAreaSize: 48,
      logoAreaBorderRadius: 10,
    },
  },
  {
    id: "fluid",
    options: {
      value: "https://example.com/fluid",
      size: 256,
      shapeOptions: {
        shape: "squircle",
        eyeFrameShape: "circle",
        bodyDensity: "sparse",
      },
    },
  },
];

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function summarize(samples: number[]): {
  medianMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
} {
  const sorted = [...samples].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return {
    medianMs: median,
    meanMs: mean,
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
  };
}

async function measure(
  payload: string,
  method: string,
  run: () => Promise<number> | number,
): Promise<BenchRow> {
  let bytes = 0;
  for (let index = 0; index < WARMUP; index += 1) {
    clearQRCodeCache();
    bytes = await run();
  }
  const samples: number[] = [];
  for (let index = 0; index < ITERATIONS; index += 1) {
    clearQRCodeCache();
    const started = nowMs();
    bytes = await run();
    samples.push(nowMs() - started);
  }
  const stats = summarize(samples);
  return {
    payload,
    method,
    ...stats,
    bytes,
    mbPerSec: stats.medianMs > 0 ? bytes / 1e6 / (stats.medianMs / 1000) : 0,
    samples,
  };
}

async function runBench(): Promise<BenchRow[]> {
  const rows: BenchRow[] = [];
  for (const { id, options } of PAYLOADS) {
    rows.push(
      await measure(id, "sync-base64", () => {
        return toPngBase64(options).length;
      }),
    );
    rows.push(
      await measure(id, "async-base64", async () => {
        return (await toPngBase64Async(options)).length;
      }),
    );
    rows.push(
      await measure(id, "sync-arraybuffer", () => {
        return toPngArrayBuffer(options).byteLength;
      }),
    );
    rows.push(
      await measure(id, "async-arraybuffer", async () => {
        return (await toPngArrayBufferAsync(options)).byteLength;
      }),
    );
  }
  return rows;
}

export default function QrcodePngBenchScreen() {
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState("[]");

  const onRun = async () => {
    setStatus("running");
    setResults("[]");
    try {
      const rows = await runBench();
      setResults(JSON.stringify(rows, null, 2));
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setResults(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <E2eScreen testID="png-bench-screen" label="PNG bench" gap={12}>
      <Text testID="png-bench-ready" style={e2eStyles.ready}>
        png-bench-ready
      </Text>
      <Text style={e2eStyles.title}>PNG ArrayBuffer bench</Text>
      <Text style={e2eStyles.subtitle}>
        Cold-cache timings on this device. Base64 and ArrayBuffer, sync and
        async.
      </Text>
      <Pressable
        testID="png-bench-run"
        accessibilityRole="button"
        accessibilityLabel="Run PNG bench"
        onPress={() => {
          void onRun();
        }}
        style={[e2eStyles.button, styles.button]}
      >
        <Text style={e2eStyles.buttonText}>Run PNG bench</Text>
      </Pressable>
      <Text testID="png-bench-status" style={styles.status}>
        {status}
      </Text>
      <Text testID="png-bench-results" selectable style={styles.results}>
        {results}
      </Text>
    </E2eScreen>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "stretch",
    backgroundColor: "#1D4ED8",
    paddingVertical: 12,
  },
  status: {
    color: "#FBBF24",
    fontFamily: "Menlo",
    fontSize: 12,
  },
  results: {
    color: "#E2E8F0",
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 16,
  },
});
