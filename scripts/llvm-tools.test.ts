import { describe, expect, it } from "bun:test";

const { createLlvmToolResolver } = require("./llvm-tools.js") as {
  createLlvmToolResolver: (options?: {
    env?: Record<string, string | undefined>;
    platform?: string;
    execSync?: (command: string, options: { encoding: string }) => string;
    execFileSync?: (
      command: string,
      args: string[],
      options: { encoding: string },
    ) => string;
  }) => (name: string) => string;
};

describe("LLVM executable discovery", () => {
  it("prefers the configured pinned version on PATH", () => {
    const commands: string[] = [];
    const resolve = createLlvmToolResolver({
      env: {},
      platform: "linux",
      execSync(command) {
        commands.push(command);
        if (command === "command -v clang++-18") {
          return "/opt/llvm-18/bin/clang++\n";
        }
        throw new Error(`unexpected lookup: ${command}`);
      },
    });

    expect(resolve("clang++")).toBe("/opt/llvm-18/bin/clang++");
    expect(commands).toEqual(["command -v clang++-18"]);
  });

  it("falls back to an unversioned executable", () => {
    const commands: string[] = [];
    const resolve = createLlvmToolResolver({
      env: {},
      platform: "linux",
      execSync(command) {
        commands.push(command);
        if (command === "command -v clang-18") {
          throw new Error("pinned compiler missing");
        }
        if (command === "command -v clang") {
          return "/usr/bin/clang\n";
        }
        throw new Error(`unexpected lookup: ${command}`);
      },
    });

    expect(resolve("clang")).toBe("/usr/bin/clang");
    expect(commands).toEqual(["command -v clang-18", "command -v clang"]);
  });

  it("honors an explicit executable path override", () => {
    const resolve = createLlvmToolResolver({
      env: { NITRO_LLVM_VERSION: "19", NITRO_LLVM_CLANGXX_PATH: "/opt/custom/clang++" },
      platform: "linux",
      execSync() {
        throw new Error("PATH lookup should not run when overridden");
      },
    });

    expect(resolve("clang++")).toBe("/opt/custom/clang++");
  });

  it("uses a valid LLVM version override for PATH lookup", () => {
    const commands: string[] = [];
    const resolve = createLlvmToolResolver({
      env: { NITRO_LLVM_VERSION: "20" },
      platform: "linux",
      execSync(command) {
        commands.push(command);
        if (command === "command -v llvm-cov-20") {
          return "/opt/llvm-20/bin/llvm-cov\n";
        }
        throw new Error(`unexpected lookup: ${command}`);
      },
    });

    expect(resolve("llvm-cov")).toBe("/opt/llvm-20/bin/llvm-cov");
    expect(commands).toEqual(["command -v llvm-cov-20"]);
  });

  it("reports the required pinned tool and version when it is missing", () => {
    const resolve = createLlvmToolResolver({
      env: {},
      platform: "linux",
      execSync() {
        throw new Error("not found");
      },
    });

    expect(() => resolve("clang++")).toThrow(
      "clang++ was not found on PATH; install LLVM 18 (clang++-18).",
    );
  });

  it("uses xcrun on macOS and reports its failure clearly", () => {
    const fileCalls: string[][] = [];
    const resolve = createLlvmToolResolver({
      env: {},
      platform: "darwin",
      execSync() {
        throw new Error("not found on PATH");
      },
      execFileSync(command, args) {
        fileCalls.push([command, ...args]);
        throw new Error("xcrun cannot locate clang");
      },
    });

    expect(() => resolve("clang")).toThrow(
      "clang was not found on PATH or by xcrun; install LLVM 18 (clang-18).",
    );
    expect(fileCalls).toEqual([["xcrun", "--find", "clang"]]);
  });
});
