#include "QRCodeGenerator.hpp"
#include "TestSupport.hpp"

#include <algorithm>
#include <cassert>
#include <cstdint>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>

extern "C" {
#include "quirc.h"
}

using NitroQRCode::GenerateOptions;
using NitroQRCode::QRCodeGenerator;

namespace {

void testQuircDecodesNayukiMatrix(
    const std::string &payload, GenerateOptions options = GenerateOptions{},
    int expectedVersion = 0, int expectedEccLevel = -1) {
  QRCodeGenerator generator;
  options.size = 256;
  const int matrixSize = generator.getMatrixSize(payload, options);
  const std::vector<uint8_t> packed =
      TestSupport::base64Decode(generator.getMatrixPackedBase64(payload, options));
  assert(matrixSize > 0);
  assert(!packed.empty());

  const int scale = 8;
  const int quiet = 4;
  const int image = (matrixSize + quiet * 2) * scale;
  quirc *qr = quirc_new();
  assert(qr != nullptr);
  assert(quirc_resize(qr, image, image) == 0);
  int width = 0;
  int height = 0;
  uint8_t *gray = quirc_begin(qr, &width, &height);
  assert(gray != nullptr);
  std::fill(gray, gray + static_cast<size_t>(image) * static_cast<size_t>(image),
            255);
  for (int y = 0; y < matrixSize; y++) {
    for (int x = 0; x < matrixSize; x++) {
      const size_t bitIndex =
          static_cast<size_t>(y) * static_cast<size_t>(matrixSize) +
          static_cast<size_t>(x);
      const uint8_t byte = packed[bitIndex / 8];
      const bool dark = ((byte >> (7U - (bitIndex % 8))) & 1U) != 0;
      if (!dark) {
        continue;
      }
      const int x0 = (x + quiet) * scale;
      const int y0 = (y + quiet) * scale;
      for (int dy = 0; dy < scale; dy++) {
        for (int dx = 0; dx < scale; dx++) {
          gray[static_cast<size_t>(y0 + dy) * static_cast<size_t>(image) +
               static_cast<size_t>(x0 + dx)] = 0;
        }
      }
    }
  }
  quirc_end(qr);

  bool matched = false;
  const int found = quirc_count(qr);
  for (int index = 0; index < found; index++) {
    quirc_code code{};
    quirc_data data{};
    quirc_extract(qr, index, &code);
    if (quirc_decode(&code, &data) == QUIRC_SUCCESS) {
      const std::string decoded(
          reinterpret_cast<const char *>(data.payload), data.payload_len);
      if (payload == decoded) {
        if (expectedVersion > 0) {
          assert(data.version == expectedVersion);
        }
        if (expectedEccLevel >= 0) {
          assert(data.ecc_level == expectedEccLevel);
        }
        matched = true;
      }
    }
  }
  quirc_destroy(qr);
  assert(matched);
}


bool quircDecodesRgbaPng(const std::string &payload, const std::string &png,
                         uint8_t backdrop) {
  int width = 0;
  int height = 0;
  const std::vector<uint8_t> rgba =
      decodePngBase64ToRgba(png, width, height);
  quirc *qr = quirc_new();
  assert(qr != nullptr);
  assert(quirc_resize(qr, width, height) == 0);
  int gw = 0;
  int gh = 0;
  uint8_t *gray = quirc_begin(qr, &gw, &gh);
  assert(gray != nullptr);
  for (size_t index = 0; index < static_cast<size_t>(width) * height; index++) {
    const int alpha = rgba[index * 4 + 3];
    const int luma = (rgba[index * 4] * 299 + rgba[index * 4 + 1] * 587 +
                      rgba[index * 4 + 2] * 114) / 1000;
    gray[index] = static_cast<uint8_t>(
        (luma * alpha + backdrop * (255 - alpha)) / 255);
  }
  quirc_end(qr);
  bool matched = false;
  const int found = quirc_count(qr);
  for (int index = 0; index < found && !matched; index++) {
    quirc_code code{};
    quirc_data data{};
    quirc_extract(qr, index, &code);
    if (quirc_decode(&code, &data) == QUIRC_SUCCESS) {
      matched = payload == std::string(
                               reinterpret_cast<const char *>(data.payload),
                               data.payload_len);
    }
  }
  quirc_destroy(qr);
  return matched;
}

void testRenderedPngDecodesWithLogoAreaByErrorCorrection() {
  QRCodeGenerator generator;
  const std::string payload = "https://example.com/products/12345?ref=scan";
  struct Case {
    const char *ecl;
    int logo;
  };
  for (const Case &testCase : {Case{"L", 64}, Case{"M", 96}, Case{"Q", 128},
                               Case{"H", 154}}) {
    GenerateOptions options;
    options.size = 512;
    options.errorCorrectionLevel = testCase.ecl;
    options.boostEcl = false;
    options.logoAreaSize = testCase.logo;
    const std::string png = generator.renderPngBase64(payload, options);
    assert(quircDecodesRgbaPng(payload, png, 255));
    assert(quircDecodesRgbaPng(payload, png, 0));
  }
}

void testRenderedPngDecodesWithDefaultsAndTranslucentLayers() {
  QRCodeGenerator generator;
  const std::string payload = "https://example.com/quiet-zone";
  GenerateOptions defaults;
  assert(defaults.quietZone == 4);
  const std::string png = generator.renderPngBase64(payload, defaults);
  assert(quircDecodesRgbaPng(payload, png, 255));

  int width = 0;
  int height = 0;
  const std::vector<uint8_t> rgba =
      decodePngBase64ToRgba(png, width, height);
  const int modules = generator.getMatrixSize(payload, defaults);
  const int total = modules + defaults.quietZone * 2;
  const int quietPixels = (defaults.quietZone * width) / total;
  for (int y = 0; y < height; y++) {
    for (int x = 0; x < width; x++) {
      if (x >= quietPixels && x < width - quietPixels && y >= quietPixels &&
          y < height - quietPixels) {
        continue;
      }
      const size_t offset =
          (static_cast<size_t>(y) * static_cast<size_t>(width) +
           static_cast<size_t>(x)) *
          4;
      assert(rgba[offset] == 255 && rgba[offset + 1] == 255 &&
             rgba[offset + 2] == 255 && rgba[offset + 3] == 255);
    }
  }

  GenerateOptions transparent;
  transparent.backgroundColor = "#00000000";
  transparent.background = {0, 0, 0, 0};
  transparent.quietZoneFill = {0, 0, 0, 0};
  const std::string transparentPng =
      generator.renderPngBase64(payload, transparent);
  assert(quircDecodesRgbaPng(payload, transparentPng, 255));
  assert(!quircDecodesRgbaPng(payload, transparentPng, 0));

  GenerateOptions translucent;
  translucent.foregroundColor = "#00000099";
  translucent.foreground = {0, 0, 0, 0x99};
  const std::string translucentPng =
      generator.renderPngBase64(payload, translucent);
  assert(quircDecodesRgbaPng(payload, translucentPng, 255));
}

void testSvgModulesDecodeAndMatchPngQuietZone() {
  QRCodeGenerator generator;
  const std::string payload = "https://example.com/svg-parity";
  GenerateOptions options;
  const std::string svg = generator.generateSvgString(payload, options);
  const int modules = generator.getMatrixSize(payload, options);
  const int total = modules + options.quietZone * 2;
  assert(svg.find("viewBox=\"0 0 " + std::to_string(total) + " " +
                  std::to_string(total) + "\"") != std::string::npos);

  const int scale = 8;
  const int image = total * scale;
  quirc *qr = quirc_new();
  assert(qr != nullptr);
  assert(quirc_resize(qr, image, image) == 0);
  int width = 0;
  int height = 0;
  uint8_t *gray = quirc_begin(qr, &width, &height);
  std::fill(gray, gray + static_cast<size_t>(image) * static_cast<size_t>(image),
            255);
  const size_t pathStart = svg.rfind("d=\"") + 3;
  const std::string path = svg.substr(pathStart, svg.find('"', pathStart) - pathStart);
  size_t cursor = 0;
  int darkModules = 0;
  while ((cursor = path.find('M', cursor)) != std::string::npos) {
    int x = 0;
    int y = 0;
    assert(std::sscanf(path.c_str() + cursor, "M%d,%d", &x, &y) == 2);
    assert(x >= options.quietZone && x < total - options.quietZone);
    assert(y >= options.quietZone && y < total - options.quietZone);
    for (int dy = 0; dy < scale; dy++) {
      for (int dx = 0; dx < scale; dx++) {
        gray[static_cast<size_t>(y * scale + dy) * static_cast<size_t>(image) +
             static_cast<size_t>(x * scale + dx)] = 0;
      }
    }
    darkModules++;
    cursor++;
  }
  assert(darkModules > 0);
  quirc_end(qr);
  bool matched = false;
  for (int index = 0; index < quirc_count(qr); index++) {
    quirc_code code{};
    quirc_data data{};
    quirc_extract(qr, index, &code);
    if (quirc_decode(&code, &data) == QUIRC_SUCCESS) {
      matched = payload == std::string(
                               reinterpret_cast<const char *>(data.payload),
                               data.payload_len);
    }
  }
  quirc_destroy(qr);
  assert(matched);
}

} // namespace

void runQRCodeScanTests() {
  testQuircDecodesNayukiMatrix("https://example.com/quirc-real");
  testQuircDecodesNayukiMatrix(std::string("hello\0world", 11));
  GenerateOptions boundedHighEcl;
  boundedHighEcl.minVersion = 2;
  boundedHighEcl.maxVersion = 2;
  boundedHighEcl.errorCorrectionLevel = "H";
  boundedHighEcl.boostEcl = false;
  testQuircDecodesNayukiMatrix(
      std::string("\xC3\xA9\0\xF0\x9F\x98\x80", 7), boundedHighEcl, 2,
      2);
  testRenderedPngDecodesWithLogoAreaByErrorCorrection();
  testRenderedPngDecodesWithDefaultsAndTranslucentLayers();
  testSvgModulesDecodeAndMatchPngQuietZone();
  std::cout << "QRCode scan-back tests passed" << std::endl;
}
