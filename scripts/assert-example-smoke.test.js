"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..");
const smokeScript = path.join(__dirname, "assert-example-smoke.js");

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, `#!/bin/sh\n${contents}`);
  fs.chmodSync(filePath, 0o755);
}

function runSmoke({ which, adb, xcrun, idb, env = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nitro-qrcode-smoke-"));
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  const availableCommands = [
    adb === undefined ? null : "adb",
    xcrun === undefined ? null : "xcrun",
    idb === undefined ? null : "idb",
  ].filter((command) => command !== null);
  writeExecutable(
    path.join(bin, "which"),
    which ??
      `case "$1" in
  ${availableCommands.length === 0 ? "__none__" : availableCommands.join("|")}) exit 0 ;;
  *) exit 1 ;;
esac`,
  );
  if (adb !== undefined) writeExecutable(path.join(bin, "adb"), adb);
  if (xcrun !== undefined) writeExecutable(path.join(bin, "xcrun"), xcrun);
  if (idb !== undefined) writeExecutable(path.join(bin, "idb"), idb);

  try {
    const baseEnv = { ...process.env };
    for (const variable of [
      "QRCODE_SMOKE_SELF_CHECK",
      "QRCODE_SMOKE_STRICT",
      "ANDROID_SERIAL",
      "IOS_UDID",
    ]) {
      delete baseEnv[variable];
    }
    return spawnSync(process.execPath, [smokeScript], {
      cwd: repoRoot,
      env: { ...baseEnv, PATH: bin, ...env },
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const adbWithDevice = [
  'if [ "$1" = "devices" ]; then',
  "  printf 'List of devices attached\\nemulator-5554\\tdevice\\n'",
  "  exit 0",
  "fi",
  "exit 0",
].join("\n");

const xcrunWithBootedSimulator = [
  'if [ "$1" = "simctl" ] && [ "$2" = "list" ]; then',
  '  printf \'%s\' \'{"devices":{"iOS 18":[{"name":"Example","udid":"booted-udid","state":"Booted"}]}}\'',
  "  exit 0",
  "fi",
  "exit 0",
].join("\n");

test("fails an explicitly selected Android serial that is not connected", () => {
  const result = runSmoke({
    adb: adbWithDevice,
    env: { ANDROID_SERIAL: "missing-serial" },
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /android: FAILED/);
  assert.match(result.stdout, /ANDROID_SERIAL missing-serial/);
  assert.match(result.stdout, /summary: .*1 failed/);
});

test("fails an explicitly selected Android serial when adb is unavailable", () => {
  const result = runSmoke({
    env: { ANDROID_SERIAL: "missing-serial" },
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /android: FAILED/);
  assert.match(result.stdout, /ANDROID_SERIAL missing-serial.*adb/);
  assert.match(result.stdout, /summary: .*1 failed/);
});

test("fails an explicitly selected iOS simulator that is not booted", () => {
  const result = runSmoke({
    xcrun: xcrunWithBootedSimulator,
    env: { IOS_UDID: "missing-udid" },
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /ios: FAILED/);
  assert.match(result.stdout, /IOS_UDID missing-udid/);
  assert.match(result.stdout, /summary: .*1 failed/);
});

test("fails an explicitly selected iOS simulator when xcrun is unavailable", () => {
  const result = runSmoke({
    env: { IOS_UDID: "missing-udid" },
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /ios: FAILED/);
  assert.match(result.stdout, /IOS_UDID missing-udid.*xcrun/);
  assert.match(result.stdout, /summary: .*1 failed/);
});

test("fails an explicitly selected iOS simulator without accessibility tooling", () => {
  const result = runSmoke({
    xcrun: xcrunWithBootedSimulator,
    env: { IOS_UDID: "booted-udid" },
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /ios: FAILED/);
  assert.match(result.stdout, /IOS_UDID booted-udid.*idb or argent/);
  assert.match(result.stdout, /summary: .*1 failed/);
});

test("reports adb discovery errors as terminal failures", () => {
  const result = runSmoke({
    adb: [
      "printf '%s\\n' 'adb discovery failed' >&2",
      "exit 1",
    ].join("\n"),
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /android: FAILED/);
  assert.match(result.stdout, /summary: .*1 failed/);
});

test("prints a summary when Android launch fails", () => {
  const result = runSmoke({
    adb: [
      'if [ "$1" = "devices" ]; then',
      "  printf 'List of devices attached\\nemulator-5554\\tdevice\\n'",
      "  exit 0",
      "fi",
      'if [ "$1" = "-s" ] && [ "$3" = "shell" ] && [ "$4" = "am" ] && [ "$5" = "start" ]; then',
      "  exit 1",
      "fi",
      "exit 0",
    ].join("\n"),
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /android: FAILED: Android smoke failed to launch/);
  assert.match(result.stdout, /summary: .*1 failed/);
});

test("keeps missing tools as non-strict skips", () => {
  const result = runSmoke();

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /android: SKIPPED/);
  assert.match(result.stdout, /ios: SKIPPED/);
  assert.match(result.stdout, /summary: .*2 skipped, 0 failed/);
});

test("resets iOS app before launch so home assertions cannot reuse the e2e route", () => {
  const routeStatePath = path.join(
    os.tmpdir(),
    `nitro-qrcode-ios-route-${process.pid}-${Date.now()}`,
  );
  fs.rmSync(routeStatePath, { force: true });

  const xcrun = [
    'if [ "$1" = "simctl" ] && [ "$2" = "list" ]; then',
    '  printf \'%s\' \'{"devices":{"iOS 18":[{"name":"Example","udid":"booted-udid","state":"Booted"}]}}\'',
    "  exit 0",
    "fi",
    'if [ "$1" = "simctl" ] && [ "$2" = "terminate" ]; then',
    '  : > "$IOS_ROUTE_STATE"',
    "  exit 0",
    "fi",
    'if [ "$1" = "simctl" ] && [ "$2" = "launch" ]; then',
    '  test -f "$IOS_ROUTE_STATE"',
    "  exit $?",
    "fi",
    "exit 0",
  ].join("\n");
  const idb = [
    'if [ "$1" = "ui" ]; then',
    "  printf '%s' 'QR Builder Live output Ready nitro-qrcode-preview QR code for'",
    "  exit 0",
    "fi",
    "exit 1",
  ].join("\n");

  try {
    const result = runSmoke({
      xcrun,
      idb,
      env: {
        IOS_ROUTE_STATE: routeStatePath,
        IOS_UDID: "booted-udid",
      },
    });

    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /ios: PASSED/);
    assert.match(result.stdout, /summary: .*1 passed, 1 skipped, 0 failed/);
  } finally {
    fs.rmSync(routeStatePath, { force: true });
  }
});
