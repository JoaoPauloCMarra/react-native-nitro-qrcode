#include "QRCodeGenerator.hpp"

#include <chrono>
#include <future>
#include <iostream>
#include <numeric>
#include <string>
#include <vector>

using NitroQRCode::base64Encode;
using NitroQRCode::GenerateOptions;
using NitroQRCode::parseColor;
using NitroQRCode::QRCodeGenerator;

namespace {

using Clock = std::chrono::steady_clock;

size_t checksum = 0;

template <typename Fn> void runBenchmark(const std::string &name, int runs, Fn fn) {
  const auto start = Clock::now();
  for (int index = 0; index < runs; index++) {
    checksum += fn(index);
  }
  const auto elapsed = Clock::now() - start;
  const auto totalMicros =
      std::chrono::duration_cast<std::chrono::microseconds>(elapsed).count();
  const double perRun = static_cast<double>(totalMicros) / runs;
  std::cout << name << "," << runs << "," << totalMicros << "," << perRun
            << std::endl;
}

GenerateOptions indexedOptions() {
  GenerateOptions options;
  options.size = 384;
  options.errorCorrectionLevel = "M";
  return options;
}

GenerateOptions gradientOptions() {
  GenerateOptions options = indexedOptions();
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#111111"), parseColor("#F5A623")};
  options.gradient.locations = {0.0, 1.0};
  return options;
}

} // namespace

int main() {
  constexpr int FastRuns = 1000;
  constexpr int RenderRuns = 200;
  constexpr int ParallelBatches = 50;

  QRCodeGenerator generator;
  const GenerateOptions indexed = indexedOptions();
  const GenerateOptions gradient = gradientOptions();

  std::cout << "benchmark,runs,total_us,avg_us" << std::endl;

  runBenchmark("matrix-size", FastRuns, [&](int index) {
    return static_cast<size_t>(generator.getMatrixSize(
        "https://example.com/matrix/" + std::to_string(index), indexed));
  });

  runBenchmark("matrix-packed-base64", FastRuns, [&](int index) {
    return generator
        .getMatrixPackedBase64(
            "https://example.com/packed/" + std::to_string(index), indexed)
        .size();
  });

  runBenchmark("indexed-png-cold", RenderRuns, [&](int index) {
    return generator
        .generatePngBase64(
            "https://example.com/indexed/" + std::to_string(index), indexed)
        .size();
  });

  generator.generatePngBase64("https://example.com/cache-hit", indexed);
  runBenchmark("indexed-png-cache-hit", FastRuns, [&](int) {
    return generator.generatePngBase64("https://example.com/cache-hit", indexed)
        .size();
  });

  runBenchmark("rgba-gradient-png-cold", RenderRuns, [&](int index) {
    return generator
        .generatePngBase64(
            "https://example.com/gradient/" + std::to_string(index), gradient)
        .size();
  });

  runBenchmark("svg-cold", RenderRuns, [&](int index) {
    return generator
        .generateSvgString(
            "https://example.com/svg/" + std::to_string(index), indexed)
        .size();
  });

  const std::vector<uint8_t> bytes(64 * 1024, 42);
  runBenchmark("base64-64kb", FastRuns, [&](int) {
    return base64Encode(bytes).size();
  });

  runBenchmark("parallel-indexed-png-cold", ParallelBatches, [&](int batch) {
    std::vector<std::future<std::string>> futures;
    futures.reserve(8);
    for (int index = 0; index < 8; index++) {
      futures.push_back(std::async(std::launch::async, [&generator, indexed,
                                                        batch, index]() {
        return generator.generatePngBase64(
            "https://example.com/parallel/" + std::to_string(batch) + "/" +
                std::to_string(index),
            indexed);
      }));
    }
    size_t total = 0;
    for (auto &future : futures) {
      total += future.get().size();
    }
    return total;
  });

  std::cerr << "checksum=" << checksum << std::endl;
  return 0;
}
