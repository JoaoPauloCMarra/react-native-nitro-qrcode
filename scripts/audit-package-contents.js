const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packageDir = path.join(
  projectRoot,
  "packages",
  "react-native-nitro-qrcode"
);

const docsSyncScript = path.join(
  packageDir,
  "scripts",
  "sync-package-docs.js",
);

const literalRequiredFiles = [
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
  "cpp/vendor/fpng/fpng.cpp",
  "cpp/vendor/fpng/fpng.h",
  "cpp/vendor/fpng/fpng_unity.cpp",
  "cpp/vendor/fpng/README.md",
  "nitrogen/generated/android/NitroQRCode+autolinking.cmake",
  "nitrogen/generated/ios/NitroQRCode+autolinking.rb",
  "nitrogen/generated/shared/c++/GenerateOptions.hpp",
  "nitrogen/generated/shared/c++/MatrixObject.hpp",
  "nitrogen/generated/shared/c++/HybridQRCodeSpec.hpp",
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

function sourceModuleFiles(srcDir) {
  return fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts"))
    .map((entry) => entry.name.replace(/\.tsx?$/, ""))
    .sort()
    .flatMap((name) => [
      `src/${name}.ts`,
      `lib/commonjs/${name}.js`,
      `lib/module/${name}.js`,
      `lib/typescript/commonjs/${name}.d.ts`,
      `lib/typescript/module/${name}.d.ts`,
    ]);
}

function requiredPackageFiles(dir = packageDir) {
  return [...literalRequiredFiles, ...sourceModuleFiles(path.join(dir, "src"))];
}

function runDocsSync(mode) {
  const result = spawnSync("node", [docsSyncScript, mode], {
    cwd: packageDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${mode} docs sync failed`);
  }
}

function main() {
  let result;
  try {
    try {
      runDocsSync("prepare");
      result = spawnSync("bun", ["pm", "pack", "--dry-run", "--ignore-scripts"], {
        cwd: packageDir,
        encoding: "utf8",
      });
    } finally {
      runDocsSync("cleanup");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

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

  const missing = requiredPackageFiles().filter((file) => !packedFiles.has(file));
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
}

if (require.main === module) {
  main();
}

module.exports = { requiredPackageFiles, sourceModuleFiles };
