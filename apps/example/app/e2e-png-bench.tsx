import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import {
  clearQRCodeCache,
  toPngBase64,
  toPngBase64Async,
  type QRCodeOptions,
} from "react-native-nitro-qrcode";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

type BenchApi = {
  toPngArrayBuffer?: (options: QRCodeOptions) => ArrayBuffer;
  toPngArrayBufferAsync?: (options: QRCodeOptions) => Promise<ArrayBuffer>;
};

const LARGE_PAYLOAD = `https://example.com/nitro-qrcode/bench?${"A".repeat(240)}`;
const WARMUP = 3;
const ITERATIONS = 20;
const PAYLOADS = [
  { id: "small-text", value: "Hi", size: 128 },
  {
    id: "medium-url",
    value: "https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode",
    size: 256,
  },
  { id: "large-high-res", value: LARGE_PAYLOAD, size: 1024 },
] as const;

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

function loadOptionalApi(): BenchApi {
  return require("react-native-nitro-qrcode") as BenchApi;
}

async function runBench(): Promise<BenchRow[]> {
  const optional = loadOptionalApi();
  const rows: BenchRow[] = [];
  for (const payload of PAYLOADS) {
    const options: QRCodeOptions = {
      value: payload.value,
      size: payload.size,
    };
    rows.push(
      await measure(payload.id, "sync-base64", () => {
        return toPngBase64(options).length;
      }),
    );
    rows.push(
      await measure(payload.id, "async-base64", async () => {
        return (await toPngBase64Async(options)).length;
      }),
    );
    if (optional.toPngArrayBuffer) {
      const generate = optional.toPngArrayBuffer;
      rows.push(
        await measure(payload.id, "sync-arraybuffer", () => {
          return generate(options).byteLength;
        }),
      );
    }
    if (optional.toPngArrayBufferAsync) {
      const generate = optional.toPngArrayBufferAsync;
      rows.push(
        await measure(payload.id, "async-arraybuffer", async () => {
          return (await generate(options)).byteLength;
        }),
      );
    }
  }
  return rows;
}

export default function QrcodePngBenchScreen() {
  const insets = useSafeAreaInsets();
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
    <ScrollView
      testID="png-bench-screen"
      accessibilityLabel="PNG bench"
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <Text testID="png-bench-ready" style={styles.ready}>
        png-bench-ready
      </Text>
      <Text style={styles.title}>PNG ArrayBuffer bench</Text>
      <Text style={styles.subtitle}>
        Cold-cache timings on this device. Base64 always; ArrayBuffer when
        exported.
      </Text>
      <Pressable
        testID="png-bench-run"
        accessibilityRole="button"
        accessibilityLabel="Run PNG bench"
        onPress={() => {
          void onRun();
        }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Run PNG bench</Text>
      </Pressable>
      <Text testID="png-bench-status" style={styles.status}>
        {status}
      </Text>
      <Text testID="png-bench-results" selectable style={styles.results}>
        {results}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#101112",
  },
  ready: {
    color: "#86EFAC",
    fontFamily: "Menlo",
    fontSize: 12,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#CBD5E1",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
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
