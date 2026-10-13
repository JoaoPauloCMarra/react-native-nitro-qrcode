import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  QRCode,
  getQRCodeMetrics,
  resetQRCodeMetrics,
  setQRCodeMetricsEnabled,
} from "react-native-nitro-qrcode";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildVisualSpecimens,
  runComboSweep,
  type ComboReport,
} from "../components/generation-matrix";
import { formatReadyWall, useReadyWall } from "../components/ready-wall";

const VISUALS = buildVisualSpecimens();

function formatReport(report: ComboReport): string {
  const heap =
    report.heapDelta === undefined
      ? "n/a"
      : `${(report.heapDelta / 1024 / 1024).toFixed(2)} MiB`;
  const failures =
    report.failures.length === 0
      ? "none"
      : report.failures
          .slice(0, 8)
          .map((failure) => `${failure.id} ${failure.method}: ${failure.message}`)
          .join(" | ");
  return [
    `ok=${report.ok}/${report.total}`,
    `fail=${report.failed}`,
    `ms=${report.elapsedMs.toFixed(0)}`,
    `p50=${report.p50Ms.toFixed(2)}`,
    `p95=${report.p95Ms.toFixed(2)}`,
    `max=${report.maxMs.toFixed(2)}`,
    `cache=${report.cacheEntries}/${report.cacheBytes}`,
    `heap=${heap}`,
    `race=${report.raceOk ? "ok" : "fail"}`,
    `leak=${report.leakOk ? "ok" : "fail"}`,
    `failures=${failures}`,
  ].join("; ");
}

export default function ComboScreen() {
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState("starting");
  const [reportText, setReportText] = useState("(idle)");
  const [showProbe, setShowProbe] = useState(false);
  const [showVisuals, setShowVisuals] = useState(false);
  const [rerenderTicks, setRerenderTicks] = useState(0);
  const [rerenderResult, setRerenderResult] = useState("(idle)");
  const [visualsGeneration, setVisualsGeneration] = useState(0);
  const wall = useReadyWall(VISUALS.length);
  const visualStatus = formatReadyWall(wall, VISUALS.length);

  const startSweep = useCallback(
    (isCancelled: () => boolean = () => false) => {
      void runComboSweep((done, total) => {
        if (!isCancelled()) {
          setProgress(`running ${done}/${total}`);
        }
      }).then((report) => {
        if (isCancelled()) {
          return;
        }
        setProgress(report.failed === 0 ? "e2e-combo-done" : "e2e-combo-failed");
        setReportText(formatReport(report));
        (
          globalThis as { __comboReport?: ComboReport }
        ).__comboReport = report;
        setShowProbe(true);
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    startSweep(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [startSweep]);

  useEffect(() => {
    if (!showProbe) {
      return;
    }
    setQRCodeMetricsEnabled(true);
    resetQRCodeMetrics();
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      setRerenderTicks((current) => current + 1);
      if (ticks >= 12) {
        clearInterval(timer);
        const snapshot = getQRCodeMetrics();
        const extra = snapshot.requests > 1;
        setRerenderResult(
          extra
            ? `fail:requests=${snapshot.requests}`
            : `ok:requests=${snapshot.requests}:ticks=12`,
        );
        setShowVisuals(true);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [showProbe]);

  const stableValue = useMemo(() => "rerender-stable-qr", []);

  return (
    <ScrollView
      testID="e2e-combo-screen"
      accessibilityLabel="E2E combo sweep"
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
      <Text testID="e2e-combo-ready" style={styles.ready}>
        {progress}
      </Text>
      <Text style={styles.title}>Combo sweep</Text>
      <Text style={styles.subtitle}>
        Every discrete QR generation path, plus cache leak, async race, and
        parent rerender checks.
      </Text>
      <Text testID="e2e-combo-report" style={styles.metric}>
        {reportText}
      </Text>
      <Text testID="e2e-combo-rerender" style={styles.metric}>
        {rerenderResult} · ticks={rerenderTicks}
      </Text>
      <Text testID="e2e-combo-visuals" style={styles.metric}>
        {visualStatus}
      </Text>
      {showProbe ? (
      <View style={styles.probe}>
        <QRCode value={stableValue} size={72} testID="e2e-combo-rerender-qr" />
      </View>
      ) : null}
      <View style={styles.grid}>
        {showVisuals
          ? VISUALS.map((specimen) => (
          <View key={`${specimen.id}-${visualsGeneration}`} style={styles.card} testID={`e2e-combo-${specimen.id}`}>
            <QRCode
              {...specimen.options}
              preset={specimen.preset}
              size={specimen.options.size ?? 96}
              testID={`e2e-combo-qr-${specimen.id}`}
              logo={
                specimen.logo === true ? (
                  <View style={styles.logo}>
                    <Text style={styles.logoText}>N</Text>
                  </View>
                ) : undefined
              }
              onReady={() => wall.markReady(specimen.id)}
              onError={() => wall.markReady(specimen.id, true)}
            />
            <Text style={styles.label}>{specimen.label}</Text>
          </View>
        ))
          : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Re-run combo sweep"
        style={styles.button}
        onPress={() => {
          setProgress("starting");
          setReportText("(idle)");
          wall.reset();
          setVisualsGeneration((value) => value + 1);
          startSweep();
        }}
      >
        <Text style={styles.buttonText}>Re-run sweep</Text>
      </Pressable>
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
    color: "#A7F3D0",
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 16,
  },
  probe: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: 132,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: "#334155",
    fontSize: 10,
    textAlign: "center",
  },
  logo: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  button: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
});
