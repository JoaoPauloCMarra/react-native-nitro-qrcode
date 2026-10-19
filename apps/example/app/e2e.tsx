import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { QrcodeE2eLab } from "../components/e2e-lab";
import { E2eScreen } from "../components/e2e-screen";

const LABS = [
  { id: "render", label: "Open render wall" },
  { id: "visuals", label: "Open visual wall" },
  { id: "scanability", label: "Open scanability wall" },
  { id: "combo", label: "Open combo sweep" },
  { id: "png-bench", label: "Open PNG bench" },
  { id: "image-swap", label: "Open image swap" },
] as const;

export default function QrcodeE2eScreen() {
  return (
    <E2eScreen testID="e2e-screen" label="E2E lab">
      <View>
        <Text testID="e2e-ready" style={styles.ready}>
          e2e-ready
        </Text>
        <Text style={styles.kicker}>react-native-nitro-qrcode</Text>
        <Text style={styles.title}>E2E lab</Text>
        <Text style={styles.subtitle}>
          Deep link qrcode://e2e. Human demo stays on the home route.
        </Text>
        <Text testID="e2e-deeplink" style={styles.deeplink}>
          qrcode://e2e
        </Text>
      </View>
      <QrcodeE2eLab />
      {LABS.map((lab) => (
        <Link key={lab.id} href={`/e2e-${lab.id}` as Href} asChild>
          <Pressable
            testID={`open-e2e-${lab.id}`}
            accessibilityRole="link"
            accessibilityLabel={lab.label}
            style={styles.renderLink}
          >
            <Text style={styles.renderLinkText}>{lab.label}</Text>
          </Pressable>
        </Link>
      ))}
    </E2eScreen>
  );
}

const styles = StyleSheet.create({
  ready: {
    color: "#86EFAC",
    fontFamily: "Menlo",
    fontSize: 12,
    marginBottom: 8,
  },
  kicker: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 4,
  },
  subtitle: {
    color: "#CBD5E1",
    fontSize: 14,
    marginTop: 6,
  },
  deeplink: {
    color: "#64748B",
    fontFamily: "Menlo",
    fontSize: 12,
    marginTop: 8,
  },
  renderLink: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  renderLinkText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
});
