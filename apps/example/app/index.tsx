import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getMatrix,
  getQRCodeCacheSize,
  NitroQRCode,
  QRCode,
  type QRCodeGradient,
  type QRCodeShapeOptions,
} from "react-native-nitro-qrcode";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const INITIAL_URL =
  "https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode";
const PRESET_PREVIEW_VALUE = "https://nitro.margelo.com/demo";
const PREVIEW_SIZE = 244;
const PRESET_PREVIEW_SIZE = 26;
const METRIC_RASTER_SIZE = Math.max(PREVIEW_SIZE * 3, 512);
const APP_ICON = require("../assets/icon.png");
const COLOR_PRESETS = ["mono", "blue", "sunset", "radial"] as const;
const STYLE_PRESET_IDS = ["classic", "soft", "dots", "badge"] as const;
const DENSITY_PRESETS = ["tight", "balanced", "airy"] as const;

type ColorPreset = (typeof COLOR_PRESETS)[number];
type StylePresetId = (typeof STYLE_PRESET_IDS)[number];
type DensityPreset = (typeof DENSITY_PRESETS)[number];

type ColorStyle = {
  foregroundColor: string;
  gradient?: QRCodeGradient;
  accent: string;
};

type StylePreset = {
  label: string;
  note: string;
  previewColorPreset: ColorPreset;
  defaultDensity: DensityPreset;
  defaultShowLogo: boolean;
  shapeOptions: QRCodeShapeOptions;
};

type DensityConfig = {
  label: string;
  gapOffset: number;
  eyeGapOffset: number;
};

const COLOR_STYLES: Record<ColorPreset, ColorStyle> = {
  mono: {
    foregroundColor: "#101112",
    accent: "#28D17C",
  },
  blue: {
    foregroundColor: "#4AA8FF",
    gradient: {
      colors: ["#7AC7FF", "#4AA8FF", "#327EFF"],
      locations: [0, 0.45, 1],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
    accent: "#4AA8FF",
  },
  sunset: {
    foregroundColor: "#FF7A59",
    gradient: {
      colors: ["#FFB457", "#FF7A59", "#E5488D"],
      locations: [0, 0.5, 1],
      start: { x: 0.1, y: 0 },
      end: { x: 0.9, y: 1 },
    },
    accent: "#FF7A59",
  },
  radial: {
    foregroundColor: "#7B61FF",
    gradient: {
      type: "radial",
      colors: ["#8DEBFF", "#4AA8FF", "#7B61FF"],
      locations: [0, 0.55, 1],
      start: { x: 0.5, y: 0.5 },
      end: { x: 1, y: 0.5 },
    },
    accent: "#7B61FF",
  },
};

const STYLE_PRESETS: Record<StylePresetId, StylePreset> = {
  classic: {
    label: "Classic",
    note: "Sharp grid",
    previewColorPreset: "mono",
    defaultDensity: "tight",
    defaultShowLogo: false,
    shapeOptions: {
      shape: "square",
      eyePatternShape: "square",
      gap: 0,
      eyePatternGap: 0,
    },
  },
  soft: {
    label: "Soft",
    note: "Rounded body",
    previewColorPreset: "blue",
    defaultDensity: "balanced",
    defaultShowLogo: true,
    shapeOptions: {
      shape: "rounded",
      eyePatternShape: "square",
      gap: 0.35,
      eyePatternGap: 0,
    },
  },
  dots: {
    label: "Dots",
    note: "Open circles",
    previewColorPreset: "blue",
    defaultDensity: "balanced",
    defaultShowLogo: false,
    shapeOptions: {
      shape: "circle",
      eyePatternShape: "square",
      gap: 0.55,
      eyePatternGap: 0,
    },
  },
  badge: {
    label: "Badge",
    note: "Rounded + mark",
    previewColorPreset: "sunset",
    defaultDensity: "balanced",
    defaultShowLogo: true,
    shapeOptions: {
      shape: "rounded",
      eyePatternShape: "rounded",
      gap: 0.45,
      eyePatternGap: 0.1,
    },
  },
};

const DENSITY_CONFIG: Record<DensityPreset, DensityConfig> = {
  tight: {
    label: "Tight",
    gapOffset: -0.2,
    eyeGapOffset: -0.05,
  },
  balanced: {
    label: "Balanced",
    gapOffset: 0,
    eyeGapOffset: 0,
  },
  airy: {
    label: "Airy",
    gapOffset: 0.25,
    eyeGapOffset: 0.15,
  },
};

export default function DemoScreen() {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(INITIAL_URL);
  const [stylePresetId, setStylePresetId] = useState<StylePresetId>("soft");
  const [density, setDensity] = useState<DensityPreset>("balanced");
  const [colorPreset, setColorPreset] = useState<ColorPreset>("blue");
  const [showLogo, setShowLogo] = useState(true);
  const [fps, setFps] = useState(60);
  const frameCount = useRef(0);
  const lastFpsTick = useRef(0);

  useEffect(() => {
    let frameId = 0;
    let mounted = true;
    lastFpsTick.current = Date.now();

    function tick() {
      if (!mounted) {
        return;
      }

      frameCount.current += 1;
      const timestamp = Date.now();
      const elapsed = timestamp - lastFpsTick.current;
      if (elapsed >= 500) {
        setFps(Math.round((frameCount.current * 1000) / elapsed));
        frameCount.current = 0;
        lastFpsTick.current = timestamp;
      }
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(frameId);
    };
  }, []);

  const stylePreset = STYLE_PRESETS[stylePresetId];
  const colorStyle = COLOR_STYLES[colorPreset];
  const shapeOptions = useMemo<QRCodeShapeOptions>(
    () => resolveShapeOptions(stylePresetId, density),
    [density, stylePresetId],
  );

  const logoAreaSize = showLogo ? 66 : 0;
  const logoAreaBorderRadius = showLogo ? 14 : 0;

  const metrics = useMemo(() => {
    const startedAt = now();
    const png = NitroQRCode.toPngBase64({
      value,
      size: METRIC_RASTER_SIZE,
      errorCorrectionLevel: showLogo ? "H" : "M",
      foregroundColor: colorStyle.foregroundColor,
      gradient: colorStyle.gradient,
      shapeOptions: scaleShapeOptions(
        shapeOptions,
        METRIC_RASTER_SIZE / PREVIEW_SIZE,
      ),
      logoAreaSize: Math.round(
        logoAreaSize * (METRIC_RASTER_SIZE / PREVIEW_SIZE),
      ),
      logoAreaBorderRadius: Math.round(
        logoAreaBorderRadius * (METRIC_RASTER_SIZE / PREVIEW_SIZE),
      ),
    });
    const elapsed = now() - startedAt;
    const matrix = getMatrix({ value });

    return {
      elapsed,
      bytes: Math.ceil((png.length * 3) / 4),
      matrixSize: matrix.size,
      cacheSize: getQRCodeCacheSize(),
    };
  }, [
    colorStyle.foregroundColor,
    colorStyle.gradient,
    logoAreaBorderRadius,
    logoAreaSize,
    shapeOptions,
    showLogo,
    value,
  ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>react-native-nitro-qrcode</Text>
        <Text style={styles.title}>Nitro QRCode</Text>
        <Text style={styles.subtitle}>
          Preset-driven QR styling without SVG or Skia
        </Text>
      </View>

      <View style={styles.stage}>
        <View style={styles.qrShell}>
          <QRCode
            value={value}
            size={PREVIEW_SIZE}
            errorCorrectionLevel={showLogo ? "H" : "M"}
            foregroundColor={colorStyle.foregroundColor}
            backgroundColor="#FFFFFF"
            gradient={colorStyle.gradient}
            shapeOptions={shapeOptions}
            logoAreaSize={logoAreaSize}
            logoAreaBorderRadius={logoAreaBorderRadius}
            logo={showLogo ? <LogoMark /> : undefined}
            testID="nitro-qrcode-preview"
          />
        </View>

        <View style={styles.stageMeta}>
          <Tag>{stylePreset.label}</Tag>
          <Tag>{DENSITY_CONFIG[density].label}</Tag>
          <Tag>{capitalize(colorPreset)}</Tag>
          <Tag>{showLogo ? "Mark on" : "Mark off"}</Tag>
        </View>
      </View>

      <View style={styles.inputPanel}>
        <Text style={styles.label}>Payload</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={Platform.OS === "web" ? "default" : "url"}
          style={styles.input}
          selectionColor="#28D17C"
        />
      </View>

      <View style={styles.controls}>
        <ControlGroup label="Style">
          <StylePresetGrid
            selected={stylePresetId}
            onChange={(nextValue) => {
              const nextPreset = STYLE_PRESETS[nextValue];
              setStylePresetId(nextValue);
              setDensity(nextPreset.defaultDensity);
              setShowLogo(nextPreset.defaultShowLogo);
            }}
          />
        </ControlGroup>

        <ControlGroup label="Palette">
          <ColorControl
            value={colorPreset}
            values={COLOR_PRESETS}
            onChange={setColorPreset}
          />
        </ControlGroup>

        <ControlGroup label="Density">
          <SegmentedControl
            value={density}
            values={DENSITY_PRESETS}
            onChange={setDensity}
            getLabel={(option) => DENSITY_CONFIG[option].label}
          />
        </ControlGroup>

        <ControlGroup label="Center mark">
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: showLogo }}
            onPress={() => {
              setShowLogo((current) => !current);
            }}
            style={[styles.toggle, showLogo && styles.toggleActive]}
          >
            <View
              style={[styles.toggleKnob, showLogo && styles.toggleKnobActive]}
            />
          </Pressable>
        </ControlGroup>
      </View>

      <View style={styles.metricsGrid}>
        <Metric
          label="Generate"
          value={`${metrics.elapsed.toFixed(2)} ms`}
          tone="green"
        />
        <Metric
          label="FPS"
          value={`${fps}`}
          tone={fps >= 55 ? "green" : "amber"}
        />
        <Metric
          label="PNG"
          value={`${formatBytes(metrics.bytes)}`}
          tone="blue"
        />
        <Metric
          label="Matrix"
          value={`${metrics.matrixSize} x ${metrics.matrixSize}`}
          tone="purple"
        />
        <Metric label="Cache" value={`${metrics.cacheSize}`} tone="green" />
      </View>
    </ScrollView>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.controlGroup}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function StylePresetGrid({
  selected,
  onChange,
}: {
  selected: StylePresetId;
  onChange: (value: StylePresetId) => void;
}) {
  return (
    <View style={styles.styleGrid}>
      {STYLE_PRESET_IDS.map((presetId) => {
        const preset = STYLE_PRESETS[presetId];
        const previewColor = COLOR_STYLES[preset.previewColorPreset];
        const selectedOption = presetId === selected;
        const previewShapeOptions = resolveShapeOptions(
          presetId,
          preset.defaultDensity,
        );

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedOption }}
            key={presetId}
            onPress={() => {
              onChange(presetId);
            }}
            style={[
              styles.styleOption,
              selectedOption && styles.styleOptionSelected,
            ]}
          >
            <View style={styles.stylePreviewShell}>
              <QRCode
                value={PRESET_PREVIEW_VALUE}
                size={PRESET_PREVIEW_SIZE}
                errorCorrectionLevel={preset.defaultShowLogo ? "H" : "M"}
                foregroundColor={previewColor.foregroundColor}
                backgroundColor="#FFFFFF"
                gradient={previewColor.gradient}
                shapeOptions={previewShapeOptions}
                logoAreaSize={preset.defaultShowLogo ? 16 : 0}
                logoAreaBorderRadius={6}
                logo={preset.defaultShowLogo ? <MiniLogoMark /> : undefined}
              />
            </View>
            <Text
              style={[
                styles.styleOptionText,
                selectedOption && styles.styleOptionTextSelected,
              ]}
            >
              {preset.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SegmentedControl<T extends string>({
  value,
  values,
  onChange,
  getLabel,
}: {
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
}) {
  return (
    <View style={styles.segmented}>
      {values.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option}
            onPress={() => {
              onChange(option);
            }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              style={[
                styles.segmentText,
                selected && styles.segmentTextSelected,
              ]}
            >
              {getLabel?.(option) ?? capitalize(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ColorControl({
  value,
  values,
  onChange,
}: {
  value: ColorPreset;
  values: readonly ColorPreset[];
  onChange: (value: ColorPreset) => void;
}) {
  return (
    <View style={styles.colorGrid}>
      {values.map((option) => {
        const selected = option === value;
        const color = COLOR_STYLES[option].accent;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option}
            onPress={() => {
              onChange(option);
            }}
            style={[styles.colorOption, selected && styles.colorOptionSelected]}
          >
            <View style={[styles.colorSwatch, { backgroundColor: color }]} />
            <Text
              style={[
                styles.colorOptionText,
                selected && styles.colorOptionTextSelected,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

function LogoMark() {
  return (
    <View style={styles.logoMark}>
      <Image
        source={APP_ICON}
        style={styles.logoMarkImage}
        resizeMode="contain"
      />
    </View>
  );
}

function MiniLogoMark() {
  return (
    <View style={styles.miniLogoMark}>
      <Image
        source={APP_ICON}
        style={styles.miniLogoMarkImage}
        resizeMode="contain"
      />
    </View>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "blue" | "purple";
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricAccent, getToneStyle(tone)]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function getToneStyle(tone: "green" | "amber" | "blue" | "purple") {
  switch (tone) {
    case "green":
      return styles.greenAccent;
    case "amber":
      return styles.amberAccent;
    case "blue":
      return styles.blueAccent;
    case "purple":
      return styles.purpleAccent;
  }
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clampSpacing(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

function resolveShapeOptions(
  presetId: StylePresetId,
  density: DensityPreset,
): QRCodeShapeOptions {
  const preset = STYLE_PRESETS[presetId];
  const densityConfig = DENSITY_CONFIG[density];

  return {
    shape: preset.shapeOptions.shape,
    eyePatternShape: preset.shapeOptions.eyePatternShape,
    gap: clampSpacing((preset.shapeOptions.gap ?? 0) + densityConfig.gapOffset),
    eyePatternGap: clampSpacing(
      (preset.shapeOptions.eyePatternGap ?? 0) + densityConfig.eyeGapOffset,
    ),
  };
}

function scaleShapeOptions(
  options: QRCodeShapeOptions,
  scale: number,
): QRCodeShapeOptions {
  return {
    shape: options.shape,
    eyePatternShape: options.eyePatternShape,
    gap: Math.round((options.gap ?? 0) * scale),
    eyePatternGap: Math.round((options.eyePatternGap ?? 0) * scale),
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#101112",
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    gap: 6,
  },
  kicker: {
    color: "#28D17C",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: "#F8FAF8",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#A9B0AA",
    fontSize: 16,
    lineHeight: 22,
  },
  stage: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  qrShell: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 18,
    boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
  },
  stageMeta: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  tag: {
    backgroundColor: "#181B19",
    borderColor: "#303532",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  tagText: {
    color: "#CBD2CD",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
  },
  inputPanel: {
    gap: 8,
  },
  label: {
    color: "#CBD2CD",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 52,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#303532",
    backgroundColor: "#181B19",
    color: "#F8FAF8",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  controls: {
    gap: 16,
  },
  controlGroup: {
    gap: 8,
  },
  styleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  styleOption: {
    alignItems: "center",
    backgroundColor: "#181B19",
    borderColor: "#303532",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    minWidth: 112,
    paddingHorizontal: 10,
  },
  styleOptionSelected: {
    borderColor: "#CBD2CD",
  },
  stylePreviewShell: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    justifyContent: "center",
    height: 28,
    width: 28,
  },
  styleOptionText: {
    color: "#CBD2CD",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  styleOptionTextSelected: {
    color: "#F8FAF8",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorOption: {
    alignItems: "center",
    backgroundColor: "#181B19",
    borderColor: "#303532",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    minWidth: 110,
    paddingHorizontal: 12,
  },
  colorOptionSelected: {
    borderColor: "#CBD2CD",
  },
  colorSwatch: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  colorOptionText: {
    color: "#CBD2CD",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "capitalize",
  },
  colorOptionTextSelected: {
    color: "#F8FAF8",
  },
  segmented: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#303532",
    flexDirection: "row",
    overflow: "hidden",
  },
  segment: {
    alignItems: "center",
    backgroundColor: "#181B19",
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentSelected: {
    backgroundColor: "#28D17C",
  },
  segmentText: {
    color: "#CBD2CD",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  segmentTextSelected: {
    color: "#101112",
  },
  toggle: {
    width: 72,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#303532",
    backgroundColor: "#181B19",
    padding: 4,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#28D17C",
    borderColor: "#28D17C",
  },
  toggleKnob: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#F8FAF8",
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metric: {
    minWidth: 96,
    flexGrow: 1,
    backgroundColor: "#181B19",
    borderColor: "#303532",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  metricAccent: {
    width: 32,
    height: 3,
    borderRadius: 999,
  },
  metricLabel: {
    color: "#8D9790",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#F8FAF8",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
  },
  greenAccent: {
    backgroundColor: "#28D17C",
  },
  amberAccent: {
    backgroundColor: "#FFB457",
  },
  blueAccent: {
    backgroundColor: "#4AA8FF",
  },
  purpleAccent: {
    backgroundColor: "#7B61FF",
  },
  logoMark: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoMarkImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  miniLogoMark: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  miniLogoMarkImage: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
  },
});
