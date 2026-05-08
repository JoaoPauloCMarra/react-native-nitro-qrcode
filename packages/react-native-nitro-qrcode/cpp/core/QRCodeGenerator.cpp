#include "QRCodeGenerator.hpp"

#include "../qrcodegen/qrcodegen.hpp"

#include <algorithm>
#include <cmath>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace NitroQRCode {
namespace {

constexpr uint32_t CrcPolynomial = 0xEDB88320;
constexpr double Pi = 3.14159265358979323846;

enum class ModuleShape {
  Square,
  Circle,
  Rounded,
  Diamond,
  Hexagon,
  Octagon,
  Star,
  Heart,
  Scallop,
  Leaf,
  Clover,
  CircleBorder,
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
  if (value == "hexagon")
    return ModuleShape::Hexagon;
  if (value == "octagon")
    return ModuleShape::Octagon;
  if (value == "star")
    return ModuleShape::Star;
  if (value == "heart")
    return ModuleShape::Heart;
  if (value == "scallop")
    return ModuleShape::Scallop;
  if (value == "leaf")
    return ModuleShape::Leaf;
  if (value == "clover")
    return ModuleShape::Clover;
  throw std::invalid_argument(std::string(name) + " has an unsupported shape.");
}

ModuleShape parseEyePatternShape(const std::string &value) {
  if (value == "circle-border")
    return ModuleShape::CircleBorder;
  try {
    return parseShape(value, "eyePatternShape");
  } catch (const std::invalid_argument &) {
    throw std::invalid_argument("eyeFrameShape has an unsupported shape.");
  }
}

ModuleShape parseEyeballShape(const std::string &value) {
  return parseShape(value, "eyeballShape");
}

void validateLayout(const std::string &value) {
  if (value != "matrix" && value != "radial") {
    throw std::invalid_argument("layout must be matrix or radial.");
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

bool hasCustomLayerColors(const GenerateOptions &options) {
  return options.strokeColor != "#000000" || options.eyeColor != "#000000" ||
         options.eyeStrokeColor != "#000000" ||
         options.eyeballColor != "#000000";
}

Color colorForLayer(uint8_t layer, const GenerateOptions &options,
                    int imageSize, int x, int y) {
  switch (layer) {
  case 2:
    return options.stroke;
  case 3:
    return options.eye;
  case 4:
    return options.eyeStroke;
  case 5:
    return options.eyeball;
  case 1:
    return hasGradient(options)
               ? interpolateColor(
                     options.gradient,
                     gradientProgressAt(options.gradient, imageSize, x, y))
               : options.foreground;
  default:
    return options.background;
  }
}

std::vector<uint8_t> renderLayeredRgba(const std::vector<uint8_t> &indices,
                                       int imageSize,
                                       const GenerateOptions &options) {
  std::vector<uint8_t> rgba(static_cast<size_t>(imageSize) *
                            static_cast<size_t>(imageSize) * 4);
  for (int y = 0; y < imageSize; y++) {
    for (int x = 0; x < imageSize; x++) {
      const size_t pixelIndex =
          static_cast<size_t>(y) * static_cast<size_t>(imageSize) +
          static_cast<size_t>(x);
      const size_t offset = pixelIndex * 4;
      const Color color =
          colorForLayer(indices[pixelIndex], options, imageSize, x, y);
      rgba[offset] = color.r;
      rgba[offset + 1] = color.g;
      rgba[offset + 2] = color.b;
      rgba[offset + 3] = color.a;
    }
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

std::string createSvgGradient(const GenerateOptions &options) {
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
    defs << "<radialGradient id=\"nitro-qrcode-gradient\" cx=\""
         << formatPercent(options.gradient.startX) << "\" cy=\""
         << formatPercent(options.gradient.startY) << "\" r=\""
         << formatPercent(radius) << "\">";
  } else {
    defs << "<linearGradient id=\"nitro-qrcode-gradient\" x1=\""
         << formatPercent(options.gradient.startX) << "\" y1=\""
         << formatPercent(options.gradient.startY) << "\" x2=\""
         << formatPercent(options.gradient.endX) << "\" y2=\""
         << formatPercent(options.gradient.endY) << "\">";
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
  if (options.logoAreaBorderRadius < 0 ||
      options.logoAreaBorderRadius > options.size / 2) {
    throw std::invalid_argument(
        "logoAreaBorderRadius must be between 0 and half the size.");
  }
  validateGradient(options);
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

bool isEyeOuterStrokeModule(int x, int y, int matrixSize) {
  const auto [originX, originY] = eyeOrigin(x, y, matrixSize);
  const int localX = x - originX;
  const int localY = y - originY;
  return localX == 0 || localX == 6 || localY == 0 || localY == 6;
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

void fillCircle(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
                int x1, int y1, uint8_t value) {
  const double radiusX = static_cast<double>(x1 - x0) / 2.0;
  const double radiusY = static_cast<double>(y1 - y0) / 2.0;
  const double centerX = static_cast<double>(x0 + x1 - 1) / 2.0;
  const double centerY = static_cast<double>(y0 + y1 - 1) / 2.0;
  for (int y = y0; y < y1; y++) {
    for (int x = x0; x < x1; x++) {
      const double dx = (static_cast<double>(x) - centerX) / radiusX;
      const double dy = (static_cast<double>(y) - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1.0) {
        indices[static_cast<size_t>(y) * static_cast<size_t>(imageSize) +
                static_cast<size_t>(x)] = value;
      }
    }
  }
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
  for (int y = y0; y < y1; y++) {
    const int closestY = std::clamp(y, topArc, bottomArc);
    for (int x = x0; x < x1; x++) {
      const int closestX = std::clamp(x, leftArc, rightArc);
      const int dx = x - closestX;
      const int dy = y - closestY;
      if (dx * dx + dy * dy <= radiusSquared) {
        indices[static_cast<size_t>(y) * static_cast<size_t>(imageSize) +
                static_cast<size_t>(x)] = value;
      }
    }
  }
}

bool pointInPolygon(const std::vector<std::pair<double, double>> &points,
                    double x, double y) {
  bool inside = false;
  size_t previous = points.size() - 1;
  for (size_t current = 0; current < points.size(); current++) {
    const auto [currentX, currentY] = points[current];
    const auto [previousX, previousY] = points[previous];
    if (((currentY > y) != (previousY > y)) &&
        (x < (previousX - currentX) * (y - currentY) / (previousY - currentY) +
                 currentX)) {
      inside = !inside;
    }
    previous = current;
  }
  return inside;
}

void fillPolygon(std::vector<uint8_t> &indices, int imageSize,
                 const std::vector<std::pair<double, double>> &points,
                 uint8_t value) {
  double minX = points.front().first;
  double maxX = points.front().first;
  double minY = points.front().second;
  double maxY = points.front().second;
  for (const auto &[x, y] : points) {
    minX = std::min(minX, x);
    maxX = std::max(maxX, x);
    minY = std::min(minY, y);
    maxY = std::max(maxY, y);
  }

  const int startX = std::max(0, static_cast<int>(std::floor(minX)));
  const int endX = std::min(imageSize, static_cast<int>(std::ceil(maxX)));
  const int startY = std::max(0, static_cast<int>(std::floor(minY)));
  const int endY = std::min(imageSize, static_cast<int>(std::ceil(maxY)));
  for (int y = startY; y < endY; y++) {
    for (int x = startX; x < endX; x++) {
      if (pointInPolygon(points, static_cast<double>(x) + 0.5,
                         static_cast<double>(y) + 0.5)) {
        indices[static_cast<size_t>(y) * static_cast<size_t>(imageSize) +
                static_cast<size_t>(x)] = value;
      }
    }
  }
}

void fillRegularPolygon(std::vector<uint8_t> &indices, int imageSize,
                        double centerX, double centerY, double radius,
                        int sides, double rotation, uint8_t value) {
  std::vector<std::pair<double, double>> points;
  points.reserve(static_cast<size_t>(sides));
  for (int index = 0; index < sides; index++) {
    const double angle = rotation + Pi * 2.0 * static_cast<double>(index) /
                                        static_cast<double>(sides);
    points.emplace_back(centerX + std::cos(angle) * radius,
                        centerY + std::sin(angle) * radius);
  }
  fillPolygon(indices, imageSize, points, value);
}

void fillStar(std::vector<uint8_t> &indices, int imageSize, double centerX,
              double centerY, double radius, uint8_t value) {
  std::vector<std::pair<double, double>> points;
  points.reserve(10);
  for (int index = 0; index < 10; index++) {
    const double angle =
        -Pi / 2.0 + Pi * 2.0 * static_cast<double>(index) / 10.0;
    const double pointRadius = index % 2 == 0 ? radius : radius * 0.48;
    points.emplace_back(centerX + std::cos(angle) * pointRadius,
                        centerY + std::sin(angle) * pointRadius);
  }
  fillPolygon(indices, imageSize, points, value);
}

void fillScallop(std::vector<uint8_t> &indices, int imageSize, double centerX,
                 double centerY, double radius, int lobes, uint8_t value) {
  std::vector<std::pair<double, double>> points;
  points.reserve(static_cast<size_t>(lobes * 2));
  for (int index = 0; index < lobes * 2; index++) {
    const double angle = -Pi / 2.0 + Pi * 2.0 * static_cast<double>(index) /
                                         static_cast<double>(lobes * 2);
    const double pointRadius = index % 2 == 0 ? radius : radius * 0.82;
    points.emplace_back(centerX + std::cos(angle) * pointRadius,
                        centerY + std::sin(angle) * pointRadius);
  }
  fillPolygon(indices, imageSize, points, value);
}

void drawModule(std::vector<uint8_t> &indices, int imageSize, int x0, int y0,
                int x1, int y1, ModuleShape shape, int gap, int cornerRadius,
                uint8_t value = 1) {
  const int maxGap = std::max(0, (std::min(x1 - x0, y1 - y0) - 1) / 2);
  const int inset = std::min(gap, maxGap);
  x0 += inset;
  y0 += inset;
  x1 -= inset;
  y1 -= inset;

  if (shape == ModuleShape::Circle) {
    fillCircle(indices, imageSize, x0, y0, x1, y1, value);
    return;
  }
  if (shape == ModuleShape::Rounded) {
    const int resolvedRadius =
        cornerRadius < 0 ? std::min(x1 - x0, y1 - y0) / 3 : cornerRadius;
    fillRoundedRect(indices, imageSize, x0, y0, x1, y1, resolvedRadius, value);
    return;
  }
  if (shape == ModuleShape::Square && cornerRadius >= 0) {
    fillRoundedRect(indices, imageSize, x0, y0, x1, y1, cornerRadius, value);
    return;
  }
  const double left = static_cast<double>(x0);
  const double top = static_cast<double>(y0);
  const double width = static_cast<double>(x1 - x0);
  const double height = static_cast<double>(y1 - y0);
  const double centerX = left + width / 2.0;
  const double centerY = top + height / 2.0;
  const double radius = std::min(width, height) / 2.0;
  if (shape == ModuleShape::Diamond) {
    fillPolygon(indices, imageSize,
                {{centerX, top},
                 {left + width, centerY},
                 {centerX, top + height},
                 {left, centerY}},
                value);
    return;
  }
  if (shape == ModuleShape::Hexagon || shape == ModuleShape::Octagon) {
    fillRegularPolygon(indices, imageSize, centerX, centerY, radius,
                       shape == ModuleShape::Hexagon ? 6 : 8, -Pi / 2.0, value);
    return;
  }
  if (shape == ModuleShape::Star) {
    fillStar(indices, imageSize, centerX, centerY, radius, value);
    return;
  }
  if (shape == ModuleShape::Heart) {
    fillPolygon(indices, imageSize,
                {{centerX, top + height * 0.9},
                 {left + width * 0.08, top + height * 0.48},
                 {left + width * 0.18, top + height * 0.12},
                 {left + width * 0.38, top + height * 0.12},
                 {centerX, top + height * 0.3},
                 {left + width * 0.62, top + height * 0.12},
                 {left + width * 0.82, top + height * 0.12},
                 {left + width * 0.92, top + height * 0.48}},
                value);
    return;
  }
  if (shape == ModuleShape::Scallop || shape == ModuleShape::Clover) {
    fillScallop(indices, imageSize, centerX, centerY, radius,
                shape == ModuleShape::Clover ? 4 : 12, value);
    return;
  }
  if (shape == ModuleShape::Leaf) {
    fillPolygon(indices, imageSize,
                {{left + width, top},
                 {left + width * 0.86, top + height},
                 {left, top + height},
                 {left + width * 0.14, top}},
                value);
    return;
  }
  fillRect(indices, imageSize, x0, y0, x1, y1, value);
}

void drawFinderCircleBorder(std::vector<uint8_t> &indices, int imageSize,
                            int moduleX, int moduleY, int quietZone,
                            int totalModules) {
  const auto modulePosition = [imageSize, quietZone, totalModules](int module,
                                                                   int offset) {
    return ((module + quietZone + offset) * imageSize) / totalModules;
  };

  fillCircle(indices, imageSize, modulePosition(moduleX, 0),
             modulePosition(moduleY, 0), modulePosition(moduleX, 7),
             modulePosition(moduleY, 7), 4);
  fillCircle(indices, imageSize, modulePosition(moduleX, 1),
             modulePosition(moduleY, 1), modulePosition(moduleX, 6),
             modulePosition(moduleY, 6), 3);
  fillCircle(indices, imageSize, modulePosition(moduleX, 2),
             modulePosition(moduleY, 2), modulePosition(moduleX, 5),
             modulePosition(moduleY, 5), 0);
  fillCircle(indices, imageSize, modulePosition(moduleX, 3),
             modulePosition(moduleY, 3), modulePosition(moduleX, 4),
             modulePosition(moduleY, 4), 5);
}

void drawFinderCircleBorders(std::vector<uint8_t> &indices, int imageSize,
                             int matrixSize, int quietZone, int totalModules) {
  drawFinderCircleBorder(indices, imageSize, 0, 0, quietZone, totalModules);
  drawFinderCircleBorder(indices, imageSize, matrixSize - 7, 0, quietZone,
                         totalModules);
  drawFinderCircleBorder(indices, imageSize, 0, matrixSize - 7, quietZone,
                         totalModules);
}

void fillFinderShape(std::vector<uint8_t> &indices, int imageSize, int x0,
                     int y0, int x1, int y1, ModuleShape shape,
                     int cornerRadius, uint8_t value) {
  if (shape == ModuleShape::Circle) {
    fillCircle(indices, imageSize, x0, y0, x1, y1, value);
    return;
  }
  if (shape == ModuleShape::Rounded || cornerRadius >= 0) {
    fillRoundedRect(indices, imageSize, x0, y0, x1, y1,
                    cornerRadius >= 0 ? cornerRadius
                                      : std::max(1, (x1 - x0) / 5),
                    value);
    return;
  }
  fillRect(indices, imageSize, x0, y0, x1, y1, value);
}

void drawGroupedFinder(std::vector<uint8_t> &indices, int imageSize,
                       int moduleX, int moduleY, int quietZone,
                       int totalModules, ModuleShape frameShape,
                       ModuleShape eyeballShape, int cornerRadius,
                       bool useEyeStrokeLayer) {
  const auto modulePosition = [imageSize, quietZone,
                               totalModules](int module, double offset) {
    return static_cast<int>(
        std::round(((static_cast<double>(module + quietZone) + offset) *
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
  drawShape(0.0, 7.0, frameShape, useEyeStrokeLayer ? 4 : 3);
  if (useEyeStrokeLayer) {
    drawShape(strokeInset, 7.0 - strokeInset * 2.0, frameShape, 3);
  }
  drawShape(1.0, 5.0, frameShape, 0);
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
  drawShape(eyeballOffset, eyeballSpan, eyeballShape, 5);
}

void drawGroupedFinders(std::vector<uint8_t> &indices, int imageSize,
                        int matrixSize, int quietZone, int totalModules,
                        ModuleShape frameShape, ModuleShape eyeballShape,
                        int cornerRadius, bool useEyeStrokeLayer) {
  drawGroupedFinder(indices, imageSize, 0, 0, quietZone, totalModules,
                    frameShape, eyeballShape, cornerRadius, useEyeStrokeLayer);
  drawGroupedFinder(indices, imageSize, matrixSize - 7, 0, quietZone,
                    totalModules, frameShape, eyeballShape, cornerRadius,
                    useEyeStrokeLayer);
  drawGroupedFinder(indices, imageSize, 0, matrixSize - 7, quietZone,
                    totalModules, frameShape, eyeballShape, cornerRadius,
                    useEyeStrokeLayer);
}

void drawRadialDot(std::vector<uint8_t> &indices, int imageSize, double center,
                   double radius, double lineWidth, double angle,
                   uint8_t value) {
  const double dotRadius = std::max(0.5, lineWidth / 2.0);
  const double dotCenterX = center + std::cos(angle) * radius;
  const double dotCenterY = center + std::sin(angle) * radius;
  fillCircle(indices, imageSize,
             static_cast<int>(std::floor(dotCenterX - dotRadius)),
             static_cast<int>(std::floor(dotCenterY - dotRadius)),
             static_cast<int>(std::ceil(dotCenterX + dotRadius)),
             static_cast<int>(std::ceil(dotCenterY + dotRadius)), value);
}

void drawRadialCapsule(std::vector<uint8_t> &indices, int imageSize,
                       double center, double radius, double length,
                       double width, double angle, uint8_t value) {
  const double halfLength = std::max(width / 2.0, length / 2.0);
  const double halfWidth = width / 2.0;
  const double axisX = std::cos(angle);
  const double axisY = std::sin(angle);
  const double capsuleCenterX = center + axisX * radius;
  const double capsuleCenterY = center + axisY * radius;
  const double startX = capsuleCenterX - axisX * halfLength;
  const double startY = capsuleCenterY - axisY * halfLength;
  const double endX = capsuleCenterX + axisX * halfLength;
  const double endY = capsuleCenterY + axisY * halfLength;
  const int minX = std::max(
      0, static_cast<int>(std::floor(std::min(startX, endX) - halfWidth)));
  const int maxX =
      std::min(imageSize - 1,
               static_cast<int>(std::ceil(std::max(startX, endX) + halfWidth)));
  const int minY = std::max(
      0, static_cast<int>(std::floor(std::min(startY, endY) - halfWidth)));
  const int maxY =
      std::min(imageSize - 1,
               static_cast<int>(std::ceil(std::max(startY, endY) + halfWidth)));

  for (int y = minY; y <= maxY; y++) {
    for (int x = minX; x <= maxX; x++) {
      const double pixelX = static_cast<double>(x) + 0.5;
      const double pixelY = static_cast<double>(y) + 0.5;
      const double projection =
          std::clamp((pixelX - startX) * axisX + (pixelY - startY) * axisY, 0.0,
                     halfLength * 2.0);
      const double nearestX = startX + axisX * projection;
      const double nearestY = startY + axisY * projection;
      if (std::hypot(pixelX - nearestX, pixelY - nearestY) <= halfWidth) {
        indices[static_cast<size_t>(y) * static_cast<size_t>(imageSize) +
                static_cast<size_t>(x)] = value;
      }
    }
  }
}

void drawRadialFinderMarker(std::vector<uint8_t> &indices, int imageSize,
                            double center, double distance, double angle,
                            double radius) {
  const double markerCenterX = center + std::cos(angle) * distance;
  const double markerCenterY = center + std::sin(angle) * distance;
  const auto drawCircle = [&](double scale, uint8_t value) {
    const double scaledRadius = std::max(0.5, radius * scale);
    fillCircle(indices, imageSize,
               static_cast<int>(std::floor(markerCenterX - scaledRadius)),
               static_cast<int>(std::floor(markerCenterY - scaledRadius)),
               static_cast<int>(std::ceil(markerCenterX + scaledRadius)),
               static_cast<int>(std::ceil(markerCenterY + scaledRadius)),
               value);
  };

  drawCircle(1.0, 4);
  drawCircle(0.82, 3);
  drawCircle(0.62, 0);
  drawCircle(0.34, 5);
}

void drawRadialFinderMarkers(std::vector<uint8_t> &indices, int imageSize,
                             double center, double outerRadius,
                             double innerRadius, double ringStep) {
  const double preferredDistance = (outerRadius + innerRadius) / 2.0;
  const double minDistance = innerRadius + ringStep * 4.0;
  const double maxDistance = outerRadius - ringStep * 4.0;
  const double markerDistance =
      std::clamp(preferredDistance, std::min(minDistance, maxDistance),
                 std::max(minDistance, maxDistance));
  const double markerRadius = std::max(3.0, ringStep * 3.0);
  drawRadialFinderMarker(indices, imageSize, center, markerDistance, -2.45,
                         markerRadius);
  drawRadialFinderMarker(indices, imageSize, center, markerDistance, -0.7,
                         markerRadius);
  drawRadialFinderMarker(indices, imageSize, center, markerDistance, 2.35,
                         markerRadius);
}

void drawRadialMatrix(std::vector<uint8_t> &indices, int imageSize,
                      const Matrix &matrix, const GenerateOptions &options) {
  const double center = static_cast<double>(imageSize) / 2.0;
  const double outerRadius =
      std::max(0.0, center - static_cast<double>(options.quietZone));
  const double logoRadius =
      options.logoAreaSize > 0
          ? std::min(static_cast<double>(options.logoAreaSize) / 2.0, center)
          : 0.0;
  const double innerRadius = std::max(
      logoRadius + static_cast<double>(options.quietZone), outerRadius * 0.16);
  const double ringStep =
      (outerRadius - innerRadius) / static_cast<double>(matrix.size);
  if (ringStep <= 0.0) {
    return;
  }

  const ModuleShape moduleShape = parseShape(options.moduleShape, "shape");
  const ModuleShape eyePatternShape =
      parseEyePatternShape(options.eyePatternShape);
  const ModuleShape eyeballShape = parseEyeballShape(options.eyeballShape);
  const bool drawCircleBorderEyes =
      eyePatternShape == ModuleShape::CircleBorder;
  const double segment = Pi * 2.0 / static_cast<double>(matrix.size);
  for (int moduleY = 0; moduleY < matrix.size; moduleY++) {
    const double radius =
        outerRadius - (static_cast<double>(moduleY) + 0.5) * ringStep;
    const double lineWidth =
        std::max(1.0, ringStep - static_cast<double>(options.gap) * 2.0);
    for (int moduleX = 0; moduleX < matrix.size; moduleX++) {
      const bool dark = matrix.modules[static_cast<size_t>(moduleY) *
                                           static_cast<size_t>(matrix.size) +
                                       static_cast<size_t>(moduleX)] == 1;
      if (drawCircleBorderEyes && isEyeModule(moduleX, moduleY, matrix.size)) {
        continue;
      }
      const bool decorativeDot = !dark && moduleShape == ModuleShape::Rounded &&
                                 drawCircleBorderEyes &&
                                 ((moduleX * 5 + moduleY * 3) % 11 == 0);
      if (!dark && !decorativeDot) {
        continue;
      }

      const double gapAngle =
          radius <= 0.0 ? 0.0
                        : std::min(segment * 0.42,
                                   static_cast<double>(options.gap) / radius);
      const double startAngle =
          -Pi / 2.0 + static_cast<double>(moduleX) * segment + gapAngle;
      const double endAngle =
          -Pi / 2.0 + static_cast<double>(moduleX + 1) * segment - gapAngle;
      const double angle = (startAngle + endAngle) / 2.0;
      const bool eyeModule = isEyeModule(moduleX, moduleY, matrix.size);
      const bool eyeballModule = isEyeBallModule(moduleX, moduleY, matrix.size);
      const ModuleShape drawShape = eyeballModule ? eyeballShape : moduleShape;
      uint8_t layer = 1;
      if (dark && eyeModule) {
        if (eyeballModule) {
          layer = 5;
        } else if (isEyeOuterStrokeModule(moduleX, moduleY, matrix.size) &&
                   options.eyeStrokeColor != "#000000") {
          layer = 4;
        } else {
          layer = 3;
        }
      }
      const double strokeExpansion = std::max(1.0, ringStep * 0.35);
      const auto drawCurrentModule = [&](uint8_t value, double expansion) {
        if (decorativeDot) {
          drawRadialDot(indices, imageSize, center, radius,
                        std::max(2.0, ringStep * 0.62) + expansion * 2.0, angle,
                        value);
        } else if (drawShape == ModuleShape::Circle) {
          drawRadialDot(indices, imageSize, center, radius,
                        lineWidth + expansion * 2.0, angle, value);
        } else if (drawShape == ModuleShape::Rounded) {
          const double capsuleWidth =
              std::max(4.0, std::min(ringStep * 1.1, radius * segment * 0.42)) +
              expansion * 2.0;
          const double capsuleLength =
              std::max(capsuleWidth, ringStep * 1.6) + expansion * 2.0;
          drawRadialCapsule(indices, imageSize, center, radius, capsuleLength,
                            capsuleWidth, angle, value);
        } else {
          const double capsuleWidth =
              std::max(3.0, std::min(ringStep * 0.9, radius * segment * 0.36)) +
              expansion * 2.0;
          const double capsuleLength =
              std::max(capsuleWidth, ringStep * 1.55) + expansion * 2.0;
          drawRadialCapsule(indices, imageSize, center, radius, capsuleLength,
                            capsuleWidth, angle, value);
        }
      };
      if (dark && !eyeModule && options.strokeColor != "#000000") {
        drawCurrentModule(2, strokeExpansion);
      }
      drawCurrentModule(layer, 0.0);
    }
  }

  if (drawCircleBorderEyes) {
    drawRadialFinderMarkers(indices, imageSize, center, outerRadius,
                            innerRadius, ringStep);
  }
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
                  logoAreaBorderRadius, 0);
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

uint32_t crc32(const uint8_t *data, size_t size) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < size; i++) {
    crc ^= data[i];
    for (int bit = 0; bit < 8; bit++) {
      crc = (crc >> 1) ^ (CrcPolynomial & (0U - (crc & 1U)));
    }
  }
  return crc ^ 0xFFFFFFFF;
}

uint32_t adler32(const std::vector<uint8_t> &bytes) {
  uint32_t a = 1;
  uint32_t b = 0;
  for (uint8_t byte : bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

void appendChunk(std::vector<uint8_t> &png, const char *type,
                 const std::vector<uint8_t> &data) {
  writeU32(png, static_cast<uint32_t>(data.size()));
  const size_t crcStart = png.size();
  png.insert(png.end(), type, type + 4);
  png.insert(png.end(), data.begin(), data.end());
  writeU32(png, crc32(png.data() + crcStart, png.size() - crcStart));
}

std::vector<uint8_t> zlibStore(const std::vector<uint8_t> &data) {
  std::vector<uint8_t> output;
  output.reserve(data.size() + (data.size() / 65535 + 1) * 5 + 6);
  output.push_back(0x78);
  output.push_back(0x01);

  size_t offset = 0;
  while (offset < data.size()) {
    const size_t remaining = data.size() - offset;
    const uint16_t blockSize =
        static_cast<uint16_t>(std::min<size_t>(remaining, 65535));
    const bool finalBlock = offset + blockSize == data.size();
    output.push_back(finalBlock ? 0x01 : 0x00);
    output.push_back(static_cast<uint8_t>(blockSize & 0xFF));
    output.push_back(static_cast<uint8_t>((blockSize >> 8) & 0xFF));
    const uint16_t nlen = static_cast<uint16_t>(~blockSize);
    output.push_back(static_cast<uint8_t>(nlen & 0xFF));
    output.push_back(static_cast<uint8_t>((nlen >> 8) & 0xFF));
    output.insert(
        output.end(), data.begin() + static_cast<std::ptrdiff_t>(offset),
        data.begin() + static_cast<std::ptrdiff_t>(offset + blockSize));
    offset += blockSize;
  }

  writeU32(output, adler32(data));
  return output;
}

std::vector<uint8_t> encodePngIndexed1(int width, int height,
                                       const std::vector<uint8_t> &indices,
                                       const Color &foreground,
                                       const Color &background) {
  const size_t rowBytes = (static_cast<size_t>(width) + 7) / 8;
  std::vector<uint8_t> raw;
  raw.reserve((rowBytes + 1) * static_cast<size_t>(height));

  for (int y = 0; y < height; y++) {
    raw.push_back(0);
    const size_t rowOutputStart = raw.size();
    raw.resize(raw.size() + rowBytes, 0);
    const size_t rowStart = static_cast<size_t>(y) * static_cast<size_t>(width);
    for (int x = 0; x < width; x++) {
      if (indices[rowStart + static_cast<size_t>(x)] != 0) {
        const size_t byteIndex = rowOutputStart + static_cast<size_t>(x / 8);
        raw[byteIndex] = static_cast<uint8_t>(
            raw[byteIndex] | (1U << (7U - (static_cast<unsigned>(x) % 8U))));
      }
    }
  }

  std::vector<uint8_t> png = {137, 80, 78, 71, 13, 10, 26, 10};
  std::vector<uint8_t> ihdr;
  writeU32(ihdr, static_cast<uint32_t>(width));
  writeU32(ihdr, static_cast<uint32_t>(height));
  ihdr.push_back(1);
  ihdr.push_back(3);
  ihdr.push_back(0);
  ihdr.push_back(0);
  ihdr.push_back(0);
  appendChunk(png, "IHDR", ihdr);

  const std::vector<uint8_t> palette = {
      background.r, background.g, background.b,
      foreground.r, foreground.g, foreground.b,
  };
  appendChunk(png, "PLTE", palette);
  appendChunk(png, "tRNS", {background.a, foreground.a});
  appendChunk(png, "IDAT", zlibStore(raw));
  appendChunk(png, "IEND", {});
  return png;
}

} // namespace

Color parseColor(const std::string &value) {
  if (value.size() != 7 && value.size() != 9) {
    throw std::invalid_argument("Color must be #RRGGBB or #RRGGBBAA.");
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
  const size_t expectedSize =
      static_cast<size_t>(width) * static_cast<size_t>(height) * 4;
  if (rgba.size() != expectedSize) {
    throw std::invalid_argument(
        "RGBA buffer size does not match PNG dimensions.");
  }

  std::vector<uint8_t> raw;
  raw.reserve((static_cast<size_t>(width) * 4 + 1) *
              static_cast<size_t>(height));
  for (int y = 0; y < height; y++) {
    raw.push_back(0);
    const size_t rowStart =
        static_cast<size_t>(y) * static_cast<size_t>(width) * 4;
    raw.insert(raw.end(), rgba.begin() + static_cast<std::ptrdiff_t>(rowStart),
               rgba.begin() + static_cast<std::ptrdiff_t>(
                                  rowStart + static_cast<size_t>(width) * 4));
  }

  std::vector<uint8_t> png = {137, 80, 78, 71, 13, 10, 26, 10};
  std::vector<uint8_t> ihdr;
  writeU32(ihdr, static_cast<uint32_t>(width));
  writeU32(ihdr, static_cast<uint32_t>(height));
  ihdr.push_back(8);
  ihdr.push_back(6);
  ihdr.push_back(0);
  ihdr.push_back(0);
  ihdr.push_back(0);
  appendChunk(png, "IHDR", ihdr);
  appendChunk(png, "IDAT", zlibStore(raw));
  appendChunk(png, "IEND", {});
  return png;
}

Matrix QRCodeGenerator::createMatrix(const std::string &value,
                                     const GenerateOptions &options) const {
  validateOptions(value, options);
  const auto qr = qrcodegen::QrCode::encodeSegments(
      qrcodegen::QrSegment::makeSegments(value.c_str()),
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

std::string QRCodeGenerator::generatePngBase64(const std::string &value,
                                               const GenerateOptions &options) {
  const std::string key = cacheKey(value, options, "png-base64");
  if (const auto cached = getCacheEntry(key)) {
    return *cached;
  }

  const Matrix matrix = createMatrix(value, options);
  const int totalModules = matrix.size + options.quietZone * 2;
  const int imageSize = std::max(options.size, totalModules);
  std::vector<uint8_t> indices(static_cast<size_t>(imageSize) *
                               static_cast<size_t>(imageSize));
  if (options.layout == "radial") {
    drawRadialMatrix(indices, imageSize, matrix, options);
    clearLogoArea(indices, imageSize, options.logoAreaSize,
                  options.logoAreaBorderRadius);
    const std::string encoded =
        hasGradient(options) || hasCustomLayerColors(options)
            ? base64Encode(
                  encodePngRgba(imageSize, imageSize,
                                renderLayeredRgba(indices, imageSize, options)))
            : base64Encode(encodePngIndexed1(imageSize, imageSize, indices,
                                             options.foreground,
                                             options.background));
    storeCacheEntry(key, encoded);
    return encoded;
  }

  const ModuleShape moduleShape = parseShape(options.moduleShape, "shape");
  const ModuleShape eyePatternShape =
      parseEyePatternShape(options.eyePatternShape);
  const ModuleShape eyeballShape = parseEyeballShape(options.eyeballShape);
  const bool drawCircleBorderEyes =
      eyePatternShape == ModuleShape::CircleBorder;
  const bool useCustomFinderColors =
      options.eyeColor != "#000000" || options.eyeStrokeColor != "#000000" ||
      options.eyeballColor != "#000000";
  const bool drawGroupedFinderEyes =
      eyePatternShape != ModuleShape::Square ||
      eyeballShape != ModuleShape::Square || useCustomFinderColors;

  for (int moduleY = 0; moduleY < matrix.size; moduleY++) {
    const int y0 = ((moduleY + options.quietZone) * imageSize) / totalModules;
    const int y1 =
        ((moduleY + options.quietZone + 1) * imageSize) / totalModules;
    for (int moduleX = 0; moduleX < matrix.size; moduleX++) {
      const bool dark = matrix.modules[static_cast<size_t>(moduleY) *
                                           static_cast<size_t>(matrix.size) +
                                       static_cast<size_t>(moduleX)] == 1;
      if (!dark) {
        continue;
      }
      const bool eyeModule = isEyeModule(moduleX, moduleY, matrix.size);
      if ((drawCircleBorderEyes || drawGroupedFinderEyes) && eyeModule) {
        continue;
      }

      const int x0 = ((moduleX + options.quietZone) * imageSize) / totalModules;
      const int x1 =
          ((moduleX + options.quietZone + 1) * imageSize) / totalModules;
      const bool eyeballModule = isEyeBallModule(moduleX, moduleY, matrix.size);
      const ModuleShape shape =
          eyeballModule ? eyeballShape
                        : (eyeModule ? eyePatternShape : moduleShape);
      const int gap = eyeModule ? options.eyePatternGap : options.gap;
      const int radius =
          eyeModule ? options.eyePatternCornerRadius : options.cornerRadius;
      uint8_t layer = 1;
      if (eyeModule) {
        if (eyeballModule) {
          layer = 5;
        } else {
          layer = 3;
        }
      }
      if (!eyeModule && options.strokeColor != "#000000") {
        drawModule(indices, imageSize, x0, y0, x1, y1, shape, gap, radius, 2);
        const int strokeInset = std::max(1, (x1 - x0) / 5);
        drawModule(indices, imageSize, x0, y0, x1, y1, shape, gap + strokeInset,
                   radius, 1);
        continue;
      }
      drawModule(indices, imageSize, x0, y0, x1, y1, shape, gap, radius, layer);
    }
  }
  if (drawCircleBorderEyes) {
    drawFinderCircleBorders(indices, imageSize, matrix.size, options.quietZone,
                            totalModules);
  } else if (drawGroupedFinderEyes) {
    drawGroupedFinders(indices, imageSize, matrix.size, options.quietZone,
                       totalModules, eyePatternShape, eyeballShape,
                       options.eyePatternCornerRadius,
                       options.eyeStrokeColor != "#000000");
  }
  clearLogoArea(indices, imageSize, options.logoAreaSize,
                options.logoAreaBorderRadius);

  const std::string encoded =
      hasGradient(options) || hasCustomLayerColors(options)
          ? base64Encode(
                encodePngRgba(imageSize, imageSize,
                              renderLayeredRgba(indices, imageSize, options)))
          : base64Encode(encodePngIndexed1(imageSize, imageSize, indices,
                                           options.foreground,
                                           options.background));
  storeCacheEntry(key, encoded);
  return encoded;
}

std::string
QRCodeGenerator::generatePngDataUri(const std::string &value,
                                    const GenerateOptions &options) {
  return "data:image/png;base64," + generatePngBase64(value, options);
}

std::string QRCodeGenerator::generateSvgString(const std::string &value,
                                               const GenerateOptions &options) {
  const std::string key = cacheKey(value, options, "svg");
  if (const auto cached = getCacheEntry(key)) {
    return *cached;
  }

  const Matrix matrix = createMatrix(value, options);
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
  svg << createSvgGradient(options);
  svg << "<path fill=\"" << options.backgroundColor << "\" d=\"M0,0h"
      << totalSize << "v" << totalSize << "H0z\"/>";
  svg << "<path fill=\""
      << (hasGradient(options) ? "url(#nitro-qrcode-gradient)"
                               : options.foregroundColor)
      << "\" d=\"" << path.str() << "\"/>";
  svg << "</svg>";

  const std::string output = svg.str();
  storeCacheEntry(key, output);
  return output;
}

std::string
QRCodeGenerator::getMatrixPackedBase64(const std::string &value,
                                       const GenerateOptions &options) {
  const Matrix matrix = createMatrix(value, options);
  std::vector<uint8_t> packed((matrix.modules.size() + 7) / 8);
  for (size_t i = 0; i < matrix.modules.size(); i++) {
    if (matrix.modules[i] == 1) {
      packed[i / 8] =
          static_cast<uint8_t>(packed[i / 8] | (1U << (7U - (i % 8U))));
    }
  }
  return base64Encode(packed);
}

int QRCodeGenerator::getMatrixSize(const std::string &value,
                                   const GenerateOptions &options) {
  return createMatrix(value, options).size;
}

void QRCodeGenerator::clearCache() {
  std::lock_guard<std::mutex> lock(cacheMutex_);
  cache_.clear();
  cacheOrder_.clear();
}

size_t QRCodeGenerator::getCacheSize() const {
  std::lock_guard<std::mutex> lock(cacheMutex_);
  return cache_.size();
}

std::string QRCodeGenerator::cacheKey(const std::string &value,
                                      const GenerateOptions &options,
                                      const std::string &output) const {
  std::string gradientColors;
  for (const auto &color : options.gradient.colors) {
    gradientColors += std::to_string(color.r) + "," + std::to_string(color.g) +
                      "," + std::to_string(color.b) + "," +
                      std::to_string(color.a) + ";";
  }

  std::string gradientLocations;
  for (double location : options.gradient.locations) {
    gradientLocations += std::to_string(location) + ";";
  }

  return output + "|" + value + "|" + std::to_string(options.size) + "|" +
         std::to_string(options.quietZone) + "|" +
         options.errorCorrectionLevel + "|" +
         std::to_string(options.foreground.r) + "," +
         std::to_string(options.foreground.g) + "," +
         std::to_string(options.foreground.b) + "," +
         std::to_string(options.foreground.a) + "|" +
         std::to_string(options.background.r) + "," +
         std::to_string(options.background.g) + "," +
         std::to_string(options.background.b) + "," +
         std::to_string(options.background.a) + "|" + options.strokeColor +
         "|" + options.eyeColor + "|" + options.eyeStrokeColor + "|" +
         options.eyeballColor + "|" + std::to_string(options.minVersion) + "|" +
         std::to_string(options.maxVersion) + "|" +
         std::to_string(options.mask) + "|" + std::to_string(options.boostEcl) +
         "|" + options.moduleShape + "|" + options.eyePatternShape + "|" +
         std::to_string(options.gap) + "|" +
         std::to_string(options.eyePatternGap) + "|" + options.eyeballShape +
         "|" + std::to_string(options.cornerRadius) + "|" +
         std::to_string(options.eyePatternCornerRadius) + "|" + options.layout +
         "|" + std::to_string(options.logoAreaSize) + "|" +
         std::to_string(options.logoAreaBorderRadius) + "|" +
         options.gradient.type + "|" + gradientColors + "|" +
         gradientLocations + "|" + std::to_string(options.gradient.startX) +
         "|" + std::to_string(options.gradient.startY) + "|" +
         std::to_string(options.gradient.endX) + "|" +
         std::to_string(options.gradient.endY);
}

std::optional<std::string>
QRCodeGenerator::getCacheEntry(const std::string &key) const {
  std::lock_guard<std::mutex> lock(cacheMutex_);
  const auto cached = cache_.find(key);
  if (cached == cache_.end()) {
    return std::nullopt;
  }

  const auto order = std::find(cacheOrder_.begin(), cacheOrder_.end(), key);
  if (order != cacheOrder_.end()) {
    cacheOrder_.erase(order);
  }
  cacheOrder_.push_back(key);
  return cached->second;
}

void QRCodeGenerator::storeCacheEntry(const std::string &key,
                                      const std::string &value) {
  std::lock_guard<std::mutex> lock(cacheMutex_);
  cache_[key] = value;
  const auto order = std::find(cacheOrder_.begin(), cacheOrder_.end(), key);
  if (order != cacheOrder_.end()) {
    cacheOrder_.erase(order);
  }
  cacheOrder_.push_back(key);
  while (cacheOrder_.size() > MaxCacheEntries) {
    cache_.erase(cacheOrder_.front());
    cacheOrder_.pop_front();
  }
}

} // namespace NitroQRCode
