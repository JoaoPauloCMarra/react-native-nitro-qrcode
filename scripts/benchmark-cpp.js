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
const buildDir = path.join(cppDir, "build");
const outputFile = path.join(buildDir, "qrcode_generator_benchmark");

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

const sources = [
  path.join(cppDir, "core", "QRCodeGeneratorBenchmark.cpp"),
  path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  path.join(cppDir, "qrcodegen", "qrcodegen.cpp"),
];

const compileCmd = [
  "clang++",
  "-std=c++20",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-O3",
  "-DNDEBUG",
  `-I${path.join(cppDir, "core")}`,
  `-I${path.join(cppDir, "qrcodegen")}`,
  ...sources,
  "-o",
  outputFile,
  "-lz",
  process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread",
].join(" ");

console.log("Compiling optimized C++ QRCode benchmark...");
execSync(compileCmd, { stdio: "inherit" });

console.log("Running C++ QRCode benchmark...");
execSync(outputFile, { stdio: "inherit" });
