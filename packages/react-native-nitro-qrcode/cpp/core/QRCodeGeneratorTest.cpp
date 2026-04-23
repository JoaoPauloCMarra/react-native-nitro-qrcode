#include "QRCodeGenerator.hpp"

#include <cassert>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

using NitroQRCode::GenerateOptions;
using NitroQRCode::QRCodeGenerator;
using NitroQRCode::base64Encode;
using NitroQRCode::encodePngRgba;
using NitroQRCode::parseColor;

namespace {

void assertPngHeader(const std::string& encoded) {
  assert(encoded.rfind("iVBORw0KGgo", 0) == 0);
}

void testPngGeneration() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 128;
  const std::string base64 = generator.generatePngBase64("https://example.com", options);
  assert(!base64.empty());
  assertPngHeader(base64);

  const std::string cached = generator.generatePngBase64("https://example.com", options);
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
  const std::string first = generator.generatePngDataUri("https://example.com", options);
  const std::string second = generator.generatePngDataUri("https://example.com", options);
  assert(first == second);
  assert(first.rfind("data:image/png;base64,", 0) == 0);
  assert(generator.getCacheSize() == 1);
  generator.clearCache();
  assert(generator.getCacheSize() == 0);
}

void testStyledPngGeneration() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 160;
  options.moduleShape = "circle";
  options.eyePatternShape = "rounded";
  options.gap = 2;
  options.eyePatternGap = 1;
  options.logoAreaSize = 42;
  options.logoAreaBorderRadius = 8;
  assertPngHeader(generator.generatePngBase64("https://example.com/styled", options));

  options.moduleShape = "rounded";
  options.eyePatternShape = "circle";
  options.gap = 128;
  options.eyePatternGap = 0;
  options.logoAreaSize = 40;
  options.logoAreaBorderRadius = 0;
  assertPngHeader(generator.generatePngBase64("https://example.com/styled-2", options));

  options.moduleShape = "square";
  options.eyePatternShape = "square";
  options.gap = 0;
  options.logoAreaSize = 0;
  assertPngHeader(generator.generatePngBase64("https://example.com/styled-3", options));

  options = GenerateOptions{};
  options.size = 160;
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#4AA8FF"), parseColor("#28D17C")};
  options.gradient.locations = {0.0, 1.0};
  options.gradient.startX = 0.1;
  options.gradient.startY = 0.2;
  options.gradient.endX = 0.9;
  options.gradient.endY = 0.8;
  assertPngHeader(generator.generatePngBase64("https://example.com/gradient", options));

  options.gradient.locations = {0.0, 0.5};
  assertPngHeader(generator.generatePngBase64("https://example.com/gradient-tail", options));

  options.gradient.type = "radial";
  options.gradient.locations = {0.0, 1.0};
  options.gradient.startX = 0.5;
  options.gradient.startY = 0.5;
  options.gradient.endX = 1.0;
  options.gradient.endY = 0.5;
  assertPngHeader(generator.generatePngBase64("https://example.com/radial-gradient", options));

  options.gradient.startX = 0.5;
  options.gradient.startY = 0.5;
  options.gradient.endX = 0.5;
  options.gradient.endY = 0.5;
  assertPngHeader(generator.generatePngBase64("https://example.com/radial-zero-radius", options));

  options.gradient.type = "linear";
  options.gradient.startX = 0.4;
  options.gradient.startY = 0.4;
  options.gradient.endX = 0.4;
  options.gradient.endY = 0.4;
  assertPngHeader(generator.generatePngBase64("https://example.com/linear-zero-length", options));
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
  const std::string gradientSvg = generator.generateSvgString("Hello-gradient", options);
  assert(gradientSvg.find("radialGradient") != std::string::npos);
  assert(gradientSvg.find("url(#nitro-qrcode-gradient)") != std::string::npos);

  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#4AA8FFAA"), parseColor("#28D17C")};
  const std::string linearGradientSvg = generator.generateSvgString("Hello-gradient-linear", options);
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
      0, 0, 0, 255,
      255, 255, 255, 255,
      255, 0, 0, 255,
      0, 255, 0, 255,
  };
  const std::vector<uint8_t> png = encodePngRgba(2, 2, rgba);
  assert(png.size() > 8);
  assert(png[0] == 137);
}

void testValidation() {
  QRCodeGenerator generator;
  GenerateOptions options;
  const auto assertThrows = [](const auto& callback) {
    bool didThrow = false;
    try {
      callback();
    } catch (const std::invalid_argument&) {
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
  options.moduleShape = "triangle";
  assertThrows([&]() { generator.generatePngBase64("Hello", options); });

  options = GenerateOptions{};
  options.eyePatternShape = "triangle";
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

}  // namespace

int main() {
  testPngGeneration();
  testDataUriAndCache();
  testStyledPngGeneration();
  testSvgGeneration();
  testMatrixPacking();
  testColorAndBase64Helpers();
  testValidation();
  std::cout << "QRCodeGenerator tests passed" << std::endl;
  return 0;
}
