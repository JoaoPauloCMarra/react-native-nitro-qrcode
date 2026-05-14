#include "QRCodeBridgeOptions.hpp"

#include <cassert>
#include <cmath>
#include <functional>
#include <limits>
#include <stdexcept>

namespace {

void assertThrows(const std::function<void()> &callback) {
  bool didThrow = false;
  try {
    callback();
  } catch (const std::invalid_argument &) {
    didThrow = true;
  }
  assert(didThrow);
}

void testBridgeOptionMapping() {
  const auto options = margelo::nitro::NitroQRCode::makeGenerateOptions(
      256, 3, "H", "#111111", "#EEEEEE", "#222222", "#333333", "#444444",
      "#555555", 2, 8, 4, false, "rounded", "circle", "square", 2, 1,
      "balanced", 5, 6, "matrix", 48, 12, "linear", {"#000000", "#FFFFFF"},
      {0.25, 1.0}, 0.1, 0.2, 0.9, 0.8);

  assert(options.size == 256);
  assert(options.quietZone == 3);
  assert(options.errorCorrectionLevel == "H");
  assert(options.foregroundColor == "#111111");
  assert(options.backgroundColor == "#EEEEEE");
  assert(options.strokeColor == "#222222");
  assert(options.eyeColor == "#333333");
  assert(options.eyeStrokeColor == "#444444");
  assert(options.eyeballColor == "#555555");
  assert(options.minVersion == 2);
  assert(options.maxVersion == 8);
  assert(options.mask == 4);
  assert(!options.boostEcl);
  assert(options.moduleShape == "rounded");
  assert(options.eyePatternShape == "circle");
  assert(options.eyeballShape == "square");
  assert(options.gap == 2);
  assert(options.eyePatternGap == 1);
  assert(options.bodyDensity == "balanced");
  assert(options.cornerRadius == 5);
  assert(options.eyePatternCornerRadius == 6);
  assert(options.layout == "matrix");
  assert(options.logoAreaSize == 48);
  assert(options.logoAreaBorderRadius == 12);
  assert(options.gradient.type == "linear");
  assert(options.gradient.colors.size() == 2);
  assert(options.gradient.locations.size() == 2);
  assert(options.gradient.locations[0] == 0.25);
  assert(options.gradient.locations[1] == 1.0);
  assert(options.gradient.startX == 0.1);
  assert(options.gradient.startY == 0.2);
  assert(options.gradient.endX == 0.9);
  assert(options.gradient.endY == 0.8);
}

void testBridgeMatrixDefaults() {
  const auto options =
      margelo::nitro::NitroQRCode::makeMatrixOptions("Q", 3, 12, -1, true);
  assert(options.size == 512);
  assert(options.quietZone == 4);
  assert(options.errorCorrectionLevel == "Q");
  assert(options.minVersion == 3);
  assert(options.maxVersion == 12);
  assert(options.mask == -1);
  assert(options.boostEcl);
  assert(options.moduleShape == "square");
  assert(options.eyePatternShape == "square");
  assert(options.eyeballShape == "square");
  assert(options.bodyDensity == "dense");
  assert(options.gradient.type == "none");
  assert(options.gradient.colors.empty());
}

void testBridgeIntegerValidation() {
  assertThrows([]() {
    margelo::nitro::NitroQRCode::toBridgeInt(
        std::numeric_limits<double>::quiet_NaN(), "size");
  });
  assertThrows([]() {
    margelo::nitro::NitroQRCode::toBridgeInt(
        std::numeric_limits<double>::infinity(), "size");
  });
  assertThrows(
      []() { margelo::nitro::NitroQRCode::toBridgeInt(1.5, "size"); });
  assertThrows([]() {
    margelo::nitro::NitroQRCode::toBridgeInt(
        static_cast<double>(std::numeric_limits<int>::max()) + 1.0, "size");
  });
}

}

void runQRCodeBridgeOptionsTests() {
  testBridgeOptionMapping();
  testBridgeMatrixDefaults();
  testBridgeIntegerValidation();
}
