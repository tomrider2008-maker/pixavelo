import type { CoreImageFormat } from '../../types/images';

const JPEG_METADATA_MARKERS = new Set([0xe1, 0xe2, 0xed]);
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'iCCP', 'iTXt', 'tEXt', 'zTXt']);
const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'ICCP', 'XMP ']);

export async function stripOutputMetadata(blob: Blob, format: CoreImageFormat) {
  const source = new Uint8Array(await blob.arrayBuffer());
  const output = stripOutputMetadataBytes(source, format);
  if (output === source) return blob;
  const transferable = new Uint8Array(output.byteLength);
  transferable.set(output);
  return new Blob([transferable.buffer], { type: `image/${format}` });
}

export function stripOutputMetadataBytes(bytes: Uint8Array, format: CoreImageFormat) {
  if (format === 'jpeg') return stripJpegMetadata(bytes);
  if (format === 'png') return stripPngMetadata(bytes);
  return stripWebpMetadata(bytes);
}

function stripJpegMetadata(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  let changed = false;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return bytes;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.subarray(offset));
      return changed ? concatenate(parts) : bytes;
    }
    if (marker === undefined) return bytes;
    if (isStandaloneJpegMarker(marker)) {
      parts.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) return bytes;
    const length = readUint16(bytes, offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return bytes;
    if (JPEG_METADATA_MARKERS.has(marker)) changed = true;
    else parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  return bytes;
}

function stripPngMetadata(bytes: Uint8Array) {
  if (bytes.length < 8) return bytes;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let changed = false;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return bytes;
    const type = ascii(bytes, offset + 4, 4);
    if (PNG_METADATA_CHUNKS.has(type)) changed = true;
    else parts.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') return changed ? concatenate(parts) : bytes;
  }
  return bytes;
}

function stripWebpMetadata(bytes: Uint8Array) {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let offset = 12;
  let changed = false;
  while (offset + 8 <= bytes.length) {
    const length = readUint32Le(bytes, offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > bytes.length) return bytes;
    const type = ascii(bytes, offset, 4);
    if (WEBP_METADATA_CHUNKS.has(type)) changed = true;
    else chunks.push(bytes.subarray(offset, end));
    offset = end;
  }
  if (!changed || offset !== bytes.length) return bytes;
  const output = new Uint8Array(12 + chunks.reduce((total, chunk) => total + chunk.length, 0));
  output.set(bytes.subarray(0, 12));
  writeUint32Le(output, 4, output.length - 8);
  let outputOffset = 12;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return output;
}

function concatenate(parts: readonly Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function isStandaloneJpegMarker(marker: number) {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
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

function writeUint32Le(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}
