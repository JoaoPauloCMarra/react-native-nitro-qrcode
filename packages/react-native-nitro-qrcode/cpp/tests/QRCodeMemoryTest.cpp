#include "BoundedCache.hpp"
#include "QRCodeGenerator.hpp"

#include <algorithm>
#include <atomic>
#include <cassert>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <new>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

std::vector<uint8_t> decodePngBase64ToRgba(const std::string &encoded,
                                           int &width, int &height);

namespace {

constexpr size_t HeaderBytes = alignof(std::max_align_t) > sizeof(size_t)
                                   ? alignof(std::max_align_t)
                                   : sizeof(size_t);

std::atomic<size_t> liveBytes{0};
std::atomic<size_t> peakBytes{0};
thread_local long failAfterAllocations = -1;
thread_local size_t failAtOrAboveBytes = 0;

void *trackedAllocate(size_t size) {
  if (failAtOrAboveBytes != 0 && size >= failAtOrAboveBytes) {
    throw std::bad_alloc();
  }
  if (failAfterAllocations >= 0) {
    if (failAfterAllocations == 0) {
      failAfterAllocations = -1;
      throw std::bad_alloc();
    }
    failAfterAllocations--;
  }
  void *raw = std::malloc(size + HeaderBytes);
  if (raw == nullptr) {
    throw std::bad_alloc();
  }
  *static_cast<size_t *>(raw) = size;
  const size_t live = liveBytes.fetch_add(size) + size;
  size_t peak = peakBytes.load();
  while (live > peak && !peakBytes.compare_exchange_weak(peak, live)) {
  }
  return static_cast<unsigned char *>(raw) + HeaderBytes;
}

void trackedFree(void *pointer) noexcept {
  if (pointer == nullptr) {
    return;
  }
  void *raw = static_cast<unsigned char *>(pointer) - HeaderBytes;
  liveBytes.fetch_sub(*static_cast<size_t *>(raw));
  std::free(raw);
}

} // namespace

void *operator new(size_t size) { return trackedAllocate(size); }
void *operator new[](size_t size) { return trackedAllocate(size); }
void *operator new(size_t size, const std::nothrow_t &) noexcept {
  try {
    return trackedAllocate(size);
  } catch (const std::bad_alloc &) {
    return nullptr;
  }
}
void *operator new[](size_t size, const std::nothrow_t &) noexcept {
  try {
    return trackedAllocate(size);
  } catch (const std::bad_alloc &) {
    return nullptr;
  }
}
void operator delete(void *pointer) noexcept { trackedFree(pointer); }
void operator delete[](void *pointer) noexcept { trackedFree(pointer); }
void operator delete(void *pointer, size_t) noexcept { trackedFree(pointer); }
void operator delete[](void *pointer, size_t) noexcept { trackedFree(pointer); }
void operator delete(void *pointer, const std::nothrow_t &) noexcept {
  trackedFree(pointer);
}
void operator delete[](void *pointer, const std::nothrow_t &) noexcept {
  trackedFree(pointer);
}

namespace {

using NitroQRCode::BoundedCache;
using NitroQRCode::GenerateOptions;
using NitroQRCode::parseColor;
using NitroQRCode::QRCodeGenerator;

constexpr size_t MiB = 1024 * 1024;

struct PeakScope {
  size_t baseline = liveBytes.load();
  PeakScope() { peakBytes.store(baseline); }
  size_t peak() const { return peakBytes.load() - baseline; }
};

template <typename Operation> bool failsWithBadAlloc(Operation &&operation) {
  try {
    operation();
  } catch (const std::bad_alloc &) {
    failAfterAllocations = -1;
    failAtOrAboveBytes = 0;
    return true;
  }
  failAfterAllocations = -1;
  failAtOrAboveBytes = 0;
  return false;
}

GenerateOptions largestOptions() {
  GenerateOptions options;
  options.size = 4096;
  options.quietZone = 32;
  options.minVersion = 40;
  options.errorCorrectionLevel = "H";
  options.logoAreaSize = 4096 * 3 / 10;
  options.logoAreaBorderRadius = 256;
  return options;
}

void testBoundedCacheStoreSurvivesAllocationFailure() {
  const std::string longA(200, 'a');
  const std::string longB(300, 'b');
  const std::string longC(400, 'c');
  bool sawFailure = false;
  bool sawSuccess = false;
  for (long failAt = 0; failAt < 16 && !sawSuccess; failAt++) {
    for (const bool replaceExisting : {true, false}) {
      BoundedCache<std::string> cache(2, 4096);
      cache.store("key-a-" + longA, longA, longA, 400);
      const std::string key =
          replaceExisting ? "key-a-" + longA : "key-b-" + longB;
      failAfterAllocations = failAt;
      const bool failed = failsWithBadAlloc(
          [&]() { cache.store(key, longB, longB, 600); });
      sawFailure = sawFailure || failed;
      sawSuccess = sawSuccess || (!failed && !replaceExisting);

      size_t expectedBytes = 0;
      size_t expectedEntries = 0;
      if (cache.get("key-a-" + longA, longA).has_value()) {
        expectedBytes += 400;
        expectedEntries++;
      }
      if (cache.get(key, longB).has_value()) {
        expectedBytes += 600;
        expectedEntries++;
      }
      assert(cache.size() == expectedEntries);
      assert(cache.bytes() == expectedBytes);

      cache.store("key-c-" + longC, longC, longC, 3000);
      cache.store("key-d-" + longC, longC, longC, 3000);
      assert(cache.size() == 1);
      assert(cache.bytes() == 3000);
      assert(cache.get("key-d-" + longC, longC).has_value());
    }
  }
  assert(sawFailure);
  assert(sawSuccess);
}

void testBoundedCacheGetSurvivesAllocationFailure() {
  const std::string longA(200, 'a');
  const std::string longB(200, 'b');
  for (long failAt = 0; failAt < 4; failAt++) {
    BoundedCache<std::string> cache(2, 4096);
    cache.store("key-a-" + longA, longA, longA, 400);
    cache.store("key-b-" + longB, longB, longB, 400);
    failAfterAllocations = failAt;
    failsWithBadAlloc([&]() { (void)cache.get("key-a-" + longA, longA); });
    assert(cache.size() == 2 && cache.bytes() == 800);
    cache.store("key-c-" + longA, longA, longA, 400);
    assert(cache.size() == 2 && cache.bytes() == 800);
    cache.store("key-d-" + longA, longA, longA, 4000);
    assert(cache.size() == 1 && cache.bytes() == 4000);
  }
}

void testRenderSurvivesEveryAllocationFailure() {
  GenerateOptions options;
  options.size = 1;
  options.quietZone = 0;
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};
  const std::string value = "allocation-failure";
  const std::vector<uint8_t> reference =
      QRCodeGenerator().renderPngBytes(value, options);

  const size_t baseline = liveBytes.load();
  long failures = 0;
  for (long failAt = 0;; failAt++) {
    QRCodeGenerator generator;
    std::vector<uint8_t> output;
    failAfterAllocations = failAt;
    const bool failed = failsWithBadAlloc(
        [&]() { output = generator.renderPngBytes(value, options); });
    if (!failed) {
      assert(output == reference);
      break;
    }
    failures++;
    assert(generator.getCacheBytes() <= QRCodeGenerator::DefaultMaxCacheBytes);
    assert(generator.getCacheSize() <= 1);
    assert(generator.renderPngBytes(value, options) == reference);
    assert(generator.generateSvgString(value, options).rfind("<svg", 0) == 0);
    assert(generator.getMatrixSize(value, options) == 25);
  }
  assert(failures > 50);
  assert(liveBytes.load() == baseline);
}

void testLargeAllocationFailureLeavesGeneratorUsable() {
  QRCodeGenerator generator;
  GenerateOptions flat;
  flat.size = 4096;
  GenerateOptions layered = largestOptions();
  GenerateOptions gradient = largestOptions();
  gradient.gradient.type = "radial";
  gradient.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};

  const size_t baseline = liveBytes.load();
  for (const GenerateOptions *options : {&flat, &layered, &gradient}) {
    failAtOrAboveBytes = 8 * MiB;
    assert(failsWithBadAlloc(
        [&]() { generator.renderPngBytes("low-memory", *options); }));
    failAtOrAboveBytes = 8 * MiB;
    assert(failsWithBadAlloc(
        [&]() { generator.renderPngDataUri("low-memory", *options); }));
  }
  assert(generator.getCacheSize() == 0);
  assert(generator.getCacheBytes() == 0);
  assert(liveBytes.load() == baseline);

  GenerateOptions small;
  small.size = 128;
  assert(generator.renderPngBytes("low-memory", small) ==
         QRCodeGenerator().renderPngBytes("low-memory", small));
}

void testPeakMemoryForLargestImages() {
  const std::string value = "peak-memory";

  GenerateOptions flat;
  flat.size = 4096;
  GenerateOptions layered = largestOptions();
  GenerateOptions gradient = largestOptions();
  gradient.gradient.type = "radial";
  gradient.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};

  struct Case {
    const char *name;
    const GenerateOptions *options;
    size_t maxPeakBytes;
  };
  const Case cases[] = {
      {"flat 1-bit", &flat, 22 * MiB},
      {"layered palette", &layered, 28 * MiB},
      {"gradient RGBA", &gradient, 22 * MiB},
  };
  for (const Case &entry : cases) {
    QRCodeGenerator generator;
    PeakScope bytesScope;
    const size_t bytesSize =
        generator.renderPngBytes(value, *entry.options).size();
    const size_t bytesPeak = bytesScope.peak();
    generator.clearCache();
    PeakScope uriScope;
    const size_t uriSize =
        generator.renderPngDataUri(value, *entry.options).size();
    const size_t uriPeak = uriScope.peak();
    std::cout << "peak heap, 4096px " << entry.name << ": bytes "
              << bytesPeak / 1024 << " KiB (png " << bytesSize / 1024
              << " KiB), data URI " << uriPeak / MiB << " MiB (uri "
              << uriSize / 1024 << " KiB)" << std::endl;
    assert(bytesPeak <= entry.maxPeakBytes);
    assert(uriPeak <= entry.maxPeakBytes);
    assert(generator.getCacheBytes() <= QRCodeGenerator::DefaultMaxCacheBytes);
    assert(generator.memorySize() <= QRCodeGenerator::MaxCombinedCacheBytes);
  }
}

void testConcurrentLargestGradientsStayBounded() {
  GenerateOptions options = largestOptions();
  options.gradient.type = "radial";
  options.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};
  QRCodeGenerator generator;
  size_t singlePeak = 0;
  {
    PeakScope scope;
    assert(!generator.renderPngBytes("concurrent-peak-single", options).empty());
    singlePeak = scope.peak();
  }
  generator.clearCache();

  PeakScope scope;
  std::vector<std::thread> workers;
  std::atomic<int> completed{0};
  for (int index = 0; index < 4; index++) {
    workers.emplace_back([&generator, &options, &completed, index]() {
      const auto png = generator.renderPngBytes(
          "concurrent-peak-" + std::to_string(index), options);
      if (png.size() > 8) {
        completed.fetch_add(1);
      }
    });
  }
  for (auto &worker : workers) {
    worker.join();
  }
  const size_t concurrentPeak = scope.peak();
  std::cout << "peak heap, 4 concurrent 4096px gradients: "
            << concurrentPeak / 1024 << " KiB (single " << singlePeak / 1024
            << " KiB)" << std::endl;
  assert(completed.load() == 4);
  assert(concurrentPeak <= 4 * singlePeak + 4 * MiB);
  assert(concurrentPeak <= 96 * MiB);
}

void testBufferedGradientEncoderPeakAtStreamingThreshold() {
  const int size = QRCodeGenerator::DefaultStreamedRgbaMinSize;
  GenerateOptions options;
  options.size = size;
  options.gradient.type = "radial";
  options.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};
  QRCodeGenerator generator;
  PeakScope scope;
  assert(!generator.renderPngBytes("threshold-peak", options).empty());
  std::cout << "peak heap, " << size << "px gradient on the fpng path: "
            << scope.peak() / 1024 << " KiB" << std::endl;
  assert(scope.peak() <= 24 * MiB);
}

void testStreamedGradientMatchesFpngPixelsAtLargestSize() {
  GenerateOptions options = largestOptions();
  options.gradient.type = "radial";
  options.gradient.colors = {parseColor("#000000"), parseColor("#1A237E"),
                             parseColor("#FF000080")};
  QRCodeGenerator streamed;
  QRCodeGenerator buffered({}, QRCodeGenerator::DefaultMaxCacheBytes,
                           std::numeric_limits<int>::max());
  int width = 0;
  int height = 0;
  const auto streamedPng = streamed.renderPngBase64("largest", options);
  const auto streamedPixels = decodePngBase64ToRgba(streamedPng, width, height);
  assert(width == 4096 && height == 4096);
  PeakScope scope;
  const auto bufferedPng = buffered.renderPngBase64("largest", options);
  const size_t bufferedPeak = scope.peak();
  const auto bufferedPixels = decodePngBase64ToRgba(bufferedPng, width, height);
  assert(streamedPixels == bufferedPixels);
  std::cout << "4096px gradient: streamed png " << streamedPng.size() * 3 / 4096
            << " KiB, fpng png " << bufferedPng.size() * 3 / 4096
            << " KiB, fpng path peak heap " << bufferedPeak / MiB << " MiB"
            << std::endl;
}

void testStreamedRenderSurvivesAllocationFailure() {
  GenerateOptions options;
  options.size = 1100;
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};
  const std::string value = "streamed-allocation-failure";
  const std::vector<uint8_t> reference =
      QRCodeGenerator().renderPngBytes(value, options);
  const size_t baseline = liveBytes.load();
  long failures = 0;
  for (long failAt = 0;; failAt++) {
    QRCodeGenerator generator;
    std::vector<uint8_t> output;
    failAfterAllocations = failAt;
    const bool failed = failsWithBadAlloc(
        [&]() { output = generator.renderPngBytes(value, options); });
    if (!failed) {
      assert(output == reference);
      break;
    }
    failures++;
    assert(generator.getCacheSize() == 0);
    assert(generator.memorySize() <= QRCodeGenerator::MaxCombinedCacheBytes);
  }
  std::cout << "streamed render: " << failures
            << " injected allocation failures survived" << std::endl;
  assert(failures > 50);
  assert(liveBytes.load() == baseline);
}

void testOversizedPayloadIsRejectedWithLinearMemory() {
  constexpr size_t payloadBytes = 4 * MiB;
  QRCodeGenerator generator;
  GenerateOptions options;
  std::string numeric(payloadBytes, '7');
  std::string binary(payloadBytes, 'a');
  binary[payloadBytes / 2] = '\0';
  for (const std::string *payload : {&numeric, &binary}) {
    PeakScope scope;
    bool rejected = false;
    try {
      generator.renderPngBytes(*payload, options);
    } catch (const std::length_error &) {
      rejected = true;
    }
    assert(rejected);
    std::cout << "peak heap, rejected 4 MiB payload: " << scope.peak() / 1024
              << " KiB" << std::endl;
    assert(scope.peak() < 64 * 1024);
  }
  assert(generator.getCacheSize() == 0);
  assert(generator.memorySize() == 0);
}

void testOutOfRangeOptionsAreRejectedBeforeImageAllocation() {
  QRCodeGenerator generator;
  const int intMax = std::numeric_limits<int>::max();
  const std::vector<int GenerateOptions::*> fields = {
      &GenerateOptions::size,
      &GenerateOptions::quietZone,
      &GenerateOptions::minVersion,
      &GenerateOptions::maxVersion,
      &GenerateOptions::gap,
      &GenerateOptions::eyePatternGap,
      &GenerateOptions::cornerRadius,
      &GenerateOptions::eyePatternCornerRadius,
      &GenerateOptions::logoAreaSize,
      &GenerateOptions::logoAreaBorderRadius,
  };
  for (const auto field : fields) {
    for (const int value : {intMax, std::numeric_limits<int>::min(), 4097}) {
      GenerateOptions options;
      options.size = 4096;
      options.*field = value;
      PeakScope scope;
      bool rejected = false;
      try {
        generator.renderPngBytes("caps", options);
      } catch (const std::invalid_argument &) {
        rejected = true;
      }
      assert(rejected);
      assert(scope.peak() < 64 * 1024);
    }
  }
  assert(generator.memorySize() == 0);
}

void testCacheHeapStaysBounded() {
  QRCodeGenerator generator;
  GenerateOptions options;
  options.size = 384;
  options.gradient.type = "linear";
  options.gradient.colors = {parseColor("#000000"), parseColor("#1A237E")};
  const size_t baseline = liveBytes.load();
  size_t maxLive = 0;
  for (int index = 0; index < 200; index++) {
    const std::string value = "cache-bound-" + std::to_string(index);
    assert(!generator.renderPngBytes(value, options).empty());
    assert(generator.getMatrixSize(value, options) >= 21);
    assert(generator.getCacheSize() <= 128);
    assert(generator.getCacheBytes() <= QRCodeGenerator::DefaultMaxCacheBytes);
    assert(generator.memorySize() <= QRCodeGenerator::MaxCombinedCacheBytes);
    maxLive = std::max(maxLive, liveBytes.load() - baseline);
  }
  std::cout << "cache heap after 200 distinct 384px gradients: "
            << maxLive / 1024 << " KiB live, " << generator.getCacheSize()
            << " entries" << std::endl;
  assert(generator.getCacheSize() > 1);
  assert(maxLive <= QRCodeGenerator::MaxCombinedCacheBytes * 2);
}

} // namespace

void runQRCodeMemoryTests() {
  testBoundedCacheStoreSurvivesAllocationFailure();
  testBoundedCacheGetSurvivesAllocationFailure();
  testRenderSurvivesEveryAllocationFailure();
  testLargeAllocationFailureLeavesGeneratorUsable();
  testPeakMemoryForLargestImages();
  testConcurrentLargestGradientsStayBounded();
  testBufferedGradientEncoderPeakAtStreamingThreshold();
  testStreamedGradientMatchesFpngPixelsAtLargestSize();
  testStreamedRenderSurvivesAllocationFailure();
  testOversizedPayloadIsRejectedWithLinearMemory();
  testOutOfRangeOptionsAreRejectedBeforeImageAllocation();
  testCacheHeapStaysBounded();
  std::cout << "QRCode memory tests passed" << std::endl;
}
