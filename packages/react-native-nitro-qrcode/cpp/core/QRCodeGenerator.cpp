#include "QRCodeGenerator.hpp"

#include "../qrcodegen/qrcodegen.hpp"
#include "fpng.h"

#include <algorithm>
#include <charconv>
#include <climits>
#include <cmath>
#include <cstdlib>
#include <iomanip>
#include <limits>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <string_view>
#include <utility>
#include <zlib.h>

namespace NitroQRCode {
namespace {

constexpr uint8_t BodyLayer = 1;
constexpr uint8_t StrokeLayer = 2;
constexpr uint8_t EyeFrameLayer = 3;
constexpr uint8_t EyeStrokeLayer = 4;
constexpr uint8_t EyeballLayer = 5;
constexpr uint8_t TransparentLayer = 6;
constexpr uint8_t AlignmentLayer = 7;
constexpr uint8_t TimingLayer = 8;
constexpr uint8_t FinderInnerLayer = 9;
constexpr uint8_t QuietZoneLayer = 10;
constexpr size_t SegmentTooLongChars = 65536;
constexpr size_t IdatChunkBytes = 64 * 1024;

enum class ModuleShape {
  Square,
  Circle,
  Rounded,
  Diamond,
  Squircle,
  Classy,
};

struct ModuleNeighbors {
  bool north = false;
  bool east = false;
  bool south = false;
  bool west = false;
};

enum class BodyDensity {
  Sparse,
  Balanced,
  Dense,
};

qrcodegen::QrCode::Ecc parseEcc(const std::string &value) {
  if (value == "L" || value == "low")
    return qrcodegen::QrCode::Ecc::LOW;
  if (value == "M" || value == "medium")
    return qrcodegen::QrCode::Ecc::MEDIUM;
  if (value == "Q" || value == "quartile")
    return qrcodegen::QrCode::Ecc::QUARTILE;
  if (value == "H" || value == "high")
    return qrcodegen::QrCode::Ecc::HIGH;
  throw std::invalid_argument("errorCorrectionLevel must be L, M, Q, H, low, "
                              "medium, quartile, or high.");
}

ModuleShape parseShape(const std::string &value, const char *name) {
  if (value == "square")
    return ModuleShape::Square;
  if (value == "circle")
    return ModuleShape::Circle;
  if (value == "rounded")
    return ModuleShape::Rounded;
  if (value == "diamond")
    return ModuleShape::Diamond;
  if (value == "squircle")
    return ModuleShape::Squircle;
  if (value == "classy")
    return ModuleShape::Classy;
  throw std::invalid_argument(
      std::string(name) +
      " must be square, circle, rounded, diamond, squircle, or classy.");
}

ModuleShape parseEyePatternShape(const std::string &value) {
  return parseShape(value, "eyeFrameShape");
}

ModuleShape parseEyeballShape(const std::string &value) {
  return parseShape(value, "eyeballShape");
}

BodyDensity parseBodyDensity(const std::string &value) {
  if (value == "sparse")
    return BodyDensity::Sparse;
  if (value == "balanced")
    return BodyDensity::Balanced;
  if (value == "dense")
    return BodyDensity::Dense;
  throw std::invalid_argument("bodyDensity must be sparse, balanced, or dense.");
}

void validateLayout(const std::string &value) {
  if (value != "matrix") {
    throw std::invalid_argument(
        "layout must be matrix; radial layouts are not scan-safe.");
  }
}

bool hasGradient(const GenerateOptions &options) {
  return options.gradient.type != "none" && !options.gradient.colors.empty();
}

double resolveGradientLocation(const GradientOptions &gradient, size_t index) {
  if (!gradient.locations.empty()) {
    return gradient.locations[index];
  }
  return static_cast<double>(index) /
         static_cast<double>(gradient.colors.size() - 1);
}

Color interpolateColor(const GradientOptions &gradient, double t) {
  const double clamped = std::clamp(t, 0.0, 1.0);
  if (clamped <= resolveGradientLocation(gradient, 0)) {
    return gradient.colors.front();
  }
  for (size_t index = 1; index < gradient.colors.size(); index++) {
    const double end = resolveGradientLocation(gradient, index);
    if (clamped <= end) {
      const double start = resolveGradientLocation(gradient, index - 1);
      const double span = end - start;
      const double progress = span <= 0.0 ? 0.0 : (clamped - start) / span;
      const Color &from = gradient.colors[index - 1];
      const Color &to = gradient.colors[index];
      const auto mix = [progress](uint8_t a, uint8_t b) {
        return static_cast<uint8_t>(std::lround(
            static_cast<double>(a) + (static_cast<double>(b) - a) * progress));
      };
      return {
          mix(from.r, to.r),
          mix(from.g, to.g),
          mix(from.b, to.b),
          mix(from.a, to.a),
      };
    }
  }

  return gradient.colors.back();
}

double gradientProgressAt(const GradientOptions &gradient, int imageSize, int x,
                          int y) {
  const double normalizedX =
      imageSize <= 1
          ? 0.0
          : static_cast<double>(x) / static_cast<double>(imageSize - 1);
  const double normalizedY =
      imageSize <= 1
          ? 0.0
          : static_cast<double>(y) / static_cast<double>(imageSize - 1);

  if (gradient.type == "radial") {
    const double dx = gradient.endX - gradient.startX;
    const double dy = gradient.endY - gradient.startY;
    const double radius = std::hypot(dx, dy);
    if (radius <= 0.0) {
      return 0.0;
    }
    return std::hypot(normalizedX - gradient.startX,
                      normalizedY - gradient.startY) /
           radius;
  }

  const double dx = gradient.endX - gradient.startX;
  const double dy = gradient.endY - gradient.startY;
  const double denominator = dx * dx + dy * dy;
  if (denominator <= 0.0) {
    return 0.0;
  }
  return ((normalizedX - gradient.startX) * dx +
          (normalizedY - gradient.startY) * dy) /
         denominator;
}

constexpr Color NoStrokeColor = {0, 0, 0, 255};

bool drawsBodyStroke(const GenerateOptions &options) {
  return options.strokeSet && options.stroke != NoStrokeColor;
}

bool drawsEyeStroke(const GenerateOptions &options) {
  return options.eyeStrokeSet && options.eyeStroke != NoStrokeColor;
}

bool hasCustomFinderColors(const GenerateOptions &options) {
  return (options.eyeSet && options.eye != NoStrokeColor) ||
         drawsEyeStroke(options) ||
         (options.eyeballSet && options.eyeball != NoStrokeColor) ||
         options.resolvedFinderInner() != options.background;
}

bool paintsSolidLayer(bool isSet, const Color &color,
                      const GenerateOptions &options) {
  return isSet && color != options.foreground;
}

bool hasCustomLayerColors(const GenerateOptions &options) {
  return drawsBodyStroke(options) || drawsEyeStroke(options) ||
         paintsSolidLayer(options.eyeSet, options.eye, options) ||
         paintsSolidLayer(options.eyeballSet, options.eyeball, options) ||
         paintsSolidLayer(options.alignmentSet, options.alignment, options) ||
         paintsSolidLayer(options.timingSet, options.timing, options) ||
         options.resolvedQuietZoneFill() != options.background ||
         options.resolvedFinderInner() != options.background;
}

Color foregroundFillAt(const GenerateOptions &options, int imageSize, int x,
                       int y) {
  return hasGradient(options)
             ? interpolateColor(
                   options.gradient,
                   gradientProgressAt(options.gradient, imageSize, x, y))
             : options.foreground;
}

Color layerFillAt(bool isSet, const Color &color,
                  const GenerateOptions &options, int imageSize, int x, int y) {
  return isSet ? color : foregroundFillAt(options, imageSize, x, y);
}

Color compositeOver(const Color &source, const Color &backdrop) {
  if (source.a == 255) {
    return source;
  }
  const int sourceAlpha = source.a;
  const int backdropWeight = backdrop.a * (255 - sourceAlpha);
  const int outAlpha = sourceAlpha * 255 + backdropWeight;
  if (outAlpha == 0) {
    return {0, 0, 0, 0};
  }
  const auto channel = [&](int top, int bottom) {
    return static_cast<uint8_t>(
        (top * sourceAlpha * 255 + bottom * backdropWeight + outAlpha / 2) /
        outAlpha);
  };
  return {channel(source.r, backdrop.r), channel(source.g, backdrop.g),
          channel(source.b, backdrop.b),
          static_cast<uint8_t>((outAlpha + 127) / 255)};
}

Color rawColorForLayer(uint8_t layer, const GenerateOptions &options,
                       int imageSize, int x, int y) {
  switch (layer) {
  case StrokeLayer:
    return options.stroke;
  case EyeFrameLayer:
    return layerFillAt(options.eyeSet, options.eye, options, imageSize, x, y);
  case EyeStrokeLayer:
    return options.eyeStroke;
  case EyeballLayer:
    return layerFillAt(options.eyeballSet, options.eyeball, options, imageSize,
                       x, y);
  case AlignmentLayer:
    return layerFillAt(options.alignmentSet, options.alignment, options,
                       imageSize, x, y);
  case TimingLayer:
    return layerFillAt(options.timingSet, options.timing, options, imageSize,
                       x, y);
  case FinderInnerLayer:
    return options.resolvedFinderInner();
  case QuietZoneLayer:
    return options.resolvedQuietZoneFill();
  case BodyLayer:
    return foregroundFillAt(options, imageSize, x, y);
  case TransparentLayer:
    return {0, 0, 0, 0};
  default:
    return options.background;
  }
}

Color colorForLayer(uint8_t layer, const GenerateOptions &options,
                    int imageSize, int x, int y) {
  const Color color = rawColorForLayer(layer, options, imageSize, x, y);
  if (layer == 0 || layer == QuietZoneLayer || layer == TransparentLayer) {
    return color;
  }
  return compositeOver(color, options.background);
}

void writeLayeredRow(const std::vector<uint8_t> &indices, int imageSize, int y,
                     const GenerateOptions &options, uint8_t *row) {
  const size_t rowStart =
      static_cast<size_t>(y) * static_cast<size_t>(imageSize);
  for (int x = 0; x < imageSize; x++) {
    const Color color = colorForLayer(indices[rowStart + static_cast<size_t>(x)],
                                      options, imageSize, x, y);
    const size_t offset = static_cast<size_t>(x) * 4;
    row[offset] = color.r;
    row[offset + 1] = color.g;
    row[offset + 2] = color.b;
    row[offset + 3] = color.a;
  }
}

std::vector<uint8_t> renderLayeredRgba(const std::vector<uint8_t> &indices,
                                       int imageSize,
                                       const GenerateOptions &options) {
  const size_t rowBytes = static_cast<size_t>(imageSize) * 4;
  std::vector<uint8_t> rgba(static_cast<size_t>(imageSize) * rowBytes);
  for (int y = 0; y < imageSize; y++) {
    writeLayeredRow(indices, imageSize, y, options,
                    rgba.data() + static_cast<size_t>(y) * rowBytes);
  }
  return rgba;
}

std::string svgColor(const Color &color) {
  std::ostringstream output;
  output << "rgb(" << static_cast<int>(color.r) << ","
         << static_cast<int>(color.g) << "," << static_cast<int>(color.b)
         << ")";
  return output.str();
}

std::string formatPercent(double value) {
  std::ostringstream output;
  output.setf(std::ios::fixed);
  output.precision(2);
  output << (std::clamp(value, 0.0, 1.0) * 100.0) << "%";
  return output.str();
}

std::string formatUserSpace(double value, int totalSize,
                            bool clampToUnit = true) {
  std::ostringstream output;
  output.setf(std::ios::fixed);
  output.precision(2);
  output << ((clampToUnit ? std::clamp(value, 0.0, 1.0) : value) * totalSize);
  return output.str();
}

std::string createSvgGradient(const GenerateOptions &options, int totalSize) {
  if (!hasGradient(options)) {
    return "";
  }

  std::ostringstream defs;
  defs << "<defs>";
  if (options.gradient.type == "radial") {
    const double radius =
        std::max(std::hypot(options.gradient.endX - options.gradient.startX,
                            options.gradient.endY - options.gradient.startY),
                 0.01);
    defs << "<radialGradient id=\"nitro-qrcode-gradient\" "
            "gradientUnits=\"userSpaceOnUse\" cx=\""
         << formatUserSpace(options.gradient.startX, totalSize) << "\" cy=\""
         << formatUserSpace(options.gradient.startY, totalSize) << "\" r=\""
         << formatUserSpace(radius, totalSize, false) << "\">";
  } else {
    defs << "<linearGradient id=\"nitro-qrcode-gradient\" "
            "gradientUnits=\"userSpaceOnUse\" x1=\""
         << formatUserSpace(options.gradient.startX, totalSize) << "\" y1=\""
         << formatUserSpace(options.gradient.startY, totalSize) << "\" x2=\""
         << formatUserSpace(options.gradient.endX, totalSize) << "\" y2=\""
         << formatUserSpace(options.gradient.endY, totalSize) << "\">";
  }

  for (size_t index = 0; index < options.gradient.colors.size(); index++) {
    const Color &color = options.gradient.colors[index];
    defs << "<stop offset=\""
         << formatPercent(resolveGradientLocation(options.gradient, index))
         << "\" stop-color=\"" << svgColor(color) << "\"";
    if (color.a != 255) {
      std::ostringstream alpha;
      alpha.setf(std::ios::fixed);
      alpha.precision(3);
      alpha << (static_cast<double>(color.a) / 255.0);
      defs << " stop-opacity=\"" << alpha.str() << "\"";
    }
    defs << "/>";
  }

  defs << (options.gradient.type == "radial" ? "</radialGradient>"
                                             : "</linearGradient>");
  defs << "</defs>";
  return defs.str();
}

void validateGradient(const GenerateOptions &options) {
  if (options.gradient.type != "none" && options.gradient.type != "linear" &&
      options.gradient.type != "radial") {
    throw std::invalid_argument(
        "gradient.type must be none, linear, or radial.");
  }
  if (options.gradient.type == "none") {
    return;
  }
  if (options.gradient.colors.size() < 2 ||
      options.gradient.colors.size() > 8) {
    throw std::invalid_argument(
        "gradient.colors must contain between 2 and 8 colors.");
  }
  if (!options.gradient.locations.empty() &&
      options.gradient.locations.size() != options.gradient.colors.size()) {
    throw std::invalid_argument(
        "gradient.locations must match gradient.colors length when provided.");
  }

  const auto validateUnit = [](double value, const char *name) {
    if (!std::isfinite(value) || value < 0.0 || value > 1.0) {
      throw std::invalid_argument(std::string(name) +
                                  " must be a finite number between 0 and 1.");
    }
  };
  validateUnit(options.gradient.startX, "gradient.startX");
  validateUnit(options.gradient.startY, "gradient.startY");
  validateUnit(options.gradient.endX, "gradient.endX");
  validateUnit(options.gradient.endY, "gradient.endY");

  double previous = 0.0;
  for (size_t index = 0; index < options.gradient.locations.size(); index++) {
    const double location = options.gradient.locations[index];
    if (!std::isfinite(location) || location < 0.0 || location > 1.0) {
      throw std::invalid_argument(
          "gradient.locations entries must be finite numbers between 0 and 1.");
    }
    if (index > 0 && location < previous) {
      throw std::invalid_argument(
          "gradient.locations must be in non-decreasing order.");
    }
    previous = location;
  }
}

void validateOptions(const std::string &value, const GenerateOptions &options) {
  if (value.empty()) {
    throw std::invalid_argument("QRCode value must not be empty.");
  }
  if (options.size < 1 || options.size > 4096) {
    throw std::invalid_argument("size must be between 1 and 4096.");
  }
  if (options.quietZone < 0 || options.quietZone > 32) {
    throw std::invalid_argument("quietZone must be between 0 and 32.");
  }
  if (options.minVersion < 1 || options.minVersion > 40 ||
      options.maxVersion < 1 || options.maxVersion > 40 ||
      options.minVersion > options.maxVersion) {
    throw std::invalid_argument("minVersion and maxVersion must be between 1 "
                                "and 40, with minVersion <= maxVersion.");
  }
  if (options.mask < -1 || options.mask > 7) {
    throw std::invalid_argument("mask must be -1 or between 0 and 7.");
  }
  validateLayout(options.layout);
  parseShape(options.moduleShape, "shape");
  parseEyePatternShape(options.eyePatternShape);
  parseEyeballShape(options.eyeballShape);
  parseShape(options.alignmentShape, "alignmentShape");
  parseShape(options.timingShape, "timingShape");
  parseBodyDensity(options.bodyDensity);
  if (options.gap < 0 || options.gap > 256) {
    throw std::invalid_argument("gap must be between 0 and 256.");
  }
  if (options.eyePatternGap < 0 || options.eyePatternGap > 256) {
    throw std::invalid_argument("eyePatternGap must be between 0 and 256.");
  }
  if (options.cornerRadius < -1 || options.cornerRadius > 256) {
    throw std::invalid_argument(
        "cornerRadius must be auto or between 0 and 256.");
  }
  if (options.eyePatternCornerRadius < -1 ||
      options.eyePatternCornerRadius > 256) {
    throw std::invalid_argument(
        "eyePatternCornerRadius must be auto or between 0 and 256.");
  }
  if (options.logoAreaSize < 0 || options.logoAreaSize > options.size) {
    throw std::invalid_argument("logoAreaSize must be between 0 and size.");
  }
  if (options.logoAreaBorderRadius < 0 || options.logoAreaBorderRadius > 2048 ||
      options.logoAreaBorderRadius > options.size / 2) {
    throw std::invalid_argument(
        "logoAreaBorderRadius must be between 0 and half the size.");
  }
  validateGradient(options);
}

void rejectOversizedValue(const std::string &value,
                          const GenerateOptions &options) {
  if (value.size() < SegmentTooLongChars ||
      value.size() > static_cast<size_t>(INT_MAX)) {
    return;
  }
  validateOptions(value, options);
  parseEcc(options.errorCorrectionLevel);
  throw qrcodegen::data_too_long("Segment too long");
}

bool isEyeModule(int x, int y, int matrixSize) {
  const bool top = y < 7;
  const bool left = x < 7;
  const bool right = x >= matrixSize - 7;
  const bool bottom = y >= matrixSize - 7;
  return (top && left) || (top && right) || (bottom && left);
}

std::pair<int, int> eyeOrigin(int x, int y, int matrixSize) {
  if (x < 7 && y < 7) {
    return {0, 0};
  }
  if (x >= matrixSize - 7 && y < 7) {
    return {matrixSize - 7, 0};
  }
  return {0, matrixSize - 7};
}

bool isEyeBallModule(int x, int y, int matrixSize) {
  const auto [originX, originY] = eyeOrigin(x, y, matrixSize);
  const int localX = x - originX;
  const int localY = y - originY;
  return localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
}

std::vector<int> alignmentPatternPositions(int matrixSize) {
  const int version = (matrixSize - 17) / 4;
  if (version < 2 || (matrixSize - 17) % 4 != 0) {
    return {};
  }
  const int numAlign = version / 7 + 2;
  const int step =
      (version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4) * 2;
  std::vector<int> result;
  for (int index = 0, pos = matrixSize - 7; index < numAlign - 1;
       ++index, pos -= step) {
    result.insert(result.begin(), pos);
  }
  result.insert(result.begin(), 6);
  return result;
}

bool isFinderAlignmentCenter(int x, int y, int matrixSize) {
  return (x == 6 && y == 6) || (x == 6 && y == matrixSize - 7) ||
         (x == matrixSize - 7 && y == 6);
}

bool isAlignmentModule(int x, int y, int matrixSize,
                       const std::vector<int> &positions) {
  if (isEyeModule(x, y, matrixSize)) {
    return false;
  }
  for (int centerY : positions) {
    for (int centerX : positions) {
      if (isFinderAlignmentCenter(centerX, centerY, matrixSize)) {
        continue;
      }
      if (std::abs(x - centerX) <= 2 && std::abs(y - centerY) <= 2) {
        return true;
      }
    }
  }
  return false;
}

bool isTimingModule(int x, int y, int matrixSize,
                    const std::vector<int> &positions) {
  if (x != 6 && y != 6) {
    return false;
  }
  return !isEyeModule(x, y, matrixSize) &&
         !isAlignmentModule(x, y, matrixSize, positions);
}

void fillRect(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
              int x1, int y1, uint8_t value) {
  for (int y = y0; y < y1; y++) {
    const size_t rowStart =
        static_cast<size_t>(y) * static_cast<size_t>(imageSize);
    std::fill(indices.begin() + static_cast<std::ptrdiff_t>(
                                    rowStart + static_cast<size_t>(x0)),
              indices.begin() + static_cast<std::ptrdiff_t>(
                                    rowStart + static_cast<size_t>(x1)),
              value);
  }
}

template <typename Inside>
void fillWhere(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
               int x1, int y1, uint8_t value, const Inside &inside) {
  for (int y = y0; y < y1; y++) {
    for (int x = x0; x < x1; x++) {
      if (inside(x, y)) {
        indices[static_cast<size_t>(y) * static_cast<size_t>(imageSize) +
                static_cast<size_t>(x)] = value;
      }
    }
  }
}

void fillCircle(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
                int x1, int y1, uint8_t value) {
  const double radiusX = static_cast<double>(x1 - x0) / 2.0;
  const double radiusY = static_cast<double>(y1 - y0) / 2.0;
  const double centerX = static_cast<double>(x0 + x1 - 1) / 2.0;
  const double centerY = static_cast<double>(y0 + y1 - 1) / 2.0;
  fillWhere(indices, imageSize, x0, y0, x1, y1, value, [&](int x, int y) {
    const double dx = (static_cast<double>(x) - centerX) / radiusX;
    const double dy = (static_cast<double>(y) - centerY) / radiusY;
    return dx * dx + dy * dy <= 1.0;
  });
}

void fillRoundedRect(std::vector<uint8_t> &indices, int imageSize, int x0,
                     int y0, int x1, int y1, int radius, uint8_t value) {
  const int width = x1 - x0;
  const int height = y1 - y0;
  const int cornerRadius =
      std::min({std::max(radius, 0), std::max(0, (width - 1) / 2),
                std::max(0, (height - 1) / 2)});
  if (cornerRadius == 0) {
    fillRect(indices, imageSize, x0, y0, x1, y1, value);
    return;
  }

  const int leftArc = x0 + cornerRadius;
  const int rightArc = x1 - cornerRadius - 1;
  const int topArc = y0 + cornerRadius;
  const int bottomArc = y1 - cornerRadius - 1;
  const int radiusSquared = cornerRadius * cornerRadius;
  fillWhere(indices, imageSize, x0, y0, x1, y1, value, [&](int x, int y) {
    const int dx = x - std::clamp(x, leftArc, rightArc);
    const int dy = y - std::clamp(y, topArc, bottomArc);
    return dx * dx + dy * dy <= radiusSquared;
  });
}

void fillDiamond(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
                 int x1, int y1, uint8_t value) {
  const double radiusX = static_cast<double>(x1 - x0) / 2.0;
  const double radiusY = static_cast<double>(y1 - y0) / 2.0;
  const double centerX = static_cast<double>(x0 + x1 - 1) / 2.0;
  const double centerY = static_cast<double>(y0 + y1 - 1) / 2.0;
  fillWhere(indices, imageSize, x0, y0, x1, y1, value, [&](int x, int y) {
    const double dx = std::abs(static_cast<double>(x) - centerX) / radiusX;
    const double dy = std::abs(static_cast<double>(y) - centerY) / radiusY;
    return dx + dy <= 1.0;
  });
}

void fillSquircle(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
                  int x1, int y1, uint8_t value) {
  const int radius = std::max(1, std::min(x1 - x0, y1 - y0) * 9 / 20);
  fillRoundedRect(indices, imageSize, x0, y0, x1, y1, radius, value);
}

void fillClassy(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
                int x1, int y1, int radius, ModuleNeighbors neighbors,
                uint8_t value) {
  const bool roundTL = !neighbors.north && !neighbors.west;
  const bool roundTR = !neighbors.north && !neighbors.east;
  const bool roundBR = !neighbors.south && !neighbors.east;
  const bool roundBL = !neighbors.south && !neighbors.west;
  if (!roundTL && !roundTR && !roundBR && !roundBL) {
    fillRect(indices, imageSize, x0, y0, x1, y1, value);
    return;
  }
  const int width = x1 - x0;
  const int height = y1 - y0;
  const int cornerRadius =
      std::min({std::max(radius, 1), std::max(0, (width - 1) / 2),
                std::max(0, (height - 1) / 2)});
  const int leftArc = x0 + cornerRadius;
  const int rightArc = x1 - cornerRadius - 1;
  const int topArc = y0 + cornerRadius;
  const int bottomArc = y1 - cornerRadius - 1;
  const int radiusSquared = cornerRadius * cornerRadius;
  const auto withinArc = [radiusSquared](int dx, int dy) {
    return dx * dx + dy * dy <= radiusSquared;
  };
  fillWhere(indices, imageSize, x0, y0, x1, y1, value, [&](int x, int y) {
    const bool inTL = x < leftArc && y < topArc;
    const bool inTR = x > rightArc && y < topArc;
    const bool inBR = x > rightArc && y > bottomArc;
    const bool inBL = x < leftArc && y > bottomArc;
    if (inTL && roundTL) {
      return withinArc(x - leftArc, y - topArc);
    }
    if (inTR && roundTR) {
      return withinArc(x - rightArc, y - topArc);
    }
    if (inBR && roundBR) {
      return withinArc(x - rightArc, y - bottomArc);
    }
    if (inBL && roundBL) {
      return withinArc(x - leftArc, y - bottomArc);
    }
    return true;
  });
}

void fillShape(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
               int x1, int y1, ModuleShape shape, int cornerRadius,
               int defaultRadius, const ModuleNeighbors *neighbors,
               uint8_t value) {
  const int roundedRadius = cornerRadius < 0 ? defaultRadius : cornerRadius;
  if (shape == ModuleShape::Circle) {
    fillCircle(indices, imageSize, x0, y0, x1, y1, value);
  } else if (shape == ModuleShape::Diamond) {
    fillDiamond(indices, imageSize, x0, y0, x1, y1, value);
  } else if (shape == ModuleShape::Squircle) {
    fillSquircle(indices, imageSize, x0, y0, x1, y1, value);
  } else if (shape == ModuleShape::Classy && neighbors != nullptr) {
    fillClassy(indices, imageSize, x0, y0, x1, y1, roundedRadius, *neighbors,
               value);
  } else if (shape == ModuleShape::Classy || shape == ModuleShape::Rounded ||
             cornerRadius >= 0) {
    fillRoundedRect(indices, imageSize, x0, y0, x1, y1, roundedRadius, value);
  } else {
    fillRect(indices, imageSize, x0, y0, x1, y1, value);
  }
}

void drawModule(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
                int x1, int y1, ModuleShape shape, int gap, int cornerRadius,
                uint8_t value = BodyLayer, ModuleNeighbors neighbors = {}) {
  const int maxGap = std::max(0, (std::min(x1 - x0, y1 - y0) - 1) / 2);
  const int inset = std::min(gap, maxGap);
  x0 += inset;
  y0 += inset;
  x1 -= inset;
  y1 -= inset;
  fillShape(indices, imageSize, x0, y0, x1, y1, shape, cornerRadius,
            std::min(x1 - x0, y1 - y0) / 3, &neighbors, value);
}

int resolveBodyGap(const GenerateOptions &options, BodyDensity density,
                   int width, int height) {
  if (density == BodyDensity::Dense) {
    return options.gap;
  }
  const int moduleSize = std::max(1, std::min(width, height));
  const double ratio = density == BodyDensity::Sparse ? 0.22 : 0.12;
  return std::max(options.gap,
                  static_cast<int>(std::round(moduleSize * ratio)));
}

void fillFinderShape(std::vector<uint8_t> &indices, int imageSize, int x0,
                     int y0, int x1, int y1, ModuleShape shape,
                     int cornerRadius, uint8_t value) {
  fillShape(indices, imageSize, x0, y0, x1, y1, shape, cornerRadius,
            std::max(1, (x1 - x0) / 5), nullptr, value);
}

void drawGroupedFinder(std::vector<uint8_t> &indices, int imageSize,
                       int moduleX, int moduleY, int quietZone,
                       int totalModules, ModuleShape frameShape,
                       ModuleShape eyeballShape, int cornerRadius,
                       bool useEyeStrokeLayer, uint8_t holeLayer) {
  const auto modulePosition = [imageSize, quietZone,
                               totalModules](int module, double offset) {
    return static_cast<int>(
        std::floor(((static_cast<double>(module + quietZone) + offset) *
                    static_cast<double>(imageSize)) /
                   static_cast<double>(totalModules)));
  };
  const auto drawShape = [&](double offset, double span, ModuleShape shape,
                             uint8_t value) {
    fillFinderShape(indices, imageSize, modulePosition(moduleX, offset),
                    modulePosition(moduleY, offset),
                    modulePosition(moduleX, offset + span),
                    modulePosition(moduleY, offset + span), shape,
                    cornerRadius, value);
  };

  const double strokeInset =
      frameShape == ModuleShape::Square ? 0.3 : 0.65;
  drawShape(0.0, 7.0, frameShape,
            useEyeStrokeLayer ? EyeStrokeLayer : EyeFrameLayer);
  if (useEyeStrokeLayer) {
    drawShape(strokeInset, 7.0 - strokeInset * 2.0, frameShape,
              EyeFrameLayer);
  }
  drawShape(1.0, 5.0, frameShape, holeLayer);
  const bool useCircleFrameSquareEyeball =
      frameShape == ModuleShape::Circle && eyeballShape == ModuleShape::Square;
  const double eyeballOffset =
      eyeballShape == ModuleShape::Circle ? 1.75
      : useCircleFrameSquareEyeball  ? 2.25
                                      : 2.0;
  const double eyeballSpan =
      eyeballShape == ModuleShape::Circle ? 3.5
      : useCircleFrameSquareEyeball  ? 2.5
                                      : 3.0;
  drawShape(eyeballOffset, eyeballSpan, eyeballShape, EyeballLayer);
}

void drawGroupedFinders(std::vector<uint8_t> &indices, int imageSize,
                        int matrixSize, int quietZone, int totalModules,
                        ModuleShape frameShape, ModuleShape eyeballShape,
                        int cornerRadius, bool useEyeStrokeLayer,
                        uint8_t holeLayer) {
  drawGroupedFinder(indices, imageSize, 0, 0, quietZone, totalModules,
                    frameShape, eyeballShape, cornerRadius, useEyeStrokeLayer,
                    holeLayer);
  drawGroupedFinder(indices, imageSize, matrixSize - 7, 0, quietZone,
                    totalModules, frameShape, eyeballShape, cornerRadius,
                    useEyeStrokeLayer, holeLayer);
  drawGroupedFinder(indices, imageSize, 0, matrixSize - 7, quietZone,
                    totalModules, frameShape, eyeballShape, cornerRadius,
                    useEyeStrokeLayer, holeLayer);
}

void clearLogoArea(std::vector<uint8_t> &indices, int imageSize,
                   int logoAreaSize, int logoAreaBorderRadius) {
  if (logoAreaSize == 0) {
    return;
  }

  const int areaSize = std::min(logoAreaSize, imageSize);
  const int x0 = (imageSize - areaSize) / 2;
  const int y0 = (imageSize - areaSize) / 2;
  fillRoundedRect(indices, imageSize, x0, y0, x0 + areaSize, y0 + areaSize,
                  logoAreaBorderRadius, TransparentLayer);
}

bool intersectsLogoArea(int x0, int y0, int x1, int y1, int imageSize,
                        int logoAreaSize) {
  if (logoAreaSize == 0) {
    return false;
  }
  const int areaSize = std::min(logoAreaSize, imageSize);
  const int logoX0 = (imageSize - areaSize) / 2;
  const int logoY0 = (imageSize - areaSize) / 2;
  return x0 < logoX0 + areaSize && x1 > logoX0 && y0 < logoY0 + areaSize &&
         y1 > logoY0;
}

uint8_t hexValue(char value) {
  if (value >= '0' && value <= '9')
    return static_cast<uint8_t>(value - '0');
  if (value >= 'a' && value <= 'f')
    return static_cast<uint8_t>(value - 'a' + 10);
  if (value >= 'A' && value <= 'F')
    return static_cast<uint8_t>(value - 'A' + 10);
  throw std::invalid_argument("Color must use hexadecimal digits.");
}

uint8_t parseHexByte(const std::string &value, size_t index) {
  return static_cast<uint8_t>((hexValue(value[index]) << 4) |
                              hexValue(value[index + 1]));
}

void writeU32(std::vector<uint8_t> &bytes, uint32_t value) {
  bytes.push_back(static_cast<uint8_t>((value >> 24) & 0xFF));
  bytes.push_back(static_cast<uint8_t>((value >> 16) & 0xFF));
  bytes.push_back(static_cast<uint8_t>((value >> 8) & 0xFF));
  bytes.push_back(static_cast<uint8_t>(value & 0xFF));
}

uint32_t crc32Value(const uint8_t *data, size_t size) {
  uLong crc = ::crc32(0L, Z_NULL, 0);
  while (size > 0) {
    const uInt chunkSize = static_cast<uInt>(std::min<size_t>(
        size, static_cast<size_t>(std::numeric_limits<uInt>::max())));
    crc = ::crc32(crc, data, chunkSize);
    data += chunkSize;
    size -= chunkSize;
  }
  return static_cast<uint32_t>(crc);
}

std::string hashCachePart(const std::string &value) {
  uint64_t hash = 14695981039346656037ULL;
  for (unsigned char character : value) {
    hash ^= character;
    hash *= 1099511628211ULL;
  }
  return std::to_string(hash);
}

void appendCachePart(std::string &request, std::string_view part) {
  char sizeBuffer[24];
  const auto sizeConverted = std::to_chars(
      sizeBuffer, sizeBuffer + sizeof(sizeBuffer), part.size());
  request.append(sizeBuffer, sizeConverted.ptr);
  request.push_back(':');
  request.append(part.data(), part.size());
}

template <typename Number>
void appendCacheNumber(std::string &request, Number value) {
  char valueBuffer[32];
  const auto converted =
      std::to_chars(valueBuffer, valueBuffer + sizeof(valueBuffer), value);
  appendCachePart(request,
                  std::string_view(valueBuffer, converted.ptr - valueBuffer));
}

std::string cacheDouble(double value) {
  thread_local std::ostringstream output;
  output.str("");
  output.clear();
  output << std::setprecision(std::numeric_limits<double>::max_digits10)
         << value;
  return output.str();
}

void appendChunk(std::vector<uint8_t> &png, const char *type,
                 const uint8_t *data, size_t size) {
  writeU32(png, static_cast<uint32_t>(size));
  const size_t crcStart = png.size();
  png.insert(png.end(), type, type + 4);
  png.insert(png.end(), data, data + size);
  writeU32(png, crc32Value(png.data() + crcStart, png.size() - crcStart));
}

void appendChunk(std::vector<uint8_t> &png, const char *type,
                 const std::vector<uint8_t> &data) {
  appendChunk(png, type, data.data(), data.size());
}

std::vector<uint8_t> beginPng(int width, int height, uint8_t bitDepth,
                              uint8_t colorType) {
  std::vector<uint8_t> png = {137, 80, 78, 71, 13, 10, 26, 10};
  std::vector<uint8_t> ihdr;
  writeU32(ihdr, static_cast<uint32_t>(width));
  writeU32(ihdr, static_cast<uint32_t>(height));
  ihdr.push_back(bitDepth);
  ihdr.push_back(colorType);
  ihdr.push_back(0);
  ihdr.push_back(0);
  ihdr.push_back(0);
  appendChunk(png, "IHDR", ihdr);
  return png;
}

void appendPalette(std::vector<uint8_t> &png, const std::vector<Color> &palette) {
  std::vector<uint8_t> plte;
  std::vector<uint8_t> trns;
  plte.reserve(palette.size() * 3);
  trns.reserve(palette.size());
  for (const Color &color : palette) {
    plte.push_back(color.r);
    plte.push_back(color.g);
    plte.push_back(color.b);
    trns.push_back(color.a);
  }
  appendChunk(png, "PLTE", plte);
  appendChunk(png, "tRNS", trns);
}

class DeflateStream {
public:
  DeflateStream() {
    if (deflateInit(&stream_, Z_BEST_SPEED) != Z_OK) throw std::runtime_error("PNG compression failed.");
  }
  ~DeflateStream() { deflateEnd(&stream_); }
  DeflateStream(const DeflateStream &) = delete;
  DeflateStream &operator=(const DeflateStream &) = delete;
  z_stream &stream() { return stream_; }

private:
  z_stream stream_{};
};

std::vector<uint8_t> encodePngRgbaStreamed(const std::vector<uint8_t> &indices,
                                           int imageSize,
                                           const GenerateOptions &options) {
  const size_t rowBytes = static_cast<size_t>(imageSize) * 4;
  std::vector<uint8_t> current(rowBytes);
  std::vector<uint8_t> previous(rowBytes, 0);
  std::vector<uint8_t> filtered(rowBytes + 1);
  std::vector<uint8_t> chunk(IdatChunkBytes);

  std::vector<uint8_t> png = beginPng(imageSize, imageSize, 8, 6);

  DeflateStream deflater;
  z_stream &stream = deflater.stream();
  stream.next_out = chunk.data();
  stream.avail_out = static_cast<uInt>(chunk.size());
  const auto pump = [&](int flush) {
    bool done = false;
    while (!done) {
      const int result = deflate(&stream, flush);
      if (result == Z_STREAM_ERROR) throw std::runtime_error("PNG compression failed.");
      done = flush == Z_FINISH
                 ? result == Z_STREAM_END
                 : stream.avail_in == 0 && stream.avail_out != 0;
      if (stream.avail_out == 0 ||
          (result == Z_STREAM_END && stream.avail_out != chunk.size())) {
        appendChunk(png, "IDAT", chunk.data(), chunk.size() - stream.avail_out);
        stream.next_out = chunk.data();
        stream.avail_out = static_cast<uInt>(chunk.size());
      }
    }
  };

  filtered[0] = 2;
  for (int y = 0; y < imageSize; y++) {
    writeLayeredRow(indices, imageSize, y, options, current.data());
    for (size_t index = 0; index < rowBytes; index++) {
      filtered[index + 1] =
          static_cast<uint8_t>(current[index] - previous[index]);
    }
    stream.next_in = filtered.data();
    stream.avail_in = static_cast<uInt>(filtered.size());
    pump(Z_NO_FLUSH);
    current.swap(previous);
  }
  stream.next_in = filtered.data();
  stream.avail_in = 0;
  pump(Z_FINISH);
  appendChunk(png, "IEND", {});
  png.shrink_to_fit();
  return png;
}

std::vector<uint8_t> zlibCompress(const std::vector<uint8_t> &data) {
  uLongf compressedSize = compressBound(static_cast<uLong>(data.size()));
  std::vector<uint8_t> output(static_cast<size_t>(compressedSize));
  const int result =
      compress2(output.data(), &compressedSize, data.data(),
                static_cast<uLong>(data.size()), Z_BEST_SPEED);
  if (result != Z_OK) throw std::runtime_error("PNG compression failed.");
  output.resize(static_cast<size_t>(compressedSize));
  return output;
}

std::vector<uint8_t> encodePngPalette(int width, int height,
                                      std::vector<uint8_t> indices,
                                      const std::vector<Color> &palette,
                                      unsigned bitDepth) {
  const size_t pixelsPerByte = 8 / bitDepth;
  const size_t rowBytes =
      (static_cast<size_t>(width) + pixelsPerByte - 1) / pixelsPerByte;
  std::vector<uint8_t> raw((rowBytes + 1) * static_cast<size_t>(height), 0);
  for (int y = 0; y < height; y++) {
    const size_t rowOutputStart =
        static_cast<size_t>(y) * (rowBytes + 1) + 1;
    const size_t rowStart = static_cast<size_t>(y) * static_cast<size_t>(width);
    for (int x = 0; x < width; x++) {
      const uint8_t sample = indices[rowStart + static_cast<size_t>(x)];
      const unsigned entry = bitDepth == 1 ? (sample != 0 ? 1U : 0U) : sample;
      const size_t byteIndex =
          rowOutputStart + static_cast<size_t>(x) / pixelsPerByte;
      const unsigned shift =
          8U - bitDepth * (static_cast<unsigned>(x) % pixelsPerByte + 1U);
      raw[byteIndex] = static_cast<uint8_t>(raw[byteIndex] | (entry << shift));
    }
  }
  std::vector<uint8_t>().swap(indices);

  std::vector<uint8_t> png =
      beginPng(width, height, static_cast<uint8_t>(bitDepth), 3);
  appendPalette(png, palette);
  appendChunk(png, "IDAT", zlibCompress(raw));
  appendChunk(png, "IEND", {});
  return png;
}

std::vector<Color> layerPalette(const GenerateOptions &options) {
  std::vector<Color> palette;
  palette.reserve(QuietZoneLayer + 1);
  for (uint8_t layer = 0; layer <= QuietZoneLayer; layer++) {
    palette.push_back(colorForLayer(layer, options, 1, 0, 0));
  }
  return palette;
}

struct ModuleShapes {
  ModuleShape body;
  ModuleShape eyePattern;
  ModuleShape eyeball;
  ModuleShape alignment;
  ModuleShape timing;
  BodyDensity bodyDensity;
};

struct ModuleStyle {
  ModuleShape shape;
  int gap;
  int radius;
  uint8_t layer;
};

ModuleStyle classifyModule(int moduleX, int moduleY, int matrixSize,
                           const std::vector<int> &alignmentPositions,
                           const ModuleShapes &shapes,
                           const GenerateOptions &options, int pixelWidth,
                           int pixelHeight) {
  const bool eyeModule = isEyeModule(moduleX, moduleY, matrixSize);
  const bool eyeballModule = isEyeBallModule(moduleX, moduleY, matrixSize);
  const bool alignmentModule =
      isAlignmentModule(moduleX, moduleY, matrixSize, alignmentPositions);
  const bool timingModule =
      isTimingModule(moduleX, moduleY, matrixSize, alignmentPositions);
  ModuleStyle style;
  style.shape = eyeballModule ? shapes.eyeball
                : eyeModule   ? shapes.eyePattern
                : alignmentModule ? shapes.alignment
                : timingModule    ? shapes.timing
                                  : shapes.body;
  style.gap = eyeModule ? options.eyePatternGap
              : alignmentModule || timingModule
                  ? 0
                  : resolveBodyGap(options, shapes.bodyDensity, pixelWidth,
                                   pixelHeight);
  style.radius =
      eyeModule ? options.eyePatternCornerRadius : options.cornerRadius;
  style.layer = BodyLayer;
  if (eyeModule) {
    style.layer = eyeballModule ? EyeballLayer : EyeFrameLayer;
  } else if (alignmentModule) {
    style.layer = AlignmentLayer;
  } else if (timingModule) {
    style.layer = TimingLayer;
  }
  return style;
}

std::vector<uint8_t> rasterizeLayers(const Matrix &matrix,
                                     const GenerateOptions &options,
                                     int imageSize) {
  const int totalModules = matrix.size + options.quietZone * 2;
  std::vector<uint8_t> indices(static_cast<size_t>(imageSize) *
                               static_cast<size_t>(imageSize));
  const auto isDark = [&matrix](int x, int y) {
    if (x < 0 || y < 0 || x >= matrix.size || y >= matrix.size) {
      return false;
    }
    return matrix.modules[static_cast<size_t>(y) *
                              static_cast<size_t>(matrix.size) +
                          static_cast<size_t>(x)] == 1;
  };

  const ModuleShapes shapes{
      parseShape(options.moduleShape, "shape"),
      parseEyePatternShape(options.eyePatternShape),
      parseEyeballShape(options.eyeballShape),
      parseShape(options.alignmentShape, "alignmentShape"),
      parseShape(options.timingShape, "timingShape"),
      parseBodyDensity(options.bodyDensity)};
  const std::vector<int> alignmentPositions =
      alignmentPatternPositions(matrix.size);
  const bool useCustomFinderColors = hasCustomFinderColors(options);
  const bool drawGroupedFinderEyes =
      shapes.eyePattern != ModuleShape::Square ||
      shapes.eyeball != ModuleShape::Square || useCustomFinderColors;
  if (options.resolvedQuietZoneFill() != options.background) {
    std::fill(indices.begin(), indices.end(), QuietZoneLayer);
    const int inner0 = (options.quietZone * imageSize) / totalModules;
    const int inner1 =
        ((matrix.size + options.quietZone) * imageSize) / totalModules;
    fillRect(indices, imageSize, inner0, inner0, inner1, inner1, 0);
  }

  for (int moduleY = 0; moduleY < matrix.size; moduleY++) {
    const int y0 = ((moduleY + options.quietZone) * imageSize) / totalModules;
    const int y1 =
        ((moduleY + options.quietZone + 1) * imageSize) / totalModules;
    for (int moduleX = 0; moduleX < matrix.size; moduleX++) {
      if (!isDark(moduleX, moduleY)) {
        continue;
      }
      const bool eyeModule = isEyeModule(moduleX, moduleY, matrix.size);
      if (drawGroupedFinderEyes && eyeModule) {
        continue;
      }

      const int x0 = ((moduleX + options.quietZone) * imageSize) / totalModules;
      const int x1 =
          ((moduleX + options.quietZone + 1) * imageSize) / totalModules;
      if (intersectsLogoArea(x0, y0, x1, y1, imageSize,
                             options.logoAreaSize)) {
        continue;
      }
      const ModuleStyle style =
          classifyModule(moduleX, moduleY, matrix.size, alignmentPositions,
                         shapes, options, x1 - x0, y1 - y0);
      const ModuleNeighbors neighbors{
          isDark(moduleX, moduleY - 1), isDark(moduleX + 1, moduleY),
          isDark(moduleX, moduleY + 1), isDark(moduleX - 1, moduleY)};
      if (style.layer == BodyLayer && drawsBodyStroke(options)) {
        drawModule(indices, imageSize, x0, y0, x1, y1, style.shape, style.gap,
                   style.radius, StrokeLayer, neighbors);
        const int strokeInset = std::max(1, (x1 - x0) / 5);
        drawModule(indices, imageSize, x0, y0, x1, y1, style.shape,
                   style.gap + strokeInset, style.radius, BodyLayer, neighbors);
        continue;
      }
      drawModule(indices, imageSize, x0, y0, x1, y1, style.shape, style.gap,
                 style.radius, style.layer, neighbors);
    }
  }
  if (drawGroupedFinderEyes) {
    drawGroupedFinders(indices, imageSize, matrix.size, options.quietZone,
                       totalModules, shapes.eyePattern, shapes.eyeball,
                       options.eyePatternCornerRadius,
                       drawsEyeStroke(options),
                       options.resolvedFinderInner() == options.background
                           ? 0
                           : FinderInnerLayer);
  }
  clearLogoArea(indices, imageSize, options.logoAreaSize,
                options.logoAreaBorderRadius);

  return indices;
}

std::vector<uint8_t> encodeLayeredPng(std::vector<uint8_t> indices,
                                      int imageSize,
                                      const GenerateOptions &options,
                                      int streamedRgbaMinSize) {
  if (hasGradient(options) && imageSize > streamedRgbaMinSize) {
    return encodePngRgbaStreamed(indices, imageSize, options);
  }
  if (hasGradient(options)) {
    const std::vector<uint8_t> rgba =
        renderLayeredRgba(indices, imageSize, options);
    std::vector<uint8_t>().swap(indices);
    return encodePngRgba(imageSize, imageSize, rgba);
  }
  if (hasCustomLayerColors(options) || options.logoAreaSize > 0) {
    return encodePngPalette(imageSize, imageSize, std::move(indices),
                            layerPalette(options), 4);
  }
  return encodePngPalette(
      imageSize, imageSize, std::move(indices),
      {options.background,
       compositeOver(options.foreground, options.background)},
      1);
}

} // namespace

QRCodeGenerator::QRCodeGenerator(CacheKeyHasher cacheKeyHasher,
                                 size_t maxCacheBytes, int streamedRgbaMinSize)
    : cacheKeyHasher_(std::move(cacheKeyHasher)),
      streamedRgbaMinSize_(streamedRgbaMinSize),
      outputCache_(MaxCacheEntries, maxCacheBytes),
      matrixCache_(MaxMatrixCacheEntries, MaxMatrixCacheBytes) {}

Color parseColor(const std::string &value) {
  if (value == "transparent") {
    return {0, 0, 0, 0};
  }
  if (value.size() != 7 && value.size() != 9) {
    throw std::invalid_argument(
        "Color must be transparent, #RRGGBB, or #RRGGBBAA.");
  }
  if (value[0] != '#') {
    throw std::invalid_argument("Color must start with #.");
  }
  return {
      parseHexByte(value, 1),
      parseHexByte(value, 3),
      parseHexByte(value, 5),
      value.size() == 9 ? parseHexByte(value, 7) : static_cast<uint8_t>(255),
  };
}

std::string base64Encode(const std::vector<uint8_t> &bytes) {
  static constexpr char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string output;
  output.reserve(((bytes.size() + 2) / 3) * 4);

  for (size_t i = 0; i < bytes.size(); i += 3) {
    const uint32_t a = bytes[i];
    const uint32_t b = i + 1 < bytes.size() ? bytes[i + 1] : 0;
    const uint32_t c = i + 2 < bytes.size() ? bytes[i + 2] : 0;
    const uint32_t triple = (a << 16) | (b << 8) | c;
    output.push_back(alphabet[(triple >> 18) & 0x3F]);
    output.push_back(alphabet[(triple >> 12) & 0x3F]);
    output.push_back(i + 1 < bytes.size() ? alphabet[(triple >> 6) & 0x3F]
                                          : '=');
    output.push_back(i + 2 < bytes.size() ? alphabet[triple & 0x3F] : '=');
  }

  return output;
}

std::vector<uint8_t> encodePngRgba(int width, int height,
                                   const std::vector<uint8_t> &rgba) {
  if (width <= 0 || height <= 0) {
    throw std::invalid_argument("PNG dimensions must be positive.");
  }
  size_t expectedSize = 0;
  if (!pixelBufferBytes(width, height, 4, expectedSize) ||
      rgba.size() != expectedSize) {
    throw std::invalid_argument(
        "RGBA buffer size does not match PNG dimensions.");
  }

  static std::once_flag fpngOnce;
  std::call_once(fpngOnce, []() { fpng::fpng_init(); });

  std::vector<uint8_t> png;
  if (!fpng::fpng_encode_image_to_memory(
          rgba.data(), static_cast<uint32_t>(width),
          static_cast<uint32_t>(height), 4, png, fpng::FPNG_ENCODE_SLOWER)) throw std::runtime_error("PNG compression failed.");
  png.shrink_to_fit();
  return png;
}

Matrix QRCodeGenerator::createMatrix(const std::string &value,
                                     const GenerateOptions &options) const {
  validateOptions(value, options);
  return encodeMatrix(value, options);
}

Matrix QRCodeGenerator::encodeMatrix(const std::string &value,
                                     const GenerateOptions &options) const {
  const auto segments = value.find('\0') == std::string::npos
      ? qrcodegen::QrSegment::makeSegments(value.c_str())
      : std::vector<qrcodegen::QrSegment>{qrcodegen::QrSegment::makeBytes(
            std::vector<uint8_t>(value.begin(), value.end()))};
  const auto qr = qrcodegen::QrCode::encodeSegments(
      segments,
      parseEcc(options.errorCorrectionLevel), options.minVersion,
      options.maxVersion, options.mask, options.boostEcl);

  Matrix matrix;
  matrix.size = qr.getSize();
  matrix.modules.resize(static_cast<size_t>(matrix.size) *
                        static_cast<size_t>(matrix.size));
  for (int y = 0; y < matrix.size; y++) {
    for (int x = 0; x < matrix.size; x++) {
      matrix.modules[static_cast<size_t>(y) * static_cast<size_t>(matrix.size) +
                     static_cast<size_t>(x)] = qr.getModule(x, y) ? 1 : 0;
    }
  }
  return matrix;
}

std::vector<uint8_t>
QRCodeGenerator::renderPngBytes(const std::string &value,
                                const GenerateOptions &options) {
  rejectOversizedValue(value, options);
  const std::string request = cacheRequest(value, options, "png-bytes");
  const std::string key = cacheKey(request);
  if (const auto cached = getCacheEntry(key, request)) {
    return std::vector<uint8_t>(cached->begin(), cached->end());
  }

  const Matrix matrix = createMatrix(value, options);
  const int imageSize =
      std::max(options.size, matrix.size + options.quietZone * 2);
  std::vector<uint8_t> png = encodeLayeredPng(
      rasterizeLayers(matrix, options, imageSize), imageSize, options,
      streamedRgbaMinSize_);
  if (outputCache_.accepts(key.size() + request.size() + png.size())) {
    storeCacheEntry(key, request, std::string(png.begin(), png.end()));
  }
  return png;
}

std::string QRCodeGenerator::renderPngBase64(const std::string &value,
                                               const GenerateOptions &options) {
  return base64Encode(renderPngBytes(value, options));
}

std::string
QRCodeGenerator::renderPngDataUri(const std::string &value,
                                    const GenerateOptions &options) {
  const std::string encoded = renderPngBase64(value, options);
  constexpr std::string_view prefix = "data:image/png;base64,";
  std::string output;
  output.reserve(prefix.size() + encoded.size());
  output.append(prefix);
  output.append(encoded);
  return output;
}

std::string QRCodeGenerator::generateSvgString(const std::string &value,
                                               const GenerateOptions &options) {
  rejectOversizedValue(value, options);
  validateOptions(value, options);
  const std::string request = cacheRequest(value, options, "svg");
  const std::string key = cacheKey(request);
  if (const auto cached = getCacheEntry(key, request)) {
    return *cached;
  }

  const Matrix matrix = encodeMatrix(value, options);
  const int totalSize = matrix.size + options.quietZone * 2;
  std::ostringstream path;
  for (int y = 0; y < matrix.size; y++) {
    for (int x = 0; x < matrix.size; x++) {
      if (matrix.modules[static_cast<size_t>(y) *
                             static_cast<size_t>(matrix.size) +
                         static_cast<size_t>(x)] == 1) {
        path << "M" << (x + options.quietZone) << "," << (y + options.quietZone)
             << "h1v1h-1z";
      }
    }
  }

  std::ostringstream svg;
  svg << "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " << totalSize
      << " " << totalSize << "\" shape-rendering=\"crispEdges\">";
  svg << createSvgGradient(options, totalSize);
  svg << "<path fill=\"" << options.backgroundColor << "\" d=\"M0,0h"
      << totalSize << "v" << totalSize << "H0z\"/>";
  svg << "<path fill=\""
      << (hasGradient(options) ? "url(#nitro-qrcode-gradient)"
                               : options.foregroundColor)
      << "\" d=\"" << path.str() << "\"/>";
  svg << "</svg>";

  const std::string output = svg.str();
  storeCacheEntry(key, request, output);
  return output;
}

QRCodeGenerator::MatrixObject
QRCodeGenerator::getMatrix(const std::string &value,
                           const GenerateOptions &options) {
  rejectOversizedValue(value, options);
  const std::string request = cacheRequest(value, options, "matrix");
  if (const auto cached = matrixCache_.get(cacheKey(request), request)) {
    return *cached;
  }

  const Matrix matrix = createMatrix(value, options);
  std::vector<uint8_t> packed((matrix.modules.size() + 7) / 8);
  for (size_t i = 0; i < matrix.modules.size(); i++) {
    if (matrix.modules[i] == 1) {
      packed[i / 8] =
          static_cast<uint8_t>(packed[i / 8] | (1U << (7U - (i % 8U))));
    }
  }
  MatrixObject result = {matrix.size, base64Encode(packed)};
  const std::string key = cacheKey(request);
  const size_t entryBytes = key.size() + request.size() + result.packedBase64.size();
  matrixCache_.store(key, request, result, entryBytes);
  return result;
}

std::string
QRCodeGenerator::getMatrixPackedBase64(const std::string &value,
                                       const GenerateOptions &options) {
  return getMatrix(value, options).packedBase64;
}

QRCodeGenerator::MatrixObject
QRCodeGenerator::getMatrixObject(const std::string &value,
                                 const GenerateOptions &options) {
  return getMatrix(value, options);
}

int QRCodeGenerator::getMatrixSize(const std::string &value,
                                   const GenerateOptions &options) {
  return getMatrix(value, options).size;
}

void QRCodeGenerator::clearCache() {
  outputCache_.clear();
  matrixCache_.clear();
}

size_t QRCodeGenerator::getCacheSize() const {
  return outputCache_.size();
}

size_t QRCodeGenerator::getCacheBytes() const {
  return outputCache_.bytes();
}

size_t QRCodeGenerator::memorySize() const noexcept {
  return outputCache_.bytes() + matrixCache_.bytes();
}

std::string QRCodeGenerator::cacheRequest(const std::string &value,
                                          const GenerateOptions &options,
                                          const std::string &output) const {
  std::string request;
  request.reserve(256 + value.size() + output.size() +
                  options.foregroundColor.size() +
                  options.backgroundColor.size());
  appendCachePart(request, output);
  appendCachePart(request, value);
  appendCachePart(request, options.errorCorrectionLevel);
  appendCacheNumber(request, options.minVersion);
  appendCacheNumber(request, options.maxVersion);
  appendCacheNumber(request, options.mask);
  appendCacheNumber(request, static_cast<int>(options.boostEcl));
  if (output == "matrix") {
    return request;
  }

  const auto appendGradient = [&request, &options]() {
    appendCachePart(request, options.gradient.type);
    for (const auto &color : options.gradient.colors) {
      appendCacheNumber(request, color.r);
      appendCacheNumber(request, color.g);
      appendCacheNumber(request, color.b);
      appendCacheNumber(request, color.a);
    }
    for (double location : options.gradient.locations) {
      appendCachePart(request, cacheDouble(location));
    }
    appendCachePart(request, cacheDouble(options.gradient.startX));
    appendCachePart(request, cacheDouble(options.gradient.startY));
    appendCachePart(request, cacheDouble(options.gradient.endX));
    appendCachePart(request, cacheDouble(options.gradient.endY));
  };
  if (output == "svg") {
    appendCacheNumber(request, options.quietZone);
    appendCachePart(request, options.foregroundColor);
    appendCachePart(request, options.backgroundColor);
    appendGradient();
    return request;
  }
  appendCacheNumber(request, options.size);
  appendCacheNumber(request, options.quietZone);
  const auto appendColor = [&request](const Color &color) {
    appendCacheNumber(request, color.r);
    appendCacheNumber(request, color.g);
    appendCacheNumber(request, color.b);
    appendCacheNumber(request, color.a);
  };
  appendColor(options.foreground);
  appendColor(options.background);
  appendColor(options.stroke);
  appendColor(options.eye);
  appendColor(options.eyeStroke);
  appendColor(options.eyeball);
  appendColor(options.alignment);
  appendColor(options.timing);
  appendColor(options.resolvedQuietZoneFill());
  appendColor(options.resolvedFinderInner());
  appendCachePart(request, options.moduleShape);
  appendCachePart(request, options.eyePatternShape);
  appendCachePart(request, options.eyeballShape);
  appendCachePart(request, options.alignmentShape);
  appendCachePart(request, options.timingShape);
  appendCacheNumber(request, options.gap);
  appendCacheNumber(request, options.eyePatternGap);
  appendCachePart(request, options.bodyDensity);
  appendCacheNumber(request, options.cornerRadius);
  appendCacheNumber(request, options.eyePatternCornerRadius);
  appendCachePart(request, options.layout);
  appendCacheNumber(request, options.logoAreaSize);
  appendCacheNumber(request, options.logoAreaBorderRadius);
  appendGradient();
  appendCacheNumber(request, (options.strokeSet ? 1 : 0) |
                                 (options.eyeSet ? 2 : 0) |
                                 (options.eyeStrokeSet ? 4 : 0) |
                                 (options.eyeballSet ? 8 : 0) |
                                 (options.alignmentSet ? 16 : 0) |
                                 (options.timingSet ? 32 : 0));
  return request;
}

std::string QRCodeGenerator::cacheKey(const std::string &request) const {
  if (cacheKeyHasher_) {
    return cacheKeyHasher_(request);
  }
  return hashCachePart(request);
}

std::optional<std::string>
QRCodeGenerator::getCacheEntry(const std::string &key,
                               const std::string &request) {
  return outputCache_.get(key, request);
}

void QRCodeGenerator::storeCacheEntry(const std::string &key,
                                      const std::string &request,
                                      const std::string &value) {
  const size_t entryBytes = key.size() + request.size() + value.size();
  outputCache_.store(key, request, value, entryBytes);
}

} // namespace NitroQRCode
