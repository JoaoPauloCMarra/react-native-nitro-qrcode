import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { QRCode, type QRCodePreset } from "react-native-nitro-qrcode";
import { E2eScreen, e2eStyles } from "../components/e2e-screen";
import { formatReadyWall, useReadyWall } from "../components/ready-wall";

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
  { id: "classy", label: "Classy", value: "https://nitro.dev/qr/classy", preset: "classy", size: 88 },
  { id: "mosaic", label: "Mosaic", value: "https://nitro.dev/qr/mosaic", preset: "mosaic", size: 88 },
  { id: "fluid", label: "Fluid", value: "https://nitro.dev/qr/fluid", preset: "fluid", size: 88 },
  { id: "circle", label: "Circle body", value: "payload-circle", size: 88, shape: "circle" },
  { id: "strict", label: "Scan-safe strict", value: "payload-strict", size: 88, scanSafe: "strict" },
  { id: "long", label: "Long URL", value: `https://example.com/qr?${"x".repeat(80)}`, size: 88 },
  { id: "unicode", label: "Unicode", value: "QR · 日本語 · café", size: 88 },
  { id: "small", label: "64px", value: "small-qr", size: 64 },
  { id: "large", label: "128px", value: "large-qr", size: 128 },
  { id: "numeric", label: "Numeric", value: "123456789012345", size: 88 },
  { id: "padded", label: "Padded whitespace", value: "  padded payload  ", size: 88 },
];

export default function QrcodeE2eRenderScreen() {
  const [generation, setGeneration] = useState(0);
  const wall = useReadyWall(SPECIMENS.length);
  const status = formatReadyWall(
    wall,
    SPECIMENS.length,
    (done) => `:ms=${(done.elapsedMs ?? 0).toFixed(1)}`,
  );

  return (
    <E2eScreen testID="e2e-render-screen" label="E2E render wall">
      <Text testID="e2e-ready" style={e2eStyles.ready}>
        e2e-ready
      </Text>
      <Text testID="e2e-render-generation">generation={generation}</Text>
      <Text style={e2eStyles.title}>Render wall</Text>
      <Text style={e2eStyles.subtitle}>
        Consumer-shaped QR variants: presets, shapes, sizes, unicode, and long
        payloads.
      </Text>
      <Text testID="e2e-render-ready-count" style={e2eStyles.metric}>
        {status}
      </Text>
      <Pressable
        testID="e2e-render-remount"
        accessibilityRole="button"
        accessibilityLabel="Remount specimens"
        onPress={() => {
          wall.reset();
          setGeneration((value) => value + 1);
        }}
        style={e2eStyles.button}
      >
        <Text style={e2eStyles.buttonText}>Remount all</Text>
      </Pressable>
      <View testID="e2e-render-grid" style={e2eStyles.grid}>
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
    </E2eScreen>
  );
}

const styles = StyleSheet.create({
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
