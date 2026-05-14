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
  options.minVersion = toBridgeInt(minVersion, "minVersion");
  options.maxVersion = toBridgeInt(maxVersion, "maxVersion");
  options.mask = toBridgeInt(mask, "mask");
  options.boostEcl = boostEcl;
  options.moduleShape = moduleShape;
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
makeMatrixOptions(const std::string &errorCorrectionLevel, double minVersion,
                  double maxVersion, double mask, bool boostEcl) {
  return makeGenerateOptions(512, 4, errorCorrectionLevel, "#000000",
                             "#FFFFFF", "#000000", "#000000", "#000000",
                             "#000000", minVersion, maxVersion, mask,
                             boostEcl);
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
