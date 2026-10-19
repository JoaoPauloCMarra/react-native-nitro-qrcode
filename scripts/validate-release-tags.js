"use strict";

const MAX_RELEASE_TAG_LENGTH = 128;
const MAX_DIST_TAG_LENGTH = 63;
const CONTROL_OR_WHITESPACE = /[\s\u0000-\u001f\u007f-\u009f]/u;
const RELEASE_TAG_PATTERN = /^v[A-Za-z0-9][A-Za-z0-9.+-]{0,126}$/u;
const DIST_TAG_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,62}$/u;
const SEMVER_OR_RANGE_PREFIX = /^[vV](?:\d|[xX*])/u;

function assertString(value, name) {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }
}

function validateReleaseTag(value, expectedTag) {
  assertString(value, "RELEASE_TAG");
  assertString(expectedTag, "expected release tag");
  if (value.length === 0 || value.length > MAX_RELEASE_TAG_LENGTH) {
    throw new Error("RELEASE_TAG must be between 1 and 128 characters.");
  }
  if (CONTROL_OR_WHITESPACE.test(value) || !RELEASE_TAG_PATTERN.test(value)) {
    throw new Error("RELEASE_TAG contains unsafe characters.");
  }
  if (value !== expectedTag) {
    throw new Error(`RELEASE_TAG ${value} does not match ${expectedTag}.`);
  }
  return value;
}

function validateDistTag(value) {
  assertString(value, "DIST_TAG");
  if (value.length === 0 || value.length > MAX_DIST_TAG_LENGTH) {
    throw new Error("DIST_TAG must be between 1 and 63 characters.");
  }
  if (CONTROL_OR_WHITESPACE.test(value) || !DIST_TAG_PATTERN.test(value)) {
    throw new Error("DIST_TAG contains unsafe characters.");
  }
  if (SEMVER_OR_RANGE_PREFIX.test(value)) {
    throw new Error("DIST_TAG must not be a SemVer or range.");
  }
  return value;
}

function validateInputs(releaseTag, distTag, expectedTag) {
  validateReleaseTag(releaseTag, expectedTag);
  validateDistTag(distTag);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    throw new Error(
      "Usage: node scripts/validate-release-tags.js <release-tag> <dist-tag> <expected-release-tag>",
    );
  }
  validateInputs(args[0], args[1], args[2]);
  console.log("[tag-validation] release and dist-tag inputs accepted");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[tag-validation] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { validateDistTag, validateInputs, validateReleaseTag };
