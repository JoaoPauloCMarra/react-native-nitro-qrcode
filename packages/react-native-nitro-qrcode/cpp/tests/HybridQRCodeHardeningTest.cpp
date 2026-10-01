#include "HybridQRCode.hpp"

#include <cassert>
#include <cmath>
#include <functional>
#include <future>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

using margelo::nitro::NitroQRCode::GenerateOptions;
using margelo::nitro::NitroQRCode::HybridQRCode;

namespace {

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

GenerateOptions makeOptions(const std::string &value = "hybrid-hardening") {
  return GenerateOptions(
      value, 424, 4, "M", "#000000", "#FFFFFF", std::nullopt, std::nullopt,
      std::nullopt, std::nullopt, 7, 40, -1, true, "square", "square", "square",
      0, 0, "dense", -1, -1, "matrix", 0, 0, "none", {}, {}, 0, 0, 1, 1,
      std::nullopt, std::nullopt, std::nullopt, std::nullopt, std::nullopt,
      std::nullopt);
}

void testObjectAbiOptionalLayerFields() {
  auto qrCode = std::make_shared<HybridQRCode>();
  const std::string base = qrCode->generatePngBase64Object(makeOptions());
  const std::vector<std::function<void(GenerateOptions &)>> setters = {
      [](GenerateOptions &o) { o.alignmentColor = "#FF0000"; },
      [](GenerateOptions &o) { o.timingColor = "#00FF00"; },
      [](GenerateOptions &o) { o.quietZoneColor = "#0000FF"; },
      [](GenerateOptions &o) { o.finderInnerColor = "#FFFF00"; },
      [](GenerateOptions &o) { o.alignmentShape = "circle"; },
      [](GenerateOptions &o) { o.timingShape = "diamond"; },
  };
  for (const auto &set : setters) {
    GenerateOptions options = makeOptions();
    set(options);
    const std::string output = qrCode->generatePngBase64Object(options);
    assert(output.rfind("iVBORw0KGgo", 0) == 0);
    assert(output != base);
  }

  const std::vector<std::function<void(GenerateOptions &)>> invalid = {
      [](GenerateOptions &o) { o.alignmentColor = "red"; },
      [](GenerateOptions &o) { o.timingColor = "#12345"; },
      [](GenerateOptions &o) { o.quietZoneColor = ""; },
      [](GenerateOptions &o) { o.finderInnerColor = "#GGGGGG"; },
      [](GenerateOptions &o) { o.alignmentShape = "star"; },
      [](GenerateOptions &o) { o.timingShape = ""; },
      [](GenerateOptions &o) { o.strokeColor = "nope"; },
      [](GenerateOptions &o) { o.eyeColor = "#1"; },
      [](GenerateOptions &o) { o.eyeStrokeColor = "#XYZXYZ"; },
      [](GenerateOptions &o) { o.eyeballColor = "#00000"; },
  };
  for (const auto &set : invalid) {
    GenerateOptions options = makeOptions();
    set(options);
    expectThrow<std::invalid_argument>(
        [&]() { qrCode->generatePngBase64Object(options); });
    expectThrow<std::invalid_argument>(
        [&]() { qrCode->generatePngArrayBufferObject(options); });
    expectThrow<std::invalid_argument>(
        [&]() { qrCode->generatePngDataUriObject(options); });
  }
  assert(qrCode->getCacheSize() == 7);
}

void testObjectAbiNumericCastsAtEveryField() {
  auto qrCode = std::make_shared<HybridQRCode>();
  const double nan = std::numeric_limits<double>::quiet_NaN();
  const double inf = std::numeric_limits<double>::infinity();
  const std::vector<double GenerateOptions::*> fields = {
      &GenerateOptions::size,         &GenerateOptions::quietZone,
      &GenerateOptions::minVersion,   &GenerateOptions::maxVersion,
      &GenerateOptions::mask,         &GenerateOptions::gap,
      &GenerateOptions::eyePatternGap, &GenerateOptions::cornerRadius,
      &GenerateOptions::eyePatternCornerRadius,
      &GenerateOptions::logoAreaSize, &GenerateOptions::logoAreaBorderRadius};
  for (const auto field : fields) {
    for (const double value : {nan, inf, -inf, 0.5, -1e12, 1e12}) {
      GenerateOptions options = makeOptions();
      options.*field = value;
      const std::string message = expectThrow<std::invalid_argument>(
          [&]() { qrCode->generatePngBase64Object(options); });
      assert(message.find("must be") != std::string::npos);
    }
  }
  for (const double value : {nan, inf, 0.5}) {
    expectThrow<std::invalid_argument>(
        [&]() { qrCode->getMatrixSize("matrix", "M", value, 40, -1, true); });
    expectThrow<std::invalid_argument>([&]() {
      qrCode->getMatrixPackedBase64("matrix", "M", 1, value, -1, true);
    });
    expectThrow<std::invalid_argument>(
        [&]() { qrCode->getMatrixObject("matrix", "M", 1, 40, value, true); });
    expectThrow<std::invalid_argument>([&]() {
      qrCode->generateSvgString("svg", value, "M", "#000000", "#FFFFFF", 1, 40,
                                -1, true, "none", {}, {}, 0, 0, 1, 1);
    });
  }
  assert(qrCode->getCacheSize() == 0);
}

void testAsyncObjectAbiRejectsThroughFuture() {
  auto qrCode = std::make_shared<HybridQRCode>();
  GenerateOptions badSize = makeOptions();
  badSize.size = std::numeric_limits<double>::quiet_NaN();
  auto base64 = qrCode->generatePngBase64AsyncObject(badSize);
  expectThrow<std::invalid_argument>([&]() { (void)base64->await().get(); });
  auto dataUri = qrCode->generatePngDataUriAsyncObject(badSize);
  expectThrow<std::invalid_argument>([&]() { (void)dataUri->await().get(); });
  auto buffer = qrCode->generatePngArrayBufferAsyncObject(badSize);
  expectThrow<std::invalid_argument>([&]() { (void)buffer->await().get(); });

  GenerateOptions tooLong = makeOptions(std::string(2954, 'a'));
  tooLong.errorCorrectionLevel = "L";
  tooLong.minVersion = 1;
  auto overflow = qrCode->generatePngBase64AsyncObject(tooLong);
  const std::string message =
      expectThrow<std::length_error>([&]() { (void)overflow->await().get(); });
  assert(message.rfind("Data length = ", 0) == 0);
  assert(qrCode->getCacheSize() == 0);
}

void testPositionalAsyncThrowsBeforePromise() {
  auto qrCode = std::make_shared<HybridQRCode>();
  const double nan = std::numeric_limits<double>::quiet_NaN();
  expectThrow<std::invalid_argument>([&]() {
    qrCode->generatePngBase64Async(
        "positional", nan, 4, "M", "#000000", "#FFFFFF", "#000000", "#000000",
        "#000000", "#000000", 1, 40, -1, true, "square", "square", "square", 0,
        0, "dense", -1, -1, "matrix", 0, 0, "none", {}, {}, 0, 0, 1, 1);
  });
  expectThrow<std::invalid_argument>([&]() {
    qrCode->generatePngDataUriAsync(
        "positional", 128, 4, "M", "bad", "#FFFFFF", "#000000", "#000000",
        "#000000", "#000000", 1, 40, -1, true, "square", "square", "square", 0,
        0, "dense", -1, -1, "matrix", 0, 0, "none", {}, {}, 0, 0, 1, 1);
  });
  auto deferred = qrCode->generatePngBase64Async(
      "", 128, 4, "M", "#000000", "#FFFFFF", "#000000", "#000000", "#000000",
      "#000000", 1, 40, -1, true, "square", "square", "square", 0, 0, "dense",
      -1, -1, "matrix", 0, 0, "none", {}, {}, 0, 0, 1, 1);
  expectThrow<std::invalid_argument>([&]() { (void)deferred->await().get(); });
}

void testAsyncKeepsInstanceAliveAfterRelease() {
  auto qrCode = std::make_shared<HybridQRCode>();
  auto pending = qrCode->generatePngBase64AsyncObject(makeOptions());
  std::weak_ptr<HybridQRCode> weak = qrCode;
  qrCode.reset();
  const std::string output = pending->await().get();
  assert(output.rfind("iVBORw0KGgo", 0) == 0);
  pending.reset();
  assert(weak.expired());
}

void testConcurrentAsyncCallsOnOneInstance() {
  auto qrCode = std::make_shared<HybridQRCode>();
  std::vector<std::shared_ptr<margelo::nitro::Promise<std::string>>> pending;
  for (int index = 0; index < 24; index++) {
    GenerateOptions options = makeOptions("parallel-" + std::to_string(index % 6));
    if (index % 3 == 0) {
      options.gradientType = "radial";
      options.gradientColors = {"#000000", "#333366"};
    }
    if (index % 4 == 0) {
      options.alignmentColor = "#AA0000";
    }
    pending.push_back(index % 2 == 0
                          ? qrCode->generatePngBase64AsyncObject(options)
                          : qrCode->generatePngDataUriAsyncObject(options));
    if (index % 8 == 7) {
      qrCode->clearCache();
    }
  }
  for (auto &promise : pending) {
    assert(!promise->await().get().empty());
  }
  assert(qrCode->getExternalMemorySize() <=
         ::NitroQRCode::QRCodeGenerator::MaxCombinedCacheBytes);
}

} // namespace

void runHybridQRCodeHardeningTests() {
  testObjectAbiOptionalLayerFields();
  testObjectAbiNumericCastsAtEveryField();
  testAsyncObjectAbiRejectsThroughFuture();
  testPositionalAsyncThrowsBeforePromise();
  testAsyncKeepsInstanceAliveAfterRelease();
  testConcurrentAsyncCallsOnOneInstance();
  std::cout << "HybridQRCode hardening tests passed" << std::endl;
}
