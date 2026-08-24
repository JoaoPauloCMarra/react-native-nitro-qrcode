#include "HybridQRCode.hpp"
#include <cassert>
#include <iostream>
#include <memory>
using margelo::nitro::NitroQRCode::GenerateOptions;
using margelo::nitro::NitroQRCode::HybridQRCode;
namespace {
GenerateOptions makeOptions() {
  return GenerateOptions(
      "https://example.com/hybrid", 128, 4, "M", "#000000", "#FFFFFF",
      "#000000", "#000000", "#000000", "#000000", 1, 40, -1, true,
      "square", "square", "square", 0, 0, "dense", -1, -1, "matrix", 0,
      0, "none", {}, {}, 0, 0, 1, 1);
}
void testHybridQRCodeMethods() {
  auto qrCode = std::make_shared<HybridQRCode>();
  const GenerateOptions options = makeOptions();
  const std::string base64 = qrCode->generatePngBase64Object(options);
  assert(base64.rfind("iVBORw0KGgo", 0) == 0);
  assert(qrCode->generatePngBase64AsyncObject(options)->await().get() == base64);
  const std::string dataUri = qrCode->generatePngDataUriObject(options);
  assert(dataUri.rfind("data:image/png;base64,", 0) == 0);
  assert(qrCode->generatePngDataUriAsyncObject(options)->await().get() == dataUri);
  const std::string svg = qrCode->generateSvgString(
      options.value, options.quietZone, options.errorCorrectionLevel,
      options.foregroundColor, options.backgroundColor, options.minVersion,
      options.maxVersion, options.mask, options.boostEcl, options.gradientType,
      options.gradientColors, options.gradientLocations, options.gradientStartX,
      options.gradientStartY, options.gradientEndX, options.gradientEndY);
  assert(svg.find("<svg") != std::string::npos);
  const std::string packed = qrCode->getMatrixPackedBase64(
      options.value, options.errorCorrectionLevel, options.minVersion,
      options.maxVersion, options.mask, options.boostEcl);
  const double size = qrCode->getMatrixSize(
      options.value, options.errorCorrectionLevel, options.minVersion,
      options.maxVersion, options.mask, options.boostEcl);
  const auto matrix = qrCode->getMatrixObject(
      options.value, options.errorCorrectionLevel, options.minVersion,
      options.maxVersion, options.mask, options.boostEcl);
  assert(!packed.empty());
  assert(size == matrix.size);
  assert(packed == matrix.packedBase64);
  assert(qrCode->getCacheSize() > 0);
  assert(qrCode->getCacheBytes() > 0);
  assert(qrCode->getExternalMemorySize() >= qrCode->getCacheBytes());
  qrCode->clearCache();
  assert(qrCode->getCacheSize() == 0);
  assert(qrCode->getCacheBytes() == 0);
  assert(qrCode->getExternalMemorySize() == 0);
}
}
void runHybridQRCodeTests() {
  testHybridQRCodeMethods();
  std::cout << "HybridQRCode tests passed" << std::endl;
}
