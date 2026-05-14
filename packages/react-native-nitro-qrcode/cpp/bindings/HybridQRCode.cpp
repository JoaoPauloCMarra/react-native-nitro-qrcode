#include "HybridQRCode.hpp"
#include "QRCodeBridgeOptions.hpp"

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
    double gap, double eyePatternGap, const std::string &bodyDensity,
    double cornerRadius, double eyePatternCornerRadius,
    const std::string &layout,
    double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) {
  return generator_.generatePngBase64(
      value,
      makeOptions(size, quietZone, errorCorrectionLevel, foregroundColor,
                  backgroundColor, strokeColor, eyeColor, eyeStrokeColor,
                  eyeballColor, minVersion, maxVersion, mask, boostEcl,
                  moduleShape, eyePatternShape, eyeballShape, gap,
                  eyePatternGap, bodyDensity, cornerRadius,
                  eyePatternCornerRadius, layout, logoAreaSize,
                  logoAreaBorderRadius, gradientType,
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
    double gap, double eyePatternGap, const std::string &bodyDensity,
    double cornerRadius, double eyePatternCornerRadius,
    const std::string &layout,
    double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) {
  return generator_.generatePngDataUri(
      value,
      makeOptions(size, quietZone, errorCorrectionLevel, foregroundColor,
                  backgroundColor, strokeColor, eyeColor, eyeStrokeColor,
                  eyeballColor, minVersion, maxVersion, mask, boostEcl,
                  moduleShape, eyePatternShape, eyeballShape, gap,
                  eyePatternGap, bodyDensity, cornerRadius,
                  eyePatternCornerRadius, layout, logoAreaSize,
                  logoAreaBorderRadius, gradientType,
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
    double gap, double eyePatternGap, const std::string &bodyDensity,
    double cornerRadius, double eyePatternCornerRadius,
    const std::string &layout,
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
           eyeballShape, gap, eyePatternGap, bodyDensity, cornerRadius,
           eyePatternCornerRadius, layout, logoAreaSize, logoAreaBorderRadius,
           gradientType, gradientColors, gradientLocations, gradientStartX,
           gradientStartY, gradientEndX, gradientEndY)]() mutable {
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
    double gap, double eyePatternGap, const std::string &bodyDensity,
    double cornerRadius, double eyePatternCornerRadius,
    const std::string &layout,
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
           eyeballShape, gap, eyePatternGap, bodyDensity, cornerRadius,
           eyePatternCornerRadius, layout, logoAreaSize, logoAreaBorderRadius,
           gradientType, gradientColors, gradientLocations, gradientStartX,
           gradientStartY, gradientEndX, gradientEndY)]() mutable {
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
  return generator_.generateSvgString(
      value,
      makeOptions(512, quietZone, errorCorrectionLevel, foregroundColor,
                  backgroundColor, "#000000", "#000000", "#000000", "#000000",
                  minVersion, maxVersion, mask, boostEcl, "square", "square",
                  "square", 0, 0, "dense", -1, -1, "matrix", 0, 0, gradientType,
                  gradientColors, gradientLocations, gradientStartX,
                  gradientStartY, gradientEndX, gradientEndY));
}

std::string HybridQRCode::getMatrixPackedBase64(
    const std::string &value, const std::string &errorCorrectionLevel,
    double minVersion, double maxVersion, double mask, bool boostEcl) {
  return generator_.getMatrixPackedBase64(
      value, makeMatrixOptions(errorCorrectionLevel, minVersion, maxVersion,
                               mask, boostEcl));
}

double HybridQRCode::getMatrixSize(const std::string &value,
                                   const std::string &errorCorrectionLevel,
                                   double minVersion, double maxVersion,
                                   double mask, bool boostEcl) {
  return generator_.getMatrixSize(
      value, makeMatrixOptions(errorCorrectionLevel, minVersion, maxVersion,
                               mask, boostEcl));
}

void HybridQRCode::clearCache() {
  generator_.clearCache();
}

double HybridQRCode::getCacheSize() {
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
    const std::string &bodyDensity, double cornerRadius,
    double eyePatternCornerRadius,
    const std::string &layout, double logoAreaSize, double logoAreaBorderRadius,
    const std::string &gradientType,
    const std::vector<std::string> &gradientColors,
    const std::vector<double> &gradientLocations, double gradientStartX,
    double gradientStartY, double gradientEndX, double gradientEndY) const {
  return makeGenerateOptions(
      size, quietZone, errorCorrectionLevel, foregroundColor, backgroundColor,
      strokeColor, eyeColor, eyeStrokeColor, eyeballColor, minVersion,
      maxVersion, mask, boostEcl, moduleShape, eyePatternShape, eyeballShape,
      gap, eyePatternGap, bodyDensity, cornerRadius, eyePatternCornerRadius,
      layout, logoAreaSize, logoAreaBorderRadius, gradientType, gradientColors,
      gradientLocations, gradientStartX, gradientStartY, gradientEndX,
      gradientEndY);
}

::NitroQRCode::GenerateOptions
HybridQRCode::makeMatrixOptions(const std::string &errorCorrectionLevel,
                                double minVersion, double maxVersion,
                                double mask, bool boostEcl) const {
  return margelo::nitro::NitroQRCode::makeMatrixOptions(
      errorCorrectionLevel, minVersion, maxVersion, mask, boostEcl);
}

} // namespace margelo::nitro::NitroQRCode
