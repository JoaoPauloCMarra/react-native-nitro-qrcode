import {
  createElement,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  useEffect,
  useRef,
  type ForwardRefExoticComponent,
  type Ref,
  type RefAttributes,
  type ReactNode,
} from "react";
import { Image, View } from "react-native";
import {
  COMPONENT_RASTER_MULTIPLIER,
  DEFAULT_HIDE_LOGO_UNTIL_READY,
  DEFAULT_KEEP_PREVIOUS_IMAGE,
  DEFAULT_LOGO_AREA_BORDER_RADIUS,
  MIN_COMPONENT_RASTER_SIZE,
  mergePresetShapeOptions,
} from "./defaults";
import {
  DEFAULT_BACKGROUND,
  type QRCodeBackgroundColor,
} from "./colors";
import type { QRCodePreset } from "./defaults";
import { styles } from "./styles";
import { useQRCodeGeneration } from "./use-qrcode-generation";
import {
  scaleShapeOptions,
  type QRCodeOptions,
} from "./validation";
import type { ImageStyle, StyleProp, ViewStyle } from "react-native";

export type QRCodeProps = QRCodeOptions & {
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  logo?: ReactNode;
  placeholder?: ReactNode;
  preset?: QRCodePreset;
  keepPreviousImage?: boolean;
  hideLogoUntilReady?: boolean;
  onReady?: (uri: string) => void;
  onError?: (error: Error) => void;
  logoPadding?: number;
  logoBackgroundColor?: QRCodeBackgroundColor;
  testID?: string;
};

export type QRCodeRef = {
  toPngDataUri: () => string;
  toPngBase64: () => string;
};

export type QRCodeComponentGenerators = {
  toPngDataUri: (options: QRCodeOptions) => string;
  toPngBase64: (options: QRCodeOptions) => string;
  toPngDataUriAsync: (options: QRCodeOptions) => Promise<string>;
  accessibilityIgnoresInvertColors?: boolean;
};

const MAX_COMPONENT_SIZE = 2048;

function qrCodeAccessibilityLabel(value: string): string {
  return `QR code for ${value}`;
}

function generatingAccessibilityLabel(): string {
  return "Generating QR code";
}

function validateComponentSize(size: number): void {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    size > MAX_COMPONENT_SIZE
  ) {
    throw new Error(
      "QRCode component size must be an integer between 1 and 2048 points.",
    );
  }
}

function contentKey(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function useStableValue<T>(value: T): T {
  const key = contentKey(value);
  const [held, setHeld] = useState({ key, value });
  if (key === undefined) {
    return value;
  }
  if (held.key !== key) {
    setHeld({ key, value });
    return value;
  }
  return held.value;
}

export function createQRCodeComponent(
  generators: QRCodeComponentGenerators,
): ForwardRefExoticComponent<QRCodeProps & RefAttributes<QRCodeRef>> {
  return forwardRef<QRCodeRef, QRCodeProps>(function QRCode(
    {
      value,
      size = 180,
      quietZone,
      errorCorrectionLevel,
      scanSafe,
      foregroundColor,
      backgroundColor,
      strokeColor,
      eyeColor,
      eyeStrokeColor,
      eyeballColor,
      alignmentColor,
      timingColor,
      quietZoneColor,
      finderInnerColor,
      gradient,
      minVersion,
      maxVersion,
      mask,
      boostEcl,
      shapeOptions,
      logoAreaSize,
      logoAreaBorderRadius,
      preset,
      keepPreviousImage = DEFAULT_KEEP_PREVIOUS_IMAGE,
      hideLogoUntilReady = DEFAULT_HIDE_LOGO_UNTIL_READY,
      onReady,
      onError,
      accessibilityLabel,
      style,
      imageStyle,
      logo,
      placeholder,
      logoPadding,
      logoBackgroundColor,
      testID,
    }: QRCodeProps,
    ref: Ref<QRCodeRef>,
  ) {
    validateComponentSize(size);

    const rasterSize = Math.max(
      Math.ceil(size * COMPONENT_RASTER_MULTIPLIER),
      MIN_COMPONENT_RASTER_SIZE,
    );
    const rasterScale = rasterSize / size;
    const resolvedLogoAreaSize =
      logoAreaSize ?? (logo !== undefined ? Math.round(size * 0.28) : 0);
    const stableShapeOptions = useStableValue(shapeOptions);
    const stableGradient = useStableValue(gradient);

    const options = useMemo<QRCodeOptions>(
      () => ({
        value,
        size: rasterSize,
        quietZone,
        errorCorrectionLevel,
        scanSafe,
        foregroundColor,
        backgroundColor,
        strokeColor,
        eyeColor,
        eyeStrokeColor,
        eyeballColor,
        alignmentColor,
        timingColor,
        quietZoneColor,
        finderInnerColor,
        gradient: stableGradient,
        minVersion,
        maxVersion,
        mask,
        boostEcl,
        shapeOptions: scaleShapeOptions(
          mergePresetShapeOptions(stableShapeOptions, preset),
          rasterScale,
        ),
        logoAreaSize: Math.round(resolvedLogoAreaSize * rasterScale),
        logoAreaBorderRadius: Math.round(
          (logoAreaBorderRadius ?? DEFAULT_LOGO_AREA_BORDER_RADIUS) *
            rasterScale,
        ),
      }),
      [
        value,
        rasterSize,
        quietZone,
        errorCorrectionLevel,
        scanSafe,
        foregroundColor,
        backgroundColor,
        strokeColor,
        eyeColor,
        eyeStrokeColor,
        eyeballColor,
        alignmentColor,
        timingColor,
        quietZoneColor,
        finderInnerColor,
        stableGradient,
        minVersion,
        maxVersion,
        mask,
        boostEcl,
        preset,
        stableShapeOptions,
        rasterScale,
        resolvedLogoAreaSize,
        logoAreaBorderRadius,
      ],
    );

    const {
      uri,
      displayedValue,
      pending,
      error: generationError,
    } = useQRCodeGeneration(
      options,
      generators,
      keepPreviousImage,
      onReady,
      onError,
    );
    const [imageState, setImageState] = useState<{
      requested: string | undefined;
      loaded: string | undefined;
      loadedValue: string | undefined;
      error: Error | undefined;
    }>({
      requested: uri,
      loaded: undefined,
      loadedValue: undefined,
      error: undefined,
    });
    if (imageState.requested !== uri) {
      setImageState({
        requested: uri,
        loaded: keepPreviousImage ? imageState.loaded : undefined,
        loadedValue: keepPreviousImage ? imageState.loadedValue : undefined,
        error: undefined,
      });
    }
    const onImageErrorRef = useRef(onError);
    useEffect(() => {
      onImageErrorRef.current = onError;
    }, [onError]);
    useEffect(() => {
      if (imageState.error !== undefined)
        onImageErrorRef.current?.(imageState.error);
    }, [imageState.error]);
    const imagePending =
      uri !== undefined &&
      imageState.loaded !== uri &&
      imageState.error === undefined;
    const imageUris = uri === undefined ? [] : [uri];
    if (
      keepPreviousImage &&
      uri !== undefined &&
      imageState.loaded !== undefined &&
      imageState.loaded !== uri
    ) {
      imageUris.unshift(imageState.loaded);
    }

    useImperativeHandle(
      ref,
      () => ({
        toPngDataUri: () => generators.toPngDataUri(options),
        toPngBase64: () => generators.toPngBase64(options),
      }),
      [options],
    );

    const showLogo =
      logo !== undefined && (!hideLogoUntilReady || uri !== undefined);

    if (generationError !== undefined) {
      throw generationError;
    }
    if (imageState.error !== undefined && onError === undefined) {
      throw imageState.error;
    }

    return createElement(
      View,
      {
        style: [styles.frame, { width: size, height: size }, style],
        testID,
        accessible: true,
        accessibilityRole: "image" as const,
        accessibilityLabel:
          accessibilityLabel ??
          (imageState.loadedValue === undefined
            ? imageState.error === undefined
              ? generatingAccessibilityLabel()
              : "QR code unavailable"
            : qrCodeAccessibilityLabel(imageState.loadedValue)),
        accessibilityState: { busy: pending || imagePending },
      },
      uri === undefined && placeholder,
      imageUris.map((imageUri) =>
        createElement(Image, {
          key: imageUri,
          source: { uri: imageUri },
          fadeDuration: 0,
          resizeMode: "contain",
          style: [
            styles.image,
            { position: "absolute" },
            imageStyle,
            imageUri !== imageState.loaded && { opacity: 0 },
          ],
          onLoad: () => {
            setImageState((current) =>
              current.requested === imageUri && current.loaded !== imageUri
                ? {
                    ...current,
                    loaded: imageUri,
                    loadedValue: displayedValue,
                    error: undefined,
                  }
                : current,
            );
          },
          onError: () => {
            const error = new Error("QRCode image failed to load.");
            setImageState((current) =>
              current.requested === imageUri && current.error === undefined
                ? { ...current, error }
                : current,
            );
          },
          accessible: false,
          accessibilityElementsHidden: true,
          importantForAccessibility: "no-hide-descendants",
          ...(generators.accessibilityIgnoresInvertColors !== undefined
            ? {
                accessibilityIgnoresInvertColors:
                  generators.accessibilityIgnoresInvertColors,
              }
            : {}),
        }),
      ),
      showLogo &&
        createElement(
          View,
          {
            style: [
              styles.logo,
              {
                width: resolvedLogoAreaSize,
                height: resolvedLogoAreaSize,
                left: (size - resolvedLogoAreaSize) / 2,
                top: (size - resolvedLogoAreaSize) / 2,
                borderRadius:
                  logoAreaBorderRadius ?? DEFAULT_LOGO_AREA_BORDER_RADIUS,
                backgroundColor:
                  logoBackgroundColor ?? backgroundColor ?? DEFAULT_BACKGROUND,
                padding: Math.max(0, logoPadding ?? 0),
              },
            ],
            accessible: false,
            accessibilityElementsHidden: true,
            importantForAccessibility: "no-hide-descendants",
          },
          logo,
        ),
    );
  });
}
