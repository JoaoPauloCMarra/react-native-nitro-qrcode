import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QrcodeE2eLab } from "../components/e2e-lab";

export default function QrcodeE2eScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      testID="e2e-screen"
      accessibilityLabel="E2E lab"
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
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
      <Link href={"/e2e-render" as Href} asChild>
        <Pressable
          testID="open-e2e-render"
          accessibilityRole="link"
          accessibilityLabel="Open render wall"
          style={styles.renderLink}
        >
          <Text style={styles.renderLinkText}>Open render wall</Text>
        </Pressable>
      </Link>
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
