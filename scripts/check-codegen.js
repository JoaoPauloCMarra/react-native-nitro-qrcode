const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
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

function walkFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else {
      files.push(full);
    }
  }
  return files.sort();
}

function fingerprint(dir) {
  const before = new Map();
  for (const file of walkFiles(dir)) {
    before.set(path.relative(dir, file), fs.readFileSync(file, "utf8"));
  }
  return before;
}

const snapshotDir = path.join(tmpDir, "generated-snapshot");
snapshotDirectory(generatedDir, snapshotDir);
const beforeFingerprint = fingerprint(generatedDir);

const codegen = run("bun", ["run", "codegen"], { cwd: packageDir });
if (codegen.status !== 0) {
  restoreDirectory(snapshotDir, generatedDir);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.error(codegen.stderr);
  console.error("Codegen failed; generated bindings were restored.");
  process.exit(codegen.status ?? 1);
}

const afterFingerprint = fingerprint(generatedDir);
const drift = [];
for (const [relative, content] of afterFingerprint) {
  if (!beforeFingerprint.has(relative) || beforeFingerprint.get(relative) !== content) {
    drift.push(relative);
  }
}
for (const relative of beforeFingerprint.keys()) {
  if (!afterFingerprint.has(relative)) {
    drift.push(relative);
  }
}

restoreDirectory(snapshotDir, generatedDir);
fs.rmSync(tmpDir, { recursive: true, force: true });

if (drift.length > 0) {
  console.error(
    `Generated Nitro bindings drifted: ${drift.length} file(s) changed.\n` +
      `${drift.slice(0, 20).join("\n")}\n` +
      "Run `bun run codegen` and commit the regenerated bindings."
  );
  process.exit(1);
}

console.log("Generated Nitro bindings are up to date.");
