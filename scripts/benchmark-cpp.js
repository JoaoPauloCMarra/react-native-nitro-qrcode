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
const buildDir = path.join(cppDir, "build");
const outputFile = path.join(buildDir, "qrcode_generator_benchmark");
const smoke = process.argv.includes("--smoke");

const PINNED_LLVM_VERSION = 18;

function resolveTool(name) {
  const pinnedName = `${name}-${PINNED_LLVM_VERSION}`;
  try {
    return execSync(`command -v ${pinnedName}`, { encoding: "utf8" }).trim();
  } catch {
    try {
      return execSync(`command -v ${name}`, { encoding: "utf8" }).trim();
    } catch {
      if (process.platform !== "darwin") {
        throw new Error(
          `${name} was not found on PATH; install LLVM ${PINNED_LLVM_VERSION} (${pinnedName}).`,
        );
      }

      return execFileSync("xcrun", ["--find", name], {
        encoding: "utf8",
      }).trim();
    }
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
  path.join(cppDir, "core", "QRCodeGeneratorBenchmark.cpp"),
  path.join(cppDir, "core", "QRCodeGenerator.cpp"),
  path.join(cppDir, "qrcodegen", "qrcodegen.cpp"),
];

const compileArgs = [
  "-std=c++20",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-O3",
  "-DNDEBUG",
  ...(smoke ? ["-DNITRO_BENCHMARK_SMOKE"] : []),
  `-I${path.join(cppDir, "core")}`,
  `-I${path.join(cppDir, "qrcodegen")}`,
  ...sources,
  "-o",
  outputFile,
  "-lz",
  process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread",
];

console.log("Compiling optimized C++ QRCode benchmark...");
runCommand(resolveTool("clang++"), compileArgs);

console.log("Running C++ QRCode benchmark...");
if (!smoke) {
  runCommand(outputFile, []);
} else {
  const output = execFileSync(outputFile, [], { encoding: "utf8" });
  process.stdout.write(output);
  const ceilingMicros = 1_000_000;
  const regressions = output
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(","))
    .filter((parts) => parts.length === 4)
    .filter((parts) => Number(parts[3]) > ceilingMicros);
  if (regressions.length > 0) {
    throw new Error(
      `C++ benchmark smoke exceeded ${ceilingMicros} average microseconds: ${regressions
        .map((parts) => `${parts[0]}=${parts[3]}`)
        .join(", ")}`,
    );
  }
}
