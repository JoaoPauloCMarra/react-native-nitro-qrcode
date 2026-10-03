import { Component, useRef, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  NitroQRCode,
  QRCode,
  clearQRCodeCache,
  getQRCodeCacheBytes,
  getQRCodeCacheSize,
  getQRCodeMetrics,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
  toPngArrayBuffer,
  toPngBase64,
  toPngDataUri,
  type QRCodePreset,
  type QRCodeRef,
} from "react-native-nitro-qrcode";

const LAB_VALUE = "https://example.com/nitro-qrcode-e2e";
const PRESETS: readonly QRCodePreset[] = [
  "default",
  "rounded",
  "dots",
  "branded",
  "classy",
  "mosaic",
  "fluid",
];

type LabResult = {
  audit: string;
  helpers: string;
  namespace: string;
  cache: string;
  metrics: string;
  validation: string;
  error: string;
  exportUri: string;
  stress: string;
};

const EMPTY: LabResult = {
  audit: "(idle)",
  helpers: "(idle)",
  namespace: "(idle)",
  cache: "(idle)",
  metrics: "(idle)",
  validation: "(idle)",
  error: "(idle)",
  exportUri: "(idle)",
  stress: "(idle)",
};

const STRESS_COUNT = 40;

type ProbeResult = {
  warnings?: string;
  refBase64?: string;
  metricsOff?: string;
  boundaryEmpty?: string;
  boundarySize?: string;
};

type BoundaryProps = {
  children: ReactNode;
  onCaught: (error: Error) => void;
};

class LabErrorBoundary extends Component<BoundaryProps, { caught: boolean }> {
  state = { caught: false };

  static getDerivedStateFromError() {
    return { caught: true };
  }

  componentDidCatch(error: Error) {
    this.props.onCaught(error);
  }

  render() {
    return this.state.caught ? null : this.props.children;
  }
}

export function QrcodeE2eLab() {
  const qrRef = useRef<QRCodeRef>(null);
  const [preset, setPreset] = useState<QRCodePreset>("default");
  const [keepPrevious, setKeepPrevious] = useState(true);
  const [scanSafeStrict, setScanSafeStrict] = useState(false);
  const [forceEmpty, setForceEmpty] = useState(false);
  const [auditUri, setAuditUri] = useState<string>();
  const [results, setResults] = useState<LabResult>(EMPTY);
  const [probe, setProbe] = useState<ProbeResult>({});
  const [showBoundaries, setShowBoundaries] = useState(false);

  const liveValue = forceEmpty ? "" : LAB_VALUE;

  const runAudit = async () => {
    try {
      clearQRCodeCache();
      const bounded = NitroQRCode.getMatrix({ value: "hello", minVersion: 10, maxVersion: 12 });
      if (bounded.size !== 57) throw new Error("minimum version was not honored");
      let rejected = false;
      try {
        NitroQRCode.getMatrix({ value: "a".repeat(100), minVersion: 1, maxVersion: 2 });
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error("maximum version was not enforced");
      const fixed = { value: "a".repeat(12), minVersion: 1, maxVersion: 1, mask: 0 } as const;
      const boosted = NitroQRCode.getMatrix({ ...fixed, errorCorrectionLevel: "L", boostEcl: true });
      const medium = NitroQRCode.getMatrix({ ...fixed, errorCorrectionLevel: "M", boostEcl: false });
      if (JSON.stringify(boosted) !== JSON.stringify(medium)) throw new Error("error correction boost differs");
      setQRCodeMetricsEnabled(true);
      resetQRCodeMetrics();
      await NitroQRCode.toPngDataUriAsync({ value: "audit-metrics", size: 96 });
      try {
        await NitroQRCode.toPngDataUriAsync({ value: "a".repeat(100), size: 96, maxVersion: 1 });
      } catch {
        // Expected capacity failure; verify it is counted exactly once below.
      }
      const metrics = getQRCodeMetrics();
      if (metrics.requests !== 2 || metrics.asyncRequests !== 2 || metrics.failedRequests !== 1)
        throw new Error(`async request accounting differs: ${JSON.stringify(metrics)}`);
      const uri = toPngDataUri({ value: "before\0after", size: 256, errorCorrectionLevel: "H" });
      setAuditUri(uri);
      setResults((current) => ({ ...current, audit: "ok:bounds:boost:metrics:nul-image-ready" }));
    } catch (error) {
      setResults((current) => ({ ...current, audit: `fail:${error instanceof Error ? error.message : "audit"}` }));
    }
  };

  const runHelpers = () => {
    const options = { value: LAB_VALUE, size: 96 };
    const png = toPngDataUri(options);
    const base64 = toPngBase64(options);
    const bytes = toPngArrayBuffer(options);
    const svg = NitroQRCode.toSvgString(options);
    const matrix = NitroQRCode.getMatrix(options);
    setResults((current) => ({
      ...current,
      helpers: png.startsWith("data:image/png;base64,iVBOR") && base64.startsWith("iVBOR") && new Uint8Array(bytes)[0] === 137 && bytes.byteLength > 8 && svg.includes("<svg") && matrix.size >= 21
        ? `ok:png=${png.length}:b64=${base64.length}:bytes=${bytes.byteLength}:svg=${svg.length}:matrix=${matrix.size}` : "fail:invalid-export-shape",
    }));
  };

  const runNamespace = async () => {
    try {
      const options = { value: LAB_VALUE, size: 80 };
      const [uri, b64, bytes] = await Promise.all([
        NitroQRCode.toPngDataUriAsync(options),
        NitroQRCode.toPngBase64Async(options),
        NitroQRCode.toPngArrayBufferAsync(options),
      ]);
      const valid = uri.startsWith("data:image/png;base64,iVBOR") &&
        b64.startsWith("iVBOR") && new Uint8Array(bytes)[0] === 137;
      setResults((current) => ({
        ...current,
        namespace: valid ? `ok:nitro:uri=${uri.length}:b64=${b64.length}` : "fail:invalid-async-export",
      }));
    } catch (error) {
      setResults((current) => ({ ...current, namespace: `fail:${error instanceof Error ? error.message : "async export"}` }));
    }
  };

  const runCache = () => {
    toPngBase64({ value: `${LAB_VALUE}#cache`, size: 72 });
    const before = getQRCodeCacheSize();
    clearQRCodeCache();
    const after = getQRCodeCacheSize();
    const bytes = getQRCodeCacheBytes();
    const cleared = before > 0 && after === 0 && bytes === 0;
    setResults((current) => ({
      ...current,
      cache: cleared
        ? `ok:cleared:${before}->${after}:bytes=${bytes}`
        : `fail:cache-not-cleared:${before}->${after}:bytes=${bytes}`,
    }));
  };

  const runMetrics = () => {
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();
    toPngBase64({ value: LAB_VALUE, size: 64 });
    const snapshot = getQRCodeMetrics();
    resetQRCodeMetrics();
    const reset = getQRCodeMetrics();
    const resetCorrectly =
      snapshot.enabled &&
      snapshot.requests === 1 &&
      snapshot.asyncRequests === 0 &&
      snapshot.failedRequests === 0 &&
      reset.enabled &&
      reset.requests === 0 &&
      reset.asyncRequests === 0 &&
      reset.failedRequests === 0;
    setResults((current) => ({
      ...current,
      metrics: resetCorrectly
        ? `ok:requests=${snapshot.requests}:reset=${reset.requests}`
        : `fail:metrics:requests=${snapshot.requests}:reset=${reset.requests}`,
    }));
  };

  const runValidation = () => {
    const valid = NitroQRCode.validateOptions({ value: LAB_VALUE, size: 128 });
    const invalid = NitroQRCode.validateOptions({
      value: "",
      size: 128,
      scanSafe: scanSafeStrict ? "strict" : true,
    });
    setResults((current) => ({
      ...current,
      validation: valid.valid && !invalid.valid && invalid.errors.length > 0 ? `ok:valid=${valid.valid}:invalid=${invalid.valid}:code=${invalid.errors[0]?.code ?? "none"}` : "fail:validation",
    }));
  };

  const runStress = () => {
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();
    const started = globalThis.performance?.now?.() ?? Date.now();
    for (let index = 0; index < STRESS_COUNT; index += 1) {
      toPngBase64({
        value: `${LAB_VALUE}#${index}`,
        size: 96,
      });
    }
    const elapsed = (globalThis.performance?.now?.() ?? Date.now()) - started;
    const snapshot = getQRCodeMetrics();
    setResults((current) => ({
      ...current,
      stress: snapshot.requests === STRESS_COUNT && snapshot.failedRequests === 0 ? `ok:count=${STRESS_COUNT}:ms=${elapsed.toFixed(1)}:avg=${(elapsed / STRESS_COUNT).toFixed(2)}:requests=${snapshot.requests}` : "fail:stress-request-count",
    }));
  };

  const runWarnings = () => {
    const result = NitroQRCode.validateOptions({
      value: LAB_VALUE,
      size: 64,
      quietZone: 0,
      foregroundColor: "#EEEEEE",
      logoAreaSize: 32,
      errorCorrectionLevel: "L",
    });
    const codes = [...new Set(result.warnings.map((warning) => warning.code))].sort();
    setProbe((current) => ({
      ...current,
      warnings: result.errors.length === 0 ? `warnings=${codes.join(",")};` : `warnings=fail:${result.errors[0]?.code ?? "none"};`,
    }));
  };

  const exportBase64 = () => {
    let base64: string | undefined;
    try {
      base64 = qrRef.current?.toPngBase64();
    } catch {
      base64 = undefined;
    }
    setProbe((current) => ({
      ...current,
      refBase64: base64?.startsWith("iVBOR") ? `ok:b64=${base64.length};` : "fail:b64-unavailable;",
    }));
  };

  const runMetricsOff = () => {
    const wasEnabled = getQRCodeMetrics().enabled;
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();
    setQRCodeMetricsEnabled(false);
    const silent = toPngBase64({ value: `${LAB_VALUE}#metrics-off`, size: 64 });
    setQRCodeMetricsEnabled(true);
    const disabled = getQRCodeMetrics();
    toPngBase64({ value: `${LAB_VALUE}#metrics-on`, size: 64 });
    const resumed = getQRCodeMetrics();
    resetQRCodeMetrics();
    setQRCodeMetricsEnabled(wasEnabled);
    const silentCorrectly =
      silent.startsWith("iVBOR") &&
      disabled.requests === 0 &&
      disabled.cacheHits === 0 &&
      disabled.cacheMisses === 0 &&
      resumed.requests === 1;
    setProbe((current) => ({
      ...current,
      metricsOff: silentCorrectly
        ? `ok:metrics-off:requests=${disabled.requests}:resumed=${resumed.requests};`
        : `fail:metrics-off:requests=${disabled.requests}:resumed=${resumed.requests};`,
    }));
  };

  const probeLabel = [
    probe.warnings,
    probe.refBase64,
    probe.metricsOff,
    `keep=${keepPrevious ? "on" : "off"}:${results.error === "ok:ready" ? "ready" : "pending"};`,
    probe.boundaryEmpty === undefined && probe.boundarySize === undefined
      ? undefined
      : `boundary:empty=${probe.boundaryEmpty ?? "pending"}:size=${probe.boundarySize ?? "pending"};`,
  ]
    .filter((token) => token !== undefined)
    .join(" ");

  const exportUri = () => {
    const uri = qrRef.current?.toPngDataUri();
    setResults((current) => ({
      ...current,
      exportUri:
        uri?.startsWith("data:image/png;base64,iVBOR") ? `ok:uri=${uri.length}` : "fail:export-unavailable",
    }));
  };

  return (
    <View testID="e2e-lab" style={styles.lab} accessibilityLabel="E2E Lab">
      <Text style={styles.title}>E2E Lab</Text>
      <Text style={styles.subtitle}>
        Deterministic controls for every public QRCode API.
      </Text>
      <View testID="e2e-probe" accessible accessibilityLabel={probeLabel} style={styles.resultsProbe} />

      <QRCode
        ref={qrRef}
        testID="e2e-lab-qr"
        value={liveValue}
        size={96}
        preset={preset}
        keepPreviousImage={keepPrevious}
        scanSafe={scanSafeStrict ? "strict" : true}
        onReady={() => {
          setResults((current) => ({
            ...current,
            error: "ok:ready",
          }));
        }}
        onError={(error) => {
          setResults((current) => ({
            ...current,
            error: forceEmpty && error.message.includes("value must not be empty")
              ? "ok:error:empty"
              : `fail:error:${error.message.slice(0, 48)}`,
          }));
        }}
      />

      <View style={styles.row}>
        {PRESETS.map((name) => (
          <LabButton
            key={name}
            testID={`e2e-preset-${name}`}
            label={name}
            selected={preset === name}
            onPress={() => {
              setPreset(name);
            }}
          />
        ))}
      </View>

      <View style={styles.row}>
        <LabButton
          testID="e2e-keep-previous"
          label={keepPrevious ? "keep-on" : "keep-off"}
          selected={keepPrevious}
          onPress={() => {
            setKeepPrevious((value) => !value);
          }}
        />
        <LabButton
          testID="e2e-scan-safe-strict"
          label={scanSafeStrict ? "strict-on" : "strict-off"}
          selected={scanSafeStrict}
          onPress={() => {
            setScanSafeStrict((value) => !value);
          }}
        />
        <LabButton
          testID="e2e-force-empty"
          label={forceEmpty ? "empty-on" : "empty-off"}
          selected={forceEmpty}
          onPress={() => {
            setForceEmpty((value) => !value);
          }}
        />
      </View>

      <View style={styles.row}>
        <LabButton testID="e2e-run-helpers" label="Helpers" onPress={runHelpers} />
        <LabButton
          testID="e2e-run-namespace"
          label="NitroQRCode"
          onPress={() => {
            void runNamespace();
          }}
        />
        <LabButton testID="e2e-run-cache" label="Clear cache" onPress={runCache} />
      </View>
      <View style={styles.row}>
        <LabButton testID="e2e-run-metrics" label="Metrics" onPress={runMetrics} />
        <LabButton
          testID="e2e-run-validation"
          label="Validate"
          onPress={runValidation}
        />
        <LabButton testID="e2e-export-uri" label="Export URI" onPress={exportUri} />
        <LabButton testID="e2e-run-stress" label="Stress PNG" onPress={runStress} />
      </View>
      <View style={styles.row}>
        <LabButton testID="e2e-run-warnings" label="Warnings" onPress={runWarnings} />
        <LabButton testID="e2e-export-b64" label="Export base64" onPress={exportBase64} />
        <LabButton testID="e2e-run-metrics-off" label="Metrics off" onPress={runMetricsOff} />
        <LabButton
          testID="e2e-run-boundary"
          label="Error boundary"
          onPress={() => {
            setShowBoundaries(true);
          }}
        />
      </View>
      {showBoundaries ? (
        <View style={styles.row}>
          <LabErrorBoundary
            onCaught={(error) => {
              setProbe((current) => ({
                ...current,
                boundaryEmpty: error.message.includes("QRCode value must not be empty.") ? "ok" : "fail",
              }));
            }}
          >
            <QRCode testID="e2e-boundary-empty" value="" size={48} />
          </LabErrorBoundary>
          <LabErrorBoundary
            onCaught={(error) => {
              setProbe((current) => ({
                ...current,
                boundarySize: error.message.includes("integer between 1 and 2048") ? "ok" : "fail",
              }));
            }}
          >
            <QRCode testID="e2e-boundary-size" value={LAB_VALUE} size={0} />
          </LabErrorBoundary>
        </View>
      ) : null}

      <LabButton testID="e2e-run-audit" label="Audit regressions" onPress={() => { void runAudit(); }} />
      <ResultRow testID="e2e-audit-result" value={results.audit} />
      {auditUri ? <Image testID="e2e-audit-nul-image" accessibilityLabel="Embedded NUL payload" source={{ uri: auditUri }} style={{ width: 256, height: 256 }} /> : null}
      <ResultRow testID="e2e-helpers-result" value={results.helpers} />
      <ResultRow testID="e2e-namespace-result" value={results.namespace} />
      <ResultRow testID="e2e-cache-result" value={results.cache} />
      <ResultRow testID="e2e-metrics-result" value={results.metrics} />
      <ResultRow testID="e2e-validation-result" value={results.validation} />
      <ResultRow testID="e2e-error-result" value={results.error} />
      <ResultRow testID="e2e-export-uri-result" value={results.exportUri} />
      <ResultRow testID="e2e-stress-result" value={results.stress} />
    </View>
  );
}

function LabButton({
  testID,
  label,
  onPress,
  selected = false,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.button, selected && styles.buttonSelected]}
    >
      <Text style={[styles.buttonText, selected && styles.buttonTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ResultRow({ testID, value }: { testID: string; value: string }) {
  return (
    <Text testID={testID} accessibilityLabel={value} style={styles.result}>
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  lab: {
    borderColor: "#D6DEE8",
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#F8FAFC",
  },
  title: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: "#475569",
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonSelected: {
    backgroundColor: "#0F172A",
  },
  buttonText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "600",
  },
  buttonTextSelected: {
    color: "#F8FAFC",
  },
  resultsProbe: {
    height: 1,
    width: "100%",
  },
  result: {
    color: "#0F172A",
    fontFamily: "Menlo",
    fontSize: 11,
  },
});
