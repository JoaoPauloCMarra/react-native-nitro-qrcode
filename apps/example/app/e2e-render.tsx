import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { QRCode, type QRCodePreset } from "react-native-nitro-qrcode";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Specimen = {
  id: string;
  label: string;
  value: string;
  preset?: QRCodePreset;
  size: number;
  scanSafe?: true | "strict";
  shape?: "square" | "circle" | "rounded";
};

const SPECIMENS: readonly Specimen[] = [
  { id: "default", label: "Default", value: "https://nitro.dev/qr/default", size: 88 },
  { id: "rounded", label: "Rounded", value: "https://nitro.dev/qr/rounded", preset: "rounded", size: 88 },
  { id: "dots", label: "Dots", value: "https://nitro.dev/qr/dots", preset: "dots", size: 88 },
  { id: "branded", label: "Branded", value: "https://nitro.dev/qr/branded", preset: "branded", size: 88 },
  { id: "circle", label: "Circle body", value: "payload-circle", size: 88, shape: "circle" },
  { id: "strict", label: "Scan-safe strict", value: "payload-strict", size: 88, scanSafe: "strict" },
  { id: "long", label: "Long URL", value: `https://example.com/qr?${"x".repeat(80)}`, size: 88 },
  { id: "unicode", label: "Unicode", value: "QR · 日本語 · café", size: 88 },
  { id: "small", label: "64px", value: "small-qr", size: 64 },
  { id: "large", label: "128px", value: "large-qr", size: 128 },
  { id: "numeric", label: "Numeric", value: "123456789012345", size: 88 },
  { id: "empty-safe", label: "Whitespace trimmed", value: "trim-me", size: 88 },
];

export default function QrcodeE2eRenderScreen() {
  const insets = useSafeAreaInsets();
  const [generation, setGeneration] = useState(0);
  const [readyIds, setReadyIds] = useState<string[]>([]);
  const readyIdsRef = useRef(new Set<string>());
  const [elapsed, setElapsed] = useState("(idle)");
  const [startedAt, setStartedAt] = useState(
    () => globalThis.performance?.now?.() ?? Date.now(),
  );

  const markReady = useCallback((id: string) => {
    if (readyIdsRef.current.has(id)) {
      return;
    }
    readyIdsRef.current.add(id);
    const next = [...readyIdsRef.current];
    setReadyIds(next);
    if (next.length === SPECIMENS.length) {
      const ms = (globalThis.performance?.now?.() ?? Date.now()) - startedAt;
      setElapsed(`ok:ready=${next.length}/${SPECIMENS.length}:ms=${ms.toFixed(1)}`);
    }
  }, [startedAt]);

  return (
    <ScrollView
      testID="e2e-render-screen"
      accessibilityLabel="E2E render wall"
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
      <Text testID="e2e-ready" style={styles.ready}>
        e2e-ready
      </Text>
      <Text style={styles.title}>Render wall</Text>
      <Text style={styles.subtitle}>
        Consumer-shaped QR variants: presets, shapes, sizes, unicode, and long
        payloads.
      </Text>
      <Text testID="e2e-render-ready-count" style={styles.metric}>
        {elapsed === "(idle)"
          ? `ready=${readyIds.length}/${SPECIMENS.length}`
          : elapsed}
      </Text>
      <Pressable
        testID="e2e-render-remount"
        accessibilityRole="button"
        accessibilityLabel="Remount specimens"
        onPress={() => {
          setStartedAt(globalThis.performance?.now?.() ?? Date.now());
          readyIdsRef.current.clear();
          setReadyIds([]);
          setElapsed("(idle)");
          setGeneration((value) => value + 1);
        }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Remount all</Text>
      </Pressable>
      <View testID="e2e-render-grid" style={styles.grid}>
        {SPECIMENS.map((specimen) => (
          <View
            key={`${specimen.id}-${generation}`}
            testID={`e2e-render-${specimen.id}`}
            style={styles.cell}
          >
            <QRCode
              testID={`e2e-render-qr-${specimen.id}`}
              value={specimen.value}
              size={specimen.size}
              preset={specimen.preset}
              scanSafe={specimen.scanSafe ?? true}
              shapeOptions={
                specimen.shape ? { shape: specimen.shape } : undefined
              }
              onReady={() => {
                markReady(specimen.id);
              }}
            />
            <Text style={styles.cellLabel}>{specimen.label}</Text>
          </View>
        ))}
      </View>
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
  metric: {
    color: "#F8FAFC",
    fontFamily: "Menlo",
    fontSize: 12,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cell: {
    alignItems: "center",
    backgroundColor: "#1A1C1E",
    borderRadius: 16,
    gap: 8,
    padding: 12,
    width: "47%",
  },
  cellLabel: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
  },
});
