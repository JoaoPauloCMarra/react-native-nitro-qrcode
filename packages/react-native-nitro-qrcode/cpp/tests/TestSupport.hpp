#pragma once

#include <cassert>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

std::vector<uint8_t> decodePngBase64ToRgba(const std::string &encoded,
                                           int &width, int &height);

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
