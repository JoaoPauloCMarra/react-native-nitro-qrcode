const { execFileSync, execSync } = require("child_process");

const PINNED_LLVM_VERSION = 18;

function environmentName(name) {
  if (name === "clang++") {
    return "CLANGXX";
  }
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function readLlvmVersion(env) {
  const configured = env.NITRO_LLVM_VERSION;
  if (configured === undefined) {
    return PINNED_LLVM_VERSION;
  }
  if (!/^[1-9]\d*$/.test(configured)) {
    throw new Error("NITRO_LLVM_VERSION must be a positive integer.");
  }
  return Number(configured);
}

function findOnPath(name, execSyncImpl) {
  const found = execSyncImpl(`command -v ${name}`, {
    encoding: "utf8",
  }).trim();
  if (found.length === 0) {
    throw new Error(`${name} resolved to an empty path.`);
  }
  return found;
}

function createLlvmToolResolver({
  env = process.env,
  platform = process.platform,
  execSync: execSyncImpl = execSync,
  execFileSync: execFileSyncImpl = execFileSync,
} = {}) {
  return function resolveLlvmTool(name) {
    const version = readLlvmVersion(env);
    const overrideKey = `NITRO_LLVM_${environmentName(name)}_PATH`;
    const override = env[overrideKey];
    if (override !== undefined) {
      const path = override.trim();
      if (path.length === 0) {
        throw new Error(`${overrideKey} must not be empty.`);
      }
      return path;
    }

    const pinnedName = `${name}-${version}`;
    try {
      return findOnPath(pinnedName, execSyncImpl);
    } catch {
      try {
        return findOnPath(name, execSyncImpl);
      } catch {
        if (platform !== "darwin") {
          throw new Error(
            `${name} was not found on PATH; install LLVM ${version} (${pinnedName}).`,
          );
        }

        try {
          const found = execFileSyncImpl("xcrun", ["--find", name], {
            encoding: "utf8",
          }).trim();
          if (found.length === 0) {
            throw new Error("xcrun returned an empty path.");
          }
          return found;
        } catch {
          throw new Error(
            `${name} was not found on PATH or by xcrun; install LLVM ${version} (${pinnedName}).`,
          );
        }
      }
    }
  };
}

const resolveLlvmTool = createLlvmToolResolver();

module.exports = {
  PINNED_LLVM_VERSION,
  createLlvmToolResolver,
  resolveLlvmTool,
};
