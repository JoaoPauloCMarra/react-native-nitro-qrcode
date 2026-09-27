const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveLlvmTool } = require("./llvm-tools.js");

const packageDir = path.join(
  __dirname,
  "..",
  "packages",
  "react-native-nitro-qrcode"
);
const cppDir = path.join(packageDir, "cpp");
const buildDir = path.join(cppDir, "build-sanitize");
const outputFile = path.join(buildDir, "qrcode_generator_test_sanitize");

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
  runCommand(resolveLlvmTool("clang"), [
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
runCommand(resolveLlvmTool("clang++"), compileArgs);

console.log("Running C++ QRCode sanitizer tests...");
runCommand(outputFile, []);
