#include "BoundedCache.hpp"
#include "QRCodeBridgeOptions.hpp"
#include "QRCodeGenerator.hpp"
#include "qrcodegen.hpp"

#include <algorithm>
#include <array>
#include <atomic>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <functional>
#include <future>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>
#include <vector>
#include <zlib.h>

extern "C" {
#include "quirc.h"
}

std::vector<uint8_t> decodePngBase64ToRgba(const std::string &encoded,
                                           int &width, int &height);

using NitroQRCode::BoundedCache;
using NitroQRCode::Color;
using NitroQRCode::GenerateOptions;
using NitroQRCode::parseColor;
using NitroQRCode::QRCodeGenerator;

namespace {

template <typename Exception>
std::string expectThrow(const std::function<void()> &callback) {
  try {
    callback();
  } catch (const Exception &error) {
    return error.what();
  }
  assert(false && "expected exception was not thrown");
  return {};
}

bool startsWith(const std::string &value, const std::string &prefix) {
  return value.rfind(prefix, 0) == 0;
}

struct CapacityCase {
  const char *ecc;
  char symbol;
  int capacity;
};

void testVersion40CapacityBoundaries() {
  const std::array<CapacityCase, 12> cases = {{
      {"L", '7', 7089}, {"M", '7', 5596}, {"Q", '7', 3993}, {"H", '7', 3057},
      {"L", 'A', 4296}, {"M", 'A', 3391}, {"Q", 'A', 2420}, {"H", 'A', 1852},
      {"L", 'a', 2953}, {"M", 'a', 2331}, {"Q", 'a', 1663}, {"H", 'a', 1273},
  }};
  QRCodeGenerator generator;
  for (const auto &entry : cases) {
    GenerateOptions options;
    options.errorCorrectionLevel = entry.ecc;
    options.boostEcl = false;
    const std::string atCapacity(static_cast<size_t>(entry.capacity),
                                 entry.symbol);
    assert(generator.getMatrixSize(atCapacity, options) == 177);

    const std::string overCapacity = atCapacity + entry.symbol;
    const std::string message = expectThrow<std::length_error>(
        [&]() { generator.getMatrixSize(overCapacity, options); });
    assert(startsWith(message, "Data length = "));
    expectThrow<std::length_error>(
        [&]() { generator.renderPngBytes(overCapacity, options); });
    expectThrow<std::length_error>(
        [&]() { generator.generateSvgString(overCapacity, options); });
  }
  assert(generator.getCacheSize() == 0);
}

void testVersionWindowTooSmallForPayload() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.errorCorrectionLevel = "H";
  options.minVersion = 1;
  options.maxVersion = 1;
  assert(generator.getMatrixSize(std::string(7, 'a'), options) == 21);
  const std::string message = expectThrow<std::length_error>(
      [&]() { generator.getMatrixSize(std::string(8, 'a'), options); });
  assert(startsWith(message, "Data length = "));
}

void testBoostEclKeepsCapacityBoundary() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.errorCorrectionLevel = "L";
  options.boostEcl = true;
  assert(generator.getMatrixSize(std::string(2953, 'a'), options) == 177);
  expectThrow<std::length_error>(
      [&]() { generator.getMatrixSize(std::string(2954, 'a'), options); });
}

void testHostilePayloads() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 64;
  const std::string emptyMessage = expectThrow<std::invalid_argument>(
      [&]() { generator.renderPngBytes("", options); });
  assert(emptyMessage == "QRCode value must not be empty.");
  expectThrow<std::invalid_argument>(
      [&]() { generator.getMatrixSize("", options); });
  expectThrow<std::invalid_argument>(
      [&]() { generator.generateSvgString("", options); });

  const std::vector<std::string> payloads = {
      std::string(1, '\0'),
      std::string(64, '\0'),
      std::string("\xFF\xFE\xC0\xAF", 4),
      std::string("\xED\xA0\x80", 3),
      std::string("\xF4\x90\x80\x80", 4),
      std::string("<svg>\"&'</svg>"),
  };
  for (const auto &payload : payloads) {
    assert(generator.getMatrixSize(payload, options) >= 21);
    const auto png = generator.renderPngBytes(payload, options);
    assert(png.size() > 8 && png[0] == 0x89);
    const std::string svg = generator.generateSvgString(payload, options);
    assert(startsWith(svg, "<svg"));
    assert(svg.find(payload) == std::string::npos);
  }
}

void testSizeAndQuietZoneExtremes() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 1;
  options.quietZone = 0;
  int width = 0;
  int height = 0;
  auto rgba = decodePngBase64ToRgba(generator.renderPngBase64("A", options),
                                    width, height);
  assert(width == 21 && height == 21);
  assert(rgba.size() == static_cast<size_t>(21 * 21 * 4));

  options.quietZone = 32;
  rgba = decodePngBase64ToRgba(generator.renderPngBase64("A", options), width,
                               height);
  assert(width == 21 + 64 && height == 21 + 64);

  options.size = 4096;
  options.minVersion = 40;
  options.quietZone = 32;
  options.gradient.type = "radial";
  options.gradient.colors = {parseColor("#000000"), parseColor("#202060")};
  rgba = decodePngBase64ToRgba(generator.renderPngBase64("A", options), width,
                               height);
  assert(width == 4096 && height == 4096);
  assert(rgba.size() == static_cast<size_t>(4096) * 4096 * 4);
  generator.clearCache();
  assert(generator.getCacheBytes() == 0);
}

void testColorInputs() {
  const std::vector<std::string> invalid = {
      "",        "#",         "red",       "#FFF",      "#FFFFF",
      "#FFFFFFF", "#FFFFFFFFF", "FFFFFFFF0", "#GGGGGG",   "#FFFFFFZZ",
      "Transparent", std::string("#FF\0FFF", 7), "#\xFF\xFF\xFF\xFF\xFF\xFF",
  };
  for (const auto &value : invalid) {
    expectThrow<std::invalid_argument>([&]() { parseColor(value); });
  }
  assert((parseColor("transparent") == Color{0, 0, 0, 0}));
  assert((parseColor("#abcdef") == Color{0xAB, 0xCD, 0xEF, 255}));
  assert((parseColor("#ABCDEF00") == Color{0xAB, 0xCD, 0xEF, 0}));

  QRCodeGenerator generator;
  const GenerateOptions options =
      margelo::nitro::NitroQRCode::makeGenerateOptions(
          64, 4, "M", "transparent", "transparent", "#000000", "#000000",
          "#000000", "#000000", 1, 40, -1, true);
  int width = 0;
  int height = 0;
  const auto rgba = decodePngBase64ToRgba(
      generator.renderPngBase64("transparent", options), width, height);
  for (size_t index = 3; index < rgba.size(); index += 4) {
    assert(rgba[index] == 0);
  }
}

void testGradientHostileNumbers() {
  QRCodeGenerator generator;
  const double nan = std::numeric_limits<double>::quiet_NaN();
  const double inf = std::numeric_limits<double>::infinity();
  const auto base = []() {
    GenerateOptions options;
    options.size = 64;
    options.gradient.type = "linear";
    options.gradient.colors = {parseColor("#000000"), parseColor("#0000FF")};
    return options;
  };

  for (const double bad : {nan, inf, -inf, -0.01, 1.01}) {
    for (int field = 0; field < 4; field++) {
      GenerateOptions options = base();
      double *target[] = {&options.gradient.startX, &options.gradient.startY,
                          &options.gradient.endX, &options.gradient.endY};
      *target[field] = bad;
      const std::string message = expectThrow<std::invalid_argument>(
          [&]() { generator.renderPngBytes("gradient", options); });
      assert(message.find("must be a finite number between 0 and 1.") !=
             std::string::npos);
    }
    GenerateOptions options = base();
    options.gradient.locations = {0.0, bad};
    expectThrow<std::invalid_argument>(
        [&]() { generator.renderPngBytes("gradient", options); });
    options.gradient.locations = {bad, 1.0};
    expectThrow<std::invalid_argument>(
        [&]() { generator.generateSvgString("gradient", options); });
  }

  GenerateOptions tooMany = base();
  tooMany.gradient.colors.assign(9, parseColor("#000000"));
  expectThrow<std::invalid_argument>(
      [&]() { generator.renderPngBytes("gradient", tooMany); });
  tooMany.gradient.colors.resize(8);
  assert(!generator.renderPngBytes("gradient", tooMany).empty());

  GenerateOptions zeroSpan = base();
  zeroSpan.gradient.startX = 0.5;
  zeroSpan.gradient.startY = 0.5;
  zeroSpan.gradient.endX = 0.5;
  zeroSpan.gradient.endY = 0.5;
  assert(!generator.renderPngBytes("gradient", zeroSpan).empty());
  zeroSpan.gradient.type = "radial";
  assert(!generator.renderPngBytes("gradient", zeroSpan).empty());
  assert(generator.generateSvgString("gradient", zeroSpan).find("r=\"1.00%\"") !=
         std::string::npos);
}

bool containsColor(const std::vector<uint8_t> &rgba, const Color &color) {
  for (size_t index = 0; index + 3 < rgba.size(); index += 4) {
    if (rgba[index] == color.r && rgba[index + 1] == color.g &&
        rgba[index + 2] == color.b && rgba[index + 3] == color.a) {
      return true;
    }
  }
  return false;
}

void testSingleCustomLayerColors() {
  QRCodeGenerator generator;
  const Color red = parseColor("#FF0000");
  for (int layer = 0; layer < 4; layer++) {
    GenerateOptions options;
    options.size = 200;
    options.minVersion = 7;
    switch (layer) {
    case 0:
      options.eyeSet = true;
      options.eye = red;
      break;
    case 1:
      options.eyeballSet = true;
      options.eyeball = red;
      break;
    case 2:
      options.alignmentSet = true;
      options.alignment = red;
      break;
    default:
      options.timingSet = true;
      options.timing = red;
      break;
    }
    int width = 0;
    int height = 0;
    const auto rgba = decodePngBase64ToRgba(
        generator.renderPngBase64("layer-color", options), width, height);
    assert(containsColor(rgba, red));
    assert(containsColor(rgba, Color{0, 0, 0, 255}));
  }
}

void testBoundedCacheCapacityZeroAndOne() {
  BoundedCache<std::string> none(0, 1024);
  none.store("k", "r", "v", 1);
  assert(none.size() == 0 && none.bytes() == 0);
  assert(!none.get("k", "r").has_value());

  BoundedCache<std::string> one(1, 1024);
  one.store("a", "ra", "va", 10);
  one.store("b", "rb", "vb", 20);
  assert(one.size() == 1 && one.bytes() == 20);
  assert(!one.get("a", "ra").has_value());
  assert(one.get("b", "rb") == std::optional<std::string>("vb"));

  BoundedCache<std::string> zeroBytes(4, 0);
  zeroBytes.store("a", "ra", "va", 1);
  assert(zeroBytes.size() == 0);
  zeroBytes.store("b", "rb", "", 0);
  assert(zeroBytes.size() == 1 && zeroBytes.bytes() == 0);
}

void testBoundedCacheLruOrderAndCollisions() {
  BoundedCache<std::string> cache(3, 1000);
  cache.store("a", "ra", "va", 1);
  cache.store("b", "rb", "vb", 1);
  cache.store("c", "rc", "vc", 1);
  assert(cache.get("a", "ra").has_value());
  cache.store("d", "rd", "vd", 1);
  assert(!cache.get("b", "rb").has_value());
  assert(cache.get("a", "ra").has_value());
  assert(cache.get("c", "rc").has_value());
  assert(cache.get("d", "rd").has_value());

  assert(!cache.get("a", "other-request").has_value());
  cache.store("a", "collision", "vx", 5);
  assert(cache.size() == 3 && cache.bytes() == 7);
  assert(!cache.get("a", "ra").has_value());
  assert(cache.get("a", "collision") == std::optional<std::string>("vx"));

  cache.store("a", "too-big", "vy", 1001);
  assert(cache.get("a", "collision") == std::optional<std::string>("vx"));
  assert(cache.bytes() == 7);

  BoundedCache<std::string> byBytes(10, 10);
  byBytes.store("a", "ra", "va", 4);
  byBytes.store("b", "rb", "vb", 4);
  assert(byBytes.get("a", "ra").has_value());
  byBytes.store("c", "rc", "vc", 4);
  assert(byBytes.size() == 2 && byBytes.bytes() == 8);
  assert(!byBytes.get("b", "rb").has_value());
  byBytes.store("d", "rd", "vd", 10);
  assert(byBytes.size() == 1 && byBytes.bytes() == 10);

  byBytes.clear();
  assert(byBytes.size() == 0 && byBytes.bytes() == 0);
  byBytes.store("e", "re", "ve", 3);
  assert(byBytes.size() == 1 && byBytes.bytes() == 3);
}

void testBoundedCacheConcurrentAccess() {
  BoundedCache<std::string> cache(8, 64);
  std::atomic<int> hits{0};
  std::vector<std::thread> workers;
  for (int worker = 0; worker < 8; worker++) {
    workers.emplace_back([&cache, &hits, worker]() {
      for (int step = 0; step < 400; step++) {
        const std::string key = std::to_string((worker + step) % 13);
        if (step % 50 == 49) {
          cache.clear();
        }
        cache.store(key, "r" + key, "v" + key, 4);
        if (const auto value = cache.get(key, "r" + key)) {
          assert(*value == "v" + key);
          hits.fetch_add(1, std::memory_order_relaxed);
        }
        assert(cache.size() <= 8);
        assert(cache.bytes() <= 64);
      }
    });
  }
  for (auto &worker : workers) {
    worker.join();
  }
  assert(hits.load() > 0);
}

void testGeneratorConcurrentMixedOutputsAndClear() {
  QRCodeGenerator generator;
  std::vector<std::future<void>> futures;
  for (int index = 0; index < 16; index++) {
    futures.push_back(std::async(std::launch::async, [&generator, index]() {
      GenerateOptions options;
      options.size = 96;
      const std::string value = "concurrent-" + std::to_string(index % 5);
      for (int step = 0; step < 6; step++) {
        switch ((index + step) % 4) {
        case 0:
          assert(!generator.renderPngBytes(value, options).empty());
          break;
        case 1:
          assert(startsWith(generator.generateSvgString(value, options),
                            "<svg"));
          break;
        case 2:
          assert(generator.getMatrixObject(value, options).size >= 21);
          break;
        default:
          generator.clearCache();
          break;
        }
        assert(generator.memorySize() <= QRCodeGenerator::MaxCombinedCacheBytes);
      }
    }));
  }
  for (auto &future : futures) {
    future.get();
  }
}

using margelo::nitro::NitroQRCode::makeGenerateOptions;
using margelo::nitro::NitroQRCode::makeMatrixOptions;
using margelo::nitro::NitroQRCode::toBridgeInt;

constexpr std::array<const char *, 11> BridgeIntFields = {
    "size",          "quietZone",    "minVersion",
    "maxVersion",    "mask",         "gap",
    "eyePatternGap", "cornerRadius", "eyePatternCornerRadius",
    "logoAreaSize",  "logoAreaBorderRadius"};

GenerateOptions makeBridgeOptionsWith(size_t field, double value) {
  std::array<double, 11> values = {256, 4, 1, 40, -1, 0, 0, -1, -1, 0, 0};
  values[field] = value;
  return makeGenerateOptions(
      values[0], values[1], "M", "#000000", "#FFFFFF", "#000000", "#000000",
      "#000000", "#000000", values[2], values[3], values[4], true, "square",
      "square", "square", values[5], values[6], "dense", values[7], values[8],
      "matrix", values[9], values[10]);
}

void testBridgeNumericCastsForEveryField() {
  const double nan = std::numeric_limits<double>::quiet_NaN();
  const double inf = std::numeric_limits<double>::infinity();
  const std::vector<double> rejected = {
      nan,   -nan, inf, -inf, 0.5, -0.5, 1e-300, 1e10, -1e10,
      2147483648.0, -2147483649.0, std::numeric_limits<double>::max(),
      std::numeric_limits<double>::lowest(),
      std::numeric_limits<double>::denorm_min()};
  for (size_t field = 0; field < BridgeIntFields.size(); field++) {
    for (const double value : rejected) {
      const std::string message = expectThrow<std::invalid_argument>(
          [&]() { makeBridgeOptionsWith(field, value); });
      assert(message ==
             std::string(BridgeIntFields[field]) + " must be a finite integer.");
    }
  }

  assert(toBridgeInt(2147483647.0, "size") == std::numeric_limits<int>::max());
  assert(toBridgeInt(-2147483648.0, "size") == std::numeric_limits<int>::min());
  assert(toBridgeInt(-0.0, "size") == 0);

  QRCodeGenerator generator;
  for (size_t field = 0; field < BridgeIntFields.size(); field++) {
    const GenerateOptions options = makeBridgeOptionsWith(field, -1e9);
    expectThrow<std::invalid_argument>(
        [&]() { generator.renderPngBytes("bridge", options); });
    const GenerateOptions huge = makeBridgeOptionsWith(field, 2147483647.0);
    expectThrow<std::invalid_argument>(
        [&]() { generator.renderPngBytes("bridge", huge); });
  }

  for (const double value : {nan, inf, 1.5}) {
    expectThrow<std::invalid_argument>(
        [&]() { makeMatrixOptions("M", value, 40, -1, true); });
    expectThrow<std::invalid_argument>(
        [&]() { makeMatrixOptions("M", 1, value, -1, true); });
    expectThrow<std::invalid_argument>(
        [&]() { makeMatrixOptions("M", 1, 40, value, true); });
  }
}

void testBridgeRejectsInvalidColorsAndEnums() {
  const auto build = [](int slot, const std::string &color) {
    std::array<std::string, 6> colors = {"#000000", "#FFFFFF", "#000000",
                                         "#000000", "#000000", "#000000"};
    std::vector<std::string> gradientColors = {"#000000", "#FFFFFF"};
    if (slot < 6) {
      colors[static_cast<size_t>(slot)] = color;
    } else {
      gradientColors[1] = color;
    }
    return makeGenerateOptions(256, 4, "M", colors[0], colors[1], colors[2],
                               colors[3], colors[4], colors[5], 1, 40, -1, true,
                               "square", "square", "square", 0, 0, "dense", -1,
                               -1, "matrix", 0, 0, "linear", gradientColors);
  };
  for (int slot = 0; slot < 7; slot++) {
    for (const std::string bad : {"", "#12", "blue", "#ZZZZZZ"}) {
      expectThrow<std::invalid_argument>([&]() { build(slot, bad); });
    }
    assert(!build(slot, "transparent").foregroundColor.empty());
  }

  QRCodeGenerator generator;
  const std::vector<std::function<void(GenerateOptions &)>> mutations = {
      [](GenerateOptions &o) { o.errorCorrectionLevel = ""; },
      [](GenerateOptions &o) { o.errorCorrectionLevel = "l"; },
      [](GenerateOptions &o) { o.errorCorrectionLevel = "HIGH"; },
      [](GenerateOptions &o) { o.moduleShape = ""; },
      [](GenerateOptions &o) { o.moduleShape = "Square"; },
      [](GenerateOptions &o) { o.eyePatternShape = std::string("square\0", 7); },
      [](GenerateOptions &o) { o.eyeballShape = "circle "; },
      [](GenerateOptions &o) { o.alignmentShape = "star"; },
      [](GenerateOptions &o) { o.timingShape = "star"; },
      [](GenerateOptions &o) { o.bodyDensity = ""; },
      [](GenerateOptions &o) { o.layout = ""; },
      [](GenerateOptions &o) { o.layout = "radial"; },
      [](GenerateOptions &o) { o.gradient.type = ""; },
      [](GenerateOptions &o) { o.gradient.type = "conic"; },
  };
  for (const auto &mutate : mutations) {
    GenerateOptions options;
    options.size = 64;
    mutate(options);
    expectThrow<std::invalid_argument>(
        [&]() { generator.renderPngBytes("enum", options); });
  }
  assert(generator.getCacheSize() == 0);
}

uint8_t compositeGray(const std::vector<uint8_t> &rgba, size_t pixel) {
  const size_t offset = pixel * 4;
  const unsigned alpha = rgba[offset + 3];
  const unsigned luma = (rgba[offset] * 299U + rgba[offset + 1] * 587U +
                         rgba[offset + 2] * 114U) /
                        1000U;
  return static_cast<uint8_t>((luma * alpha + 255U * (255U - alpha)) / 255U);
}

bool decodesRenderedPng(const std::string &payload,
                        const GenerateOptions &options, int expectedVersion,
                        int expectedEccLevel) {
  QRCodeGenerator generator;
  int width = 0;
  int height = 0;
  const auto rgba = decodePngBase64ToRgba(
      generator.renderPngBase64(payload, options), width, height);
  quirc *qr = quirc_new();
  assert(qr != nullptr);
  assert(quirc_resize(qr, width, height) == 0);
  uint8_t *gray = quirc_begin(qr, nullptr, nullptr);
  const size_t pixels = static_cast<size_t>(width) * static_cast<size_t>(height);
  for (size_t pixel = 0; pixel < pixels; pixel++) {
    gray[pixel] = compositeGray(rgba, pixel);
  }
  quirc_end(qr);
  bool matched = false;
  for (int index = 0; index < quirc_count(qr); index++) {
    quirc_code code{};
    quirc_data data{};
    quirc_extract(qr, index, &code);
    if (quirc_decode(&code, &data) != QUIRC_SUCCESS) {
      continue;
    }
    const std::string decoded(reinterpret_cast<const char *>(data.payload),
                              static_cast<size_t>(data.payload_len));
    if (decoded == payload && data.version == expectedVersion &&
        data.ecc_level == expectedEccLevel) {
      matched = true;
    }
  }
  quirc_destroy(qr);
  return matched;
}

std::string bytePayload(size_t length) {
  std::string payload;
  payload.reserve(length);
  for (size_t index = 0; index < length; index++) {
    payload.push_back(static_cast<char>('a' + index % 26));
  }
  return payload;
}

void testRenderedRoundTripAtMaxVersion() {
  struct EccCase {
    const char *ecc;
    int quircLevel;
    size_t capacity;
  };
  const std::array<EccCase, 4> cases = {{
      {"L", QUIRC_ECC_LEVEL_L, 2953},
      {"M", QUIRC_ECC_LEVEL_M, 2331},
      {"Q", QUIRC_ECC_LEVEL_Q, 1663},
      {"H", QUIRC_ECC_LEVEL_H, 1273},
  }};
  for (const auto &entry : cases) {
    GenerateOptions options;
    options.size = (177 + 8) * 6;
    options.errorCorrectionLevel = entry.ecc;
    options.boostEcl = false;
    assert(decodesRenderedPng(bytePayload(entry.capacity), options, 40,
                              entry.quircLevel));
  }
}

void testRenderedRoundTripWithMaxScanSafeLogo() {
  const std::string payload = "https://example.com/logo-round-trip";
  for (const int version : {5, 10, 40}) {
    GenerateOptions options;
    const int modules = version * 4 + 17 + 8;
    options.size = modules * 6;
    options.errorCorrectionLevel = "H";
    options.boostEcl = false;
    options.minVersion = version;
    options.maxVersion = version;
    options.logoAreaSize = options.size * 3 / 10;
    options.logoAreaBorderRadius = options.logoAreaSize / 4;
    assert(decodesRenderedPng(payload, options, version, QUIRC_ECC_LEVEL_H));

    options.gradient.type = "linear";
    options.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};
    assert(decodesRenderedPng(payload, options, version, QUIRC_ECC_LEVEL_H));
  }
}

void testRenderedRoundTripHostileBytes() {
  GenerateOptions options;
  options.size = 29 * 8;
  options.minVersion = 1;
  options.errorCorrectionLevel = "M";
  options.boostEcl = false;
  options.quietZone = 4;
  for (const std::string &payload :
       {std::string("\xFF\xFE\xC0\xAF", 4), std::string(3, '\0'),
        std::string("\xED\xA0\x80", 3)}) {
    assert(decodesRenderedPng(payload, options, 1, QUIRC_ECC_LEVEL_M));
  }
}

void testShapeCombinationEdges() {
  QRCodeGenerator generator;
  GenerateOptions base;
  base.size = 232;
  const auto reference = generator.renderPngBytes("shape-edges", base);

  GenerateOptions classy = base;
  classy.moduleShape = "classy";
  classy.alignmentShape = "classy";
  classy.timingShape = "classy";
  assert(generator.renderPngBytes("shape-edges", classy) != reference);
  for (const int radius : {0, 1, 4, 256}) {
    classy.cornerRadius = radius;
    const auto output = generator.renderPngBytes("shape-edges", classy);
    assert(output != reference);
  }

  for (const char *eyeball : {"diamond", "rounded", "squircle", "classy"}) {
    GenerateOptions eyes = base;
    eyes.eyePatternShape = "circle";
    eyes.eyeballShape = eyeball;
    assert(generator.renderPngBytes("shape-edges", eyes) != reference);
  }
}

void testPixelBufferBytesOn32BitSizeType() {
  using NitroQRCode::pixelBufferBytes;
  const int intMax = std::numeric_limits<int>::max();
  uint32_t narrow = 7;
  assert(pixelBufferBytes<uint32_t>(4096, 4096, 4, narrow));
  assert(narrow == 67108864U);
  assert(pixelBufferBytes<uint32_t>(32767, 32767, 4, narrow));
  assert(narrow == 4294705156U);
  assert(pixelBufferBytes<uint32_t>(65535, 65535, 1, narrow));
  assert(narrow == 4294836225U);
  narrow = 7;
  for (const auto &dimensions : std::vector<std::pair<int, int>>{
           {32768, 32768},
           {65536, 65536},
           {intMax, intMax},
           {intMax, 1},
           {1073741824, 1},
           {0, 1},
           {1, 0},
           {-1, 1},
           {1, -1},
       }) {
    assert(!pixelBufferBytes<uint32_t>(dimensions.first, dimensions.second, 4,
                                       narrow));
    assert(narrow == 7);
  }
  assert(!pixelBufferBytes<uint32_t>(65536, 65536, 1, narrow));
  assert(!pixelBufferBytes<uint32_t>(1, 1, 0, narrow));
  assert(!pixelBufferBytes<uint32_t>(1, 1, 5, narrow));

  uint64_t wide = 0;
  assert(pixelBufferBytes<uint64_t>(32768, 32768, 4, wide));
  assert(wide == 4294967296ULL);
  assert(pixelBufferBytes<uint64_t>(intMax, intMax, 4, wide));
  assert(wide == 18446744056529682436ULL);
  uint16_t tiny = 0;
  assert(pixelBufferBytes<uint16_t>(127, 129, 4, tiny) && tiny == 65532);
  assert(!pixelBufferBytes<uint16_t>(128, 128, 4, tiny));
  static_assert(sizeof(size_t) >= sizeof(uint32_t));
}

void testOversizedValueIsRejectedLikeTheEncoder() {
  QRCodeGenerator generator;
  for (const size_t length : {65536U, 65537U, 300000U}) {
    for (const char symbol : {'7', 'A', 'a', '\0'}) {
      for (const int maxVersion : {1, 9, 40}) {
        GenerateOptions options;
        options.maxVersion = maxVersion;
        const std::string value(length, symbol);
        assert(expectThrow<qrcodegen::data_too_long>([&]() {
                 generator.getMatrixSize(value, options);
               }) == "Segment too long");
        assert(expectThrow<qrcodegen::data_too_long>([&]() {
                 generator.renderPngBytes(value, options);
               }) == "Segment too long");
        assert(expectThrow<qrcodegen::data_too_long>([&]() {
                 generator.generateSvgString(value, options);
               }) == "Segment too long");
      }
    }
  }
  for (const char symbol : {'7', 'A', 'a'}) {
    const std::string value(65536, symbol);
    const std::string encoderMessage =
        expectThrow<qrcodegen::data_too_long>([&]() {
          qrcodegen::QrCode::encodeSegments(
              qrcodegen::QrSegment::makeSegments(value.c_str()),
              qrcodegen::QrCode::Ecc::LOW);
        });
    GenerateOptions options;
    assert(expectThrow<qrcodegen::data_too_long>([&]() {
             generator.getMatrixSize(value, options);
           }) == encoderMessage);
  }
  const std::string below(65535, 'a');
  GenerateOptions defaults;
  assert(startsWith(expectThrow<qrcodegen::data_too_long>([&]() {
                      generator.getMatrixSize(below, defaults);
                    }),
                    "Data length = 524300 bits"));

  const std::string oversized(70000, 'a');
  GenerateOptions badSize;
  badSize.size = 0;
  assert(expectThrow<std::invalid_argument>([&]() {
           generator.renderPngBytes(oversized, badSize);
         }) == "size must be between 1 and 4096.");
  GenerateOptions badEcc;
  badEcc.errorCorrectionLevel = "zz";
  for (const auto &call : std::vector<std::function<void()>>{
           [&]() { generator.renderPngBytes(oversized, badEcc); },
           [&]() { generator.generateSvgString(oversized, badEcc); },
           [&]() { generator.getMatrixSize(oversized, badEcc); },
       }) {
    assert(startsWith(expectThrow<std::invalid_argument>(call),
                      "errorCorrectionLevel must be"));
  }
  assert(generator.memorySize() == 0);
}

void testConcurrentLargeRendersMatchSerialOutput() {
  GenerateOptions options;
  options.size = 1100;
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};
  std::vector<std::vector<uint8_t>> expected;
  for (int index = 0; index < 3; index++) {
    expected.push_back(QRCodeGenerator().renderPngBytes(
        "large-" + std::to_string(index), options));
  }
  QRCodeGenerator shared;
  QRCodeGenerator other;
  std::vector<std::future<bool>> futures;
  for (int index = 0; index < 12; index++) {
    futures.push_back(std::async(std::launch::async, [&, index]() {
      QRCodeGenerator &generator = index % 4 == 3 ? other : shared;
      const auto slot = static_cast<size_t>(index % 3);
      if (index % 6 == 5) {
        GenerateOptions invalid = options;
        invalid.size = 4097;
        expectThrow<std::invalid_argument>(
            [&]() { generator.renderPngBytes("large-invalid", invalid); });
      }
      return generator.renderPngBytes("large-" + std::to_string(slot),
                                      options) == expected[slot];
    }));
  }
  for (auto &future : futures) {
    assert(future.get());
  }
  assert(shared.getCacheSize() == 3);
}

void testReturnedPngDoesNotRetainEncoderCapacity() {
  QRCodeGenerator generator;
  for (const bool gradient : {false, true}) {
    for (const int logoAreaSize : {0, 200}) {
      GenerateOptions options;
      options.size = 1024;
      options.logoAreaSize = logoAreaSize;
      if (gradient) {
        options.gradient.type = "linear";
        options.gradient.colors = {parseColor("#000000"),
                                   parseColor("#1A237E")};
      }
      const auto png = generator.renderPngBytes("capacity", options);
      assert(png.capacity() <= png.size() * 2);
    }
  }
  const std::vector<uint8_t> rgba(64 * 64 * 4, 0x7F);
  const auto direct = NitroQRCode::encodePngRgba(64, 64, rgba);
  assert(direct.capacity() <= direct.size() * 2);
}

uint32_t readBigEndian32(const std::vector<uint8_t> &bytes, size_t offset) {
  return (static_cast<uint32_t>(bytes[offset]) << 24) |
         (static_cast<uint32_t>(bytes[offset + 1]) << 16) |
         (static_cast<uint32_t>(bytes[offset + 2]) << 8) |
         static_cast<uint32_t>(bytes[offset + 3]);
}

size_t assertStreamedRgbaPngStructure(const std::vector<uint8_t> &png,
                                      int expectedSize) {
  const std::vector<uint8_t> signature = {137, 80, 78, 71, 13, 10, 26, 10};
  assert(png.size() > signature.size());
  assert(std::equal(signature.begin(), signature.end(), png.begin()));
  std::vector<std::string> types;
  size_t idatBytes = 0;
  size_t offset = signature.size();
  while (offset < png.size()) {
    assert(offset + 12 <= png.size());
    const size_t length = readBigEndian32(png, offset);
    assert(offset + 12 + length <= png.size());
    const std::string type(reinterpret_cast<const char *>(&png[offset + 4]), 4);
    const uint32_t expectedCrc = static_cast<uint32_t>(
        crc32(crc32(0L, Z_NULL, 0), &png[offset + 4],
              static_cast<uInt>(length + 4)));
    assert(readBigEndian32(png, offset + 8 + length) == expectedCrc);
    if (type == "IHDR") {
      assert(length == 13);
      assert(readBigEndian32(png, offset + 8) ==
             static_cast<uint32_t>(expectedSize));
      assert(readBigEndian32(png, offset + 12) ==
             static_cast<uint32_t>(expectedSize));
      assert(png[offset + 16] == 8 && png[offset + 17] == 6);
      assert(png[offset + 18] == 0 && png[offset + 19] == 0 &&
             png[offset + 20] == 0);
    } else if (type == "IDAT") {
      assert(length > 0 && length <= 64 * 1024);
      idatBytes += length;
    } else {
      assert(type == "IEND" && length == 0);
    }
    types.push_back(type);
    offset += 12 + length;
  }
  assert(offset == png.size());
  assert(types.size() >= 3);
  assert(types.front() == "IHDR" && types.back() == "IEND");
  for (size_t index = 1; index + 1 < types.size(); index++) {
    assert(types[index] == "IDAT");
  }
  return idatBytes;
}

std::vector<GenerateOptions> gradientVariants(int size) {
  std::vector<GenerateOptions> variants;
  GenerateOptions linear;
  linear.size = size;
  linear.gradient.type = "linear";
  linear.gradient.colors = {parseColor("#111111"), parseColor("#F5A623")};
  variants.push_back(linear);

  GenerateOptions radialLogo = linear;
  radialLogo.gradient.type = "radial";
  radialLogo.gradient.startX = 0.5;
  radialLogo.gradient.startY = 0.5;
  radialLogo.errorCorrectionLevel = "H";
  radialLogo.logoAreaSize = size * 3 / 10;
  radialLogo.logoAreaBorderRadius = size / 20;
  radialLogo.quietZone = 0;
  variants.push_back(radialLogo);

  GenerateOptions translucent = linear;
  translucent.background = parseColor("transparent");
  translucent.backgroundColor = "transparent";
  translucent.quietZoneFill = translucent.background;
  translucent.finderInner = translucent.background;
  translucent.moduleShape = "circle";
  translucent.eyePatternShape = "rounded";
  translucent.eyeballShape = "diamond";
  translucent.gradient.colors = {
      parseColor("#FF000080"), parseColor("#00FF00"), parseColor("#0000FF40"),
      parseColor("#000000"),   parseColor("#FFFFFF"), parseColor("#12345678"),
      parseColor("#ABCDEF"),   parseColor("#00000000")};
  translucent.gradient.locations = {0.0, 0.1, 0.2, 0.2, 0.5, 0.75, 0.9, 1.0};
  variants.push_back(translucent);

  GenerateOptions layered = linear;
  layered.minVersion = 8;
  layered.strokeSet = true;
  layered.stroke = parseColor("#00AA00");
  layered.eyeSet = true;
  layered.eye = parseColor("#AA0000");
  layered.eyeStrokeSet = true;
  layered.eyeStroke = parseColor("#0000AA");
  layered.alignmentSet = true;
  layered.alignment = parseColor("#AA00AA");
  layered.quietZoneFill = parseColor("#EEEEEE");
  layered.finderInner = parseColor("#FFFFCC");
  layered.quietZone = 32;
  variants.push_back(layered);
  return variants;
}

void testStreamedGradientPixelsMatchFpng() {
  const int never = std::numeric_limits<int>::max();
  const std::string value = "https://example.com/streamed-gradient";
  for (const int size : {1, 64, 257, 1024, 1025, 1500}) {
    for (const GenerateOptions &options : gradientVariants(size)) {
      QRCodeGenerator streamed({}, QRCodeGenerator::DefaultMaxCacheBytes, 0);
      QRCodeGenerator buffered({}, QRCodeGenerator::DefaultMaxCacheBytes,
                               never);
      QRCodeGenerator standard;
      const auto streamedPng = streamed.renderPngBytes(value, options);
      const auto bufferedPng = buffered.renderPngBytes(value, options);
      const auto standardPng = standard.renderPngBytes(value, options);

      int streamedWidth = 0;
      int streamedHeight = 0;
      int bufferedWidth = 0;
      int bufferedHeight = 0;
      const auto streamedPixels = decodePngBase64ToRgba(
          NitroQRCode::base64Encode(streamedPng), streamedWidth,
          streamedHeight);
      const auto bufferedPixels = decodePngBase64ToRgba(
          NitroQRCode::base64Encode(bufferedPng), bufferedWidth,
          bufferedHeight);
      assert(streamedWidth == bufferedWidth);
      assert(streamedHeight == bufferedHeight);
      assert(streamedPixels == bufferedPixels);
      assertStreamedRgbaPngStructure(streamedPng, streamedWidth);
      assert(streamedPng.capacity() <= streamedPng.size() * 2);

      const bool large =
          streamedWidth > QRCodeGenerator::DefaultStreamedRgbaMinSize;
      assert(standardPng == (large ? streamedPng : bufferedPng));
      assert(streamed.renderPngBytes(value, options) == streamedPng);
      assert(streamed.getCacheSize() == 1);
    }
  }
}

void testStreamedGradientSpansManyIdatChunks() {
  GenerateOptions options;
  options.size = 1400;
  options.minVersion = 40;
  options.moduleShape = "circle";
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#FF0000"), parseColor("#00FF00"),
                             parseColor("#0000FF80")};
  QRCodeGenerator generator;
  const auto png = generator.renderPngBytes("idat-chunks", options);
  const size_t idatBytes = assertStreamedRgbaPngStructure(png, 1400);
  assert(idatBytes > 3 * 64 * 1024);
}

void testEncodePngRgbaDimensionGuards() {
  using NitroQRCode::encodePngRgba;
  const int intMax = std::numeric_limits<int>::max();
  const std::vector<uint8_t> empty;
  const std::vector<uint8_t> onePixel = {1, 2, 3, 4};
  for (const auto &dimensions : std::vector<std::pair<int, int>>{
           {0, 1},
           {1, 0},
           {-1, 1},
           {1, -1},
           {std::numeric_limits<int>::min(), 1},
           {32768, 32768},
           {65536, 65536},
           {intMax, intMax},
           {intMax, 1},
           {2, 1},
       }) {
    expectThrow<std::invalid_argument>([&]() {
      encodePngRgba(dimensions.first, dimensions.second, empty);
    });
    if (dimensions.first != 1 || dimensions.second != 1) {
      expectThrow<std::invalid_argument>([&]() {
        encodePngRgba(dimensions.first, dimensions.second, onePixel);
      });
    }
  }
  const auto png = encodePngRgba(1, 1, onePixel);
  assert(png.size() > 8 && png[0] == 0x89);
}

void testBase64OutputLengthIsExact() {
  using NitroQRCode::base64Encode;
  for (const size_t length : {0U, 1U, 2U, 3U, 4U, 5U, 255U, 256U, 257U, 65537U}) {
    const std::vector<uint8_t> bytes(length, 0xA5);
    const std::string encoded = base64Encode(bytes);
    assert(encoded.size() == ((length + 2) / 3) * 4);
    assert(encoded.size() % 4 == 0);
  }
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 4096;
  const size_t pngBytes = generator.renderPngBytes("length", options).size();
  const std::string dataUri = generator.renderPngDataUri("length", options);
  assert(dataUri.size() == 22 + ((pngBytes + 2) / 3) * 4);
}

} // namespace

void runQRCodeHardeningTests() {
  testShapeCombinationEdges();
  testPixelBufferBytesOn32BitSizeType();
  testOversizedValueIsRejectedLikeTheEncoder();
  testConcurrentLargeRendersMatchSerialOutput();
  testReturnedPngDoesNotRetainEncoderCapacity();
  testStreamedGradientPixelsMatchFpng();
  testStreamedGradientSpansManyIdatChunks();
  testEncodePngRgbaDimensionGuards();
  testBase64OutputLengthIsExact();
  testVersion40CapacityBoundaries();
  testVersionWindowTooSmallForPayload();
  testBoostEclKeepsCapacityBoundary();
  testHostilePayloads();
  testSizeAndQuietZoneExtremes();
  testColorInputs();
  testGradientHostileNumbers();
  testSingleCustomLayerColors();
  testBoundedCacheCapacityZeroAndOne();
  testBoundedCacheLruOrderAndCollisions();
  testBoundedCacheConcurrentAccess();
  testGeneratorConcurrentMixedOutputsAndClear();
  testBridgeNumericCastsForEveryField();
  testBridgeRejectsInvalidColorsAndEnums();
  testRenderedRoundTripAtMaxVersion();
  testRenderedRoundTripWithMaxScanSafeLogo();
  testRenderedRoundTripHostileBytes();
  std::cout << "QRCode hardening tests passed" << std::endl;
}
