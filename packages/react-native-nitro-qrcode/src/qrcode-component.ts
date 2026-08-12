import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
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
  type QRCodeColor,
} from "./colors";
import type { QRCodePreset } from "./defaults";
import { styles } from "./styles";
import { useQRCodeGeneration } from "./use-qrcode-generation";
import {
  scaleShapeOptions,
  type QRCodeGradient,
  type QRCodeGradientColors,
  type QRCodeGradientLocations,
  type QRCodeOptions,
  type QRCodeShapeOptions,
} from "./validation";
import type { ImageStyle, StyleProp, ViewStyle } from "react-native";
import type { ReactNode } from "react";

export type QRCodeProps = QRCodeOptions & {
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
    !Number.isFinite(size) ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > MAX_COMPONENT_SIZE
  ) {
    throw new Error(
      "QRCode component size must be an integer between 1 and 2048 points.",
    );
  }
}

function createGradientColors(
  color0: QRCodeColor | undefined,
  color1: QRCodeColor | undefined,
  color2: QRCodeColor | undefined,
  color3: QRCodeColor | undefined,
  color4: QRCodeColor | undefined,
  color5: QRCodeColor | undefined,
  color6: QRCodeColor | undefined,
  color7: QRCodeColor | undefined,
): QRCodeGradientColors | undefined {
  if (color0 === undefined || color1 === undefined) {
    return undefined;
  }

  if (color2 === undefined) {
    return [color0, color1];
  }

  if (color3 === undefined) {
    return [color0, color1, color2];
  }

  if (color4 === undefined) {
    return [color0, color1, color2, color3];
  }

  if (color5 === undefined) {
    return [color0, color1, color2, color3, color4];
  }

  if (color6 === undefined) {
    return [color0, color1, color2, color3, color4, color5];
  }

  if (color7 === undefined) {
    return [color0, color1, color2, color3, color4, color5, color6];
  }

  return [color0, color1, color2, color3, color4, color5, color6, color7];
}

function createGradientLocations(
  location0: number | undefined,
  location1: number | undefined,
  location2: number | undefined,
  location3: number | undefined,
  location4: number | undefined,
  location5: number | undefined,
  location6: number | undefined,
  location7: number | undefined,
): QRCodeGradientLocations | undefined {
  if (location0 === undefined || location1 === undefined) {
    return undefined;
  }

  if (location2 === undefined) {
    return [location0, location1];
  }

  if (location3 === undefined) {
    return [location0, location1, location2];
  }

  if (location4 === undefined) {
    return [location0, location1, location2, location3];
  }

  if (location5 === undefined) {
    return [location0, location1, location2, location3, location4];
  }

  if (location6 === undefined) {
    return [location0, location1, location2, location3, location4, location5];
  }

  if (location7 === undefined) {
    return [
      location0,
      location1,
      location2,
      location3,
      location4,
      location5,
      location6,
    ];
  }

  return [
    location0,
    location1,
    location2,
    location3,
    location4,
    location5,
    location6,
    location7,
  ];
}

export function createQRCodeComponent(generators: QRCodeComponentGenerators) {
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
      gradient,
      minVersion,
      maxVersion,
      mask,
      boostEcl,
      orbit,
      shapeOptions,
      logoAreaSize,
      logoAreaBorderRadius,
      preset,
      keepPreviousImage = DEFAULT_KEEP_PREVIOUS_IMAGE,
      hideLogoUntilReady = DEFAULT_HIDE_LOGO_UNTIL_READY,
      onReady,
      onError,
      style,
      imageStyle,
      logo,
      placeholder,
      logoPadding,
      logoBackgroundColor,
      testID,
    }: QRCodeProps,
    ref: React.Ref<QRCodeRef>,
  ) {
    validateComponentSize(size);

    const rasterSize = Math.max(
      Math.ceil(size * COMPONENT_RASTER_MULTIPLIER),
      MIN_COMPONENT_RASTER_SIZE,
    );
    const rasterScale = rasterSize / size;
    const resolvedLogoAreaSize =
      logoAreaSize ?? (logo !== undefined ? Math.round(size * 0.28) : 0);
    const hasShapeOptions = shapeOptions !== undefined;
    const shapeOptionsLayout = shapeOptions?.layout;
    const shapeOptionsShape = shapeOptions?.shape;
    const shapeOptionsEyeFrameShape = shapeOptions?.eyeFrameShape;
    const shapeOptionsEyeballShape = shapeOptions?.eyeballShape;
    const shapeOptionsEyePatternShape = shapeOptions?.eyePatternShape;
    const shapeOptionsGap = shapeOptions?.gap;
    const shapeOptionsEyePatternGap = shapeOptions?.eyePatternGap;
    const shapeOptionsBodyDensity = shapeOptions?.bodyDensity;
    const shapeOptionsCornerRadius = shapeOptions?.cornerRadius;
    const shapeOptionsEyePatternCornerRadius =
      shapeOptions?.eyePatternCornerRadius;
    const gradientType = gradient?.type;
    const gradientColors = gradient?.colors;
    const gradientColor0 = gradientColors?.[0];
    const gradientColor1 = gradientColors?.[1];
    const gradientColor2 = gradientColors?.[2];
    const gradientColor3 = gradientColors?.[3];
    const gradientColor4 = gradientColors?.[4];
    const gradientColor5 = gradientColors?.[5];
    const gradientColor6 = gradientColors?.[6];
    const gradientColor7 = gradientColors?.[7];
    const gradientLocations = gradient?.locations;
    const gradientLocation0 = gradientLocations?.[0];
    const gradientLocation1 = gradientLocations?.[1];
    const gradientLocation2 = gradientLocations?.[2];
    const gradientLocation3 = gradientLocations?.[3];
    const gradientLocation4 = gradientLocations?.[4];
    const gradientLocation5 = gradientLocations?.[5];
    const gradientLocation6 = gradientLocations?.[6];
    const gradientLocation7 = gradientLocations?.[7];
    const gradientStartX = gradient?.start?.x;
    const gradientStartY = gradient?.start?.y;
    const gradientEndX = gradient?.end?.x;
    const gradientEndY = gradient?.end?.y;
    const stableShapeOptions = useMemo<QRCodeShapeOptions | undefined>(
      () =>
        !hasShapeOptions
          ? undefined
          : {
              layout: shapeOptionsLayout,
              shape: shapeOptionsShape,
              eyeFrameShape: shapeOptionsEyeFrameShape,
              eyeballShape: shapeOptionsEyeballShape,
              eyePatternShape: shapeOptionsEyePatternShape,
              gap: shapeOptionsGap,
              eyePatternGap: shapeOptionsEyePatternGap,
              bodyDensity: shapeOptionsBodyDensity,
              cornerRadius: shapeOptionsCornerRadius,
              eyePatternCornerRadius: shapeOptionsEyePatternCornerRadius,
            },
      [
        hasShapeOptions,
        shapeOptionsLayout,
        shapeOptionsShape,
        shapeOptionsEyeFrameShape,
        shapeOptionsEyeballShape,
        shapeOptionsEyePatternShape,
        shapeOptionsGap,
        shapeOptionsEyePatternGap,
        shapeOptionsBodyDensity,
        shapeOptionsCornerRadius,
        shapeOptionsEyePatternCornerRadius,
      ],
    );
    const stableGradient = useMemo<QRCodeGradient | undefined>(
      () => {
        const colors = createGradientColors(
          gradientColor0,
          gradientColor1,
          gradientColor2,
          gradientColor3,
          gradientColor4,
          gradientColor5,
          gradientColor6,
          gradientColor7,
        );

        return colors === undefined
          ? undefined
          : {
              type: gradientType,
              colors,
              locations: createGradientLocations(
                gradientLocation0,
                gradientLocation1,
                gradientLocation2,
                gradientLocation3,
                gradientLocation4,
                gradientLocation5,
                gradientLocation6,
                gradientLocation7,
              ),
              start:
                gradientStartX === undefined || gradientStartY === undefined
                  ? undefined
                  : { x: gradientStartX, y: gradientStartY },
              end:
                gradientEndX === undefined || gradientEndY === undefined
                  ? undefined
                  : { x: gradientEndX, y: gradientEndY },
            };
      },
      [
        gradientColor0,
        gradientColor1,
        gradientColor2,
        gradientColor3,
        gradientColor4,
        gradientColor5,
        gradientColor6,
        gradientColor7,
        gradientEndX,
        gradientEndY,
        gradientLocation0,
        gradientLocation1,
        gradientLocation2,
        gradientLocation3,
        gradientLocation4,
        gradientLocation5,
        gradientLocation6,
        gradientLocation7,
        gradientStartX,
        gradientStartY,
        gradientType,
      ],
    );

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
        gradient: stableGradient,
        minVersion,
        maxVersion,
        mask,
        boostEcl,
        orbit,
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
        stableGradient,
        minVersion,
        maxVersion,
        mask,
        boostEcl,
        orbit,
        preset,
        stableShapeOptions,
        rasterScale,
        resolvedLogoAreaSize,
        logoAreaBorderRadius,
      ],
    );

    const { uri, error: generationError } = useQRCodeGeneration(
      options,
      generators,
      keepPreviousImage,
      onReady,
      onError,
    );

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

    return React.createElement(
      View,
      {
        style: [styles.frame, { width: size, height: size }, style],
        testID,
        ...(uri === undefined
          ? {
              accessible: true,
              accessibilityRole: "image" as const,
              accessibilityLabel: generatingAccessibilityLabel(),
              accessibilityState: { busy: true },
            }
          : {}),
      },
      uri === undefined && placeholder,
      uri !== undefined &&
        React.createElement(Image, {
          source: { uri },
          resizeMode: "contain",
          style: [styles.image, imageStyle],
          accessible: true,
          accessibilityRole: "image",
          accessibilityLabel: qrCodeAccessibilityLabel(value),
          ...(generators.accessibilityIgnoresInvertColors !== undefined
            ? {
                accessibilityIgnoresInvertColors:
                  generators.accessibilityIgnoresInvertColors,
              }
            : {}),
        }),
      showLogo &&
        React.createElement(
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
