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
const quircDir = path.join(cppDir, "tests", "quirc");

function runCommand(command, args) {
  execFileSync(command, args, {
    stdio: "inherit",
  });
}

const sources = [
  path.join(cppDir, "core", "QRCodeGeneratorTest.cpp"),
  path.join(cppDir, "core", "parity-corpus.cpp"),
  path.join(cppDir, "tests", "QRCodeBridgeOptionsTest.cpp"),
  path.join(cppDir, "tests", "QRCodeScanTest.cpp"),
  path.join(cppDir, "tests", "QRCodeHardeningTest.cpp"),
  path.join(cppDir, "bindings", "QRCodeBridgeOptions.cpp"),
  path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  path.join(cppDir, "vendor", "fpng", "fpng_unity.cpp"),
  path.join(cppDir, "qrcodegen", "qrcodegen.cpp"),
];

const sanitizers = [
  { label: "ASan/UBSan", flag: "address,undefined", suffix: "sanitize" },
  { label: "TSan", flag: "thread", suffix: "tsan" },
];

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

for (const { label, flag, suffix } of sanitizers) {
  const outputFile = path.join(buildDir, `qrcode_generator_test_${suffix}`);
  const quircObjects = ["quirc.c", "decode.c", "identify.c", "version_db.c"].map(
    (file) => {
      const objectFile = path.join(buildDir, `${file}.${suffix}.o`);
      runCommand(resolveLlvmTool("clang"), [
        "-std=c11",
        "-DQUIRC_MAX_REGIONS=65534",
        "-O1",
        "-g",
        "-fno-omit-frame-pointer",
        `-fsanitize=${flag}`,
        `-I${quircDir}`,
        "-c",
        path.join(quircDir, file),
        "-o",
        objectFile,
      ]);
      return objectFile;
    },
  );

  console.log(`Compiling C++ QRCode tests with ${label}...`);
  runCommand(resolveLlvmTool("clang++"), [
    "-std=c++20",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-O1",
    "-g",
    "-fno-omit-frame-pointer",
    `-fsanitize=${flag}`,
    "-fno-sanitize-recover=all",
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
  ]);

  console.log(`Running C++ QRCode ${label} tests...`);
  runCommand(outputFile, []);
}
