#include "HybridQRCode.hpp"
#include "QRCodeBridgeOptions.hpp"

namespace margelo::nitro::NitroQRCode {

::NitroQRCode::GenerateOptions makeGenerateOptions(
    const GenerateOptions &options) {
  return makeGenerateOptions(
      options.size, options.quietZone, options.errorCorrectionLevel,
      options.foregroundColor, options.backgroundColor, options.strokeColor,
      options.eyeColor, options.eyeStrokeColor, options.eyeballColor,
      options.minVersion, options.maxVersion, options.mask, options.boostEcl,
      options.moduleShape, options.eyePatternShape, options.eyeballShape,
      options.gap, options.eyePatternGap, options.bodyDensity,
      options.cornerRadius, options.eyePatternCornerRadius, options.layout,
      options.logoAreaSize, options.logoAreaBorderRadius,
      options.gradientType, options.gradientColors, options.gradientLocations,
      options.gradientStartX, options.gradientStartY, options.gradientEndX,
      options.gradientEndY);
}

HybridQRCode::HybridQRCode() : HybridObject(TAG), HybridQRCodeSpec() {}

std::string HybridQRCode::generatePngBase64Object(
    const GenerateOptions &options) {
  return generator_.renderPngBase64(options.value,
                                      makeGenerateOptions(options));
}

std::shared_ptr<Promise<std::string>>
HybridQRCode::generatePngBase64AsyncObject(const GenerateOptions &options) {
  auto self = shared_cast<HybridQRCode>();
  return Promise<std::string>::async(
      [self, options]() mutable {
        return self->generator_.renderPngBase64(options.value,
                                                  makeGenerateOptions(options));
      });
}

std::string HybridQRCode::generatePngDataUriObject(
    const GenerateOptions &options) {
  return generator_.renderPngDataUri(options.value,
                                       makeGenerateOptions(options));
}

std::shared_ptr<Promise<std::string>>
HybridQRCode::generatePngDataUriAsyncObject(const GenerateOptions &options) {
  auto self = shared_cast<HybridQRCode>();
  return Promise<std::string>::async(
      [self, options]() mutable {
        return self->generator_.renderPngDataUri(options.value,
                                                   makeGenerateOptions(options));
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
      makeGenerateOptions(512, quietZone, errorCorrectionLevel,
                          foregroundColor, backgroundColor, "#000000",
                          "#000000", "#000000", "#000000", minVersion,
                          maxVersion, mask, boostEcl, "square", "square",
                          "square", 0, 0, "dense", -1, -1, "matrix", 0, 0,
                          gradientType, gradientColors, gradientLocations,
                          gradientStartX, gradientStartY, gradientEndX,
                          gradientEndY));
}

std::string HybridQRCode::getMatrixPackedBase64(
    const std::string &value, const std::string &errorCorrectionLevel,
    double minVersion, double maxVersion, double mask, bool boostEcl) {
  return generator_.getMatrixPackedBase64(
      value, margelo::nitro::NitroQRCode::makeMatrixOptions(
                 errorCorrectionLevel, minVersion, maxVersion, mask, boostEcl));
}

double HybridQRCode::getMatrixSize(const std::string &value,
                                   const std::string &errorCorrectionLevel,
                                   double minVersion, double maxVersion,
                                   double mask, bool boostEcl) {
  return generator_.getMatrixSize(
      value, margelo::nitro::NitroQRCode::makeMatrixOptions(
                 errorCorrectionLevel, minVersion, maxVersion, mask, boostEcl));
}

MatrixObject HybridQRCode::getMatrixObject(
    const std::string &value, const std::string &errorCorrectionLevel,
    double minVersion, double maxVersion, double mask, bool boostEcl) {
  const auto matrix = generator_.getMatrixObject(
      value, margelo::nitro::NitroQRCode::makeMatrixOptions(
                 errorCorrectionLevel, minVersion, maxVersion, mask, boostEcl));
  return MatrixObject(matrix.size, matrix.packedBase64);
}

void HybridQRCode::clearCache() {
  generator_.clearCache();
}

double HybridQRCode::getCacheSize() {
  return static_cast<double>(generator_.getCacheSize());
}

double HybridQRCode::getCacheBytes() {
  return static_cast<double>(generator_.getCacheBytes());
}

size_t HybridQRCode::getExternalMemorySize() noexcept {
  return memorySize();
}

size_t HybridQRCode::memorySize() noexcept {
  return generator_.memorySize();
}

} // namespace margelo::nitro::NitroQRCode
