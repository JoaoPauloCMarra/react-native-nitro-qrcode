"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { platformLinkArgs, sharedIncludeArgs, testSources } = require("./cpp-includes.js");

const root = path.join(__dirname, "..");

test("the shared include set covers the generated Nitro headers", () => {
  const args = sharedIncludeArgs(root);
  assert.ok(
    args.some((arg) => arg.endsWith(path.join("nitrogen", "generated", "shared", "c++"))),
  );
  assert.ok(args.some((arg) => arg.endsWith(path.join("cpp", "bindings"))));
  assert.ok(args.some((arg) => arg.endsWith(path.join("cpp", "core"))));
});

test("the C++ test and sanitizer runners use the same include set", () => {
  for (const script of ["test-cpp.js", "test-cpp-sanitize.js"]) {
    const source = fs.readFileSync(path.join(__dirname, script), "utf8");
    assert.match(source, /\.\.\.sharedIncludeArgs\(/, script);
    assert.match(source, /prepareNitroHeaders\(/, script);
    assert.doesNotMatch(source, /`-I\$\{path\.join\(cppDir, "(bindings|core|qrcodegen)"\)\}`/, script);
  }
});

test("testSources lists the binding layer and gates the memory test", () => {
  const packageDir = path.join(root, "packages", "react-native-nitro-qrcode");
  const names = (sources) => sources.map((source) => path.basename(source));
  const withMemory = names(testSources(packageDir, { includeMemory: true }));
  const withoutMemory = names(testSources(packageDir, { includeMemory: false }));
  for (const file of [
    "HybridQRCode.cpp",
    "HybridQRCodeSpec.cpp",
    "HybridQRCodeTest.cpp",
    "HybridQRCodeHardeningTest.cpp",
    "QRCodeBridgeOptions.cpp",
  ]) {
    assert.ok(withMemory.includes(file), file);
    assert.ok(withoutMemory.includes(file), file);
  }
  assert.ok(withMemory.includes("QRCodeMemoryTest.cpp"));
  assert.ok(!withoutMemory.includes("QRCodeMemoryTest.cpp"));
  for (const source of testSources(packageDir, { includeMemory: true })) {
    assert.ok(fs.existsSync(source), source);
  }
});

test("platformLinkArgs links zlib and picks the platform runtime", () => {
  const args = platformLinkArgs();
  assert.equal(args[0], "-lz");
  assert.equal(args[1], process.platform === "darwin" ? "-stdlib=libc++" : "-lpthread");
});

test("the sanitizer runner builds the binding layer with the shared source list", () => {
  const source = fs.readFileSync(path.join(__dirname, "test-cpp-sanitize.js"), "utf8");
  assert.match(source, /testSources\(/);
  assert.match(source, /-DNITRO_HYBRID_BINDING_TEST/);
  assert.match(source, /compileQuircObjects\(/);
  assert.match(source, /platformLinkArgs\(\)/);
  for (const script of ["test-cpp.js", "benchmark-cpp.js"]) {
    const text = fs.readFileSync(path.join(__dirname, script), "utf8");
    assert.match(text, /platformLinkArgs\(\)/, script);
    assert.doesNotMatch(text, /process\.platform === "darwin"/, script);
  }
});
