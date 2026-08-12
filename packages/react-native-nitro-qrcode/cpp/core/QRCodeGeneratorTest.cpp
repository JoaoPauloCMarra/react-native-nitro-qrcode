#include "QRCodeGenerator.hpp"
#include "parity-corpus.hpp"

#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <future>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
#include <zlib.h>

using NitroQRCode::base64Encode;
using NitroQRCode::encodePngRgba;
using NitroQRCode::GenerateOptions;
using NitroQRCode::parityCorpus;
using NitroQRCode::parseColor;
using NitroQRCode::QRCodeGenerator;

void runQRCodeBridgeOptionsTests();

namespace {

void assertPngHeader(const std::string &encoded) {
  assert(encoded.rfind("iVBORw0KGgo", 0) == 0);
}

std::vector<uint8_t> base64Decode(const std::string &encoded) {
  std::vector<int> values(256, -1);
  const std::string alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (size_t index = 0; index < alphabet.size(); index++) {
    values[static_cast<unsigned char>(alphabet[index])] =
        static_cast<int>(index);
  }

  std::vector<uint8_t> output;
  int accumulator = 0;
  int bits = -8;
  for (unsigned char character : encoded) {
    if (character == '=') {
      break;
    }
    const int value = values[character];
    if (value < 0) {
      continue;
    }
    accumulator = (accumulator << 6) | value;
    bits += 6;
    if (bits >= 0) {
      output.push_back(static_cast<uint8_t>((accumulator >> bits) & 0xFF));
      bits -= 8;
    }
  }
  return output;
}

uint32_t readU32(const std::vector<uint8_t> &bytes, size_t offset) {
  return (static_cast<uint32_t>(bytes[offset]) << 24) |
         (static_cast<uint32_t>(bytes[offset + 1]) << 16) |
         (static_cast<uint32_t>(bytes[offset + 2]) << 8) |
         static_cast<uint32_t>(bytes[offset + 3]);
}

std::vector<uint8_t> decodeRgbaPng(const std::string &encoded, int &width,
                                   int &height) {
  const std::vector<uint8_t> png = base64Decode(encoded);
  assert(png.size() > 8);
  std::vector<uint8_t> compressed;
  size_t offset = 8;
  while (offset + 12 <= png.size()) {
    const uint32_t chunkSize = readU32(png, offset);
    const size_t typeOffset = offset + 4;
    const size_t dataOffset = typeOffset + 4;
    const std::string type(reinterpret_cast<const char *>(&png[typeOffset]), 4);
    assert(dataOffset + chunkSize + 4 <= png.size());
    if (type == "IHDR") {
      width = static_cast<int>(readU32(png, dataOffset));
      height = static_cast<int>(readU32(png, dataOffset + 4));
      assert(png[dataOffset + 8] == 8);
      assert(png[dataOffset + 9] == 6);
    } else if (type == "IDAT") {
      compressed.insert(compressed.end(), png.begin() + dataOffset,
                        png.begin() + dataOffset + chunkSize);
    } else if (type == "IEND") {
      break;
    }
    offset = dataOffset + chunkSize + 4;
  }

  std::vector<uint8_t> raw((static_cast<size_t>(width) * 4 + 1) *
                           static_cast<size_t>(height));
  uLongf rawSize = static_cast<uLongf>(raw.size());
  const int result = uncompress(raw.data(), &rawSize, compressed.data(),
                                static_cast<uLong>(compressed.size()));
  assert(result == Z_OK);
  assert(rawSize == raw.size());

  std::vector<uint8_t> rgba(static_cast<size_t>(width) *
                            static_cast<size_t>(height) * 4);
  for (int y = 0; y < height; y++) {
    const size_t rawRow = static_cast<size_t>(y) *
                          (static_cast<size_t>(width) * 4 + 1);
    assert(raw[rawRow] == 0);
    const size_t rgbaRow =
        static_cast<size_t>(y) * static_cast<size_t>(width) * 4;
    std::copy(raw.begin() + static_cast<std::ptrdiff_t>(rawRow + 1),
              raw.begin() + static_cast<std::ptrdiff_t>(
                                rawRow + 1 + static_cast<size_t>(width) * 4),
              rgba.begin() + static_cast<std::ptrdiff_t>(rgbaRow));
  }
  return rgba;
}

std::vector<uint8_t> decodeIndexedAlphaPng(const std::string &encoded,
                                           int &width, int &height) {
  const std::vector<uint8_t> png = base64Decode(encoded);
  assert(png.size() > 8);
  std::vector<uint8_t> palette;
  std::vector<uint8_t> trns;
  std::vector<uint8_t> compressed;
  size_t offset = 8;
  while (offset + 12 <= png.size()) {
    const uint32_t chunkSize = readU32(png, offset);
    const size_t typeOffset = offset + 4;
    const size_t dataOffset = typeOffset + 4;
    const std::string type(reinterpret_cast<const char *>(&png[typeOffset]), 4);
    assert(dataOffset + chunkSize + 4 <= png.size());
    if (type == "IHDR") {
      width = static_cast<int>(readU32(png, dataOffset));
      height = static_cast<int>(readU32(png, dataOffset + 4));
      assert(png[dataOffset + 8] == 1);
      assert(png[dataOffset + 9] == 3);
    } else if (type == "PLTE") {
      palette.assign(png.begin() + dataOffset,
                     png.begin() + dataOffset + chunkSize);
    } else if (type == "tRNS") {
      trns.assign(png.begin() + dataOffset,
                  png.begin() + dataOffset + chunkSize);
    } else if (type == "IDAT") {
      compressed.insert(compressed.end(), png.begin() + dataOffset,
                        png.begin() + dataOffset + chunkSize);
    } else if (type == "IEND") {
      break;
    }
    offset = dataOffset + chunkSize + 4;
  }
  assert(palette.size() >= 6);
  assert(trns.size() >= 2);

  const size_t rowBytes = (static_cast<size_t>(width) + 7) / 8;
  std::vector<uint8_t> raw((rowBytes + 1) * static_cast<size_t>(height));
  uLongf rawSize = static_cast<uLongf>(raw.size());
  const int result = uncompress(raw.data(), &rawSize, compressed.data(),
                                static_cast<uLong>(compressed.size()));
  assert(result == Z_OK);
  assert(rawSize == raw.size());

  std::vector<uint8_t> alpha(static_cast<size_t>(width) *
                             static_cast<size_t>(height));
  for (int y = 0; y < height; y++) {
    const size_t rawRow = static_cast<size_t>(y) * (rowBytes + 1);
    assert(raw[rawRow] == 0);
    for (int x = 0; x < width; x++) {
      const uint8_t byte = raw[rawRow + 1 + static_cast<size_t>(x / 8)];
      const uint8_t bit = static_cast<uint8_t>(
          (byte >> (7U - static_cast<unsigned>(x % 8))) & 1U);
      const size_t entry = static_cast<size_t>(bit) * 3;
      assert(entry + 2 < palette.size());
      const uint8_t alphaValue = bit < trns.size() ? trns[bit] : 255;
      alpha[static_cast<size_t>(y) * static_cast<size_t>(width) +
            static_cast<size_t>(x)] = alphaValue;
      (void)palette[entry];
    }
  }
  return alpha;
}

void testPngGeneration() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 128;
  const std::string base64 =
      generator.generatePngBase64("https://example.com", options);
  assert(!base64.empty());
  assertPngHeader(base64);

  const std::string cached =
      generator.generatePngBase64("https://example.com", options);
  assert(cached == base64);

  options.size = 1;
  options.quietZone = 0;
  options.errorCorrectionLevel = "L";
  options.foreground = parseColor("#12345678");
  options.background = parseColor("#ABCDEF");
  assertPngHeader(generator.generatePngBase64("small", options));

  options = GenerateOptions{};
  options.size = 800;
  assertPngHeader(generator.generatePngBase64("large-output", options));
}

void testDataUriAndCache() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 96;
  const std::string first =
      generator.generatePngDataUri("https://example.com", options);
  const std::string second =
      generator.generatePngDataUri("https://example.com", options);
  assert(first == second);
  assert(first.rfind("data:image/png;base64,", 0) == 0);
  assert(generator.getCacheSize() == 1);
  generator.clearCache();
  assert(generator.getCacheSize() == 0);

  options.size = 32;
  options.quietZone = 0;
  for (int index = 0; index < 140; index++) {
    generator.generatePngBase64("cache-entry-" + std::to_string(index),
                                options);
  }
  assert(generator.getCacheSize() == 128);
  generator.clearCache();
  assert(generator.getCacheSize() == 0);
}

void testCollisionSafeCache() {
  QRCodeGenerator generator(
      [](const std::string &) { return std::string("collision"); });
  GenerateOptions options;
  const std::string first = generator.generateSvgString("first", options);
  const std::string second = generator.generateSvgString("second", options);

  assert(first != second);
  assert(generator.generateSvgString("first", options) == first);
  GenerateOptions alternateOptions = options;
  alternateOptions.backgroundColor = "#FF0000";
  alternateOptions.background = parseColor("#FF0000");
  const std::string alternate =
      generator.generateSvgString("first", alternateOptions);
  assert(alternate != first);
  assert(generator.generateSvgString("first", options) == first);
  assert(generator.getCacheSize() == 1);
}

void testByteBoundedCache() {
  QRCodeGenerator generator({}, 16 * 1024);
  GenerateOptions options;
  for (int index = 0; index < 30; index++) {
    generator.generateSvgString("byte-entry-" + std::to_string(index),
                                options);
  }

  assert(generator.getCacheSize() > 0);
  assert(generator.getCacheSize() < 30);

  QRCodeGenerator oversized({}, 1);
  oversized.generateSvgString("oversized", options);
  assert(oversized.getCacheSize() == 0);
}

void testConcurrentGeneration() {
  QRCodeGenerator generator;
  GenerateOptions baseOptions;
  baseOptions.size = 192;

  std::vector<std::future<std::string>> futures;
  futures.reserve(32);
  for (int index = 0; index < 32; index++) {
    futures.push_back(std::async(
        std::launch::async, [&generator, baseOptions, index]() mutable {
          if (index % 2 == 1) {
            baseOptions.gradient.type = "linear";
            baseOptions.gradient.colors = {parseColor("#111111"),
                                           parseColor("#F5A623")};
          }
          return generator.generatePngBase64(
              "parallel-entry-" + std::to_string(index % 12), baseOptions);
        }));
  }

  for (auto &future : futures) {
    assertPngHeader(future.get());
  }
  assert(generator.getCacheSize() > 0);
  assert(generator.getCacheSize() <= 24);
}

void testStyledPngGeneration() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 160;
  options.moduleShape = "circle";
  options.eyePatternShape = "rounded";
  options.bodyDensity = "balanced";
  options.gap = 2;
  options.eyePatternGap = 1;
  options.cornerRadius = 4;
  options.eyePatternCornerRadius = 6;
  options.logoAreaSize = 42;
  options.logoAreaBorderRadius = 8;
  assertPngHeader(
      generator.generatePngBase64("https://example.com/styled", options));

  options.moduleShape = "rounded";
  options.eyePatternShape = "circle";
  options.gap = 128;
  options.eyePatternGap = 0;
  options.cornerRadius = 0;
  options.logoAreaSize = 40;
  options.logoAreaBorderRadius = 0;
  assertPngHeader(
      generator.generatePngBase64("https://example.com/styled-2", options));

  options.moduleShape = "square";
  options.eyePatternShape = "square";
  options.gap = 0;
  options.logoAreaSize = 0;
  assertPngHeader(
      generator.generatePngBase64("https://example.com/styled-3", options));

  options.bodyDensity = "sparse";
  assertPngHeader(
      generator.generatePngBase64("https://example.com/sparse", options));

  options.moduleShape = "circle";
  options.eyePatternShape = "square";
  options.eyeballShape = "circle";
  options.eyeStrokeColor = "#222222";
  options.eyeStroke = parseColor(options.eyeStrokeColor);
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/circle-body-square-frame-circle-eye", options));

  options = GenerateOptions{};
  options.size = 160;
  options.moduleShape = "circle";
  options.eyePatternShape = "rounded";
  options.eyeballShape = "rounded";
  options.gap = 1;
  options.bodyDensity = "sparse";
  options.cornerRadius = 4;
  options.eyePatternCornerRadius = 6;
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/circle-styled", options));

  options = GenerateOptions{};
  options.size = 160;
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#4AA8FF"), parseColor("#28D17C")};
  options.gradient.locations = {0.0, 1.0};
  options.gradient.startX = 0.1;
  options.gradient.startY = 0.2;
  options.gradient.endX = 0.9;
  options.gradient.endY = 0.8;
  assertPngHeader(
      generator.generatePngBase64("https://example.com/gradient", options));

  options.gradient.locations = {0.0, 0.5};
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/gradient-tail", options));

  options.gradient.type = "radial";
  options.gradient.locations = {0.0, 1.0};
  options.gradient.startX = 0.5;
  options.gradient.startY = 0.5;
  options.gradient.endX = 1.0;
  options.gradient.endY = 0.5;
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/radial-gradient", options));

  options.gradient.startX = 0.5;
  options.gradient.startY = 0.5;
  options.gradient.endX = 0.5;
  options.gradient.endY = 0.5;
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/radial-zero-radius", options));

  options.gradient.type = "linear";
  options.gradient.startX = 0.4;
  options.gradient.startY = 0.4;
  options.gradient.endX = 0.4;
  options.gradient.endY = 0.4;
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/linear-zero-length", options));

  options = GenerateOptions{};
  options.size = 160;
  options.moduleShape = "rounded";
  options.eyePatternShape = "rounded";
  options.gap = 1;
  options.cornerRadius = 4;
  options.strokeColor = "#FF0000FF";
  options.eyeColor = "#111111";
  options.eyeStrokeColor = "#333333";
  options.eyeballColor = "#555555";
  options.stroke = parseColor(options.strokeColor);
  options.eye = parseColor(options.eyeColor);
  options.eyeStroke = parseColor(options.eyeStrokeColor);
  options.eyeball = parseColor(options.eyeballColor);
  assertPngHeader(
      generator.generatePngBase64("https://example.com/layer-colors", options));

  options.eyePatternShape = "square";
  options.eyeballShape = "square";
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/layer-square-eye-stroke", options));

  options = GenerateOptions{};
  options.size = 160;
  const std::string squareModules =
      generator.generatePngBase64("https://example.com/square-radius", options);
  options.cornerRadius = 4;
  const std::string roundedSquareModules =
      generator.generatePngBase64("https://example.com/square-radius", options);
  assert(squareModules != roundedSquareModules);

  options = GenerateOptions{};
  options.size = 160;
  const std::string squareEyes =
      generator.generatePngBase64("https://example.com/eye-radius", options);
  options.eyePatternCornerRadius = 4;
  const std::string roundedSquareEyes =
      generator.generatePngBase64("https://example.com/eye-radius", options);
  assert(squareEyes != roundedSquareEyes);
}

void testCircleGeometryTolerance() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 160;
  options.quietZone = 4;
  options.minVersion = 3;
  options.maxVersion = 3;
  options.mask = 0;
  options.boostEcl = false;
  options.moduleShape = "circle";
  options.eyePatternShape = "square";
  options.eyeballShape = "square";
  options.gap = 0;
  options.eyePatternGap = 0;
  options.bodyDensity = "dense";
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#000000")};
  options.gradient.locations = {0.0, 1.0};

  const std::string value = "https://example.com/circle-tolerance";
  const std::string encoded = generator.generatePngBase64(value, options);

  int width = 0;
  int height = 0;
  const std::vector<uint8_t> rgba = decodeRgbaPng(encoded, width, height);
  assert(width == 160);
  assert(height == 160);

  const int matrixSize = generator.getMatrixSize(value, options);
  const int totalModules = matrixSize + options.quietZone * 2;
  const int imageSize = std::max(options.size, totalModules);

  const auto cellStart = [=](int module) {
    return (module + options.quietZone) * imageSize / totalModules;
  };
  const auto cellEnd = [=](int module) {
    return (module + options.quietZone + 1) * imageSize / totalModules;
  };
  const auto isEyeRegion = [=](int x, int y) {
    return (y < 7 && x < 7) || (y < 7 && x >= matrixSize - 7) ||
           (y >= matrixSize - 7 && x < 7);
  };
  const auto isDarkPixel = [&](int x, int y) {
    const size_t offset =
        (static_cast<size_t>(y) * static_cast<size_t>(width) +
         static_cast<size_t>(x)) *
        4;
    return rgba[offset] == 0 && rgba[offset + 1] == 0 &&
           rgba[offset + 2] == 0 && rgba[offset + 3] == 255;
  };

  int checkedModules = 0;
  for (int moduleY = 0; moduleY < matrixSize; moduleY++) {
    const int y0 = cellStart(moduleY);
    const int y1 = cellEnd(moduleY);
    const double centerY = static_cast<double>(y0 + y1 - 1) / 2.0;
    const double radiusY = static_cast<double>(y1 - y0) / 2.0;
    for (int moduleX = 0; moduleX < matrixSize; moduleX++) {
      if (isEyeRegion(moduleX, moduleY)) {
        continue;
      }
      const int x0 = cellStart(moduleX);
      const int x1 = cellEnd(moduleX);
      const double centerX = static_cast<double>(x0 + x1 - 1) / 2.0;
      const double radiusX = static_cast<double>(x1 - x0) / 2.0;
      if (!isDarkPixel((x0 + x1 - 1) / 2, (y0 + y1 - 1) / 2)) {
        continue;
      }
      checkedModules++;
      for (int y = y0; y < y1; y++) {
        const double dy = (static_cast<double>(y) - centerY) / radiusY;
        const double scale = std::sqrt(std::max(0.0, 1.0 - dy * dy));
        const double left = centerX - radiusX * scale;
        const double right = centerX + radiusX * scale;
        int minX = -1;
        int maxX = -1;
        for (int x = x0; x < x1; x++) {
          if (!isDarkPixel(x, y)) {
            continue;
          }
          minX = minX < 0 ? x : std::min(minX, x);
          maxX = std::max(maxX, x);
        }
        assert(minX >= 0);
        assert(std::abs(static_cast<double>(minX) - left) <= 1.0);
        assert(std::abs(static_cast<double>(maxX) - right) <= 1.0);
      }
    }
  }
  assert(checkedModules > 10);
}

void testLogoAreaIsTransparent() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 128;
  options.logoAreaSize = 32;
  options.logoAreaBorderRadius = 4;
  const std::string encoded =
      generator.generatePngBase64("https://example.com/logo-hole", options);

  int width = 0;
  int height = 0;
  const std::vector<uint8_t> rgba = decodeRgbaPng(encoded, width, height);
  assert(width == 128);
  assert(height == 128);

  const auto alphaAt = [&](int x, int y) {
    return rgba[(static_cast<size_t>(y) * static_cast<size_t>(width) +
                 static_cast<size_t>(x)) *
                    4 +
                3];
  };

  assert(alphaAt(width / 2, height / 2) == 0);
  assert(alphaAt(width / 2 - 10, height / 2) == 0);
  assert(alphaAt(width / 2 + 10, height / 2) == 0);
  assert(alphaAt(0, 0) == 255);
}

void testTransparentBackgroundPng() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 128;
  options.quietZone = 4;
  options.backgroundColor = "transparent";
  options.background = parseColor("transparent");
  const std::string encoded =
      generator.generatePngBase64("https://example.com/transparent", options);

  int width = 0;
  int height = 0;
  const std::vector<uint8_t> alpha =
      decodeIndexedAlphaPng(encoded, width, height);
  assert(width == 128);
  assert(height == 128);

  const auto alphaAt = [&](int x, int y) {
    return alpha[static_cast<size_t>(y) * static_cast<size_t>(width) +
                 static_cast<size_t>(x)];
  };

  // Quiet-zone corners stay fully transparent.
  assert(alphaAt(0, 0) == 0);
  assert(alphaAt(width - 1, height - 1) == 0);
  // Dark finder modules are fully opaque.
  assert(alphaAt(16, 16) == 255);
  assert(alphaAt(24, 16) == 255);
}

void testParityCorpus() {
  QRCodeGenerator generator;
  for (const auto &entry : parityCorpus()) {
    GenerateOptions options;
    options.errorCorrectionLevel = entry.errorCorrectionLevel;
    options.minVersion = entry.minVersion;
    options.maxVersion = entry.maxVersion;
    options.mask = entry.mask;
    options.boostEcl = entry.boostEcl;
    assert(generator.getMatrixSize(entry.value, options) == entry.size);
    assert(generator.getMatrixPackedBase64(entry.value, options) ==
           entry.packedBase64);
  }
}

void testMatrixCacheLru() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.errorCorrectionLevel = "M";
  for (int index = 0; index < 40; index++) {
    const std::string value = "matrix-lru-" + std::to_string(index);
    const int size = generator.getMatrixSize(value, options);
    const std::string packed =
        generator.getMatrixPackedBase64(value, options);
    assert(size > 0);
    assert(!packed.empty());
  }

  // Alternating matrix requests must stay correct after eviction cycles.
  for (int round = 0; round < 3; round++) {
    for (int index = 0; index < 40; index++) {
      const std::string value = "matrix-lru-" + std::to_string(index);
      const int size = generator.getMatrixSize(value, options);
      const std::string packed =
          generator.getMatrixPackedBase64(value, options);
      const std::string recheck =
          generator.getMatrixPackedBase64(value, options);
      assert(size == generator.getMatrixSize(value, options));
      assert(packed == recheck);
    }
  }
}

void testShapeLimits() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 160;
  const auto assertThrows = [](const auto &callback) {
    bool didThrow = false;
    try {
      callback();
    } catch (const std::invalid_argument &) {
      didThrow = true;
    }
    assert(didThrow);
  };

  for (const auto &shape : {"diamond", "hexagon", "octagon", "star",
                            "heart",   "scallop", "leaf",    "clover",
                            "triangle"}) {
    options.moduleShape = shape;
    assertThrows([&]() {
      generator.generatePngBase64("https://example.com/shape", options);
    });
  }

  options = GenerateOptions{};
  options.size = 160;
  options.eyePatternShape = "circle-border";
  assertThrows([&]() {
    generator.generatePngBase64("https://example.com/eye-shape", options);
  });

  options = GenerateOptions{};
  options.size = 160;
  options.layout = "radial";
  assertThrows([&]() {
    generator.generatePngBase64("https://example.com/layout", options);
  });
}

void testSvgGeneration() {
  QRCodeGenerator generator;
  GenerateOptions options;
  const std::string svg = generator.generateSvgString("Hello", options);
  const std::string cached = generator.generateSvgString("Hello", options);
  assert(cached == svg);
  assert(svg.find("<svg") != std::string::npos);
  assert(svg.find("shape-rendering=\"crispEdges\"") != std::string::npos);
  assert(svg.find("<path") != std::string::npos);

  options.gradient.type = "radial";
  options.gradient.colors = {parseColor("#4AA8FF"), parseColor("#28D17C")};
  const std::string gradientSvg =
      generator.generateSvgString("Hello-gradient", options);
  assert(gradientSvg.find("radialGradient") != std::string::npos);
  assert(gradientSvg.find("url(#nitro-qrcode-gradient)") != std::string::npos);

  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#4AA8FFAA"), parseColor("#28D17C")};
  const std::string linearGradientSvg =
      generator.generateSvgString("Hello-gradient-linear", options);
  assert(linearGradientSvg.find("linearGradient") != std::string::npos);
  assert(linearGradientSvg.find("stop-opacity=") != std::string::npos);
}

void testMatrixPacking() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.errorCorrectionLevel = "Q";
  const int size = generator.getMatrixSize("Hello", options);
  const std::string packed = generator.getMatrixPackedBase64("Hello", options);
  assert(size == 21);
  assert(!packed.empty());

  options.errorCorrectionLevel = "quartile";
  assert(generator.getMatrixSize("Hello", options) == 21);

  options.errorCorrectionLevel = "H";
  assert(generator.getMatrixSize("Hello", options) == 21);

  options.errorCorrectionLevel = "high";
  assert(generator.getMatrixSize("Hello", options) == 21);

  options.errorCorrectionLevel = "low";
  assert(generator.getMatrixSize("Hello", options) == 21);

  options.errorCorrectionLevel = "medium";
  assert(generator.getMatrixSize("Hello", options) == 21);
}

void testColorAndBase64Helpers() {
  const auto lower = parseColor("#abcdef");
  assert(lower.r == 0xAB);
  assert(lower.g == 0xCD);
  assert(lower.b == 0xEF);
  assert(lower.a == 255);

  const auto upperWithAlpha = parseColor("#12345678");
  assert(upperWithAlpha.r == 0x12);
  assert(upperWithAlpha.g == 0x34);
  assert(upperWithAlpha.b == 0x56);
  assert(upperWithAlpha.a == 0x78);

  const auto transparent = parseColor("transparent");
  assert(transparent.r == 0);
  assert(transparent.g == 0);
  assert(transparent.b == 0);
  assert(transparent.a == 0);

  assert(base64Encode({}) == "");
  assert(base64Encode({'f'}) == "Zg==");
  assert(base64Encode({'f', 'o'}) == "Zm8=");
  assert(base64Encode({'f', 'o', 'o'}) == "Zm9v");

  const std::vector<uint8_t> rgba = {
      0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255, 0, 255, 0, 255,
  };
  const std::vector<uint8_t> png = encodePngRgba(2, 2, rgba);
  assert(png.size() > 8);
  assert(png[0] == 137);
}

void testValidation() {
  QRCodeGenerator generator;
  GenerateOptions options;
  const auto assertThrows = [](const auto &callback) {
    bool didThrow = false;
    try {
      callback();
    } catch (const std::invalid_argument &) {
      didThrow = true;
    }
    assert(didThrow);
  };

  assertThrows([&]() { generator.generatePngBase64("", options); });

  options.size = 0;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.size = 4097;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.quietZone = -1;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.quietZone = 33;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.minVersion = 0;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.minVersion = 41;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.maxVersion = 0;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.maxVersion = 41;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.minVersion = 2;
  options.maxVersion = 1;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.mask = -2;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.mask = 8;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.errorCorrectionLevel = "bad";
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });
  assertThrows([&]() { generator.getMatrixSize("Hello", options); });

  options = GenerateOptions{};
  options.layout = "spiral";
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.moduleShape = "triangle";
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.eyePatternShape = "triangle";
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.eyeballShape = "triangle";
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.bodyDensity = "crowded";
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.gap = -1;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.gap = 257;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.eyePatternGap = -1;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.eyePatternGap = 257;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.cornerRadius = -2;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.cornerRadius = 257;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.eyePatternCornerRadius = -2;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.eyePatternCornerRadius = 257;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.logoAreaSize = -1;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.logoAreaSize = options.size + 1;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.logoAreaBorderRadius = -1;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options.logoAreaBorderRadius = options.size / 2 + 1;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.gradient.type = "bad";
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000")};
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#FFFFFF")};
  options.gradient.locations = {0.0};
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#FFFFFF")};
  options.gradient.startX = 2.0;
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#FFFFFF")};
  options.gradient.locations = {0.8, 0.2};
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#FFFFFF")};
  options.gradient.locations = {0.0, 2.0};
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  assertThrows([&]() { parseColor("#12345"); });
  assertThrows([&]() { parseColor("1234567"); });
  assertThrows([&]() { parseColor("#12345Z"); });
  assertThrows([&]() { parseColor("#/23456"); });
  assertThrows([&]() { parseColor("#z23456"); });
  assertThrows([&]() { parseColor("#@23456"); });
  assertThrows([&]() { encodePngRgba(0, 1, {}); });
  assertThrows([&]() { encodePngRgba(1, 0, {}); });
  assertThrows([&]() { encodePngRgba(1, 1, {0, 0, 0}); });
}

} // namespace

int main() {
  testPngGeneration();
  testDataUriAndCache();
  testCollisionSafeCache();
  testByteBoundedCache();
  testConcurrentGeneration();
  testStyledPngGeneration();
  testCircleGeometryTolerance();
  testLogoAreaIsTransparent();
  testTransparentBackgroundPng();
  testParityCorpus();
  testShapeLimits();
  testMatrixCacheLru();
  testSvgGeneration();
  testMatrixPacking();
  testColorAndBase64Helpers();
  testValidation();
  runQRCodeBridgeOptionsTests();
  std::cout << "QRCodeGenerator tests passed" << std::endl;
  return 0;
}
