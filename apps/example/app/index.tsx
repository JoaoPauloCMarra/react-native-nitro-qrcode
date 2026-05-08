import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  getMatrix,
  getQRCodeCacheSize,
  NitroQRCode,
  QRCode,
  type QRCodeRef,
  type QRCodeBodyShape,
  type QRCodeEyeBallShape,
  type QRCodeEyeFrameShape,
  type QRCodeGradient,
  type QRCodeShapeOptions,
} from "react-native-nitro-qrcode";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const INITIAL_URL =
  "https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode";
const PREVIEW_SIZE = 244;
const METRIC_RASTER_SIZE = Math.max(Math.ceil(PREVIEW_SIZE * 3), 96);
const APP_ICON = require("../assets/icon.png");
const CONFIG_TABS = ["color", "shapes", "logo"] as const;
const LOGO_PADDING_PRESETS = ["none", "small", "medium", "large"] as const;
const BODY_SHAPES = ["square", "circle"] as const;
const EYE_FRAME_SHAPES = [
  "square",
  "rounded",
  "circle",
] as const satisfies readonly QRCodeEyeFrameShape[];
const EYE_BALL_SHAPES = [
  "square",
  "rounded",
  "circle",
] as const satisfies readonly QRCodeEyeBallShape[];

type ConfigTab = (typeof CONFIG_TABS)[number];
type LogoPaddingPreset = (typeof LOGO_PADDING_PRESETS)[number];
type ColorMode = "single" | "gradient";
type GradientType = NonNullable<QRCodeGradient["type"]>;

type ForegroundConfig = {
  enabled: boolean;
  mode: ColorMode;
  singleColor: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientType: GradientType;
};

type BackgroundConfig = {
  enabled: boolean;
  color: string;
};

type SolidColorConfig = {
  enabled: boolean;
  color: string;
};

type DemoMetrics = {
  elapsed: number;
  bytes: number;
  matrixSize: number;
  cacheSize: number;
};

const DEFAULT_FOREGROUND_CONFIG: ForegroundConfig = {
  enabled: true,
  mode: "gradient",
  singleColor: "#09090B",
  gradientStartColor: "#09090B",
  gradientEndColor: "#1E3A8A",
  gradientType: "linear",
};

const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
  enabled: true,
  color: "#FFFFFF",
};

const DEFAULT_STROKE_CONFIG: SolidColorConfig = {
  enabled: false,
  color: "#111827",
};

const DEFAULT_EYE_CONFIG: SolidColorConfig = {
  enabled: true,
  color: "#1E40AF",
};

const DEFAULT_EYE_STROKE_CONFIG: SolidColorConfig = {
  enabled: false,
  color: "#020617",
};

const DEFAULT_EYEBALL_CONFIG: SolidColorConfig = {
  enabled: true,
  color: "#0F172A",
};

const DEFAULT_SHAPE_OPTIONS: QRCodeShapeOptions = {
  shape: "square",
  eyeFrameShape: "square",
  eyeballShape: "square",
  gap: 0,
  eyePatternGap: 0,
};

const LOGO_PADDING_CONFIG: Record<LogoPaddingPreset, number> = {
  none: 0,
  small: 6,
  medium: 10,
  large: 14,
};

export default function DemoScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isWideLayout = windowWidth >= 900;
  const [value, setValue] = useState(INITIAL_URL);
  const [foregroundConfig, setForegroundConfig] = useState<ForegroundConfig>(
    DEFAULT_FOREGROUND_CONFIG,
  );
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>(
    DEFAULT_BACKGROUND_CONFIG,
  );
  const [strokeConfig, setStrokeConfig] = useState<SolidColorConfig>(
    DEFAULT_STROKE_CONFIG,
  );
  const [eyeConfig, setEyeConfig] =
    useState<SolidColorConfig>(DEFAULT_EYE_CONFIG);
  const [eyeStrokeConfig, setEyeStrokeConfig] = useState<SolidColorConfig>(
    DEFAULT_EYE_STROKE_CONFIG,
  );
  const [eyeballConfig, setEyeballConfig] = useState<SolidColorConfig>(
    DEFAULT_EYEBALL_CONFIG,
  );
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTab>("color");
  const [bodyShape, setBodyShape] = useState<QRCodeBodyShape>("square");
  const [eyeFrameShape, setEyeFrameShape] =
    useState<QRCodeEyeFrameShape>("square");
  const [eyeballShape, setEyeballShape] =
    useState<QRCodeEyeBallShape>("square");
  const [showLogo, setShowLogo] = useState(false);
  const [logoPadding, setLogoPadding] = useState<LogoPaddingPreset>("medium");
  const [fps, setFps] = useState(60);
  const frameCount = useRef(0);
  const lastFpsTick = useRef(0);
  const [metrics, setMetrics] = useState<DemoMetrics>({
    elapsed: 0,
    bytes: 0,
    matrixSize: 0,
    cacheSize: 0,
  });
  const [readyUri, setReadyUri] = useState("");
  const [qrError, setQrError] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<Error | null>(null);
  const qrRef = useRef<QRCodeRef>(null);

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

  const shapeOptions = useMemo<QRCodeShapeOptions>(
    () =>
      resolveShapeOptions({
        bodyShape,
        eyeFrameShape,
        eyeballShape,
      }),
    [bodyShape, eyeFrameShape, eyeballShape],
  );
  const foregroundColor = resolveForegroundColor(foregroundConfig);
  const backgroundColor = resolveBackgroundColor(backgroundConfig);
  const strokeColor = resolveSolidColor(strokeConfig, "#000000");
  const eyeColor = resolveSolidColor(eyeConfig, "#000000");
  const eyeStrokeColor = resolveSolidColor(eyeStrokeConfig, "#000000");
  const eyeballColor = resolveSolidColor(eyeballConfig, "#000000");
  const gradient = useMemo(
    () => resolveGradient(foregroundConfig),
    [foregroundConfig],
  );

  const logoAreaSize = showLogo ? 66 : 0;
  const logoAreaBorderRadius = showLogo ? 14 : 0;
  const logoPaddingSize = showLogo ? LOGO_PADDING_CONFIG[logoPadding] : 0;

  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(() => {
      const startedAt = now();
      void NitroQRCode.toPngBase64Async({
        value,
        size: METRIC_RASTER_SIZE,
        errorCorrectionLevel: showLogo ? "H" : "M",
        foregroundColor,
        backgroundColor,
        strokeColor,
        eyeColor,
        eyeStrokeColor,
        eyeballColor,
        gradient,
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
      }).then(
        (png) => {
          if (!isMounted) {
            return;
          }

          const matrix = getMatrix({ value });
          setMetricsError(null);
          setMetrics({
            elapsed: now() - startedAt,
            bytes: Math.ceil((png.length * 3) / 4),
            matrixSize: matrix.size,
            cacheSize: getQRCodeCacheSize(),
          });
        },
        (error: unknown) => {
          if (!isMounted) {
            return;
          }
          setMetricsError(
            error instanceof Error ? error : new Error(String(error)),
          );
        },
      );
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [
    backgroundColor,
    eyeballColor,
    eyeColor,
    eyeStrokeColor,
    foregroundColor,
    gradient,
    logoAreaBorderRadius,
    logoAreaSize,
    logoPadding,
    shapeOptions,
    showLogo,
    strokeColor,
    value,
  ]);

  if (metricsError !== null) {
    throw metricsError;
  }

  return (
    <ScrollView
      style={styles.screen}
      alwaysBounceHorizontal={false}
      alwaysBounceVertical={false}
      bounces={false}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>react-native-nitro-qrcode</Text>
        <Text style={styles.title}>QR Builder</Text>
        <Text style={styles.subtitle}>
          Configure production-safe QR codes and verify the output live.
        </Text>
      </View>

      <View style={[styles.workbench, isWideLayout && styles.workbenchWide]}>
        <View
          style={[styles.previewPanel, isWideLayout && styles.previewPanelWide]}
        >
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelEyebrow}>Preview</Text>
              <Text style={styles.panelTitle}>Live output</Text>
            </View>
            <Tag>{showLogo ? "Logo on" : "Logo off"}</Tag>
          </View>

          <View style={styles.stage}>
            <View style={styles.qrShell}>
              <QRCode
                ref={qrRef}
                value={value}
                size={PREVIEW_SIZE}
                placeholder={
                  <View style={styles.qrPlaceholder}>
                    <Text style={styles.qrPlaceholderText}>Generating QR…</Text>
                  </View>
                }
                hideLogoUntilReady
                onReady={(uri) => {
                  setReadyUri(uri);
                  setQrError(null);
                }}
                onError={(error) => {
                  setQrError(error.message);
                }}
                errorCorrectionLevel={showLogo ? "H" : "M"}
                foregroundColor={foregroundColor}
                backgroundColor={backgroundColor}
                strokeColor={strokeColor}
                eyeColor={eyeColor}
                eyeStrokeColor={eyeStrokeColor}
                eyeballColor={eyeballColor}
                gradient={gradient}
                shapeOptions={shapeOptions}
                logoAreaSize={logoAreaSize}
                logoAreaBorderRadius={logoAreaBorderRadius}
                logoPadding={logoPaddingSize}
                logo={showLogo ? <LogoMark /> : undefined}
                testID="nitro-qrcode-preview"
              />
            </View>

            <View style={styles.stageMeta}>
              <Tag>{capitalize(bodyShape)}</Tag>
              <Tag>{gradient === undefined ? "Single" : "Gradient"}</Tag>
              <Tag>{readyUri === "" ? "Pending" : "Ready"}</Tag>
              {qrError !== null ? <Tag>{qrError}</Tag> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const data = qrRef.current?.toPngBase64();
                setExportPreview(
                  data === undefined
                    ? "Export unavailable"
                    : `Base64: ${data.slice(0, 14)}…`,
                );
              }}
              style={styles.selectButton}
            >
              <Text style={styles.selectButtonText}>Export PNG base64</Text>
            </Pressable>
            {exportPreview !== null ? (
              <Text style={styles.label}>{exportPreview}</Text>
            ) : null}
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
              selectionColor="#26A269"
            />
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
              value={`${metrics.matrixSize}x${metrics.matrixSize}`}
              tone="purple"
            />
          </View>
        </View>

        <View
          style={[styles.configPanel, isWideLayout && styles.configPanelWide]}
        >
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelEyebrow}>Builder</Text>
              <Text style={styles.panelTitle}>Configuration</Text>
            </View>
            <Tag>{`${metrics.cacheSize} cached`}</Tag>
          </View>

          <View style={styles.controls}>
            <ConfigTabs value={activeConfigTab} onChange={setActiveConfigTab} />
            {activeConfigTab === "color" ? (
              <ColorConfigPanel
                foregroundConfig={foregroundConfig}
                backgroundConfig={backgroundConfig}
                strokeConfig={strokeConfig}
                eyeConfig={eyeConfig}
                eyeStrokeConfig={eyeStrokeConfig}
                eyeballConfig={eyeballConfig}
                onForegroundChange={setForegroundConfig}
                onBackgroundChange={setBackgroundConfig}
                onStrokeChange={setStrokeConfig}
                onEyeChange={setEyeConfig}
                onEyeStrokeChange={setEyeStrokeConfig}
                onEyeballChange={setEyeballConfig}
              />
            ) : null}
            {activeConfigTab === "shapes" ? (
              <ShapeConfigPanel
                bodyShape={bodyShape}
                eyeFrameShape={eyeFrameShape}
                eyeballShape={eyeballShape}
                onBodyShapeChange={setBodyShape}
                onEyeFrameShapeChange={setEyeFrameShape}
                onEyeballShapeChange={setEyeballShape}
              />
            ) : null}
            {activeConfigTab === "logo" ? (
              <LogoConfigPanel
                logoPadding={logoPadding}
                showLogo={showLogo}
                onLogoPaddingChange={setLogoPadding}
                onShowLogoChange={setShowLogo}
              />
            ) : null}
          </View>
        </View>
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

function ConfigTabs({
  value,
  onChange,
}: {
  value: ConfigTab;
  onChange: (value: ConfigTab) => void;
}) {
  return (
    <View style={styles.tabBar}>
      {CONFIG_TABS.map((tab) => {
        const selected = tab === value;
        return (
          <Pressable
            aria-selected={selected}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab}
            onPress={() => {
              onChange(tab);
            }}
            style={[styles.tabButton, selected && styles.tabButtonSelected]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
              {capitalize(tab)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ColorConfigPanel({
  foregroundConfig,
  backgroundConfig,
  strokeConfig,
  eyeConfig,
  eyeStrokeConfig,
  eyeballConfig,
  onForegroundChange,
  onBackgroundChange,
  onStrokeChange,
  onEyeChange,
  onEyeStrokeChange,
  onEyeballChange,
}: {
  foregroundConfig: ForegroundConfig;
  backgroundConfig: BackgroundConfig;
  strokeConfig: SolidColorConfig;
  eyeConfig: SolidColorConfig;
  eyeStrokeConfig: SolidColorConfig;
  eyeballConfig: SolidColorConfig;
  onForegroundChange: (value: ForegroundConfig) => void;
  onBackgroundChange: (value: BackgroundConfig) => void;
  onStrokeChange: (value: SolidColorConfig) => void;
  onEyeChange: (value: SolidColorConfig) => void;
  onEyeStrokeChange: (value: SolidColorConfig) => void;
  onEyeballChange: (value: SolidColorConfig) => void;
}) {
  return (
    <View style={styles.builderPanel}>
      <ColorSection
        checked={foregroundConfig.enabled}
        label="Foreground color"
        onCheckedChange={(enabled) => {
          onForegroundChange({ ...foregroundConfig, enabled });
        }}
      >
        <ModeSelector
          disabled={!foregroundConfig.enabled}
          value={foregroundConfig.mode}
          onChange={(mode) => {
            onForegroundChange({ ...foregroundConfig, mode });
          }}
        />
        {foregroundConfig.mode === "gradient" ? (
          <View style={styles.colorRow}>
            <ColorInput
              disabled={!foregroundConfig.enabled}
              value={foregroundConfig.gradientStartColor}
              onChange={(gradientStartColor) => {
                onForegroundChange({
                  ...foregroundConfig,
                  gradientStartColor,
                });
              }}
            />
            <ColorInput
              disabled={!foregroundConfig.enabled}
              value={foregroundConfig.gradientEndColor}
              onChange={(gradientEndColor) => {
                onForegroundChange({
                  ...foregroundConfig,
                  gradientEndColor,
                });
              }}
            />
            <SelectButton
              disabled={!foregroundConfig.enabled}
              label={`${capitalize(foregroundConfig.gradientType)} gradient`}
              onPress={() => {
                onForegroundChange({
                  ...foregroundConfig,
                  gradientType:
                    foregroundConfig.gradientType === "linear"
                      ? "radial"
                      : "linear",
                });
              }}
            />
          </View>
        ) : (
          <ColorInput
            disabled={!foregroundConfig.enabled}
            value={foregroundConfig.singleColor}
            onChange={(singleColor) => {
              onForegroundChange({ ...foregroundConfig, singleColor });
            }}
          />
        )}
      </ColorSection>

      <SolidColorSection
        config={strokeConfig}
        label="Custom stroke color"
        onChange={onStrokeChange}
      />

      <SolidColorSection
        config={eyeConfig}
        label="Custom eye color"
        onChange={onEyeChange}
      />

      <SolidColorSection
        config={eyeStrokeConfig}
        label="Custom eye stroke color"
        onChange={onEyeStrokeChange}
      />

      <SolidColorSection
        config={eyeballConfig}
        label="Custom eyeball color"
        onChange={onEyeballChange}
      />

      <ColorSection
        checked={backgroundConfig.enabled}
        label="Background color"
        onCheckedChange={(enabled) => {
          onBackgroundChange({ ...backgroundConfig, enabled });
        }}
      >
        <ColorInput
          disabled={!backgroundConfig.enabled}
          value={backgroundConfig.color}
          onChange={(color) => {
            onBackgroundChange({ ...backgroundConfig, color });
          }}
        />
      </ColorSection>
    </View>
  );
}

function SolidColorSection({
  config,
  label,
  onChange,
}: {
  config: SolidColorConfig;
  label: string;
  onChange: (value: SolidColorConfig) => void;
}) {
  return (
    <ColorSection
      checked={config.enabled}
      label={label}
      onCheckedChange={(enabled) => {
        onChange({ ...config, enabled });
      }}
    >
      <View style={styles.modeRow}>
        <View style={styles.radioOption}>
          <View style={[styles.radio, styles.radioSelected]}>
            <View style={styles.radioDot} />
          </View>
          <Text style={styles.radioText}>Single color</Text>
        </View>
      </View>
      <ColorInput
        disabled={!config.enabled}
        value={config.color}
        onChange={(color) => {
          onChange({ ...config, color });
        }}
      />
    </ColorSection>
  );
}

function ShapeConfigPanel({
  bodyShape,
  eyeFrameShape,
  eyeballShape,
  onBodyShapeChange,
  onEyeFrameShapeChange,
  onEyeballShapeChange,
}: {
  bodyShape: QRCodeBodyShape;
  eyeFrameShape: QRCodeEyeFrameShape;
  eyeballShape: QRCodeEyeBallShape;
  onBodyShapeChange: (value: QRCodeBodyShape) => void;
  onEyeFrameShapeChange: (value: QRCodeEyeFrameShape) => void;
  onEyeballShapeChange: (value: QRCodeEyeBallShape) => void;
}) {
  return (
    <View style={styles.builderPanel}>
      <ControlGroup label="Body type">
        <ShapeGrid
          value={bodyShape}
          values={BODY_SHAPES}
          onChange={onBodyShapeChange}
        />
      </ControlGroup>

      <ControlGroup label="Eye frame type">
        <ShapeGrid
          value={eyeFrameShape}
          values={EYE_FRAME_SHAPES}
          onChange={onEyeFrameShapeChange}
        />
      </ControlGroup>

      <ControlGroup label="Eye ball type">
        <ShapeGrid
          value={eyeballShape}
          values={EYE_BALL_SHAPES}
          onChange={onEyeballShapeChange}
        />
      </ControlGroup>
    </View>
  );
}

function ShapeGrid<T extends string>({
  value,
  values,
  onChange,
}: {
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.shapeGrid}>
      {values.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            accessibilityRole="button"
            aria-selected={selected}
            accessibilityState={{ selected }}
            accessibilityLabel={getShapeLabel(option)}
            key={option}
            onPress={() => {
              onChange(option);
            }}
            style={[styles.shapeButton, selected && styles.shapeButtonSelected]}
          >
            <ShapeIcon shape={option} />
          </Pressable>
        );
      })}
    </View>
  );
}

function ShapeIcon({ shape }: { shape: string }) {
  return (
    <View
      style={[
        styles.shapeIcon,
        shape === "circle" && styles.shapeIconCircle,
        shape === "rounded" && styles.shapeIconRounded,
      ]}
    />
  );
}

function LogoConfigPanel({
  logoPadding,
  showLogo,
  onLogoPaddingChange,
  onShowLogoChange,
}: {
  logoPadding: LogoPaddingPreset;
  showLogo: boolean;
  onLogoPaddingChange: (value: LogoPaddingPreset) => void;
  onShowLogoChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.builderPanel}>
      <ControlGroup label="Demo logo">
        <Pressable
          accessibilityRole="switch"
          aria-checked={showLogo}
          accessibilityState={{ checked: showLogo }}
          onPress={() => {
            onShowLogoChange(!showLogo);
          }}
          style={[styles.toggle, showLogo && styles.toggleActive]}
        >
          <View
            style={[styles.toggleKnob, showLogo && styles.toggleKnobActive]}
          />
        </Pressable>
      </ControlGroup>
      <ControlGroup label="Logo padding">
        <SegmentedControl
          value={logoPadding}
          values={LOGO_PADDING_PRESETS}
          onChange={onLogoPaddingChange}
        />
      </ControlGroup>
    </View>
  );
}

function ColorSection({
  checked,
  label,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.colorSection}>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={checked}
        accessibilityState={{ checked }}
        onPress={() => {
          onCheckedChange(!checked);
        }}
        style={styles.sectionHeader}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <View style={styles.checkboxDot} /> : null}
        </View>
        <Text style={styles.sectionTitle}>{label}</Text>
      </Pressable>
      <View style={[styles.sectionBody, !checked && styles.sectionBodyMuted]}>
        {children}
      </View>
    </View>
  );
}

function ModeSelector({
  disabled = false,
  value,
  onChange,
}: {
  disabled?: boolean;
  value: ColorMode;
  onChange: (value: ColorMode) => void;
}) {
  return (
    <View style={styles.modeRow}>
      {(["single", "gradient"] as const).map((mode) => {
        const selected = mode === value;
        return (
          <Pressable
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityState={{ checked: selected }}
            disabled={disabled}
            key={mode}
            onPress={() => {
              onChange(mode);
            }}
            style={[styles.radioOption, disabled && styles.optionDisabled]}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={[styles.radioText, disabled && styles.textDisabled]}>
              {`${capitalize(mode)} color`}
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
            aria-selected={selected}
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

function ColorInput({
  disabled = false,
  value,
  onChange,
}: {
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={[styles.colorInput, disabled && styles.optionDisabled]}>
      <View
        style={[
          styles.largeSwatch,
          { backgroundColor: isHexColor(value) ? value : "#000000" },
        ]}
      >
        <Text style={styles.swatchPip}>/</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.colorTextInput, disabled && styles.colorTextDisabled]}
        selectionColor="#7C83FF"
      />
    </View>
  );
}

function SelectButton({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.selectButton, disabled && styles.selectButtonDisabled]}
    >
      <Text
        style={[styles.selectButtonText, disabled && styles.textDisabledDark]}
      >
        {label}
      </Text>
    </Pressable>
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

function getShapeLabel(value: string): string {
  return value
    .split("-")
    .map((part) => capitalize(part))
    .join(" ");
}

function resolveShapeOptions({
  bodyShape,
  eyeFrameShape,
  eyeballShape,
}: {
  bodyShape: QRCodeBodyShape;
  eyeFrameShape: QRCodeEyeFrameShape;
  eyeballShape: QRCodeEyeBallShape;
}): QRCodeShapeOptions {
  return {
    shape: bodyShape,
    eyeFrameShape,
    eyeballShape,
    gap: 0,
    eyePatternGap: 0,
    cornerRadius: DEFAULT_SHAPE_OPTIONS.cornerRadius,
    eyePatternCornerRadius:
      eyeFrameShape !== "square" || eyeballShape !== "square"
        ? undefined
        : DEFAULT_SHAPE_OPTIONS.eyePatternCornerRadius,
  };
}

function resolveForegroundColor(config: ForegroundConfig): string {
  if (!config.enabled) {
    return "#000000";
  }
  return resolveHexColor(config.singleColor, "#111315");
}

function resolveBackgroundColor(config: BackgroundConfig): string {
  if (!config.enabled) {
    return "#FFFFFF";
  }
  return resolveHexColor(config.color, "#FFFFFF");
}

function resolveSolidColor(config: SolidColorConfig, fallback: string): string {
  if (!config.enabled) {
    return fallback;
  }
  return resolveHexColor(config.color, fallback);
}

function resolveGradient(config: ForegroundConfig): QRCodeGradient | undefined {
  if (!config.enabled || config.mode !== "gradient") {
    return undefined;
  }

  return {
    type: config.gradientType,
    colors: [
      resolveHexColor(config.gradientStartColor, "#111315"),
      resolveHexColor(config.gradientEndColor, "#303532"),
    ],
    start:
      config.gradientType === "linear" ? { x: 0, y: 0 } : { x: 0.5, y: 0.5 },
    end: config.gradientType === "linear" ? { x: 1, y: 1 } : { x: 1, y: 0.5 },
  };
}

function resolveHexColor(value: string, fallback: string): string {
  return isHexColor(value) ? value : fallback;
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

function scaleShapeOptions(
  options: QRCodeShapeOptions,
  scale: number,
): QRCodeShapeOptions {
  return {
    layout: options.layout,
    shape: options.shape,
    eyeFrameShape: options.eyeFrameShape,
    eyeballShape: options.eyeballShape,
    eyePatternShape: options.eyePatternShape,
    gap: Math.round((options.gap ?? 0) * scale),
    eyePatternGap: Math.round((options.eyePatternGap ?? 0) * scale),
    cornerRadius:
      options.cornerRadius === undefined
        ? undefined
        : Math.round(options.cornerRadius * scale),
    eyePatternCornerRadius:
      options.eyePatternCornerRadius === undefined
        ? undefined
        : Math.round(options.eyePatternCornerRadius * scale),
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0D1110",
  },
  content: {
    alignSelf: "center",
    gap: 18,
    maxWidth: 1120,
    paddingHorizontal: 18,
    width: "100%",
  },
  header: {
    gap: 5,
  },
  kicker: {
    color: "#26A269",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: "#F8FAF8",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#A9B0AA",
    fontSize: 16,
    lineHeight: 22,
  },
  workbench: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: 16,
    width: "100%",
  },
  workbenchWide: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  previewPanel: {
    backgroundColor: "#151A18",
    borderColor: "#2C3732",
    borderRadius: 8,
    borderWidth: 1,
    boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
    flexGrow: 1,
    gap: 16,
    padding: 16,
  },
  previewPanelWide: {
    flexBasis: 400,
  },
  configPanel: {
    backgroundColor: "#111514",
    borderColor: "#2C3732",
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1.2,
    gap: 14,
    padding: 16,
  },
  configPanelWide: {
    flexBasis: 520,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  panelEyebrow: {
    color: "#26A269",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  panelTitle: {
    color: "#F8FAF8",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
  },
  stage: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  qrShell: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 14px 34px rgba(0,0,0,0.32)",
  },
  qrPlaceholder: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  qrPlaceholderText: {
    color: "#A9B0AA",
    fontSize: 13,
    fontWeight: "700",
  },
  stageMeta: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  tag: {
    backgroundColor: "#1B211F",
    borderColor: "#34423B",
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
    minHeight: 48,
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
    gap: 14,
  },
  controlGroup: {
    backgroundColor: "#151A18",
    borderColor: "#2C3732",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  tabBar: {
    backgroundColor: "#0D1110",
    borderColor: "#2C3732",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  tabButton: {
    alignItems: "center",
    backgroundColor: "#111514",
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  tabButtonSelected: {
    backgroundColor: "#26A269",
  },
  tabText: {
    color: "#8D9790",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  tabTextSelected: {
    color: "#07110D",
  },
  builderPanel: {
    gap: 8,
  },
  shapeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shapeButton: {
    alignItems: "center",
    backgroundColor: "#181B19",
    borderColor: "#303532",
    borderRadius: 6,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  shapeButtonSelected: {
    backgroundColor: "#17211C",
    borderColor: "#26A269",
    borderWidth: 2,
  },
  shapeIcon: {
    backgroundColor: "#F8FAF8",
    borderRadius: 1,
    height: 22,
    width: 22,
  },
  shapeIconCircle: {
    borderRadius: 10,
  },
  shapeIconRounded: {
    borderRadius: 5,
  },
  colorSection: {
    backgroundColor: "#151A18",
    borderColor: "#2C3732",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checkbox: {
    alignItems: "center",
    borderColor: "#55605A",
    borderRadius: 4,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  checkboxChecked: {
    backgroundColor: "#26A269",
    borderColor: "#26A269",
  },
  checkboxDot: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  sectionTitle: {
    color: "#F8FAF8",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
  },
  sectionBody: {
    borderTopColor: "#2C3732",
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionBodyMuted: {
    opacity: 0.48,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  radioOption: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    minHeight: 24,
  },
  radio: {
    alignItems: "center",
    borderColor: "#8D9790",
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  radioSelected: {
    borderColor: "#26A269",
    borderWidth: 2,
  },
  radioDot: {
    backgroundColor: "#26A269",
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  radioText: {
    color: "#CBD2CD",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "capitalize",
  },
  optionDisabled: {
    opacity: 0.45,
  },
  textDisabled: {
    color: "#8D9790",
  },
  colorRow: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: 8,
  },
  colorInput: {
    alignItems: "center",
    flexDirection: "row",
    width: "100%",
  },
  largeSwatch: {
    alignItems: "center",
    borderBottomLeftRadius: 6,
    borderTopLeftRadius: 6,
    height: 42,
    justifyContent: "center",
    width: 44,
  },
  swatchPip: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  colorTextInput: {
    backgroundColor: "#F8FAF8",
    borderBottomRightRadius: 6,
    borderColor: "#CBD2CD",
    borderTopRightRadius: 6,
    borderWidth: 1,
    color: "#1E2320",
    fontSize: 14,
    flex: 1,
    height: 42,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  colorTextDisabled: {
    backgroundColor: "#DDE3DE",
    color: "#55605A",
  },
  selectButton: {
    alignItems: "center",
    backgroundColor: "#F8FAF8",
    borderColor: "#CBD2CD",
    borderRadius: 6,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
    width: "100%",
  },
  selectButtonDisabled: {
    backgroundColor: "#DDE3DE",
  },
  selectButtonText: {
    color: "#1E2320",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  textDisabledDark: {
    color: "#55605A",
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
    backgroundColor: "#26A269",
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
    backgroundColor: "#26A269",
    borderColor: "#26A269",
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
    backgroundColor: "#26A269",
  },
  amberAccent: {
    backgroundColor: "#F59E0B",
  },
  blueAccent: {
    backgroundColor: "#22B8E8",
  },
  purpleAccent: {
    backgroundColor: "#A61E4D",
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
});
