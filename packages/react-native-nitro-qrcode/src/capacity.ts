type EccLevel = "L" | "M" | "Q" | "H";

const DATA_CODEWORDS: Record<EccLevel, readonly number[]> = {
  L: [
    19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523, 589,
    647, 721, 795, 861, 932, 1006, 1094, 1174, 1276, 1370, 1468, 1531, 1631,
    1735, 1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812, 2956,
  ],
  M: [
    16, 28, 44, 64, 86, 108, 124, 154, 182, 216, 254, 290, 334, 365, 415, 453,
    507, 563, 627, 669, 714, 782, 860, 914, 1000, 1062, 1128, 1193, 1267, 1373,
    1455, 1541, 1631, 1725, 1812, 1914, 1992, 2102, 2216, 2334,
  ],
  Q: [
    13, 22, 34, 48, 62, 76, 88, 110, 132, 154, 180, 206, 244, 261, 295, 325,
    367, 397, 445, 485, 512, 568, 614, 664, 718, 754, 808, 871, 911, 985, 1033,
    1115, 1171, 1231, 1286, 1354, 1426, 1502, 1582, 1666,
  ],
  H: [
    9, 16, 26, 36, 46, 60, 66, 86, 100, 122, 140, 158, 180, 197, 223, 253, 283,
    313, 341, 385, 406, 442, 464, 514, 538, 596, 628, 661, 701, 745, 793, 845,
    901, 961, 986, 1054, 1096, 1142, 1222, 1276,
  ],
};

const NUMERIC_PATTERN = /^[0-9]*$/;
const ALPHANUMERIC_PATTERN = /^[0-9A-Z $%*+\-./:]*$/;

function utf8LengthLowerBound(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index++;
      } else {
        bytes += 1;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      bytes += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function requiredDataBits(value: string, version: number): number {
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  if (NUMERIC_PATTERN.test(value)) {
    const groups = Math.floor(value.length / 3);
    const rest = value.length % 3;
    return 4 + [10, 12, 14][band]! + groups * 10 + (rest === 0 ? 0 : rest * 3 + 1);
  }
  if (ALPHANUMERIC_PATTERN.test(value)) {
    return (
      4 +
      [9, 11, 13][band]! +
      Math.floor(value.length / 2) * 11 +
      (value.length % 2) * 6
    );
  }
  return 4 + [8, 16, 16][band]! + utf8LengthLowerBound(value) * 8;
}

export function payloadExceedsCapacity(
  value: string,
  errorCorrectionLevel: EccLevel,
  maxVersion: number,
): boolean {
  const codewords = DATA_CODEWORDS[errorCorrectionLevel][maxVersion - 1]!;
  return requiredDataBits(value, maxVersion) > codewords * 8;
}
