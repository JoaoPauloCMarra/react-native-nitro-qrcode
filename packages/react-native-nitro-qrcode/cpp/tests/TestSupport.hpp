#pragma once

#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>
#include <zlib.h>

namespace TestSupport {

inline std::vector<uint8_t> base64Decode(const std::string &encoded) {
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

inline uint32_t readU32(const std::vector<uint8_t> &bytes, size_t offset) {
  return (static_cast<uint32_t>(bytes[offset]) << 24) |
         (static_cast<uint32_t>(bytes[offset + 1]) << 16) |
         (static_cast<uint32_t>(bytes[offset + 2]) << 8) |
         static_cast<uint32_t>(bytes[offset + 3]);
}

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

struct PngChunk {
  std::string type;
  size_t dataOffset;
  uint32_t size;
};

// Walks the chunks after the 8-byte signature. The callback returns false to
// stop early. Returns the offset after the last chunk visited.
inline size_t forEachPngChunk(const std::vector<uint8_t> &png,
                              const std::function<bool(const PngChunk &)> &visit) {
  size_t offset = 8;
  while (offset + 12 <= png.size()) {
    const uint32_t size = readU32(png, offset);
    const size_t typeOffset = offset + 4;
    const PngChunk chunk{
        std::string(reinterpret_cast<const char *>(&png[typeOffset]), 4),
        typeOffset + 4, size};
    assert(chunk.dataOffset + size + 4 <= png.size());
    offset = chunk.dataOffset + size + 4;
    if (!visit(chunk)) {
      break;
    }
  }
  return offset;
}

} // namespace TestSupport

inline std::vector<uint8_t> decodePngBase64ToRgba(const std::string &encoded,
                                                  int &width, int &height) {
  const std::vector<uint8_t> png = TestSupport::base64Decode(encoded);
  assert(png.size() > 8);
  std::vector<uint8_t> compressed;
  std::vector<uint8_t> palette;
  std::vector<uint8_t> trns;
  int bitDepth = 8;
  int colorType = 6;
  TestSupport::forEachPngChunk(png, [&](const TestSupport::PngChunk &chunk) {
    const uint32_t chunkSize = chunk.size;
    const size_t dataOffset = chunk.dataOffset;
    const std::string &type = chunk.type;
      if (type == "IHDR") {
        width = static_cast<int>(TestSupport::readU32(png, dataOffset));
        height = static_cast<int>(TestSupport::readU32(png, dataOffset + 4));
        bitDepth = png[dataOffset + 8];
        colorType = png[dataOffset + 9];
        assert((colorType == 6 && bitDepth == 8) ||
               (colorType == 3 && (bitDepth == 1 || bitDepth == 2 ||
                                   bitDepth == 4 || bitDepth == 8)));
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
        return false;
      }
    return true;
  });

  const size_t bytesPerPixel = colorType == 6 ? 4 : 1;
  const size_t rowBytes =
      colorType == 6
          ? static_cast<size_t>(width) * 4
          : (static_cast<size_t>(width) * static_cast<size_t>(bitDepth) + 7) /
                8;
  std::vector<uint8_t> raw((rowBytes + 1) * static_cast<size_t>(height));
  uLongf rawSize = static_cast<uLongf>(raw.size());
  const int result = uncompress(raw.data(), &rawSize, compressed.data(),
                                static_cast<uLong>(compressed.size()));
  assert(result == Z_OK);
  assert(rawSize == raw.size());

  std::vector<uint8_t> rgba(static_cast<size_t>(width) *
                            static_cast<size_t>(height) * 4);
  std::vector<uint8_t> previous(rowBytes, 0);
  for (int y = 0; y < height; y++) {
    const size_t rawRow = static_cast<size_t>(y) * (rowBytes + 1);
    const uint8_t filter = raw[rawRow];
    std::vector<uint8_t> row(raw.begin() + static_cast<std::ptrdiff_t>(rawRow + 1),
                             raw.begin() + static_cast<std::ptrdiff_t>(rawRow + 1 + rowBytes));
    for (size_t index = 0; index < rowBytes; index++) {
      const uint8_t left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const uint8_t up = previous[index];
      const uint8_t upLeft =
          index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      uint8_t predictor = 0;
      switch (filter) {
      case 1:
        predictor = left;
        break;
      case 2:
        predictor = up;
        break;
      case 3:
        predictor = static_cast<uint8_t>((static_cast<unsigned>(left) + up) / 2);
        break;
      case 4: {
        const int p = static_cast<int>(left) + static_cast<int>(up) -
                      static_cast<int>(upLeft);
        const int pa = std::abs(p - static_cast<int>(left));
        const int pb = std::abs(p - static_cast<int>(up));
        const int pc = std::abs(p - static_cast<int>(upLeft));
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        break;
      }
      default:
        assert(filter == 0);
        break;
      }
      row[index] = static_cast<uint8_t>(row[index] + predictor);
    }
    const size_t rgbaRow =
        static_cast<size_t>(y) * static_cast<size_t>(width) * 4;
    if (colorType == 6) {
      std::copy(row.begin(), row.end(),
                rgba.begin() + static_cast<std::ptrdiff_t>(rgbaRow));
    } else {
      const unsigned pixelsPerByte = 8U / static_cast<unsigned>(bitDepth);
      const unsigned mask = (1U << static_cast<unsigned>(bitDepth)) - 1U;
      for (int x = 0; x < width; x++) {
        const uint8_t byte = row[static_cast<size_t>(x) / pixelsPerByte];
        const unsigned shift =
            8U - static_cast<unsigned>(bitDepth) *
                     (static_cast<unsigned>(x) % pixelsPerByte + 1U);
        const size_t entry = (byte >> shift) & mask;
        assert(entry * 3 + 2 < palette.size());
        const size_t out = rgbaRow + static_cast<size_t>(x) * 4;
        rgba[out] = palette[entry * 3];
        rgba[out + 1] = palette[entry * 3 + 1];
        rgba[out + 2] = palette[entry * 3 + 2];
        rgba[out + 3] = entry < trns.size() ? trns[entry] : 255;
      }
    }
    previous = std::move(row);
  }
  return rgba;
}
