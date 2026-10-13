"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { sharedIncludeArgs } = require("./cpp-includes.js");

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
