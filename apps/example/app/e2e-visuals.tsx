import { useCallback, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  QRCode,
  getQRCodeMetrics,
  type QRCodePreset,
} from "react-native-nitro-qrcode";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Specimen = {
  id: string;
  label: string;
  preset: QRCodePreset;
  logo: boolean;
};

const PRESETS: readonly QRCodePreset[] = [
  "default",
  "rounded",
  "dots",
  "branded",
  "classy",
  "mosaic",
  "fluid",
];

const SPECIMENS: readonly Specimen[] = PRESETS.flatMap((preset) => [
  { id: `${preset}-plain`, label: `${preset} · no logo`, preset, logo: false },
  { id: `${preset}-logo`, label: `${preset} · logo`, preset, logo: true },
]);

const APP_ICON = require("../assets/icon.png");

export default function QrcodeE2eVisualsScreen() {
  const insets = useSafeAreaInsets();
  const [generation, setGeneration] = useState(0);
  const [readyIds, setReadyIds] = useState<string[]>([]);
  const readyIdsRef = useRef(new Set<string>());
  const [elapsed, setElapsed] = useState("(idle)");
  const [startedAt, setStartedAt] = useState(
    () => globalThis.performance?.now?.() ?? Date.now(),
  );

  const markReady = useCallback(
    (id: string) => {
      if (readyIdsRef.current.has(id)) {
        return;
      }
      readyIdsRef.current.add(id);
      const next = [...readyIdsRef.current];
      setReadyIds(next);
      if (next.length === SPECIMENS.length) {
        const ms =
          (globalThis.performance?.now?.() ?? Date.now()) - startedAt;
        const last = getQRCodeMetrics().lastGenerationMs ?? 0;
        setElapsed(
          `ok:ready=${next.length}/${SPECIMENS.length}:ms=${ms.toFixed(1)}:last=${last.toFixed(1)}`,
        );
      }
    },
    [startedAt],
  );

  return (
    <ScrollView
      testID="e2e-visuals-screen"
      accessibilityLabel="E2E visual wall"
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
      <Text testID="e2e-visuals-ready" style={styles.ready}>
        e2e-visuals-ready
      </Text>
      <Text style={styles.title}>Visual wall</Text>
      <Text style={styles.subtitle}>
        Every look with and without a center logo. Times the full wall.
      </Text>
      <Text testID="e2e-visuals-ready-count" style={styles.metric}>
        {elapsed === "(idle)"
          ? `ready=${readyIds.length}/${SPECIMENS.length}`
          : elapsed}
      </Text>
      <Pressable
        testID="e2e-visuals-remount"
        accessibilityRole="button"
        accessibilityLabel="Remount visual specimens"
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
      <View testID="e2e-visuals-grid" style={styles.grid}>
        {SPECIMENS.map((specimen) => (
          <View
            key={`${specimen.id}-${generation}`}
            testID={`e2e-visuals-${specimen.id}`}
            style={styles.cell}
          >
            <QRCode
              testID={`e2e-visuals-qr-${specimen.id}`}
              value={`https://nitro.dev/visual/${specimen.id}`}
              size={120}
              preset={specimen.preset}
              scanSafe
              errorCorrectionLevel={specimen.logo ? "H" : "M"}
              logoAreaSize={specimen.logo ? 32 : 0}
              logoAreaBorderRadius={specimen.logo ? 8 : 0}
              logoPadding={specimen.logo ? 3 : 0}
              logo={
                specimen.logo ? (
                  <Image
                    source={APP_ICON}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                ) : undefined
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    gap: 8,
    padding: 12,
    width: "47%",
  },
  cellLabel: {
    color: "#334155",
    fontSize: 12,
    textAlign: "center",
  },
  logo: {
    height: "100%",
    width: "100%",
  },
});
