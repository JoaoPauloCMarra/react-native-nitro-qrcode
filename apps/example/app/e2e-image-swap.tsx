import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { QRCode } from "react-native-nitro-qrcode";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAYLOAD = "0123456789abcdef".repeat(20);

export default function ImageSwapScreen() {
  const insets = useSafeAreaInsets();
  const [cycle, setCycle] = useState(1);
  const [readyCycle, setReadyCycle] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCycle((current) => Math.min(current + 1, 12));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>QR image swap · issue 25</Text>
      <Text testID="swap-cycle" style={styles.text}>Cycle {cycle}</Text>
      <View style={styles.stage}>
        <QRCode
          value={`https://example.com/scan/${cycle}?payload=${PAYLOAD}&cycle=${cycle}`}
          size={272}
          backgroundColor="#FFFFFF"
          foregroundColor="#11121A"
          errorCorrectionLevel="H"
          quietZone={8}
          keepPreviousImage
          onReady={() => setReadyCycle(cycle)}
        />
      </View>
      <Text testID="swap-ready" style={styles.text}>Generated {readyCycle}</Text>
      <Text style={styles.text}>The QR must stay visible between updates.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", gap: 24, backgroundColor: "#11121A" },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  text: { color: "#FFFFFF", fontSize: 16 },
  stage: { width: 272, height: 272, backgroundColor: "#FFFFFF" },
});
