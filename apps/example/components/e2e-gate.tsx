import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

export function E2eGate() {
  return (
    <Link href={"/e2e" as Href} asChild>
      <Pressable
        testID="open-e2e-lab"
        accessibilityRole="link"
        accessibilityLabel="Open E2E lab"
        style={styles.gate}
      >
        <Text style={styles.label}>E2E lab</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  gate: {
    alignSelf: "flex-start",
    marginTop: 24,
    paddingVertical: 6,
  },
  label: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
});
