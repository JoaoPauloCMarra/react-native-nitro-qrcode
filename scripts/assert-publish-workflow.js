"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflowPath = path.join(
  __dirname,
  "..",
  ".github",
  "workflows",
  "npm-publish.yml",
);
const workflow = Bun.YAML.parse(fs.readFileSync(workflowPath, "utf8"));

assert.deepEqual(workflow.on.release.types, ["published"]);
assert.ok(Object.hasOwn(workflow.on, "workflow_dispatch"));
assert.equal(workflow.on.workflow_dispatch.inputs?.publish, undefined);
assert.equal(
  workflow.jobs.publish.if,
  "${{ github.event_name == 'release' && needs.validate.outputs.already_published != 'true' }}",
  "publish must require a release event and an unpublished version",
);
assert.equal(
  workflow.jobs.verify.if,
  "${{ always() && needs.validate.result == 'success' && github.event_name == 'release' }}",
  "registry verification must require a validated release event",
);
assert.deepEqual(
  Object.keys(workflow.jobs.validate.outputs).sort(),
  [
    "already_published",
    "dist_tag",
    "package_name",
    "package_version",
    "release_commit",
    "release_tag",
  ],
  "validate must expose only outputs that other jobs read",
);
assert.notEqual(workflow.permissions, "write-all");
assert.notEqual(workflow.permissions?.["id-token"], "write");
assert.equal(workflow.jobs.publish.permissions?.["id-token"], "write");
for (const [name, job] of Object.entries(workflow.jobs)) {
  if (name === "publish") {
    continue;
  }
  assert.notEqual(job.permissions, "write-all", `${name} must not grant OIDC`);
  assert.notEqual(
    job.permissions?.["id-token"],
    "write",
    `${name} must not grant OIDC`,
  );
}

const publishSteps = workflow.jobs.publish.steps;
const checkoutIndex = publishSteps.findIndex((step) =>
  step.uses?.startsWith("actions/checkout@"),
);
assert.notEqual(checkoutIndex, -1, "publish must check out validated source");
assert.equal(
  publishSteps[checkoutIndex].with?.ref,
  "${{ needs.validate.outputs.release_commit }}",
  "publish must use the commit that passed validation",
);
const sourceCheckIndex = publishSteps.findIndex(
  (step) => step.id === "validated_source",
);
assert.ok(sourceCheckIndex > checkoutIndex, "publish must check its checkout");
assert.equal(
  publishSteps[sourceCheckIndex].env?.RELEASE_COMMIT,
  "${{ needs.validate.outputs.release_commit }}",
);
const publishIndex = publishSteps.findIndex(
  (step) => step.name === "Publish to npm with Trusted Publishing",
);
assert.ok(
  publishIndex > sourceCheckIndex,
  "source verification must finish before publication",
);

for (const [name, job] of Object.entries(workflow.jobs)) {
  for (const step of job.steps) {
    assert.ok(
      !step.uses?.startsWith("actions/cache"),
      `${name} must not restore caches in the publish workflow`,
    );
  }
}

const ciWorkflow = Bun.YAML.parse(
  fs.readFileSync(path.join(path.dirname(workflowPath), "ci.yml"), "utf8"),
);
assert.notEqual(ciWorkflow.permissions, "write-all");
assert.equal(ciWorkflow.permissions?.["id-token"], undefined);
for (const [name, job] of Object.entries(ciWorkflow.jobs)) {
  assert.equal(job["runs-on"], "ubuntu-26.04", `${name} must run on Linux`);
  assert.notEqual(job.permissions, "write-all", `${name} must not grant OIDC`);
  assert.equal(job.permissions?.["id-token"], undefined, `${name} OIDC`);
  const cacheIndex = job.steps.findIndex((step) =>
    step.uses?.startsWith("actions/cache@v6"),
  );
  const installIndex = job.steps.findIndex((step) =>
    step.run?.startsWith("bun install"),
  );
  assert.notEqual(installIndex, -1, `${name} must install dependencies`);
  assert.ok(
    cacheIndex !== -1 && cacheIndex < installIndex,
    `${name} must restore the Bun package cache before installing`,
  );
  assert.equal(job.steps[cacheIndex].with.path, "~/.bun/install/cache");
  assert.equal(
    job.steps[cacheIndex].with.key,
    "${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}",
    `${name} cache key must follow the lockfile`,
  );
  for (const step of job.steps) {
    if (step.uses?.startsWith("actions/checkout@")) {
      assert.equal(step.with?.["persist-credentials"], false);
    }
  }
}

console.log(
  "Publish workflow validates source identity and publishes only on GitHub Release events.",
);
