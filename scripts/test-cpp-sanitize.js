const fs = require("fs");
const path = require("path");
const { resolveLlvmTool } = require("./llvm-tools.js");
const {
  compileQuircObjects,
  platformLinkArgs,
  prepareNitroHeaders,
  runCommand,
  sharedIncludeArgs,
  testSources,
} = require("./cpp-includes.js");

const packageDir = path.join(
  __dirname,
  "..",
  "packages",
  "react-native-nitro-qrcode"
);
const cppDir = path.join(packageDir, "cpp");
const buildDir = path.join(cppDir, "build-sanitize");
const quircDir = path.join(cppDir, "tests", "quirc");

const generatedDir = path.join(packageDir, "nitrogen", "generated", "shared", "c++");
const matrixObjectHeader = path.join(generatedDir, "MatrixObject.hpp");
if (!fs.existsSync(matrixObjectHeader)) {
  throw new Error(
    `Missing generated MatrixObject converter: ${matrixObjectHeader}. Run codegen first.`,
  );
}

const sources = testSources(packageDir, { includeMemory: false });

const sanitizers = [
  { label: "ASan/UBSan", flag: "address,undefined", suffix: "sanitize" },
  { label: "TSan", flag: "thread", suffix: "tsan" },
];

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });
const includeRoot = prepareNitroHeaders(path.join(__dirname, ".."), buildDir);

for (const { label, flag, suffix } of sanitizers) {
  const outputFile = path.join(buildDir, `qrcode_generator_test_${suffix}`);
  const quircObjects = compileQuircObjects({
    clang: resolveLlvmTool("clang"),
    quircDir,
    buildDir,
    suffix,
    flags: ["-O1", "-g", "-fno-omit-frame-pointer", `-fsanitize=${flag}`],
  });

  console.log(`Compiling C++ QRCode tests with ${label}...`);
  runCommand(resolveLlvmTool("clang++"), [
    "-std=c++20",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-DNITRO_HYBRID_BINDING_TEST",
    "-O1",
    "-g",
    "-fno-omit-frame-pointer",
    `-fsanitize=${flag}`,
    "-fno-sanitize-recover=all",
    `-I${includeRoot}`,
    ...sharedIncludeArgs(path.join(__dirname, "..")),
    ...sources,
    ...quircObjects,
    "-o",
    outputFile,
    ...platformLinkArgs(),
  ]);

  console.log(`Running C++ QRCode ${label} tests...`);
  runCommand(outputFile, []);
}
