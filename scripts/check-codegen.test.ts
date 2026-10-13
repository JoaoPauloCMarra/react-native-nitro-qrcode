import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = path.join(import.meta.dir, "check-codegen.js");
const roots: string[] = [];

function git(root: string, ...args: string[]) {
  const result = spawnSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args],
    { cwd: root, encoding: "utf8" },
  );
  expect(result.status).toBe(0);
}

function createFixture(committedContent: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codegen-check-"));
  roots.push(root);
  const packageDir = path.join(root, "packages", "react-native-nitro-qrcode");
  const generated = path.join(packageDir, "nitrogen", "generated");
  fs.mkdirSync(generated, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({ scripts: { codegen: "node regen.js" } }),
  );
  fs.writeFileSync(
    path.join(packageDir, "regen.js"),
    `require("fs").writeFileSync(require("path").join(__dirname, "nitrogen", "generated", "binding.txt"), "fresh output");`,
  );
  fs.writeFileSync(path.join(generated, "binding.txt"), committedContent);
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "fixture");
  return { root, generated };
}

function runCheck(root: string) {
  return spawnSync("node", [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CODEGEN_CHECK_ROOT: root },
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("check-codegen", () => {
  it("passes when regenerated output matches the committed tree", () => {
    const { root } = createFixture("fresh output");
    const result = runCheck(root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("up to date");
  });

  it("fails when the committed output differs by one byte", () => {
    const { root, generated } = createFixture("fresh outpux");
    const result = runCheck(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("binding.txt");
    expect(fs.readFileSync(path.join(generated, "binding.txt"), "utf8")).toBe(
      "fresh outpux",
    );
  });

  it("fails when the working tree was pre-regenerated but not committed", () => {
    const { root, generated } = createFixture("stale");
    fs.writeFileSync(path.join(generated, "binding.txt"), "fresh output");
    const result = runCheck(root);
    expect(result.status).toBe(1);
  });

  it("fails when codegen produces a file that is not committed", () => {
    const { root } = createFixture("fresh output");
    fs.writeFileSync(
      path.join(root, "packages", "react-native-nitro-qrcode", "regen.js"),
      `const fs = require("fs"); const path = require("path"); const dir = path.join(__dirname, "nitrogen", "generated"); fs.writeFileSync(path.join(dir, "binding.txt"), "fresh output"); fs.writeFileSync(path.join(dir, "extra.txt"), "new");`,
    );
    git(root, "add", "-A");
    git(root, "commit", "-qm", "change generator");
    const result = runCheck(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("extra.txt");
  });
});
