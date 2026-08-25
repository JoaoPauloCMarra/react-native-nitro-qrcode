const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const packageDir = path.join(
  __dirname,
  "..",
  "packages",
  "react-native-nitro-qrcode"
);
const packageManifest = require(path.join(packageDir, "package.json"));
const cppDir = path.join(packageDir, "cpp");
const buildDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "react-native-nitro-qrcode-benchmark-"),
);
const outputFile = path.join(buildDir, "qrcode_generator_benchmark");
const smoke = process.argv.includes("--smoke");

if (packageManifest.name !== "react-native-nitro-qrcode") {
  throw new Error(
    `Benchmark setup failed: expected react-native-nitro-qrcode, got ${packageManifest.name}.`,
  );
}

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

function parseBenchmarkOutput(output) {
  const lines = output.trim().split(/\r?\n/);
  const headerIndex = lines.indexOf("benchmark,runs,total_us,avg_us");
  if (headerIndex < 0) {
    throw new Error("C++ benchmark did not emit its CSV header");
  }

  return lines
    .slice(headerIndex + 1)
    .map((line) => line.split(","))
    .filter((parts) => parts.length === 4)
    .map(([benchmark, runs, totalUs, averageUs]) => ({
      benchmark,
      runs: Number(runs),
      totalUs: Number(totalUs),
      averageUs: Number(averageUs),
    }));
}

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
try {
  runCommand(resolveTool("clang++"), compileArgs);

  console.log(
    `Benchmark package: ${packageManifest.name}@${packageManifest.version}`,
  );
  console.log(
    "Benchmark scope: isolated optimized C++ process with a temporary build directory; no repository build state is reused.",
  );
  console.log("Running C++ QRCode benchmark...");
  const output = execFileSync(outputFile, [], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  process.stdout.write(output);
  const metrics = parseBenchmarkOutput(output);
  if (smoke) {
    const ceilingMicros = 1_000_000;
    const regressions = metrics.filter(
      (metric) => metric.averageUs > ceilingMicros,
    );
    if (regressions.length > 0) {
      throw new Error(
        `C++ benchmark smoke exceeded ${ceilingMicros} average microseconds: ${regressions
          .map((metric) => `${metric.benchmark}=${metric.averageUs}`)
          .join(", ")}`,
      );
    }
  }
  console.log(
    `BENCHMARK_RESULT ${JSON.stringify({
      package: packageManifest.name,
      version: packageManifest.version,
      benchmark: "native-cpp-qrcode",
      scope: "isolated-native-cpp-process",
      smoke,
      compiler: "clang++ -O3 -DNDEBUG",
      metrics,
      platform: process.platform,
      architecture: process.arch,
    })}`,
  );
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
