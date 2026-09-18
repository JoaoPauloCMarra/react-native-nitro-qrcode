const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const packageDir = path.join(
  __dirname,
  "..",
  "packages",
  "react-native-nitro-qrcode",
);
const cppDir = path.join(packageDir, "cpp");
const buildDir = path.join(cppDir, "build");
const outputFile = path.join(buildDir, "qrcode_generator_test");
const profileRawFile = path.join(buildDir, "qrcode_generator.profraw");
const profileDataFile = path.join(buildDir, "qrcode_generator.profdata");

const PINNED_LLVM_VERSION = 18;

function resolveTool(name) {
  const pinnedName = `${name}-${PINNED_LLVM_VERSION}`;
  try {
    return execSync(`command -v ${pinnedName}`, { encoding: "utf8" }).trim();
  } catch {
    try {
      return execSync(`command -v ${name}`, { encoding: "utf8" }).trim();
    } catch {
      if (process.platform !== "darwin") {
        throw new Error(
          `${name} was not found on PATH; install LLVM ${PINNED_LLVM_VERSION} (${pinnedName}).`,
        );
      }

      return execFileSync("xcrun", ["--find", name], {
        encoding: "utf8",
      }).trim();
    }
  }
}

function runCommand(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

const includeRoot = path.join(buildDir, "headers");
const nitroVirtualDir = path.join(includeRoot, "NitroModules");
fs.mkdirSync(nitroVirtualDir, { recursive: true });
const nitroDir = path.join(__dirname, "..", "node_modules", "react-native-nitro-modules", "cpp");
for (const subdir of ["core", "jsi", "platform", "templates", "threading", "utils"])
  for (const file of fs.readdirSync(path.join(nitroDir, subdir)))
    if (file.endsWith(".hpp"))
      fs.copyFileSync(path.join(nitroDir, subdir, file), path.join(nitroVirtualDir, file));

const writeHeader = (name, source) =>
  fs.writeFileSync(path.join(nitroVirtualDir, name), source, "utf8");
writeHeader("HybridObject.hpp", `#pragma once
#include <cstddef>
#include <memory>
namespace margelo::nitro {
class Prototype { public: template <typename... Args> void registerHybridMethod(const char*, Args...) {} };
class HybridObject : public std::enable_shared_from_this<HybridObject> {
public:
  explicit HybridObject(const char* = "") {}
  virtual ~HybridObject() = default;
  virtual void loadHybridMethods() {}
  virtual size_t getExternalMemorySize() noexcept { return 0; }
protected:
  template <typename Fn> void registerHybrids(HybridObject*, Fn&& fn) { Prototype prototype; fn(prototype); }
  template <typename T> std::shared_ptr<T> shared_cast() { return std::dynamic_pointer_cast<T>(shared_from_this()); }
};
}
`,
);
writeHeader("Promise.hpp", `#pragma once
#include <future>
#include <functional>
#include <memory>
#include <utility>
namespace margelo::nitro {
template <typename T> class Promise {
  std::future<T> future_;
public:
  explicit Promise(std::future<T>&& future) : future_(std::move(future)) {}
  static std::shared_ptr<Promise<T>> async(std::function<T()>&& operation) { return std::make_shared<Promise<T>>(std::async(std::launch::async, std::move(operation))); }
  std::future<T> await() { return std::move(future_); }
};
}
`,
);
writeHeader("ArrayBuffer.hpp", `#pragma once
#include <cstdint>
#include <cstring>
#include <memory>
#include <vector>
namespace margelo::nitro {
class ArrayBuffer {
  std::vector<uint8_t> data_;
public:
  explicit ArrayBuffer(std::vector<uint8_t>&& data) : data_(std::move(data)) {}
  static std::shared_ptr<ArrayBuffer> copy(const uint8_t* data, size_t size) {
    return std::make_shared<ArrayBuffer>(std::vector<uint8_t>(data, data + size));
  }
  static std::shared_ptr<ArrayBuffer> copy(const std::vector<uint8_t>& data) {
    return std::make_shared<ArrayBuffer>(std::vector<uint8_t>(data));
  }
  static std::shared_ptr<ArrayBuffer> move(std::vector<uint8_t>&& data) {
    return std::make_shared<ArrayBuffer>(std::move(data));
  }
  uint8_t* data() { return data_.data(); }
  const uint8_t* data() const { return data_.data(); }
  size_t size() const { return data_.size(); }
  bool isOwner() const { return true; }
  size_t getExternalMemorySize() const { return data_.size(); }
};
}
`,
);
writeHeader("JSIConverter+ArrayBuffer.hpp", `#pragma once
#include "ArrayBuffer.hpp"
#include "JSIConverter.hpp"
#include <jsi/jsi.h>
#include <memory>
#include <vector>
namespace margelo::nitro {
using namespace facebook;
template <>
struct JSIConverter<std::shared_ptr<ArrayBuffer>> final {
  static inline std::shared_ptr<ArrayBuffer> fromJSI(jsi::Runtime&, const jsi::Value&) {
    return ArrayBuffer::move(std::vector<uint8_t>{});
  }
  static inline jsi::Value toJSI(jsi::Runtime&, const std::shared_ptr<ArrayBuffer>&) {
    return jsi::Value::undefined();
  }
  static inline bool canConvert(jsi::Runtime&, const jsi::Value&) {
    return false;
  }
};
}
`,
);
const jsCallbackHeader = path.join(nitroVirtualDir, "JSCallback.hpp");
if (fs.existsSync(jsCallbackHeader)) {
  const contents = fs.readFileSync(jsCallbackHeader, "utf8");
  if (!contents.includes("NitroLogger.hpp")) {
    fs.writeFileSync(
      jsCallbackHeader,
      `#include "NitroLogger.hpp"\n${contents}`,
    );
  }
}

const generatedDir = path.join(packageDir, "nitrogen", "generated", "shared", "c++");
const matrixObjectHeader = path.join(generatedDir, "MatrixObject.hpp");
if (!fs.existsSync(matrixObjectHeader)) {
  throw new Error(
    `Missing generated MatrixObject converter: ${matrixObjectHeader}. Run codegen first.`,
  );
}

const quircDir = path.join(cppDir, "tests", "quirc");
const quircObjects = [
  "quirc.c",
  "decode.c",
  "identify.c",
  "version_db.c",
].map((file) => {
  const objectFile = path.join(buildDir, `${file}.o`);
  runCommand(resolveTool("clang"), [
    "-std=c11",
    "-O0",
    "-g",
    "-fprofile-instr-generate",
    "-fcoverage-mapping",
    `-I${quircDir}`,
    "-c",
    path.join(quircDir, file),
    "-o",
    objectFile,
  ]);
  return objectFile;
});

const sources = [
  path.join(cppDir, "core", "QRCodeGeneratorTest.cpp"),
  path.join(cppDir, "core", "parity-corpus.cpp"),
  path.join(cppDir, "tests", "QRCodeBridgeOptionsTest.cpp"),
  path.join(cppDir, "tests", "QRCodeScanTest.cpp"),
  path.join(cppDir, "bindings", "QRCodeBridgeOptions.cpp"),
  path.join(cppDir, "bindings", "HybridQRCodeTest.cpp"),
  path.join(cppDir, "bindings", "HybridQRCode.cpp"),
  path.join(generatedDir, "HybridQRCodeSpec.cpp"),
  path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  path.join(cppDir, "vendor", "fpng", "fpng_unity.cpp"),
  path.join(cppDir, "qrcodegen", "qrcodegen.cpp"),
];

const compileArgs = [
  "-std=c++20",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-DNITRO_HYBRID_BINDING_TEST",
  "-O0",
  "-g",
  "-fprofile-instr-generate",
  "-fcoverage-mapping",
  `-I${includeRoot}`,
  `-I${generatedDir}`,
  `-I${path.join(cppDir, "bindings")}`,
  `-I${path.join(cppDir, "core")}`,
  `-I${path.join(cppDir, "qrcodegen")}`,
  `-I${path.join(cppDir, "vendor", "fpng")}`,
  `-I${quircDir}`,
  `-I${path.join(__dirname, "..", "node_modules", "react-native", "ReactCommon")}`,
  `-I${path.join(__dirname, "..", "node_modules", "react-native", "ReactCommon", "jsi")}`,
  ...sources,
  ...quircObjects,
  "-o",
  outputFile,
  "-lz",
  process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread",
];

console.log("Compiling C++ QRCode tests...");
runCommand(resolveTool("clang++"), compileArgs);

console.log("Running C++ QRCode tests...");
runCommand(outputFile, [], {
  env: {
    ...process.env,
    LLVM_PROFILE_FILE: profileRawFile,
  },
});

console.log("Checking C++ QRCode coverage...");
const llvmProfdata = resolveTool("llvm-profdata");
const llvmCov = resolveTool("llvm-cov");
runCommand(llvmProfdata, [
  "merge",
  "-sparse",
  profileRawFile,
  "-o",
  profileDataFile,
]);

const report = execFileSync(
  llvmCov,
  [
    "report",
    outputFile,
    `-instr-profile=${profileDataFile}`,
    `-ignore-filename-regex=(${path.join("qrcodegen", "qrcodegen.cpp")}|QRCodeGeneratorTest.cpp)`,
    path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  ],
  { encoding: "utf8" },
);

console.log(report.trimEnd());
const totalLine = report
  .split("\n")
  .find((line) => line.trim().startsWith("TOTAL"));

if (!totalLine) {
  throw new Error("Unable to find TOTAL line in C++ coverage report.");
}

const columns = totalLine.trim().split(/\s+/);
const missedLines = columns[8];
const lineCoverage = columns[9];

if (missedLines !== "0" || lineCoverage !== "100.00%") {
  throw new Error(
    `Expected 100.00% C++ line coverage with 0 missed lines, got ${lineCoverage} with ${missedLines} missed lines.`,
  );
}
