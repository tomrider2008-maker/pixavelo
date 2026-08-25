import type { CoreImageFormat } from '../../types/images';

const JPEG_METADATA_MARKERS = new Set([0xe1, 0xe2, 0xed]);
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'iCCP', 'iTXt', 'tEXt', 'zTXt']);
const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'ICCP', 'XMP ']);

export function outputHasMetadata(bytes: Uint8Array, format: CoreImageFormat) {
  if (format === 'jpeg') return jpegHasMetadata(bytes);
  if (format === 'png') return pngHasMetadata(bytes);
  return webpHasMetadata(bytes);
}

function jpegHasMetadata(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = readUint16(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    if (marker !== undefined && JPEG_METADATA_MARKERS.has(marker)) return true;
    offset += 2 + length;
  }
  return false;
}

function pngHasMetadata(bytes: Uint8Array) {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    if (PNG_METADATA_CHUNKS.has(type)) return true;
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return false;
}

function webpHasMetadata(bytes: Uint8Array) {
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = readUint32Le(bytes, offset + 4);
    if (WEBP_METADATA_CHUNKS.has(type)) return true;
    offset += 8 + length + (length % 2);
  }
  return false;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUint16(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readUint32Le(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) +
      ((bytes[offset + 1] ?? 0) << 8) +
      ((bytes[offset + 2] ?? 0) << 16) +
      (bytes[offset + 3] ?? 0) * 0x1000000) >>>
    0
  );
}
