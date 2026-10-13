#include "QRCodeBridgeOptions.hpp"

#include <cmath>
#include <limits>
#include <stdexcept>

namespace margelo::nitro::NitroQRCode {

::NitroQRCode::GenerateOptions makeGenerateOptions(
    double size, double quietZone, const std::string &errorCorrectionLevel,
    const std::string &foregroundColor, const std::string &backgroundColor,
    const std::string &strokeColor, const std::string &eyeColor,
    const std::string &eyeStrokeColor, const std::string &eyeballColor,
    double minVersion, double maxVersion, double mask, bool boostEcl,
    const std::string &moduleShape, const std::string &eyePatternShape,
    const std::string &eyeballShape, double gap, double eyePatternGap,
    const std::string &bodyDensity, double cornerRadius,
    double eyePatternCornerRadius,
    const std::string &layout, double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) {
  ::NitroQRCode::GenerateOptions options;
  options.size = toBridgeInt(size, "size");
  options.quietZone = toBridgeInt(quietZone, "quietZone");
  options.errorCorrectionLevel = errorCorrectionLevel;
  options.foregroundColor = foregroundColor;
  options.backgroundColor = backgroundColor;
  options.strokeColor = strokeColor;
  options.eyeColor = eyeColor;
  options.eyeStrokeColor = eyeStrokeColor;
  options.eyeballColor = eyeballColor;
  options.foreground = ::NitroQRCode::parseColor(foregroundColor);
  options.background = ::NitroQRCode::parseColor(backgroundColor);
  options.stroke = ::NitroQRCode::parseColor(strokeColor);
  options.eye = ::NitroQRCode::parseColor(eyeColor);
  options.eyeStroke = ::NitroQRCode::parseColor(eyeStrokeColor);
  options.eyeball = ::NitroQRCode::parseColor(eyeballColor);
  const ::NitroQRCode::Color legacyUnset =
      ::NitroQRCode::parseColor(LegacyUnsetColor);
  options.strokeSet = options.stroke != legacyUnset;
  options.eyeSet = options.eye != legacyUnset;
  options.eyeStrokeSet = options.eyeStroke != legacyUnset;
  options.eyeballSet = options.eyeball != legacyUnset;
  options.alignment = options.foreground;
  options.timing = options.foreground;
  options.quietZoneFill = options.background;
  options.finderInner = options.background;
  options.minVersion = toBridgeInt(minVersion, "minVersion");
  options.maxVersion = toBridgeInt(maxVersion, "maxVersion");
  options.mask = toBridgeInt(mask, "mask");
  options.boostEcl = boostEcl;
  options.moduleShape = moduleShape;
  options.alignmentShape = moduleShape;
  options.timingShape = moduleShape;
  options.eyePatternShape = eyePatternShape;
  options.eyeballShape = eyeballShape;
  options.gap = toBridgeInt(gap, "gap");
  options.eyePatternGap = toBridgeInt(eyePatternGap, "eyePatternGap");
  options.bodyDensity = bodyDensity;
  options.cornerRadius = toBridgeInt(cornerRadius, "cornerRadius");
  options.eyePatternCornerRadius =
      toBridgeInt(eyePatternCornerRadius, "eyePatternCornerRadius");
  options.layout = layout;
  options.logoAreaSize = toBridgeInt(logoAreaSize, "logoAreaSize");
  options.logoAreaBorderRadius =
      toBridgeInt(logoAreaBorderRadius, "logoAreaBorderRadius");
  options.gradient.type = gradientType;
  options.gradient.locations = gradientLocations;
  options.gradient.startX = gradientStartX;
  options.gradient.startY = gradientStartY;
  options.gradient.endX = gradientEndX;
  options.gradient.endY = gradientEndY;
  options.gradient.colors.reserve(gradientColors.size());
  for (const auto &color : gradientColors) {
    options.gradient.colors.push_back(::NitroQRCode::parseColor(color));
  }
  return options;
}

::NitroQRCode::GenerateOptions
makeGenerateOptions(const GenerateOptions &options) {
  auto resolved = makeGenerateOptions(
      options.size, options.quietZone, options.errorCorrectionLevel,
      options.foregroundColor, options.backgroundColor,
      options.strokeColor.value_or(LegacyUnsetColor),
      options.eyeColor.value_or(LegacyUnsetColor),
      options.eyeStrokeColor.value_or(LegacyUnsetColor),
      options.eyeballColor.value_or(LegacyUnsetColor),
      options.minVersion, options.maxVersion, options.mask, options.boostEcl,
      options.moduleShape, options.eyePatternShape, options.eyeballShape,
      options.gap, options.eyePatternGap, options.bodyDensity,
      options.cornerRadius, options.eyePatternCornerRadius, options.layout,
      options.logoAreaSize, options.logoAreaBorderRadius,
      options.gradientType, options.gradientColors, options.gradientLocations,
      options.gradientStartX, options.gradientStartY, options.gradientEndX,
      options.gradientEndY);
  resolved.strokeSet = options.strokeColor.has_value();
  resolved.eyeSet = options.eyeColor.has_value();
  resolved.eyeStrokeSet = options.eyeStrokeColor.has_value();
  resolved.eyeballSet = options.eyeballColor.has_value();
  if (options.alignmentColor.has_value()) {
    resolved.alignmentSet = true;
    resolved.alignment = ::NitroQRCode::parseColor(*options.alignmentColor);
  }
  if (options.timingColor.has_value()) {
    resolved.timingSet = true;
    resolved.timing = ::NitroQRCode::parseColor(*options.timingColor);
  }
  if (options.quietZoneColor.has_value()) {
    resolved.quietZoneFill =
        ::NitroQRCode::parseColor(*options.quietZoneColor);
  }
  if (options.finderInnerColor.has_value()) {
    resolved.finderInner =
        ::NitroQRCode::parseColor(*options.finderInnerColor);
  }
  if (options.alignmentShape.has_value()) {
    resolved.alignmentShape = *options.alignmentShape;
  }
  if (options.timingShape.has_value()) {
    resolved.timingShape = *options.timingShape;
  }
  return resolved;
}

::NitroQRCode::GenerateOptions
makeMatrixOptions(const std::string &errorCorrectionLevel, double minVersion,
                  double maxVersion, double mask, bool boostEcl) {
  return makeGenerateOptions(512, 4, errorCorrectionLevel, "#000000",
                             "#FFFFFF", LegacyUnsetColor, LegacyUnsetColor,
                             LegacyUnsetColor, LegacyUnsetColor, minVersion,
                             maxVersion, mask, boostEcl);
}

int toBridgeInt(double value, const char *name) {
  if (!std::isfinite(value) || std::floor(value) != value ||
      value < static_cast<double>(std::numeric_limits<int>::min()) ||
      value > static_cast<double>(std::numeric_limits<int>::max())) {
    throw std::invalid_argument(std::string(name) +
                                " must be a finite integer.");
  }
  return static_cast<int>(value);
}

}
