import type { ImageDimensions, ImageFormat } from '../../types/images';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
]);

const matches = (bytes: Uint8Array, expected: readonly number[], offset = 0) =>
  expected.every((value, index) => bytes[offset + index] === value);

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.slice(offset, offset + length));

export function detectImageFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length < 4) return 'unknown';
  if (matches(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (matches(bytes, PNG_SIGNATURE)) return 'png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 3) === 'GIF') return 'gif';
  if (ascii(bytes, 0, 2) === 'BM') return 'bmp';
  if (matches(bytes, [0x49, 0x49, 0x2a, 0x00]) || matches(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return 'tiff';
  }
  if (matches(bytes, [0x00, 0x00, 0x01, 0x00])) return 'ico';

  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brands = readIsoBmffBrands(bytes);
    if (brands.some((brand) => brand === 'avif' || brand === 'avis')) return 'avif';
    if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx'].includes(brand))) return 'heic';
    if (brands.some((brand) => brand === 'mif1' || brand === 'msf1')) return 'heif';
  }

  const textHead = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, 1024))
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(textHead)) return 'svg';

  return 'unknown';
}

export function readImageDimensions(
  format: ImageFormat,
  bytes: Uint8Array
): ImageDimensions | undefined {
  const raw =
    format === 'png'
      ? readPngDimensions(bytes)
      : format === 'jpeg'
        ? readJpegDimensions(bytes)
        : format === 'webp'
          ? readWebpDimensions(bytes)
          : format === 'gif'
            ? readGifDimensions(bytes)
            : format === 'bmp'
              ? readBmpDimensions(bytes)
              : format === 'tiff'
                ? readTiffDimensions(bytes)
                : format === 'ico'
                  ? readIcoDimensions(bytes)
                  : format === 'avif' || format === 'heic' || format === 'heif'
                    ? readIsoBmffDimensions(bytes)
                    : undefined;

  if (!raw || raw.width <= 0 || raw.height <= 0) return undefined;
  const pixels = raw.width * raw.height;
  return {
    ...raw,
    pixels,
    megapixels: pixels / 1_000_000
  };
}

export function countGifFrames(bytes: Uint8Array): number {
  if (bytes.length < 13 || ascii(bytes, 0, 3) !== 'GIF') return 0;
  let offset = 13;
  if ((bytes[10] ?? 0) & 0x80) offset += 3 * 2 ** (((bytes[10] ?? 0) & 0x07) + 1);
  let frames = 0;

  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      offset += 1;
      offset = skipSubBlocks(bytes, offset);
      continue;
    }
    if (marker !== 0x2c || offset + 9 > bytes.length) break;
    frames += 1;
    const packed = bytes[offset + 8] ?? 0;
    offset += 9;
    if (packed & 0x80) offset += 3 * 2 ** ((packed & 0x07) + 1);
    offset += 1;
    offset = skipSubBlocks(bytes, offset);
  }
  return frames;
}

export function isAnimatedAvif(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp' && ascii(bytes, 8, 4) === 'avis';
}

function readPngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24 || !matches(bytes, PNG_SIGNATURE)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === undefined) return undefined;
    if (JPEG_START_OF_FRAME.has(marker)) {
      return {
        height: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
        width: ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0)
      };
    }

    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const segmentLength = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (segmentLength < 2) return undefined;
    offset += segmentLength + 2;
  }
  return undefined;
}

function readWebpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30) return undefined;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    return {
      width: 1 + readUint24(bytes, 24),
      height: 1 + readUint24(bytes, 27)
    };
  }
  if (chunk === 'VP8 ' && matches(bytes, [0x9d, 0x01, 0x2a], 23)) {
    return {
      width: ((bytes[26] ?? 0) | ((bytes[27] ?? 0) << 8)) & 0x3fff,
      height: ((bytes[28] ?? 0) | ((bytes[29] ?? 0) << 8)) & 0x3fff
    };
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const b0 = bytes[21] ?? 0;
    const b1 = bytes[22] ?? 0;
    const b2 = bytes[23] ?? 0;
    const b3 = bytes[24] ?? 0;
    return {
      width: 1 + (b0 | ((b1 & 0x3f) << 8)),
      height: 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10))
    };
  }
  return undefined;
}

function readGifDimensions(bytes: Uint8Array) {
  if (bytes.length < 10 || ascii(bytes, 0, 3) !== 'GIF') return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readBmpDimensions(bytes: Uint8Array) {
  if (bytes.length < 26 || ascii(bytes, 0, 2) !== 'BM') return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dibSize = view.getUint32(14, true);
  if (dibSize === 12) {
    return { width: view.getUint16(18, true), height: view.getUint16(20, true) };
  }
  if (dibSize < 40) return undefined;
  return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) };
}

function readTiffDimensions(bytes: Uint8Array) {
  if (bytes.length < 16) return undefined;
  const littleEndian = ascii(bytes, 0, 2) === 'II';
  if (!littleEndian && ascii(bytes, 0, 2) !== 'MM') return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(2, littleEndian) !== 42) return undefined;
  const ifdOffset = view.getUint32(4, littleEndian);
  if (ifdOffset + 2 > bytes.length) return undefined;
  const entryCount = view.getUint16(ifdOffset, littleEndian);
  let width: number | undefined;
  let height: number | undefined;
  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    if (entry + 12 > bytes.length) break;
    const tag = view.getUint16(entry, littleEndian);
    if (tag !== 256 && tag !== 257) continue;
    const type = view.getUint16(entry + 2, littleEndian);
    const count = view.getUint32(entry + 4, littleEndian);
    if (count !== 1 || (type !== 3 && type !== 4)) continue;
    const value =
      type === 3
        ? view.getUint16(entry + 8, littleEndian)
        : view.getUint32(entry + 8, littleEndian);
    if (tag === 256) width = value;
    else height = value;
  }
  return width && height ? { width, height } : undefined;
}

function readIcoDimensions(bytes: Uint8Array) {
  if (bytes.length < 22 || !matches(bytes, [0x00, 0x00, 0x01, 0x00])) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = Math.min(view.getUint16(4, true), Math.floor((bytes.length - 6) / 16));
  let best: { width: number; height: number } | undefined;
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = bytes[offset] === 0 ? 256 : (bytes[offset] ?? 0);
    const height = bytes[offset + 1] === 0 ? 256 : (bytes[offset + 1] ?? 0);
    if (!best || width * height > best.width * best.height) best = { width, height };
  }
  return best;
}

function readIsoBmffBrands(bytes: Uint8Array): string[] {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== 'ftyp') return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredSize = view.getUint32(0);
  const end = Math.min(bytes.length, declaredSize >= 16 ? declaredSize : bytes.length);
  const brands = [ascii(bytes, 8, 4)];
  for (let offset = 16; offset + 4 <= end; offset += 4) brands.push(ascii(bytes, offset, 4));
  return brands;
}

function readIsoBmffDimensions(bytes: Uint8Array) {
  if (bytes.length < 20) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let best: { width: number; height: number } | undefined;
  for (let offset = 4; offset + 16 <= bytes.length; offset += 1) {
    if (ascii(bytes, offset, 4) !== 'ispe') continue;
    const boxSize = view.getUint32(offset - 4);
    if (boxSize < 20) continue;
    const width = view.getUint32(offset + 8);
    const height = view.getUint32(offset + 12);
    if (!width || !height) continue;
    if (!best || width * height > best.width * best.height) best = { width, height };
  }
  return best;
}

function skipSubBlocks(bytes: Uint8Array, start: number): number {
  let offset = start;
  while (offset < bytes.length) {
    const length = bytes[offset] ?? 0;
    offset += 1;
    if (length === 0) break;
    offset += length;
  }
  return offset;
}

function readUint24(bytes: Uint8Array, offset: number) {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}
