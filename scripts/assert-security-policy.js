"use strict";

const fs = require("node:fs");
const path = require("node:path");

function checkSecurityPolicy(policy, version) {
  const [major, minor] = version.split(".");
  const line = `${major}.${minor}.x`;
  const failures = [];
  const rows = policy
    .split("\n")
    .filter((row) => row.startsWith("|") && /\|\s*(Yes|No)\s*\|$/.test(row));
  const supported = rows.filter((row) => /\|\s*Yes\s*\|$/.test(row));
  if (supported.length !== 1 || !supported[0].includes(`\`${line}\` (latest)`)) {
    failures.push(
      `SECURITY.md must list exactly one supported row: \`${line}\` (latest).`,
    );
  }
  if (!rows.some((row) => /^\| All earlier `0\.x` lines \| No \|$/.test(row))) {
    failures.push("SECURITY.md must list the row: All earlier `0.x` lines | No.");
  }
  if (!/fpng/.test(policy) || !/streaming zlib/i.test(policy)) {
    failures.push(
      "SECURITY.md must name both the fpng and the streaming zlib RGBA gradient encoders.",
    );
  }
  return failures;
}

module.exports = { checkSecurityPolicy };

if (require.main === module) {
  const root = path.join(__dirname, "..");
  const policy = fs.readFileSync(path.join(root, "SECURITY.md"), "utf8");
  const { version } = JSON.parse(
    fs.readFileSync(
      path.join(root, "packages", "react-native-nitro-qrcode", "package.json"),
      "utf8",
    ),
  );
  const failures = checkSecurityPolicy(policy, version);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }
  console.log(`SECURITY.md matches package version ${version}.`);
}
