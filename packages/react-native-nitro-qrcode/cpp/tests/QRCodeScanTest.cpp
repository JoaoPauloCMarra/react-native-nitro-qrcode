#include "QRCodeGenerator.hpp"
#include "TestSupport.hpp"

#include <algorithm>
#include <cassert>
#include <cstdint>
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
  std::cout << "QRCode scan-back tests passed" << std::endl;
}
