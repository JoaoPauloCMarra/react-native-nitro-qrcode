const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packageDir = path.join(
  projectRoot,
  "packages",
  "react-native-nitro-qrcode"
);

// The real publish injects the repository README and LICENSE through the
// prepack lifecycle. Stage them exactly like prepack does so the dry-run
// contents match the published artifact, then restore the package directory.
const stagedFiles = ["README.md", "CHANGELOG.md", "SECURITY.md", "LICENSE"];
const stagedCopies = [];
for (const file of stagedFiles) {
  const source = path.join(projectRoot, file);
  const target = path.join(packageDir, file);
  if (fs.existsSync(source)) {
    if (fs.existsSync(target)) {
      const backup = path.join(packageDir, `.audit-${file}`);
      fs.copyFileSync(target, backup);
      stagedCopies.push({ target, backup, hadOriginal: true });
    } else {
      stagedCopies.push({ target, backup: null, hadOriginal: false });
    }
    fs.copyFileSync(source, target);
  }
}

function restoreStagedFiles() {
  for (const copy of stagedCopies) {
    fs.rmSync(copy.target, { force: true });
    if (copy.hadOriginal) {
      fs.copyFileSync(copy.backup, copy.target);
      fs.rmSync(copy.backup, { force: true });
    }
  }
}

const result = spawnSync("bun", ["pm", "pack", "--dry-run", "--ignore-scripts"], {
  cwd: packageDir,
  encoding: "utf8",
});
restoreStagedFiles();

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
  "CHANGELOG.md",
  "SECURITY.md",
  "package.json",
  "react-native-nitro-qrcode.podspec",
  "android/CMakeLists.txt",
  "android/build.gradle",
  "app.plugin.js",
  "cpp/bindings/HybridQRCode.cpp",
  "cpp/bindings/QRCodeBridgeOptions.cpp",
  "cpp/core/BoundedCache.hpp",
  "cpp/core/QRCodeGenerator.cpp",
  "cpp/qrcodegen/qrcodegen.cpp",
  "cpp/qrcodegen/README.nayuki.markdown",
  "lib/commonjs/index.js",
  "lib/commonjs/qrcode-component.js",
  "lib/commonjs/cache.js",
  "lib/commonjs/colors.js",
  "lib/commonjs/defaults.js",
  "lib/commonjs/metrics.js",
  "lib/commonjs/render-plan.js",
  "lib/commonjs/scan-policy.js",
  "lib/commonjs/styles.js",
  "lib/commonjs/use-qrcode-generation.js",
  "lib/commonjs/validation.js",
  "lib/module/index.js",
  "lib/module/qrcode-component.js",
  "lib/module/cache.js",
  "lib/module/colors.js",
  "lib/module/defaults.js",
  "lib/module/metrics.js",
  "lib/module/render-plan.js",
  "lib/module/scan-policy.js",
  "lib/module/styles.js",
  "lib/module/use-qrcode-generation.js",
  "lib/module/validation.js",
  "lib/typescript/commonjs/index.d.ts",
  "lib/typescript/commonjs/qrcode-component.d.ts",
  "lib/typescript/commonjs/cache.d.ts",
  "lib/typescript/commonjs/colors.d.ts",
  "lib/typescript/commonjs/defaults.d.ts",
  "lib/typescript/commonjs/metrics.d.ts",
  "lib/typescript/commonjs/render-plan.d.ts",
  "lib/typescript/commonjs/scan-policy.d.ts",
  "lib/typescript/commonjs/styles.d.ts",
  "lib/typescript/commonjs/use-qrcode-generation.d.ts",
  "lib/typescript/commonjs/validation.d.ts",
  "lib/typescript/module/index.d.ts",
  "lib/typescript/module/qrcode-component.d.ts",
  "lib/typescript/module/cache.d.ts",
  "lib/typescript/module/colors.d.ts",
  "lib/typescript/module/defaults.d.ts",
  "lib/typescript/module/metrics.d.ts",
  "lib/typescript/module/render-plan.d.ts",
  "lib/typescript/module/scan-policy.d.ts",
  "lib/typescript/module/styles.d.ts",
  "lib/typescript/module/use-qrcode-generation.d.ts",
  "lib/typescript/module/validation.d.ts",
  "nitrogen/generated/android/NitroQRCode+autolinking.cmake",
  "nitrogen/generated/ios/NitroQRCode+autolinking.rb",
  "nitrogen/generated/shared/c++/GenerateOptions.hpp",
  "nitrogen/generated/shared/c++/HybridQRCodeSpec.hpp",
  "src/index.ts",
  "src/index.web.ts",
  "src/cache.ts",
  "src/colors.ts",
  "src/defaults.ts",
  "src/metrics.ts",
  "src/qrcode-component.ts",
  "src/render-plan.ts",
  "src/scan-policy.ts",
  "src/styles.ts",
  "src/use-qrcode-generation.ts",
  "src/validation.ts",
];

const forbiddenPatterns = [
  /^src\/__tests__\//,
  /^cpp\/core\/parity-corpus\.(cpp|hpp)$/,
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
