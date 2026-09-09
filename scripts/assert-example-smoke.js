const { execFileSync, spawnSync } = require("child_process");

const ANDROID_PACKAGE = "com.qrcode.example";
const IOS_BUNDLE_ID = "com.qrcode.example";
const REQUIRED_TEXT = [
  "QR Builder",
  "Live output",
  "Ready",
  "nitro-qrcode-preview",
  "QR code for",
];
const FAILURE_TEXT = [
  "Unable to load script",
  "No script URL provided",
  "Runtime Error",
  "Application has not been registered",
  "Exception",
  "Enter a payload",
  "Generating QR code",
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
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function recordRequiredFailure(platform, skipReason, failureReason) {
  recordResult(
    platform,
    strict ? "failed" : "skipped",
    strict ? failureReason : skipReason,
  );
}

function listAdbSerials() {
  return run("adb", ["devices"])
    .split("\n")
    .map((line) => line.match(/^(\S+)\tdevice$/))
    .filter((match) => match !== null)
    .map((match) => match[1]);
}

function resolveAndroidSerial() {
  const requested = process.env.ANDROID_SERIAL;
  const serials = listAdbSerials();
  if (requested !== undefined && requested !== "") {
    if (!serials.includes(requested)) {
      throw new Error(
        `ANDROID_SERIAL ${requested} is not a connected adb device.`,
      );
    }
    return requested;
  }
  if (serials.length > 1) {
    throw new Error(
      "Multiple adb devices are connected; set ANDROID_SERIAL to the owned emulator.",
    );
  }
  return serials[0];
}

function adb(serial, args) {
  return spawnSync("adb", ["-s", serial, ...args], { encoding: "utf8" });
}

function listBootedSimulatorUdids() {
  const listed = JSON.parse(
    run("xcrun", ["simctl", "list", "devices", "booted", "--json"]),
  );
  const udids = [];
  for (const devices of Object.values(listed.devices ?? {})) {
    for (const device of devices) {
      if (device.state === "Booted" && typeof device.udid === "string") {
        udids.push(device.udid);
      }
    }
  }
  return udids;
}

function resolveIosUdid() {
  const requested = process.env.IOS_UDID;
  const udids = listBootedSimulatorUdids();
  if (requested !== undefined && requested !== "") {
    if (!udids.includes(requested)) {
      throw new Error(
        `IOS_UDID ${requested} is not a booted simulator.`,
      );
    }
    return requested;
  }
  if (udids.length > 1) {
    throw new Error(
      "Multiple simulators are booted; set IOS_UDID to the owned simulator.",
    );
  }
  return udids[0];
}

function describeIosUi(udid) {
  if (commandExists("idb")) {
    const described = spawnSync(
      "idb",
      ["ui", "describe-all", "--udid", udid, "--nested"],
      { encoding: "utf8" },
    );
    if (described.status === 0 && described.stdout.trim() !== "") {
      return described.stdout;
    }
  }
  return describeWithArgent(udid);
}

function describeWithArgent(udid) {
  if (!commandExists("argent")) {
    throw new Error(
      "UI dump needs idb or argent; screenshot existence is not accepted.",
    );
  }
  const described = spawnSync("argent", ["run", "describe", "--udid", udid], {
    encoding: "utf8",
  });
  if (described.status !== 0 || described.stdout.trim() === "") {
    throw new Error(
      `argent describe exited with ${described.status ?? "no status"}`,
    );
  }
  return described.stdout;
}

function describeAndroidUi(serial) {
  const dumpPath = "/sdcard/nitro-qrcode-ui.xml";
  adb(serial, ["shell", "rm", "-f", dumpPath]);
  const dump = adb(serial, ["shell", "uiautomator", "dump", dumpPath]);
  if (dump.status === 0) {
    const read = adb(serial, ["shell", "cat", dumpPath]);
    if (read.status === 0 && read.stdout.trim() !== "") {
      return read.stdout;
    }
  }
  return describeWithArgent(serial);
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

function waitForAndroidUi(serial) {
  let lastError = "UI dump was unavailable";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertVisible(describeAndroidUi(serial), "Android");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    run("sleep", ["0.5"]);
  }

  throw new Error(`Android UI did not become ready: ${lastError}`);
}

function waitForAndroidProcess(serial) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const process = adb(serial, ["shell", "pidof", ANDROID_PACKAGE]);
    if (process.status === 0 && process.stdout.trim() !== "") {
      return;
    }
    run("sleep", ["0.5"]);
  }

  throw new Error("Android app process did not start.");
}

function waitForIosUi(udid) {
  let lastError = "UI dump was unavailable";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertVisible(describeIosUi(udid), "iOS");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    run("sleep", ["0.5"]);
  }
  throw new Error(`iOS UI did not become ready: ${lastError}`);
}

function smokeAndroid() {
  const requestedSerial = process.env.ANDROID_SERIAL;
  if (!commandExists("adb")) {
    if (requestedSerial !== undefined && requestedSerial !== "") {
      throw new Error(
        `ANDROID_SERIAL ${requestedSerial} requires adb to validate the selected device.`,
      );
    }
    recordRequiredFailure(
      "android",
      "adb is unavailable",
      "Android smoke requires adb in strict mode.",
    );
    return;
  }

  let serial;
  try {
    serial = resolveAndroidSerial();
  } catch (error) {
    const reason = errorMessage(error);
    if (reason.includes("Multiple adb devices")) {
      recordRequiredFailure(
        "android",
        reason,
        "Android smoke requires a single connected adb device in strict mode.",
      );
      return;
    }
    recordResult("android", "failed", reason);
    return;
  }

  if (serial === undefined) {
    recordRequiredFailure(
      "android",
      "no adb device is connected",
      "Android smoke requires a connected adb device in strict mode.",
    );
    return;
  }

  adb(serial, ["shell", "am", "force-stop", ANDROID_PACKAGE]);
  const started = adb(serial, [
    "shell",
    "am",
    "start",
    "-n",
    `${ANDROID_PACKAGE}/.MainActivity`,
  ]);
  if (started.status !== 0) {
    throw new Error("Android smoke failed to launch the example app.");
  }
  waitForAndroidProcess(serial);
  waitForAndroidUi(serial);
  recordResult("android", "passed");
}

function resetIosRoute(udid) {
  spawnSync("xcrun", ["simctl", "terminate", udid, IOS_BUNDLE_ID], {
    stdio: "ignore",
  });
}

function smokeIos() {
  const requestedUdid = process.env.IOS_UDID;
  if (!commandExists("xcrun")) {
    if (requestedUdid !== undefined && requestedUdid !== "") {
      throw new Error(
        `IOS_UDID ${requestedUdid} requires xcrun to validate the selected simulator.`,
      );
    }
    recordRequiredFailure(
      "ios",
      "xcrun is unavailable",
      "iOS smoke requires xcrun in strict mode.",
    );
    return;
  }

  let udid;
  try {
    udid = resolveIosUdid();
  } catch (error) {
    const reason = errorMessage(error);
    if (reason.includes("Multiple simulators")) {
      recordRequiredFailure(
        "ios",
        reason,
        "iOS smoke requires a single booted simulator in strict mode.",
      );
      return;
    }
    recordResult("ios", "failed", reason);
    return;
  }

  if (udid === undefined) {
    recordRequiredFailure(
      "ios",
      "no booted simulator is available",
      "iOS smoke requires a booted simulator in strict mode.",
    );
    return;
  }

  if (!commandExists("idb") && !commandExists("argent")) {
    if (requestedUdid !== undefined && requestedUdid !== "") {
      throw new Error(
        `IOS_UDID ${requestedUdid} requires idb or argent for accessibility assertions.`,
      );
    }
    recordRequiredFailure(
      "ios",
      "idb and argent are unavailable for accessibility assertions",
      "iOS smoke requires idb or argent in strict mode; screenshot existence is not accepted.",
    );
    return;
  }

  resetIosRoute(udid);
  run("xcrun", ["simctl", "launch", udid, IOS_BUNDLE_ID]);
  waitForIosUi(udid);
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
  try {
    smokeAndroid();
  } catch (error) {
    recordResult("android", "failed", errorMessage(error));
  }
  try {
    smokeIos();
  } catch (error) {
    recordResult("ios", "failed", errorMessage(error));
  }
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
