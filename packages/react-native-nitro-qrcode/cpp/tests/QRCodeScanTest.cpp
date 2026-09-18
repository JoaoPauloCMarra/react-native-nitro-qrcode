#include "QRCodeGenerator.hpp"

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

std::vector<uint8_t> decodeBase64(const std::string &encoded) {
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
    accumulator = (accumulator << 6) + value;
    bits += 6;
    if (bits >= 0) {
      output.push_back(
          static_cast<uint8_t>((accumulator >> bits) & 0xFF));
      bits -= 8;
    }
  }
  return output;
}

void testQuircDecodesNayukiMatrix() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 256;
  const std::string payload = "https://example.com/quirc-real";
  const int matrixSize = generator.getMatrixSize(payload, options);
  const std::vector<uint8_t> packed =
      decodeBase64(generator.getMatrixPackedBase64(payload, options));
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
      matched = payload == reinterpret_cast<const char *>(data.payload);
    }
  }
  quirc_destroy(qr);
  assert(matched);
}

} // namespace

void runQRCodeScanTests() {
  testQuircDecodesNayukiMatrix();
  std::cout << "QRCode scan-back tests passed" << std::endl;
}
