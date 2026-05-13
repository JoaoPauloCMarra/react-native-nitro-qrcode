const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ANDROID_PACKAGE = "com.qrcode.example";
const IOS_BUNDLE_ID = "com.qrcode.example";
const REQUIRED_TEXT = ["QR Builder", "Live output"];
const FAILURE_TEXT = [
  "Unable to load script",
  "No script URL provided",
  "Runtime Error",
  "Application has not been registered",
  "Exception",
];

function commandExists(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" });
}

function assertVisible(output, platform) {
  for (const text of REQUIRED_TEXT) {
    if (!output.includes(text)) {
      throw new Error(`${platform} smoke did not find "${text}".`);
    }
  }

  for (const text of FAILURE_TEXT) {
    if (output.includes(text)) {
      throw new Error(`${platform} smoke found failure text "${text}".`);
    }
  }
}

function smokeAndroid() {
  if (!commandExists("adb")) {
    console.log("Android smoke skipped: adb is unavailable.");
    return;
  }

  const devices = run("adb", ["devices"]);
  if (!/\tdevice\b/.test(devices)) {
    console.log("Android smoke skipped: no adb device is connected.");
    return;
  }

  run("adb", ["shell", "pidof", ANDROID_PACKAGE]);
  run("adb", ["shell", "uiautomator", "dump", "/sdcard/nitro-qrcode-ui.xml"]);
  const output = run("adb", ["shell", "cat", "/sdcard/nitro-qrcode-ui.xml"]);
  assertVisible(output, "Android");
  console.log("Android smoke passed.");
}

function smokeIos() {
  if (!commandExists("xcrun")) {
    console.log("iOS smoke skipped: xcrun is unavailable.");
    return;
  }

  const booted = run("xcrun", ["simctl", "list", "devices", "booted"]);
  if (!booted.includes("Booted")) {
    console.log("iOS smoke skipped: no booted simulator is available.");
    return;
  }

  run("xcrun", ["simctl", "launch", "booted", IOS_BUNDLE_ID]);
  const screenshotPath = path.join(os.tmpdir(), "nitro-qrcode-ios-smoke.png");
  fs.rmSync(screenshotPath, { force: true });
  run("xcrun", ["simctl", "io", "booted", "screenshot", screenshotPath]);
  const stats = fs.statSync(screenshotPath);
  fs.rmSync(screenshotPath, { force: true });
  if (stats.size === 0) {
    throw new Error("iOS smoke screenshot was empty.");
  }
  console.log("iOS smoke passed.");
}

smokeAndroid();
smokeIos();
