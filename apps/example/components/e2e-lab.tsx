import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  NitroQRCode,
  QRCode,
  clearQRCodeCache,
  getQRCodeCacheBytes,
  getQRCodeCacheSize,
  getQRCodeMetrics,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
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
];

type LabResult = {
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

export function QrcodeE2eLab() {
  const qrRef = useRef<QRCodeRef>(null);
  const [preset, setPreset] = useState<QRCodePreset>("default");
  const [keepPrevious, setKeepPrevious] = useState(true);
  const [scanSafeStrict, setScanSafeStrict] = useState(false);
  const [forceEmpty, setForceEmpty] = useState(false);
  const [results, setResults] = useState<LabResult>(EMPTY);

  const liveValue = forceEmpty ? "" : LAB_VALUE;

  const runHelpers = () => {
    const options = { value: LAB_VALUE, size: 96 };
    const png = toPngDataUri(options);
    const base64 = toPngBase64(options);
    const svg = NitroQRCode.toSvgString(options);
    const matrix = NitroQRCode.getMatrix(options);
    setResults((current) => ({
      ...current,
      helpers: `ok:png=${png.length}:b64=${base64.length}:svg=${svg.length}:matrix=${matrix.size}`,
    }));
  };

  const runNamespace = async () => {
    const options = { value: LAB_VALUE, size: 80 };
    const [uri, b64] = await Promise.all([
      NitroQRCode.toPngDataUriAsync(options),
      NitroQRCode.toPngBase64Async(options),
    ]);
    setResults((current) => ({
      ...current,
      namespace: `ok:nitro:uri=${uri.length}:b64=${b64.length}`,
    }));
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
      validation: `ok:valid=${valid.valid}:invalid=${invalid.valid}:code=${invalid.errors[0]?.code ?? "none"}`,
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
      stress: `ok:count=${STRESS_COUNT}:ms=${elapsed.toFixed(1)}:avg=${(elapsed / STRESS_COUNT).toFixed(2)}:requests=${snapshot.requests}`,
    }));
  };

  const exportUri = () => {
    const uri = qrRef.current?.toPngDataUri();
    setResults((current) => ({
      ...current,
      exportUri:
        uri === undefined ? "fail:export-unavailable" : `ok:uri=${uri.length}`,
    }));
  };

  return (
    <View testID="e2e-lab" style={styles.lab} accessibilityLabel="E2E Lab">
      <Text style={styles.title}>E2E Lab</Text>
      <Text style={styles.subtitle}>
        Deterministic controls for every public QRCode API.
      </Text>

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
            error: `ok:error:${error.message.slice(0, 48)}`,
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
  result: {
    color: "#0F172A",
    fontFamily: "Menlo",
    fontSize: 11,
  },
});
