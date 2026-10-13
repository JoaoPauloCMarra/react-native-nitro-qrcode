const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = process.env.CODEGEN_CHECK_ROOT ?? path.resolve(__dirname, "..");
const packageDir = path.join(
  projectRoot,
  "packages",
  "react-native-nitro-qrcode"
);
const generatedDir = path.join(packageDir, "nitrogen", "generated");
const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "qrcode-codegen-check-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    stdio: "pipe",
    encoding: "utf8",
  });
  return result;
}

function snapshotDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  if (!fs.existsSync(source)) {
    return;
  }
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      snapshotDirectory(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function restoreDirectory(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  if (!fs.existsSync(source)) {
    return;
  }
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      snapshotDirectory(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function listLines(args) {
  const result = run("git", args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line.length > 0);
}

function findDrift() {
  const scope = path.relative(projectRoot, generatedDir);
  return [
    ...listLines(["diff", "--name-only", "--", scope]),
    ...listLines(["ls-files", "--others", "--exclude-standard", "--", scope]),
  ];
}

const snapshotDir = path.join(tmpDir, "generated-snapshot");
snapshotDirectory(generatedDir, snapshotDir);

const codegen = run("bun", ["run", "codegen"], { cwd: packageDir });
if (codegen.status !== 0) {
  restoreDirectory(snapshotDir, generatedDir);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.error(codegen.stderr);
  console.error("Codegen failed; generated bindings were restored.");
  process.exit(codegen.status ?? 1);
}

let drift;
try {
  drift = findDrift();
} finally {
  restoreDirectory(snapshotDir, generatedDir);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (drift.length > 0) {
  console.error(
    `Generated Nitro bindings drifted: ${drift.length} file(s) changed.\n` +
      `${drift.slice(0, 20).join("\n")}\n` +
      "Run `bun run codegen` and commit the regenerated bindings."
  );
  process.exit(1);
}

console.log("Generated Nitro bindings are up to date.");
