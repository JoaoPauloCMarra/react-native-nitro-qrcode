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

function resolveTool(name) {
  try {
    return execSync(`command -v ${name}`, { encoding: "utf8" }).trim();
  } catch {
    if (process.platform !== "darwin") {
      throw new Error(`${name} was not found on PATH.`);
    }

    return execFileSync("xcrun", ["--find", name], {
      encoding: "utf8",
    }).trim();
  }
}

function runCommand(command, args) {
  execFileSync(command, args, {
    stdio: "inherit",
  });
}

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

const sources = [
  path.join(cppDir, "core", "QRCodeGeneratorTest.cpp"),
  path.join(cppDir, "tests", "QRCodeBridgeOptionsTest.cpp"),
  path.join(cppDir, "bindings", "QRCodeBridgeOptions.cpp"),
  path.join(cppDir, "core", "QRCodeGenerator.cpp"),
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
  ...sources,
  "-o",
  outputFile,
  "-lz",
  process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread",
];

console.log("Compiling C++ QRCode tests with ASan/UBSan...");
runCommand(resolveTool("clang++"), compileArgs);

console.log("Running C++ QRCode sanitizer tests...");
runCommand(outputFile, []);
