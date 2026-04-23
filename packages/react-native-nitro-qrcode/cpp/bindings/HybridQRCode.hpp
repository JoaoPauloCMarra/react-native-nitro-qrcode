#pragma once

#include "HybridQRCodeSpec.hpp"
#include "../core/QRCodeGenerator.hpp"

#include <mutex>
#include <string>
#include <vector>

namespace margelo::nitro::NitroQRCode {

class HybridQRCode : public HybridQRCodeSpec {
 public:
  HybridQRCode();
  ~HybridQRCode() override = default;

  std::string generatePngBase64(
      const std::string& value,
      double size,
      double quietZone,
      const std::string& errorCorrectionLevel,
      const std::string& foregroundColor,
      const std::string& backgroundColor,
      double minVersion,
      double maxVersion,
      double mask,
      bool boostEcl,
      const std::string& moduleShape,
      const std::string& eyePatternShape,
      double gap,
      double eyePatternGap,
      double logoAreaSize,
      double logoAreaBorderRadius,
      const std::string& gradientType,
      const std::vector<std::string>& gradientColors,
      const std::vector<double>& gradientLocations,
      double gradientStartX,
      double gradientStartY,
      double gradientEndX,
      double gradientEndY) override;

  std::string generatePngDataUri(
      const std::string& value,
      double size,
      double quietZone,
      const std::string& errorCorrectionLevel,
      const std::string& foregroundColor,
      const std::string& backgroundColor,
      double minVersion,
      double maxVersion,
      double mask,
      bool boostEcl,
      const std::string& moduleShape,
      const std::string& eyePatternShape,
      double gap,
      double eyePatternGap,
      double logoAreaSize,
      double logoAreaBorderRadius,
      const std::string& gradientType,
      const std::vector<std::string>& gradientColors,
      const std::vector<double>& gradientLocations,
      double gradientStartX,
      double gradientStartY,
      double gradientEndX,
      double gradientEndY) override;

  std::string generateSvgString(
      const std::string& value,
      double quietZone,
      const std::string& errorCorrectionLevel,
      const std::string& foregroundColor,
      const std::string& backgroundColor,
      double minVersion,
      double maxVersion,
      double mask,
      bool boostEcl,
      const std::string& gradientType,
      const std::vector<std::string>& gradientColors,
      const std::vector<double>& gradientLocations,
      double gradientStartX,
      double gradientStartY,
      double gradientEndX,
      double gradientEndY) override;

  std::string getMatrixPackedBase64(
      const std::string& value,
      const std::string& errorCorrectionLevel,
      double minVersion,
      double maxVersion,
      double mask,
      bool boostEcl) override;

  double getMatrixSize(
      const std::string& value,
      const std::string& errorCorrectionLevel,
      double minVersion,
      double maxVersion,
      double mask,
      bool boostEcl) override;

  void clearCache() override;
  double getCacheSize() override;

 private:
  ::NitroQRCode::QRCodeGenerator generator_;
  std::mutex mutex_;

  ::NitroQRCode::GenerateOptions makeOptions(
      double size,
      double quietZone,
      const std::string& errorCorrectionLevel,
      const std::string& foregroundColor,
      const std::string& backgroundColor,
      double minVersion,
      double maxVersion,
      double mask,
      bool boostEcl,
      const std::string& moduleShape = "square",
      const std::string& eyePatternShape = "square",
      double gap = 0,
      double eyePatternGap = 0,
      double logoAreaSize = 0,
      double logoAreaBorderRadius = 0,
      const std::string& gradientType = "none",
      const std::vector<std::string>& gradientColors = {},
      const std::vector<double>& gradientLocations = {},
      double gradientStartX = 0,
      double gradientStartY = 0,
      double gradientEndX = 1,
      double gradientEndY = 1) const;

  ::NitroQRCode::GenerateOptions makeMatrixOptions(
      const std::string& errorCorrectionLevel,
      double minVersion,
      double maxVersion,
      double mask,
      bool boostEcl) const;

  int toInt(double value, const char* name) const;
};

}  // namespace margelo::nitro::NitroQRCode
