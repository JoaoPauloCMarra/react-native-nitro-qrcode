import { unzlibSync } from "fflate";
import jsQR from "jsqr";

export type DecodeOutcome = "ok" | "miss" | "mismatch" | "error";

export type Backdrop = readonly [number, number, number];

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
    table[BASE64_ALPHABET.charCodeAt(index)] = index;
  }
  return table;
})();

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const output = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let offset = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const value = BASE64_LOOKUP[clean.charCodeAt(index)];
    if (value === undefined || value < 0) {
      throw new Error("invalid base64");
    }
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[offset] = (buffer >> bits) & 0xff;
      offset += 1;
    }
  }
  return output.subarray(0, offset);
}

type PngHeader = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
};

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function channelsFor(colorType: number): number {
  switch (colorType) {
    case 2:
      return 3;
    case 3:
      return 1;
    case 6:
      return 4;
    default:
      throw new Error(`unsupported PNG color type ${colorType}`);
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left;
  }
  return distanceUp <= distanceUpLeft ? up : upLeft;
}

function unfilter(
  raw: Uint8Array,
  height: number,
  stride: number,
  bytesPerPixel: number,
): Uint8Array {
  if (raw.length < height * (stride + 1)) {
    throw new Error("PNG image data is truncated");
  }
  const output = new Uint8Array(height * stride);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = row * (stride + 1) + 1;
    const target = row * stride;
    const previous = target - stride;
    for (let column = 0; column < stride; column += 1) {
      const value = raw[source + column];
      const left = column >= bytesPerPixel ? output[target + column - bytesPerPixel] : 0;
      const up = row > 0 ? output[previous + column] : 0;
      const upLeft =
        row > 0 && column >= bytesPerPixel
          ? output[previous + column - bytesPerPixel]
          : 0;
      let predictor: number;
      switch (filter) {
        case 0:
          predictor = 0;
          break;
        case 1:
          predictor = left;
          break;
        case 2:
          predictor = up;
          break;
        case 3:
          predictor = (left + up) >> 1;
          break;
        case 4:
          predictor = paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`unsupported PNG filter ${filter}`);
      }
      output[target + column] = (value + predictor) & 0xff;
    }
  }
  return output;
}

function compositeChannel(value: number, backdrop: number, alpha: number): number {
  return (value * alpha + backdrop * (255 - alpha)) / 255;
}

export function pngToRgba(bytes: Uint8Array, backdrop: Backdrop) {
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error("missing PNG signature");
    }
  }
  let header: PngHeader | undefined;
  let palette: Uint8Array | undefined;
  let transparency: Uint8Array | undefined;
  const dataChunks: Uint8Array[] = [];
  let dataLength = 0;
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) {
      throw new Error(`PNG chunk ${type} is truncated`);
    }
    const chunk = bytes.subarray(start, end);
    if (type === "IHDR") {
      if (chunk[10] !== 0 || chunk[11] !== 0 || chunk[12] !== 0) {
        throw new Error("unsupported PNG compression, filter or interlace method");
      }
      header = {
        width: readUint32(chunk, 0),
        height: readUint32(chunk, 4),
        bitDepth: chunk[8],
        colorType: chunk[9],
      };
    } else if (type === "PLTE") {
      palette = chunk;
    } else if (type === "tRNS") {
      transparency = chunk;
    } else if (type === "IDAT") {
      dataChunks.push(chunk);
      dataLength += chunk.length;
    } else if (type === "IEND") {
      break;
    }
    offset = end + 4;
  }
  if (header === undefined) {
    throw new Error("missing PNG IHDR");
  }
  const { width, height, bitDepth, colorType } = header;
  const channels = channelsFor(colorType);
  if (colorType === 3 ? ![1, 2, 4, 8].includes(bitDepth) : bitDepth !== 8) {
    throw new Error(`unsupported PNG bit depth ${bitDepth} for color type ${colorType}`);
  }
  if (colorType === 3 && palette === undefined) {
    throw new Error("missing PNG palette");
  }
  const compressed = new Uint8Array(dataLength);
  let cursor = 0;
  for (const chunk of dataChunks) {
    compressed.set(chunk, cursor);
    cursor += chunk.length;
  }
  const bitsPerPixel = bitDepth * channels;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const pixels = unfilter(
    unzlibSync(compressed),
    height,
    stride,
    Math.max(1, bitsPerPixel >> 3),
  );

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      let red: number;
      let green: number;
      let blue: number;
      let alpha = 255;
      if (colorType === 3 && palette !== undefined) {
        const bitOffset = column * bitDepth;
        const byte = pixels[row * stride + (bitOffset >> 3)];
        const shift = 8 - bitDepth - (bitOffset & 7);
        const index = (byte >> shift) & ((1 << bitDepth) - 1);
        if (index * 3 + 2 >= palette.length) {
          throw new Error("PNG palette index out of range");
        }
        red = palette[index * 3];
        green = palette[index * 3 + 1];
        blue = palette[index * 3 + 2];
        if (transparency !== undefined && index < transparency.length) {
          alpha = transparency[index];
        }
      } else {
        const source = row * stride + column * channels;
        red = pixels[source];
        green = pixels[source + 1];
        blue = pixels[source + 2];
        if (channels === 4) {
          alpha = pixels[source + 3];
        }
      }
      const target = (row * width + column) * 4;
      rgba[target] = compositeChannel(red, backdrop[0], alpha);
      rgba[target + 1] = compositeChannel(green, backdrop[1], alpha);
      rgba[target + 2] = compositeChannel(blue, backdrop[2], alpha);
      rgba[target + 3] = 255;
    }
  }
  return { rgba, width, height };
}

export function decodePngBase64(
  base64: string,
  expected: string,
  backdrop: Backdrop,
): DecodeOutcome {
  const { rgba, width, height } = pngToRgba(base64ToBytes(base64), backdrop);
  const result = jsQR(rgba, width, height, { inversionAttempts: "attemptBoth" });
  if (result === null) {
    return "miss";
  }
  return result.data === expected ? "ok" : "mismatch";
}
