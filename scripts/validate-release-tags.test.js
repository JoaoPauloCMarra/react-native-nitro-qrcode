"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { test } = require("node:test");

const {
  validateDistTag,
  validateInputs,
  validateReleaseTag,
} = require("./validate-release-tags.js");

test("accepts valid release and dist-tag pairs", () => {
  for (const distTag of ["latest", "next", "beta", "canary-1", "preview_2"]) {
    validateInputs("v0.9.0", distTag, "v0.9.0");
  }
});

test("rejects unsafe release tags", () => {
  assert.throws(() => validateReleaseTag("v0.9.0\ninjected=true", "v0.9.0"), /unsafe/);
  assert.throws(() => validateReleaseTag("v0.9.0\u001b", "v0.9.0"), /unsafe/);
});

test("rejects unsafe dist-tags", () => {
  for (const value of [
    "latest\ninjected=true",
    "latest\r\ninjected=true",
    "next\u001b[31m",
    "latest tag",
    "latest/next",
    "latest;echo",
  ]) {
    assert.throws(() => validateDistTag(value), /unsafe/, JSON.stringify(value));
  }
  assert.throws(() => validateDistTag("v1.2.3"), /SemVer or range/);
  assert.throws(() => validateDistTag("v1.2"), /SemVer or range/);
});

test("enforces the release tag length bound", () => {
  const longest = `v${"1".repeat(127)}`;
  assert.equal(longest.length, 128);
  assert.equal(validateReleaseTag(longest, longest), longest);
  const tooLong = `${longest}1`;
  assert.throws(() => validateReleaseTag(tooLong, tooLong), /between 1 and 128/);
  assert.throws(() => validateReleaseTag("", "v0.9.0"), /between 1 and 128/);
});

test("enforces the dist-tag length bound", () => {
  const longest = "a".repeat(63);
  assert.equal(validateDistTag(longest), longest);
  assert.throws(() => validateDistTag(`${longest}a`), /between 1 and 63/);
  assert.throws(() => validateDistTag(""), /between 1 and 63/);
});

test("rejects a release tag that does not match the package version", () => {
  assert.throws(() => validateReleaseTag("v0.9.1", "v0.9.0"), /does not match v0.9.0/);
  assert.throws(() => validateInputs("v0.9.1", "latest", "v0.9.0"), /does not match/);
});

test("rejects non-string inputs", () => {
  assert.throws(() => validateReleaseTag(undefined, "v0.9.0"), /RELEASE_TAG must be a string/);
  assert.throws(() => validateDistTag(undefined), /DIST_TAG must be a string/);
});

test("the command line validates and reports unsafe input", () => {
  const script = path.join(__dirname, "validate-release-tags.js");
  const accepted = spawnSync(process.execPath, [script, "v0.9.0", "latest", "v0.9.0"], {
    encoding: "utf8",
  });
  assert.equal(accepted.status, 0, accepted.stderr);
  const rejected = spawnSync(process.execPath, [script, "v0.9.1", "latest", "v0.9.0"], {
    encoding: "utf8",
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /does not match/);
  const usage = spawnSync(process.execPath, [script, "--test"], { encoding: "utf8" });
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /Usage:/);
});
