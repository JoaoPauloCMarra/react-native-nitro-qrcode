#include "HybridQRCode.hpp"

#include <cmath>
#include <limits>
#include <stdexcept>

namespace margelo::nitro::NitroQRCode {

HybridQRCode::HybridQRCode() : HybridObject(TAG), HybridQRCodeSpec() {}

std::string HybridQRCode::generatePngBase64(
    const std::string &value, double size, double quietZone,
    const std::string &errorCorrectionLevel, const std::string &foregroundColor,
    const std::string &backgroundColor, const std::string &strokeColor,
    const std::string &eyeColor, const std::string &eyeStrokeColor,
    const std::string &eyeballColor, double minVersion, double maxVersion,
    double mask, bool boostEcl, const std::string &moduleShape,
    const std::string &eyePatternShape, const std::string &eyeballShape,
    double gap, double eyePatternGap, double cornerRadius,
    double eyePatternCornerRadius, const std::string &layout,
    double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) {
  std::lock_guard<std::mutex> lock(mutex_);
  return generator_.generatePngBase64(
      value,
      makeOptions(size, quietZone, errorCorrectionLevel, foregroundColor,
                  backgroundColor, strokeColor, eyeColor, eyeStrokeColor,
                  eyeballColor, minVersion, maxVersion, mask, boostEcl,
                  moduleShape, eyePatternShape, eyeballShape, gap,
                  eyePatternGap, cornerRadius, eyePatternCornerRadius, layout,
                  logoAreaSize, logoAreaBorderRadius, gradientType,
                  gradientColors, gradientLocations, gradientStartX,
                  gradientStartY, gradientEndX, gradientEndY));
}

std::string HybridQRCode::generatePngDataUri(
    const std::string &value, double size, double quietZone,
    const std::string &errorCorrectionLevel, const std::string &foregroundColor,
    const std::string &backgroundColor, const std::string &strokeColor,
    const std::string &eyeColor, const std::string &eyeStrokeColor,
    const std::string &eyeballColor, double minVersion, double maxVersion,
    double mask, bool boostEcl, const std::string &moduleShape,
    const std::string &eyePatternShape, const std::string &eyeballShape,
    double gap, double eyePatternGap, double cornerRadius,
    double eyePatternCornerRadius, const std::string &layout,
    double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) {
  std::lock_guard<std::mutex> lock(mutex_);
  return generator_.generatePngDataUri(
      value,
      makeOptions(size, quietZone, errorCorrectionLevel, foregroundColor,
                  backgroundColor, strokeColor, eyeColor, eyeStrokeColor,
                  eyeballColor, minVersion, maxVersion, mask, boostEcl,
                  moduleShape, eyePatternShape, eyeballShape, gap,
                  eyePatternGap, cornerRadius, eyePatternCornerRadius, layout,
                  logoAreaSize, logoAreaBorderRadius, gradientType,
                  gradientColors, gradientLocations, gradientStartX,
                  gradientStartY, gradientEndX, gradientEndY));
}

std::shared_ptr<Promise<std::string>> HybridQRCode::generatePngBase64Async(
    const std::string &value, double size, double quietZone,
    const std::string &errorCorrectionLevel, const std::string &foregroundColor,
    const std::string &backgroundColor, const std::string &strokeColor,
    const std::string &eyeColor, const std::string &eyeStrokeColor,
    const std::string &eyeballColor, double minVersion, double maxVersion,
    double mask, bool boostEcl, const std::string &moduleShape,
    const std::string &eyePatternShape, const std::string &eyeballShape,
    double gap, double eyePatternGap, double cornerRadius,
    double eyePatternCornerRadius, const std::string &layout,
    double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) {
  auto self = shared_cast<HybridQRCode>();
  return Promise<std::string>::async(
      [self, value,
       options = makeOptions(
           size, quietZone, errorCorrectionLevel, foregroundColor,
           backgroundColor, strokeColor, eyeColor, eyeStrokeColor, eyeballColor,
           minVersion, maxVersion, mask, boostEcl, moduleShape, eyePatternShape,
           eyeballShape, gap, eyePatternGap, cornerRadius,
           eyePatternCornerRadius, layout, logoAreaSize, logoAreaBorderRadius,
           gradientType, gradientColors, gradientLocations, gradientStartX,
           gradientStartY, gradientEndX, gradientEndY)]() mutable {
        std::lock_guard<std::mutex> lock(self->mutex_);
        return self->generator_.generatePngBase64(value, options);
      });
}

std::shared_ptr<Promise<std::string>> HybridQRCode::generatePngDataUriAsync(
    const std::string &value, double size, double quietZone,
    const std::string &errorCorrectionLevel, const std::string &foregroundColor,
    const std::string &backgroundColor, const std::string &strokeColor,
    const std::string &eyeColor, const std::string &eyeStrokeColor,
    const std::string &eyeballColor, double minVersion, double maxVersion,
    double mask, bool boostEcl, const std::string &moduleShape,
    const std::string &eyePatternShape, const std::string &eyeballShape,
    double gap, double eyePatternGap, double cornerRadius,
    double eyePatternCornerRadius, const std::string &layout,
    double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) {
  auto self = shared_cast<HybridQRCode>();
  return Promise<std::string>::async(
      [self, value,
       options = makeOptions(
           size, quietZone, errorCorrectionLevel, foregroundColor,
           backgroundColor, strokeColor, eyeColor, eyeStrokeColor, eyeballColor,
           minVersion, maxVersion, mask, boostEcl, moduleShape, eyePatternShape,
           eyeballShape, gap, eyePatternGap, cornerRadius,
           eyePatternCornerRadius, layout, logoAreaSize, logoAreaBorderRadius,
           gradientType, gradientColors, gradientLocations, gradientStartX,
           gradientStartY, gradientEndX, gradientEndY)]() mutable {
        std::lock_guard<std::mutex> lock(self->mutex_);
        return self->generator_.generatePngDataUri(value, options);
      });
}

std::string HybridQRCode::generateSvgString(
    const std::string &value, double quietZone,
    const std::string &errorCorrectionLevel, const std::string &foregroundColor,
    const std::string &backgroundColor, double minVersion, double maxVersion,
    double mask, bool boostEcl, const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) {
  std::lock_guard<std::mutex> lock(mutex_);
  return generator_.generateSvgString(
      value,
      makeOptions(512, quietZone, errorCorrectionLevel, foregroundColor,
                  backgroundColor, "#000000", "#000000", "#000000", "#000000",
                  minVersion, maxVersion, mask, boostEcl, "square", "square",
                  "square", 0, 0, -1, -1, "matrix", 0, 0, gradientType,
                  gradientColors, gradientLocations, gradientStartX,
                  gradientStartY, gradientEndX, gradientEndY));
}

std::string HybridQRCode::getMatrixPackedBase64(
    const std::string &value, const std::string &errorCorrectionLevel,
    double minVersion, double maxVersion, double mask, bool boostEcl) {
  std::lock_guard<std::mutex> lock(mutex_);
  return generator_.getMatrixPackedBase64(
      value, makeMatrixOptions(errorCorrectionLevel, minVersion, maxVersion,
                               mask, boostEcl));
}

double HybridQRCode::getMatrixSize(const std::string &value,
                                   const std::string &errorCorrectionLevel,
                                   double minVersion, double maxVersion,
                                   double mask, bool boostEcl) {
  std::lock_guard<std::mutex> lock(mutex_);
  return generator_.getMatrixSize(
      value, makeMatrixOptions(errorCorrectionLevel, minVersion, maxVersion,
                               mask, boostEcl));
}

void HybridQRCode::clearCache() {
  std::lock_guard<std::mutex> lock(mutex_);
  generator_.clearCache();
}

double HybridQRCode::getCacheSize() {
  std::lock_guard<std::mutex> lock(mutex_);
  return static_cast<double>(generator_.getCacheSize());
}

::NitroQRCode::GenerateOptions HybridQRCode::makeOptions(
    double size, double quietZone, const std::string &errorCorrectionLevel,
    const std::string &foregroundColor, const std::string &backgroundColor,
    const std::string &strokeColor, const std::string &eyeColor,
    const std::string &eyeStrokeColor, const std::string &eyeballColor,
    double minVersion, double maxVersion, double mask, bool boostEcl,
    const std::string &moduleShape, const std::string &eyePatternShape,
    const std::string &eyeballShape, double gap, double eyePatternGap,
    double cornerRadius, double eyePatternCornerRadius,
    const std::string &layout, double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) const {
  ::NitroQRCode::GenerateOptions options;
  options.size = toInt(size, "size");
  options.quietZone = toInt(quietZone, "quietZone");
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
  options.minVersion = toInt(minVersion, "minVersion");
  options.maxVersion = toInt(maxVersion, "maxVersion");
  options.mask = toInt(mask, "mask");
  options.boostEcl = boostEcl;
  options.moduleShape = moduleShape;
  options.eyePatternShape = eyePatternShape;
  options.eyeballShape = eyeballShape;
  options.gap = toInt(gap, "gap");
  options.eyePatternGap = toInt(eyePatternGap, "eyePatternGap");
  options.cornerRadius = toInt(cornerRadius, "cornerRadius");
  options.eyePatternCornerRadius =
      toInt(eyePatternCornerRadius, "eyePatternCornerRadius");
  options.layout = layout;
  options.logoAreaSize = toInt(logoAreaSize, "logoAreaSize");
  options.logoAreaBorderRadius =
      toInt(logoAreaBorderRadius, "logoAreaBorderRadius");
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
HybridQRCode::makeMatrixOptions(const std::string &errorCorrectionLevel,
                                double minVersion, double maxVersion,
                                double mask, bool boostEcl) const {
  return makeOptions(512, 4, errorCorrectionLevel, "#000000", "#FFFFFF",
                     "#000000", "#000000", "#000000", "#000000", minVersion,
                     maxVersion, mask, boostEcl);
}

int HybridQRCode::toInt(double value, const char *name) const {
  if (!std::isfinite(value) || std::floor(value) != value ||
      value < static_cast<double>(std::numeric_limits<int>::min()) ||
      value > static_cast<double>(std::numeric_limits<int>::max())) {
    throw std::invalid_argument(std::string(name) +
                                " must be a finite integer.");
  }
  return static_cast<int>(value);
}

} // namespace margelo::nitro::NitroQRCode
