import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type E2eScreenProps = {
  testID: string;
  label: string;
  gap?: number;
  children: ReactNode;
};

export function E2eScreen({ testID, label, gap = 16, children }: E2eScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      testID={testID}
      accessibilityLabel={label}
      style={e2eStyles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap,
      }}
    >
      {children}
    </ScrollView>
  );
}

export const e2eStyles = StyleSheet.create({
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
    fontSize: 14,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
});
