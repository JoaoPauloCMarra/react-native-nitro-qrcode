"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { checkSecurityPolicy } = require("./assert-security-policy.js");

const root = path.join(__dirname, "..");
const policy = fs.readFileSync(path.join(root, "SECURITY.md"), "utf8");
const { version } = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages", "react-native-nitro-qrcode", "package.json"),
    "utf8",
  ),
);

test("accepts the repository SECURITY.md for the current package version", () => {
  assert.deepEqual(checkSecurityPolicy(policy, version), []);
});

test("rejects a policy whose latest row names an older minor line", () => {
  const [major, minor] = version.split(".").map(Number);
  const stale = policy.replaceAll(`${major}.${minor}.x`, `${major}.${minor - 1}.x`);
  assert.notEqual(stale, policy);
  assert.notDeepEqual(checkSecurityPolicy(stale, version), []);
});

test("rejects a policy that supports a second line", () => {
  const extra = policy.replace(
    "| All earlier `0.x` lines | No |",
    "| `0.9.x` | Yes |\n| All earlier `0.x` lines | No |",
  );
  assert.notEqual(extra, policy);
  assert.notDeepEqual(checkSecurityPolicy(extra, version), []);
});

test("rejects a policy without the earlier-lines row", () => {
  const trimmed = policy.replace(/^\| All earlier .*\n/m, "");
  assert.notEqual(trimmed, policy);
  assert.notDeepEqual(checkSecurityPolicy(trimmed, version), []);
});

test("rejects an encoder description that omits the streamed gradient path", () => {
  const stale = policy.replace(/streaming zlib/gi, "zlib");
  assert.notEqual(stale, policy);
  assert.notDeepEqual(checkSecurityPolicy(stale, version), []);
});
