import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { QRCode, type QRCodeProps } from "react-native-nitro-qrcode";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScanCase = {
  id: string;
  props: QRCodeProps;
  expectedError?: boolean;
  darkBackdrop?: boolean;
};

const SCAN_CASES: readonly ScanCase[] = [
  { id: "default", props: { value: "https://nitro.dev/scan/default" } },
  { id: "small", props: { value: "1234567890", size: 64 } },
  { id: "large", props: { value: "https://nitro.dev/scan/large", size: 300 } },
  { id: "unicode", props: { value: "QR · 日本語 · café · 😀" } },
  { id: "long", props: { value: `https://nitro.dev/scan/long?payload=${"abcd0123".repeat(50)}`, size: 300, errorCorrectionLevel: "H" } },
  { id: "rounded", props: { value: "https://nitro.dev/scan/rounded", preset: "rounded" } },
  { id: "dots", props: { value: "https://nitro.dev/scan/dots", preset: "dots" } },
  { id: "branded", props: { value: "https://nitro.dev/scan/branded", preset: "branded" } },
  { id: "linear", props: { value: "https://nitro.dev/scan/linear", gradient: { type: "linear", colors: ["#111827", "#4338CA"] } } },
  { id: "radial", props: { value: "https://nitro.dev/scan/radial", gradient: { type: "radial", colors: ["#111827", "#075985"] } } },
  { id: "logo", props: { value: "https://nitro.dev/scan/logo", logoAreaSize: 48, logoPadding: 4, logo: <View style={{ flex: 1, backgroundColor: "#4338CA", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>QR</Text></View> } },
  { id: "transparent-light", props: { value: "https://nitro.dev/scan/transparent-light", backgroundColor: "transparent" } },
  { id: "transparent-dark", darkBackdrop: true, props: { value: "https://nitro.dev/scan/transparent-dark", foregroundColor: "#FFFFFF", backgroundColor: "transparent" } },
  { id: "quiet-zone", props: { value: "https://nitro.dev/scan/quiet-zone", quietZone: 0, scanSafe: true } },
  { id: "clear-previous", props: { value: "https://nitro.dev/scan/clear-previous", keepPreviousImage: false } },
  { id: "invalid-empty", expectedError: true, props: { value: "" } },
  { id: "recover", props: { value: "https://nitro.dev/scan/recover" } },
  { id: "strict-low-contrast", expectedError: true, props: { value: "reject-low-contrast", foregroundColor: "#EEEEEE", backgroundColor: "#FFFFFF", scanSafe: "strict" } },
  { id: "final-recover", props: { value: "https://nitro.dev/scan/final-recover", imageStyle: { opacity: 0.9 } } },
];

export default function ScanabilityScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState("pending");
  const specimen = SCAN_CASES[index];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>QR scanability</Text>
      <Text testID="scan-case" style={styles.text}>{specimen.id}</Text>
      <View style={[styles.stage, specimen.darkBackdrop && styles.dark]}>
        <QRCode
          size={240}
          {...specimen.props}
          onReady={() => setResult(specimen.expectedError ? "FAIL:accepted" : `ready:${specimen.id}`)}
          onError={(error) => setResult(specimen.expectedError ? `rejected:${specimen.id}` : `FAIL:${error.message}`)}
        />
      </View>
      <Text testID="scan-result" style={styles.text}>{result}</Text>
      <Pressable
        testID="scan-next"
        accessibilityRole="button"
        accessibilityLabel="Next scan case"
        disabled={index === SCAN_CASES.length - 1}
        onPress={() => {
          setResult("pending");
          setIndex((current) => Math.min(current + 1, SCAN_CASES.length - 1));
        }}
        style={styles.button}
      >
        <Text style={styles.text}>Next case</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", gap: 16, backgroundColor: "#101112" },
  title: { color: "#F8FAFC", fontSize: 24, fontWeight: "700" },
  text: { color: "#F8FAFC", fontSize: 16 },
  stage: { width: 320, height: 320, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  dark: { backgroundColor: "#101112" },
  button: { padding: 16, borderRadius: 12, backgroundColor: "#1E293B" },
});
