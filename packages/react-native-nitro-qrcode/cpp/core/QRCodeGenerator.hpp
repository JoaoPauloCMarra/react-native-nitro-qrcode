#pragma once

#include <cstdint>
#include <deque>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace NitroQRCode {

struct Color {
  uint8_t r = 0;
  uint8_t g = 0;
  uint8_t b = 0;
  uint8_t a = 255;
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
  std::string generatePngBase64(const std::string &value,
                                const GenerateOptions &options);
  std::string generatePngDataUri(const std::string &value,
                                 const GenerateOptions &options);
  std::string generateSvgString(const std::string &value,
                                const GenerateOptions &options);
  std::string getMatrixPackedBase64(const std::string &value,
                                    const GenerateOptions &options);
  int getMatrixSize(const std::string &value, const GenerateOptions &options);
  void clearCache();
  size_t getCacheSize() const;

private:
  static constexpr size_t MaxCacheEntries = 128;
  mutable std::mutex cacheMutex_;
  mutable std::unordered_map<std::string, std::string> cache_;
  mutable std::deque<std::string> cacheOrder_;

  Matrix createMatrix(const std::string &value,
                      const GenerateOptions &options) const;
  std::string cacheKey(const std::string &value, const GenerateOptions &options,
                       const std::string &output) const;
  std::optional<std::string> getCacheEntry(const std::string &key) const;
  void storeCacheEntry(const std::string &key, const std::string &value);
};

Color parseColor(const std::string &value);
std::string base64Encode(const std::vector<uint8_t> &bytes);
std::vector<uint8_t> encodePngRgba(int width, int height,
                                   const std::vector<uint8_t> &rgba);

} // namespace NitroQRCode
