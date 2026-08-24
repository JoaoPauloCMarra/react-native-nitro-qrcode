#pragma once

#include "BoundedCache.hpp"

#include <cstddef>
#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace NitroQRCode {

struct Color {
  uint8_t r = 0;
  uint8_t g = 0;
  uint8_t b = 0;
  uint8_t a = 255;

  constexpr bool operator==(const Color &) const = default;
};

struct GradientOptions {
  std::string type = "none";
  std::vector<Color> colors;
  std::vector<double> locations;
  double startX = 0.0;
  double startY = 0.0;
  double endX = 1.0;
  double endY = 1.0;
};

struct GenerateOptions {
  int size = 512;
  int quietZone = 4;
  std::string errorCorrectionLevel = "M";
  std::string foregroundColor = "#000000";
  std::string backgroundColor = "#FFFFFF";
  std::string strokeColor = "#000000";
  std::string eyeColor = "#000000";
  std::string eyeStrokeColor = "#000000";
  std::string eyeballColor = "#000000";
  Color foreground = {0, 0, 0, 255};
  Color background = {255, 255, 255, 255};
  Color stroke = {0, 0, 0, 255};
  Color eye = {0, 0, 0, 255};
  Color eyeStroke = {0, 0, 0, 255};
  Color eyeball = {0, 0, 0, 255};
  GradientOptions gradient;
  int minVersion = 1;
  int maxVersion = 40;
  int mask = -1;
  bool boostEcl = true;
  std::string moduleShape = "square";
  std::string eyePatternShape = "square";
  std::string eyeballShape = "square";
  int gap = 0;
  int eyePatternGap = 0;
  std::string bodyDensity = "dense";
  int cornerRadius = -1;
  int eyePatternCornerRadius = -1;
  std::string layout = "matrix";
  int logoAreaSize = 0;
  int logoAreaBorderRadius = 0;
};

struct Matrix {
  int size = 0;
  std::vector<uint8_t> modules;
};

class QRCodeGenerator {
public:
  using CacheKeyHasher = std::function<std::string(const std::string &)>;

  static constexpr size_t DefaultMaxCacheBytes = 4 * 1024 * 1024;
  static constexpr size_t MaxMatrixCacheBytes = 512 * 1024;
  static constexpr size_t MaxCombinedCacheBytes =
      DefaultMaxCacheBytes + MaxMatrixCacheBytes;

  struct MatrixObject {
    int size = 0;
    std::string packedBase64;
  };

  explicit QRCodeGenerator(CacheKeyHasher cacheKeyHasher = {},
                           size_t maxCacheBytes = DefaultMaxCacheBytes);
  std::string renderPngBase64(const std::string &value,
                                const GenerateOptions &options);
  std::string renderPngDataUri(const std::string &value,
                                 const GenerateOptions &options);
  std::string generateSvgString(const std::string &value,
                                const GenerateOptions &options);
  MatrixObject getMatrixObject(const std::string &value,
                               const GenerateOptions &options);
  std::string getMatrixPackedBase64(const std::string &value,
                                    const GenerateOptions &options);
  int getMatrixSize(const std::string &value, const GenerateOptions &options);
  void clearCache();
  size_t getCacheSize() const;
  size_t getCacheBytes() const;
  size_t memorySize() const noexcept;

private:
  static constexpr size_t MaxCacheEntries = 128;
  static constexpr size_t MaxMatrixCacheEntries = 32;

  CacheKeyHasher cacheKeyHasher_;
  BoundedCache<std::string> outputCache_;
  BoundedCache<MatrixObject> matrixCache_;

  Matrix createMatrix(const std::string &value,
                      const GenerateOptions &options) const;
  MatrixObject getMatrix(const std::string &value,
                         const GenerateOptions &options);
  std::string cacheRequest(const std::string &value,
                           const GenerateOptions &options,
                           const std::string &output) const;
  std::string cacheKey(const std::string &request) const;
  std::optional<std::string> getCacheEntry(const std::string &key,
                                           const std::string &request);
  void storeCacheEntry(const std::string &key, const std::string &request,
                       const std::string &value);
};

Color parseColor(const std::string &value);
std::string base64Encode(const std::vector<uint8_t> &bytes);
std::vector<uint8_t> encodePngRgba(int width, int height,
                                   const std::vector<uint8_t> &rgba);

} // namespace NitroQRCode
