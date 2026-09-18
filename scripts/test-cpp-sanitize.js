const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const packageDir = path.join(
  __dirname,
  "..",
  "packages",
  "react-native-nitro-qrcode"
);
const cppDir = path.join(packageDir, "cpp");
const buildDir = path.join(cppDir, "build-sanitize");
const outputFile = path.join(buildDir, "qrcode_generator_test_sanitize");

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

function runCommand(command, args) {
  execFileSync(command, args, {
    stdio: "inherit",
  });
}

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

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
    "-O1",
    "-g",
    "-fno-omit-frame-pointer",
    "-fsanitize=address,undefined",
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
  path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  path.join(cppDir, "vendor", "fpng", "fpng_unity.cpp"),
  path.join(cppDir, "qrcodegen", "qrcodegen.cpp"),
];

const compileArgs = [
  "-std=c++20",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-O1",
  "-g",
  "-fno-omit-frame-pointer",
  "-fsanitize=address,undefined",
  `-I${path.join(cppDir, "bindings")}`,
  `-I${path.join(cppDir, "core")}`,
  `-I${path.join(cppDir, "qrcodegen")}`,
  `-I${path.join(cppDir, "vendor", "fpng")}`,
  `-I${quircDir}`,
  ...sources,
  ...quircObjects,
  "-o",
  outputFile,
  "-lz",
  process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread",
];

console.log("Compiling C++ QRCode tests with ASan/UBSan...");
runCommand(resolveTool("clang++"), compileArgs);

console.log("Running C++ QRCode sanitizer tests...");
runCommand(outputFile, []);
