import * as QRCodeJS from "qrcode";
import { payloadExceedsCapacity } from "../capacity";
import { getMatrix } from "../index.web";
import { validateOptions } from "../validation";
import type { QRCodeOptions } from "../validation";

type Level = "L" | "M" | "Q" | "H";
type Mode = "numeric" | "alphanumeric" | "byte";

const encoder = QRCodeJS as unknown as {
  create(
    segments: { data: string; mode: Mode }[],
    options: { errorCorrectionLevel: Level; version: number; maskPattern: number },
  ): unknown;
};

const LEVELS: readonly Level[] = ["L", "M", "Q", "H"];
const VERSIONS = Array.from({ length: 40 }, (_, index) => index + 1);
const MODES: readonly (readonly [Mode, string, number])[] = [
  ["numeric", "7", 7089],
  ["alphanumeric", "A", 4296],
  ["byte", "a", 2953],
];

function encoderAccepts(
  mode: Mode,
  value: string,
  errorCorrectionLevel: Level,
  version: number,
): boolean {
  try {
    encoder.create([{ data: value, mode }], {
      errorCorrectionLevel,
      version,
      maskPattern: 0,
    });
    return true;
  } catch {
    return false;
  }
}

function largestAcceptedLength(
  mode: Mode,
  character: string,
  upperBound: number,
  errorCorrectionLevel: Level,
  version: number,
): number {
  let low = 0;
  let high = upperBound + 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (
      encoderAccepts(mode, character.repeat(middle), errorCorrectionLevel, version)
    ) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}

describe("capacity rule against the real encoder", () => {
  it.each(MODES.flatMap(([mode, character, upperBound]) =>
    LEVELS.map((level) => [mode, character, upperBound, level] as const),
  ))(
    "matches the encoder boundary for every version (%s, %s, level %s)",
    (mode, character, upperBound, level) => {
      const disagreements: string[] = [];
      for (const version of VERSIONS) {
        const capacity = largestAcceptedLength(
          mode,
          character,
          upperBound,
          level,
          version,
        );
        if (capacity < 1 || capacity >= upperBound + 1) {
          disagreements.push(`${mode} ${level} v${version}: capacity ${capacity}`);
          continue;
        }
        if (payloadExceedsCapacity(character.repeat(capacity), level, version)) {
          disagreements.push(
            `${mode} ${level} v${version}: rejected ${capacity}, encoder accepts`,
          );
        }
        if (!payloadExceedsCapacity(character.repeat(capacity + 1), level, version)) {
          disagreements.push(
            `${mode} ${level} v${version}: accepted ${capacity + 1}, encoder rejects`,
          );
        }
      }
      expect(disagreements).toEqual([]);
    },
    240000,
  );

  it.each([
    [1, "L"],
    [10, "M"],
    [20, "Q"],
    [30, "H"],
    [40, "L"],
  ] as const)(
    "matches the encoder boundary for multi-byte UTF-8 (version %i, level %s)",
    (version, level) => {
      const bytes = largestAcceptedLength("byte", "a", 2953, level, version);
      for (const [character, width] of [
        ["é", 2],
        ["€", 3],
        ["😀", 4],
      ] as const) {
        const fitting =
          character.repeat(Math.floor(bytes / width)) + "a".repeat(bytes % width);
        const overflowing = `${fitting}a`;

        expect(encoderAccepts("byte", fitting, level, version)).toBe(true);
        expect(encoderAccepts("byte", overflowing, level, version)).toBe(false);
        expect(payloadExceedsCapacity(fitting, level, version)).toBe(false);
        expect(payloadExceedsCapacity(overflowing, level, version)).toBe(true);
      }
    },
    60000,
  );
});

const CASES = [
  ["low", 1, 17],
  ["high", 1, 7],
  ["medium", 10, 213],
  ["quartile", 10, 151],
  ["low", 40, 2953],
  ["high", 40, 1273],
] as const;

function fits(options: QRCodeOptions): boolean {
  try {
    getMatrix(options);
    return true;
  } catch {
    return false;
  }
}

describe("validateOptions capacity", () => {
  it.each(CASES)(
    "accepts a %s byte payload that fits version %i and rejects one byte more",
    (errorCorrectionLevel, version, capacity) => {
      const base = {
        errorCorrectionLevel,
        minVersion: version,
        maxVersion: version,
      } as const;
      const fitting = { ...base, value: "a".repeat(capacity) };
      const overflowing = { ...base, value: "a".repeat(capacity + 1) };

      expect(fits(fitting)).toBe(true);
      expect(fits(overflowing)).toBe(false);
      expect(validateOptions(fitting)).toMatchObject({ valid: true, errors: [] });
      const result = validateOptions(overflowing);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        { code: "invalid", message: expect.stringContaining("maxVersion") },
      ]);
    },
  );

  it("counts multi-byte UTF-8 characters by encoded length", () => {
    const base = {
      errorCorrectionLevel: "low",
      minVersion: 1,
      maxVersion: 1,
    } as const;
    const fitting = { ...base, value: `${"é".repeat(8)}a` };
    const overflowing = { ...base, value: "é".repeat(9) };

    expect(fits(fitting)).toBe(true);
    expect(fits(overflowing)).toBe(false);
    expect(validateOptions(fitting).valid).toBe(true);
    expect(validateOptions(overflowing).valid).toBe(false);
  });

  it("counts 3-byte, 4-byte and lone surrogate characters", () => {
    const base = { errorCorrectionLevel: "low", maxVersion: 1 } as const;
    expect(validateOptions({ ...base, value: "€".repeat(5) }).valid).toBe(true);
    expect(validateOptions({ ...base, value: "€".repeat(6) }).valid).toBe(false);
    expect(validateOptions({ ...base, value: "😀".repeat(4) }).valid).toBe(true);
    expect(validateOptions({ ...base, value: "😀".repeat(5) }).valid).toBe(false);
    expect(validateOptions({ ...base, value: "\ud800".repeat(14) }).valid).toBe(true);
    expect(validateOptions({ ...base, value: "\udc00".repeat(14) }).valid).toBe(true);
  });

  it.each([
    ["low", 1, "7", 41],
    ["high", 1, "7", 17],
    ["low", 40, "7", 7089],
    ["low", 1, "A", 25],
    ["high", 1, "A", 10],
    ["low", 40, "A", 4296],
  ] as const)(
    "uses the tighter numeric and alphanumeric capacity (%s, version %i, %s)",
    (errorCorrectionLevel, version, character, capacity) => {
      const base = {
        errorCorrectionLevel,
        minVersion: version,
        maxVersion: version,
      } as const;
      const fitting = { ...base, value: character.repeat(capacity) };
      const overflowing = { ...base, value: character.repeat(capacity + 1) };

      expect(fits(fitting)).toBe(true);
      expect(fits(overflowing)).toBe(false);
      expect(validateOptions(fitting).valid).toBe(true);
      expect(validateOptions(overflowing).valid).toBe(false);
    },
  );
});
