import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  QRCode,
  PRESET_SHAPE_OPTIONS,
  getQRCodeMetrics,
  toPngBase64Async,
  type QRCodeBodyShape,
  type QRCodeColor,
  type QRCodeOptions,
  type QRCodePreset,
} from "react-native-nitro-qrcode";
import { decodePngBase64, type Backdrop } from "../components/scan-decode";
import { PRESETS } from "../components/generation-matrix";
import { formatReadyWall, useReadyWall } from "../components/ready-wall";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Specimen = {
  id: string;
  label: string;
  preset: QRCodePreset;
  logo: boolean;
  alignmentColor?: QRCodeColor;
  timingColor?: QRCodeColor;
  quietZoneColor?: QRCodeColor;
  finderInnerColor?: QRCodeColor;
  alignmentShape?: QRCodeBodyShape;
  timingShape?: QRCodeBodyShape;
};

const SPECIMENS: readonly Specimen[] = [
  ...PRESETS.flatMap((preset) => [
    { id: `${preset}-plain`, label: `${preset} · no logo`, preset, logo: false },
    { id: `${preset}-logo`, label: `${preset} · logo`, preset, logo: true },
  ]),
  {
    id: "regions",
    label: "regions · custom parts",
    preset: "classy",
    logo: false,
    alignmentColor: "#B45309",
    timingColor: "#0F766E",
    quietZoneColor: "#F1F5F9",
    finderInnerColor: "#FFF7ED",
    alignmentShape: "diamond",
    timingShape: "circle",
  },
];

const APP_ICON = require("../assets/icon.png");

const LIGHT_BACKDROP: Backdrop = [255, 255, 255];

const DECODE_PROBES: readonly { id: string; options: QRCodeOptions }[] = [
  {
    id: "transparent-rounded",
    options: {
      value: "https://nitro.dev/decode/transparent",
      size: 240,
      backgroundColor: "transparent",
      shapeOptions: PRESET_SHAPE_OPTIONS.rounded,
    },
  },
  {
    id: "translucent",
    options: {
      value: "https://nitro.dev/decode/translucent",
      size: 240,
      foregroundColor: "#000000C0",
      eyeColor: "#1E40AFB0",
      eyeballColor: "#0F172AB0",
    },
  },
];

function useDecodeProbes(): string {
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      DECODE_PROBES.map(async ({ id, options }) => {
        try {
          const base64 = await toPngBase64Async(options);
          const value = options.value;
          return [id, decodePngBase64(base64, value, LIGHT_BACKDROP)] as const;
        } catch {
          return [id, "error"] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) {
        setOutcomes(Object.fromEntries(entries));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return DECODE_PROBES.map(
    ({ id }) => `decode:${id}=${outcomes[id] ?? "pending"};`,
  ).join(" ");
}

const lastGenerationMs = () => getQRCodeMetrics().lastGenerationMs ?? 0;

export default function QrcodeE2eVisualsScreen() {
  const insets = useSafeAreaInsets();
  const [generation, setGeneration] = useState(0);
  const decodeProbes = useDecodeProbes();
  const wall = useReadyWall(SPECIMENS.length, lastGenerationMs);
  const status = formatReadyWall(
    wall,
    SPECIMENS.length,
    (done) =>
      `:ms=${(done.elapsedMs ?? 0).toFixed(1)}:last=${(done.extra ?? 0).toFixed(1)}`,
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
      <Text testID="e2e-visuals-generation" style={styles.metric}>
        {`generation=${generation};`}
      </Text>
      <Text testID="e2e-visuals-ready-count" style={styles.metric}>
        {status}
      </Text>
      <View
        testID="e2e-visuals-decode"
        accessible
        accessibilityLabel={decodeProbes}
        style={styles.decodeProbe}
      />
      <Pressable
        testID="e2e-visuals-remount"
        accessibilityRole="button"
        accessibilityLabel="Remount visual specimens"
        onPress={() => {
          wall.reset();
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
              alignmentColor={specimen.alignmentColor}
              timingColor={specimen.timingColor}
              quietZoneColor={specimen.quietZoneColor}
              finderInnerColor={specimen.finderInnerColor}
              shapeOptions={
                specimen.alignmentShape === undefined &&
                specimen.timingShape === undefined
                  ? undefined
                  : {
                      alignmentShape: specimen.alignmentShape,
                      timingShape: specimen.timingShape,
                    }
              }
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
                wall.markReady(specimen.id);
              }}
              onError={() => {
                wall.markReady(specimen.id, true);
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
  decodeProbe: { width: "100%", height: 1 },
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
