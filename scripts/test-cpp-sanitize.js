const { execSync } = require("child_process");
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

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

const sources = [
  path.join(cppDir, "core", "QRCodeGeneratorTest.cpp"),
  path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  path.join(cppDir, "qrcodegen", "qrcodegen.cpp"),
];

const compileCmd = [
  "clang++",
  "-std=c++20",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-O1",
  "-g",
  "-fno-omit-frame-pointer",
  "-fsanitize=address,undefined",
  `-I${path.join(cppDir, "core")}`,
  `-I${path.join(cppDir, "qrcodegen")}`,
  ...sources,
  "-o",
  outputFile,
  process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread",
].join(" ");

console.log("Compiling C++ QRCode tests with ASan/UBSan...");
execSync(compileCmd, { stdio: "inherit" });

console.log("Running C++ QRCode sanitizer tests...");
execSync(outputFile, { stdio: "inherit" });
