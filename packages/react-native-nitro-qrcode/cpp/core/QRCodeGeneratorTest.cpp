#include "QRCodeGenerator.hpp"

#include <cassert>
#include <future>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

using NitroQRCode::base64Encode;
using NitroQRCode::encodePngRgba;
using NitroQRCode::GenerateOptions;
using NitroQRCode::parseColor;
using NitroQRCode::QRCodeGenerator;

void runQRCodeBridgeOptionsTests();

namespace {

void assertPngHeader(const std::string &encoded) {
  assert(encoded.rfind("iVBORw0KGgo", 0) == 0);
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
  options.eyePatternShape = "circle-border";
  options.gap = 1;
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/circle-border-eyes", options));

  options = GenerateOptions{};
  options.size = 160;
  options.moduleShape = "circle";
  options.eyePatternShape = "square";
  options.eyeballShape = "circle";
  options.eyeStrokeColor = "#222222";
  options.eyeStroke = parseColor(options.eyeStrokeColor);
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/circle-body-square-frame-circle-eye", options));

  const std::vector<std::string> decorativeShapes = {
      "diamond", "hexagon", "octagon", "star",
      "heart",   "scallop", "leaf",    "clover"};
  for (const auto &shape : decorativeShapes) {
    options = GenerateOptions{};
    options.size = 160;
    options.moduleShape = shape;
    options.eyePatternShape = "rounded";
    options.eyeballShape = shape;
    options.gap = 1;
    assertPngHeader(generator.generatePngBase64(
        "https://example.com/shape-" + shape, options));
  }

  options = GenerateOptions{};
  options.size = 160;
  options.layout = "radial";
  options.moduleShape = "rounded";
  options.gap = 2;
  options.logoAreaSize = 32;
  options.logoAreaBorderRadius = 16;
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/radial-layout", options));

  options.logoAreaSize = options.size;
  options.logoAreaBorderRadius = options.size / 2;
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/radial-logo-only", options));

  options = GenerateOptions{};
  options.size = 96;
  options.layout = "radial";
  options.moduleShape = "rounded";
  options.eyePatternShape = "circle-border";
  options.gap = 3;
  options.cornerRadius = 8;
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/radial-small-rounded-modules", options));

  options.moduleShape = "circle";
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/radial-dot-modules", options));

  options.moduleShape = "square";
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/radial-arc-modules", options));

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

  options.eyePatternShape = "circle-border";
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/layer-circle-border", options));

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

  options.layout = "radial";
  options.moduleShape = "rounded";
  options.gap = 2;
  options.strokeColor = "#FF0000FF";
  options.eyeStrokeColor = "#333333";
  options.stroke = parseColor(options.strokeColor);
  options.eyeStroke = parseColor(options.eyeStrokeColor);
  assertPngHeader(
      generator.generatePngBase64("https://example.com/layer-radial", options));

  options.eyePatternShape = "rounded";
  assertPngHeader(generator.generatePngBase64(
      "https://example.com/layer-radial-eyes", options));
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
  testConcurrentGeneration();
  testStyledPngGeneration();
  testSvgGeneration();
  testMatrixPacking();
  testColorAndBase64Helpers();
  testValidation();
  runQRCodeBridgeOptionsTests();
  std::cout << "QRCodeGenerator tests passed" << std::endl;
  return 0;
}
