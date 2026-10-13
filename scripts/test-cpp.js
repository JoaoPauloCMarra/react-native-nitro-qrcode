const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveLlvmTool } = require("./llvm-tools.js");
const { prepareNitroHeaders, sharedIncludeArgs } = require("./cpp-includes.js");

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

function runCommand(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

const includeRoot = prepareNitroHeaders(path.join(__dirname, ".."), buildDir);

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
  runCommand(resolveLlvmTool("clang"), [
    "-std=c11",
    "-DQUIRC_MAX_REGIONS=65534",
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
  path.join(cppDir, "tests", "QRCodeHardeningTest.cpp"),
  path.join(cppDir, "tests", "HybridQRCodeHardeningTest.cpp"),
  path.join(cppDir, "tests", "QRCodeMemoryTest.cpp"),
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
  "-DNITRO_QRCODE_MEMORY_TEST",
  "-O0",
  "-g",
  "-fprofile-instr-generate",
  "-fcoverage-mapping",
  `-I${includeRoot}`,
  ...sharedIncludeArgs(path.join(__dirname, "..")),
  ...sources,
  ...quircObjects,
  "-o",
  outputFile,
  "-lz",
  process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread",
];

console.log("Compiling C++ QRCode tests...");
runCommand(resolveLlvmTool("clang++"), compileArgs);

console.log("Running C++ QRCode tests...");
runCommand(outputFile, [], {
  env: {
    ...process.env,
    LLVM_PROFILE_FILE: profileRawFile,
  },
});

console.log("Checking C++ QRCode coverage...");
const llvmProfdata = resolveLlvmTool("llvm-profdata");
const llvmCov = resolveLlvmTool("llvm-cov");
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
