const { spawnSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packageDir = path.join(
  projectRoot,
  "packages",
  "react-native-nitro-qrcode"
);

const result = spawnSync("bun", ["pm", "pack", "--dry-run"], {
  cwd: packageDir,
  encoding: "utf8",
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const packedFiles = new Set(
  result.stdout
    .split("\n")
    .map((line) => line.match(/^packed\s+\S+\s+(.+)$/)?.[1])
    .filter(Boolean)
);

const requiredFiles = [
  ".watchmanconfig",
  "LICENSE",
  "README.md",
  "package.json",
  "react-native-nitro-qrcode.podspec",
  "android/CMakeLists.txt",
  "android/build.gradle",
  "app.plugin.js",
  "cpp/bindings/HybridQRCode.cpp",
  "cpp/bindings/QRCodeBridgeOptions.cpp",
  "cpp/core/QRCodeGenerator.cpp",
  "cpp/qrcodegen/qrcodegen.cpp",
  "lib/commonjs/index.js",
  "lib/module/index.js",
  "lib/typescript/commonjs/index.d.ts",
  "lib/typescript/module/index.d.ts",
  "nitrogen/generated/android/NitroQRCode+autolinking.cmake",
  "nitrogen/generated/ios/NitroQRCode+autolinking.rb",
  "nitrogen/generated/shared/c++/HybridQRCodeSpec.hpp",
  "src/index.ts",
  "src/index.web.ts",
];

const forbiddenPatterns = [
  /^src\/__tests__\//,
  /^cpp\/bindings\/.*Test\.cpp$/,
  /^cpp\/tests\//,
  /^cpp\/core\/.*Test\.cpp$/,
  /^cpp\/core\/.*Benchmark\.cpp$/,
  /^cpp\/build\//,
  /^cpp\/build-sanitize\//,
  /^android\/build\//,
  /^android\/\.cxx\//,
  /^scripts\//,
  /^coverage\//,
  /^node_modules\//,
];

const missing = requiredFiles.filter((file) => !packedFiles.has(file));
const forbidden = [...packedFiles].filter((file) =>
  forbiddenPatterns.some((pattern) => pattern.test(file))
);

if (missing.length > 0 || forbidden.length > 0) {
  if (missing.length > 0) {
    console.error(`Missing package files: ${missing.join(", ")}`);
  }
  if (forbidden.length > 0) {
    console.error(`Forbidden package files: ${forbidden.join(", ")}`);
  }
  process.exit(1);
}

console.log(
  `Package contents audit passed with ${packedFiles.size} packed files.`
);
