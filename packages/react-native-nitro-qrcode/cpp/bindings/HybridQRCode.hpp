#pragma once

#include "../core/QRCodeGenerator.hpp"
#include "HybridQRCodeSpec.hpp"

#include <NitroModules/Promise.hpp>
#include <string>
#include <vector>

namespace margelo::nitro::NitroQRCode {

class HybridQRCode : public HybridQRCodeSpec {
public:
  HybridQRCode();
  ~HybridQRCode() override = default;

  std::string generatePngBase64Object(const GenerateOptions &options) override;

  std::shared_ptr<Promise<std::string>>
  generatePngBase64AsyncObject(const GenerateOptions &options) override;

  std::string generatePngDataUriObject(const GenerateOptions &options) override;

  std::shared_ptr<Promise<std::string>>
  generatePngDataUriAsyncObject(const GenerateOptions &options) override;

  std::string generateSvgString(
      const std::string &value, double quietZone,
      const std::string &errorCorrectionLevel,
      const std::string &foregroundColor, const std::string &backgroundColor,
      double minVersion, double maxVersion, double mask, bool boostEcl,
      const std::string &gradientType,
      const std::vector<std::string> &gradientColors,
      const std::vector<double> &gradientLocations, double gradientStartX,
      double gradientStartY, double gradientEndX, double gradientEndY) override;

  std::string getMatrixPackedBase64(const std::string &value,
                                    const std::string &errorCorrectionLevel,
                                    double minVersion, double maxVersion,
                                    double mask, bool boostEcl) override;

  double getMatrixSize(const std::string &value,
                       const std::string &errorCorrectionLevel,
                       double minVersion, double maxVersion, double mask,
                       bool boostEcl) override;

  MatrixObject getMatrixObject(const std::string &value,
                               const std::string &errorCorrectionLevel,
                               double minVersion, double maxVersion,
                               double mask, bool boostEcl) override;

  void clearCache() override;
  double getCacheSize() override;
  double getCacheBytes() override;
  size_t getExternalMemorySize() noexcept override;

private:
  ::NitroQRCode::QRCodeGenerator generator_;
  size_t memorySize() noexcept;

};

} // namespace margelo::nitro::NitroQRCode
