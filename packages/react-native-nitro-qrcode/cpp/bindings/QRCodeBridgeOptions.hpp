#pragma once

#include "../core/QRCodeGenerator.hpp"

#include <string>
#include <vector>

namespace margelo::nitro::NitroQRCode {

::NitroQRCode::GenerateOptions makeGenerateOptions(
    double size, double quietZone, const std::string &errorCorrectionLevel,
    const std::string &foregroundColor, const std::string &backgroundColor,
    const std::string &strokeColor, const std::string &eyeColor,
    const std::string &eyeStrokeColor, const std::string &eyeballColor,
    double minVersion, double maxVersion, double mask, bool boostEcl,
    const std::string &moduleShape = "square",
    const std::string &eyePatternShape = "square",
    const std::string &eyeballShape = "square", double gap = 0,
    double eyePatternGap = 0, const std::string &bodyDensity = "dense",
    double cornerRadius = -1, double eyePatternCornerRadius = -1,
    const std::string &layout = "matrix", double logoAreaSize = 0,
    double logoAreaBorderRadius = 0,
    const std::string &gradientType = "none",
    const std::vector<std::string> &gradientColors = {},
    const std::vector<double> &gradientLocations = {},
    double gradientStartX = 0, double gradientStartY = 0,
    double gradientEndX = 1, double gradientEndY = 1);

::NitroQRCode::GenerateOptions
makeMatrixOptions(const std::string &errorCorrectionLevel, double minVersion,
                  double maxVersion, double mask, bool boostEcl);

int toBridgeInt(double value, const char *name);

}
