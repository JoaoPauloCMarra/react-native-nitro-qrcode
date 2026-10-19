"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { requiredPackageFiles, sourceModuleFiles } = require("./audit-package-contents.js");

const packageDir = path.join(__dirname, "..", "packages", "react-native-nitro-qrcode");

test("every source module is required in all five shipped forms", () => {
  const required = new Set(requiredPackageFiles(packageDir));
  for (const name of ["qr-regions", "QRCode.nitro", "index.web", "validation"]) {
    for (const file of [
      `src/${name}.ts`,
      `lib/commonjs/${name}.js`,
      `lib/module/${name}.js`,
      `lib/typescript/commonjs/${name}.d.ts`,
      `lib/typescript/module/${name}.d.ts`,
    ]) {
      assert.ok(required.has(file), file);
    }
  }
});

test("derived entries follow the src directory and skip tests and declarations", () => {
  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), "nitro-qrcode-audit-"));
  try {
    fs.writeFileSync(path.join(srcDir, "alpha.ts"), "");
    fs.writeFileSync(path.join(srcDir, "beta.tsx"), "");
    fs.writeFileSync(path.join(srcDir, "types.d.ts"), "");
    fs.mkdirSync(path.join(srcDir, "__tests__"));
    fs.writeFileSync(path.join(srcDir, "__tests__", "alpha.test.ts"), "");
    const files = sourceModuleFiles(srcDir);
    assert.equal(files.length, 10);
    assert.ok(files.includes("lib/module/beta.js"));
    assert.ok(!files.some((file) => /types\.|__tests__|alpha\.test/.test(file)));
  } finally {
    fs.rmSync(srcDir, { recursive: true, force: true });
  }
});

test("the literal list covers the non-module package files", () => {
  const required = requiredPackageFiles(packageDir);
  for (const file of ["package.json", "app.plugin.js", "cpp/core/QRCodeGenerator.cpp"]) {
    assert.ok(required.includes(file), file);
  }
});
