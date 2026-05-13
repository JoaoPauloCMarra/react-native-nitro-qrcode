const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const packageDir = path.join(__dirname, "..", "packages", "react-native-nitro-qrcode");
const cppDir = path.join(packageDir, "cpp");
const buildDir = path.join(cppDir, "build");
const outputFile = path.join(buildDir, "qrcode_generator_test");
const profileRawFile = path.join(buildDir, "qrcode_generator.profraw");
const profileDataFile = path.join(buildDir, "qrcode_generator.profdata");

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

const sources = [
  path.join(cppDir, "core", "QRCodeGeneratorTest.cpp"),
  path.join(cppDir, "tests", "QRCodeBridgeOptionsTest.cpp"),
  path.join(cppDir, "bindings", "QRCodeBridgeOptions.cpp"),
  path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  path.join(cppDir, "qrcodegen", "qrcodegen.cpp"),
];

const compileCmd = [
  "clang++",
  "-std=c++20",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-O0",
  "-g",
  "-fprofile-instr-generate",
  "-fcoverage-mapping",
  `-I${path.join(cppDir, "bindings")}`,
  `-I${path.join(cppDir, "core")}`,
  `-I${path.join(cppDir, "qrcodegen")}`,
  ...sources,
  "-o",
  outputFile,
  process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread",
].join(" ");

console.log("Compiling C++ QRCode tests...");
execSync(compileCmd, { stdio: "inherit" });

console.log("Running C++ QRCode tests...");
execSync(outputFile, {
  stdio: "inherit",
  env: {
    ...process.env,
    LLVM_PROFILE_FILE: profileRawFile,
  },
});

console.log("Checking C++ QRCode coverage...");
execSync(
  [
    "llvm-profdata",
    "merge",
    "-sparse",
    profileRawFile,
    "-o",
    profileDataFile,
  ].join(" "),
  { stdio: "inherit" }
);

const report = execSync(
  [
    "llvm-cov",
    "report",
    outputFile,
    `-instr-profile=${profileDataFile}`,
    `-ignore-filename-regex='(${path.join("qrcodegen", "qrcodegen.cpp")}|QRCodeGeneratorTest.cpp)'`,
    path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  ].join(" "),
  { encoding: "utf8" }
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
    `Expected 100.00% C++ line coverage with 0 missed lines, got ${lineCoverage} with ${missedLines} missed lines.`
  );
}
