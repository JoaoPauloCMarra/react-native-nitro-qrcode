#!/usr/bin/env node

// Regenerates or verifies the native/web encoder parity corpus fixture.
//
// The corpus contract: for inputs that are entirely numeric, entirely
// alphanumeric, or entirely byte-mode (no digits, uppercase letters, or
// `$%*+-./:` characters), the web `qrcode` encoder and the native Nayuki
// encoder must produce identical matrices when version, error correction
// level, and mask are fixed. Automatic mask selection can differ because the
// two encoders interpret the ISO N4 penalty rounding differently.
//
// The boostEcl emulation below mirrors `createModel` in
// packages/react-native-nitro-qrcode/src/index.web.ts: encode at the
// requested level, then raise the level as high as the same version allows.
//
// Usage:
//   bun scripts/generate-parity-corpus.js            # verify the fixture
//   bun scripts/generate-parity-corpus.js --write    # rewrite the fixture
//
// The native side of the corpus is verified by testParityCorpus() in
// cpp/core/QRCodeGeneratorTest.cpp, which asserts the exact same values.

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const requireFromRepo = createRequire(path.join(__dirname, "..", "package.json"));
const QRCode = requireFromRepo("qrcode");

const projectRoot = path.resolve(__dirname, "..");
const fixturePath = path.join(
  projectRoot,
  "packages",
  "react-native-nitro-qrcode",
  "src",
  "__tests__",
  "fixtures",
  "parity-corpus.json",
);

const longAlpha = Array(12)
  .fill("THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG ")
  .join("")
  .trim();

const ENTRIES = [
  { value: "Hello, world!", ecl: "M", minVersion: 1, maxVersion: 40, mask: -1, boostEcl: true },
  { value: "hello, world!", ecl: "M", minVersion: 1, maxVersion: 40, mask: 0, boostEcl: true },
  { value: "payment invoice number", ecl: "M", minVersion: 1, maxVersion: 40, mask: -1, boostEcl: true },
  { value: "h\u00e9llo w\u00f6rld, \u4f60\u597d", ecl: "M", minVersion: 1, maxVersion: 40, mask: 6, boostEcl: true },
  { value: "01234567890123456789012345678901234567890123456789", ecl: "M", minVersion: 1, maxVersion: 40, mask: -1, boostEcl: true },
  { value: "HELLO WORLD 12345 $%*+-./:", ecl: "M", minVersion: 1, maxVersion: 40, mask: 1, boostEcl: true },
  { value: "fixed version number", ecl: "M", minVersion: 10, maxVersion: 10, mask: 2, boostEcl: true },
  { value: "masked", ecl: "M", minVersion: 1, maxVersion: 40, mask: 3, boostEcl: true },
  { value: "boost off", ecl: "M", minVersion: 1, maxVersion: 40, mask: -1, boostEcl: false },
  { value: "high error correction level", ecl: "H", minVersion: 1, maxVersion: 40, mask: 4, boostEcl: true },
  { value: "boost tiny", ecl: "L", minVersion: 1, maxVersion: 40, mask: -1, boostEcl: true },
  { value: "boost tiny", ecl: "L", minVersion: 1, maxVersion: 40, mask: -1, boostEcl: false },
  { value: longAlpha, ecl: "M", minVersion: 1, maxVersion: 40, mask: 5, boostEcl: true },
];

function createModel(value, ecl, minVersion, maxVersion, mask, boostEcl) {
  const make = (level, version) =>
    QRCode.create(value, {
      errorCorrectionLevel: level,
      version: version ?? undefined,
      maskPattern: mask >= 0 ? mask : undefined,
    });
  const base = make(ecl, minVersion === maxVersion ? minVersion : undefined);
  const version = (base.modules.size - 17) / 4;
  if (boostEcl && ecl !== "H") {
    let boosted = base;
    for (const candidate of ["Q", "H"]) {
      try {
        boosted = make(candidate, version);
      } catch {
        break;
      }
    }
    if (boosted !== base) {
      return boosted;
    }
  }
  return base;
}

function packMatrix(model) {
  const size = model.modules.size;
  const packed = new Uint8Array(Math.ceil((size * size) / 8));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      if (model.modules.data[index]) {
        packed[Math.floor(index / 8)] |= 1 << (7 - (index % 8));
      }
    }
  }
  let binary = "";
  for (const byte of packed) {
    binary += String.fromCharCode(byte);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

function buildCorpus() {
  return ENTRIES.map((entry) => {
    const model = createModel(
      entry.value,
      entry.ecl,
      entry.minVersion,
      entry.maxVersion,
      entry.mask,
      entry.boostEcl,
    );
    return {
      value: entry.value,
      ecl: entry.ecl,
      minVersion: entry.minVersion,
      maxVersion: entry.maxVersion,
      mask: entry.mask,
      boostEcl: entry.boostEcl,
      size: model.modules.size,
      packedBase64: packMatrix(model),
    };
  });
}

const write = process.argv.includes("--write");
const corpus = buildCorpus();

if (write) {
  fs.writeFileSync(fixturePath, JSON.stringify(corpus, null, 2) + "\n");
  console.log(
    `Wrote parity corpus with ${corpus.length} entries to ${path.relative(projectRoot, fixturePath)}.`,
  );
  console.log(
    "Verify the native side by running `bun run --cwd packages/react-native-nitro-qrcode test:cpp` (testParityCorpus).",
  );
  process.exit(0);
}

const committed = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (JSON.stringify(committed) !== JSON.stringify(corpus)) {
  console.error(
    "Parity corpus fixture drifted from the web encoder output.\n" +
      "Run `bun scripts/generate-parity-corpus.js --write` after verifying the native encoder agrees.",
  );
  process.exit(1);
}
console.log(
  `Parity corpus fixture matches the web encoder (${corpus.length} entries).`,
);
