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
const strict =
  process.argv.includes("--strict") || process.env.QRCODE_SMOKE_STRICT === "1";
const selfCheck =
  process.argv.includes("--self-check") ||
  process.env.QRCODE_SMOKE_SELF_CHECK === "1";

const results = [];

function recordResult(platform, state, reason) {
  results.push({ platform, state, reason });
  const label = state === "passed" ? "PASSED" : state === "failed" ? "FAILED" : "SKIPPED";
  const suffix = reason === undefined ? "" : `: ${reason}`;
  console.log(`[smoke] ${platform}: ${label}${suffix}`);
}

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

function waitForAndroidUi() {
  const dumpPath = "/sdcard/nitro-qrcode-ui.xml";
  let lastError = "UI dump was unavailable";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    spawnSync("adb", ["shell", "rm", "-f", dumpPath], { stdio: "ignore" });
    const dump = spawnSync(
      "adb",
      ["shell", "uiautomator", "dump", dumpPath],
      { encoding: "utf8" },
    );

    if (dump.status === 0) {
      const output = run("adb", ["shell", "cat", dumpPath]);
      try {
        assertVisible(output, "Android");
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    } else {
      lastError = `uiautomator dump exited with ${dump.status ?? "no status"}`;
    }

    run("sleep", ["0.5"]);
  }

  throw new Error(`Android UI did not become ready: ${lastError}`);
}

function waitForAndroidProcess() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const process = spawnSync(
      "adb",
      ["shell", "pidof", ANDROID_PACKAGE],
      { encoding: "utf8" },
    );
    if (process.status === 0 && process.stdout.trim() !== "") {
      return;
    }
    run("sleep", ["0.5"]);
  }

  throw new Error("Android app process did not start.");
}

function smokeAndroid() {
  if (!commandExists("adb")) {
    recordResult("android", "skipped", "adb is unavailable");
    if (strict) {
      throw new Error("Android smoke requires adb in strict mode.");
    }
    return;
  }

  const devices = run("adb", ["devices"]);
  if (!/\tdevice\b/.test(devices)) {
    recordResult("android", "skipped", "no adb device is connected");
    if (strict) {
      throw new Error(
        "Android smoke requires a connected adb device in strict mode.",
      );
    }
    return;
  }

  run("adb", ["shell", "am", "force-stop", ANDROID_PACKAGE]);
  run("adb", ["shell", "monkey", "-p", ANDROID_PACKAGE, "1"]);
  waitForAndroidProcess();
  waitForAndroidUi();
  recordResult("android", "passed");
}

function smokeIos() {
  if (!commandExists("xcrun")) {
    recordResult("ios", "skipped", "xcrun is unavailable");
    if (strict) {
      throw new Error("iOS smoke requires xcrun in strict mode.");
    }
    return;
  }

  const booted = run("xcrun", ["simctl", "list", "devices", "booted"]);
  if (!booted.includes("Booted")) {
    recordResult("ios", "skipped", "no booted simulator is available");
    if (strict) {
      throw new Error("iOS smoke requires a booted simulator in strict mode.");
    }
    return;
  }

  run("xcrun", ["simctl", "launch", "booted", IOS_BUNDLE_ID]);
  const screenshotPath = path.join(os.tmpdir(), "nitro-qrcode-ios-smoke.png");
  fs.rmSync(screenshotPath, { force: true });
  run("xcrun", ["simctl", "io", "booted", "screenshot", screenshotPath]);
  const stats = fs.statSync(screenshotPath);
  fs.rmSync(screenshotPath, { force: true });
  if (stats.size === 0) {
    recordResult("ios", "failed", "screenshot was empty");
    throw new Error("iOS smoke screenshot was empty.");
  }
  recordResult("ios", "passed");
}

function runSelfCheck() {
  console.log("[smoke] self-check: verifying terminal-state reporting");
  const started = results.length;
  recordResult("self-executed", "passed", "verification");
  recordResult("self-skipped", "skipped", "verification");
  recordResult("self-failed", "failed", "verification");
  if (results.length !== started + 3) {
    throw new Error("self-check failed to record every terminal state.");
  }
  const states = new Set(results.slice(started).map((result) => result.state));
  if (
    !states.has("passed") ||
    !states.has("skipped") ||
    !states.has("failed")
  ) {
    throw new Error(
      `self-check did not record every terminal state: ${[...states].join(", ")}`,
    );
  }
  results.splice(started);
  const failureDetection = [
    { state: "passed" },
    { state: "skipped" },
    { state: "failed" },
  ].filter((result) => result.state === "failed");
  if (failureDetection.length !== 1) {
    throw new Error("self-check could not detect a failed result.");
  }
  console.log(
    "[smoke] self-check passed: executed, skipped, and failed states are recorded",
  );
}

if (selfCheck) {
  runSelfCheck();
} else {
  smokeAndroid();
  smokeIos();
  const executed = results.filter((result) => result.state === "passed").length;
  const skipped = results.filter((result) => result.state === "skipped").length;
  const failed = results.filter((result) => result.state === "failed").length;
  console.log(
    `[smoke] summary: ${results.length} results (${executed} passed, ${skipped} skipped, ${failed} failed)`,
  );
  if (failed > 0) {
    process.exit(1);
  }
  if (strict && executed === 0) {
    throw new Error(
      "Strict smoke requires at least one executed case; both platforms were skipped.",
    );
  }
  if (results.length === 0) {
    throw new Error("Smoke recorded no results; it cannot silently pass.");
  }
}
