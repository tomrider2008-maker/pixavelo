import { AppError } from '../../engine/errors/AppError';
import { processNativeImage } from '../../engine/pipeline/processNativeImage';
import type { CoreImageFormat, ImageValidationReport, ProcessingStage } from '../../types/images';
import { buildDerivativeFilename } from '../../utils/filenames';
import { inspectImageMetadata } from './metadataInspector';
import { metadataCategories, removedCategories } from './metadataPresets';
import type {
  MetadataCleanResult,
  MetadataInspection,
  MetadataRemovalPolicy,
  MetadataVerification,
  PrivacyPreset
} from './types';

const CORE_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_METADATA_BLOCK_BYTES = 8 * 1024 * 1024;
const MAX_CONTAINER_SEGMENTS = 4096;
const EXIF_HEADER = 'Exif\0\0';

interface CleanMetadataInput {
  readonly file: File;
  readonly validation: ImageValidationReport;
  readonly sourceInspection: MetadataInspection;
  readonly policy: MetadataRemovalPolicy;
  readonly preset: PrivacyPreset | 'custom';
  readonly outputFormat: CoreImageFormat;
  readonly quality: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (stage: ProcessingStage) => void;
}

class SelectiveRewriteUnavailable extends Error {}

export async function cleanImageMetadata(input: CleanMetadataInput): Promise<MetadataCleanResult> {
  const startedAt = performance.now();
  const sameCoreFormat =
    CORE_FORMATS.has(input.validation.format) && input.validation.format === input.outputFormat;
  const selected = removedCategories(input.policy);

  input.onProgress?.('preparing');
  assertNotCancelled(input.signal);

  let blob: Blob;
  let pixelPreserving = false;
  let metadataRemovedVerified = false;

  if (selected.length === 0 && sameCoreFormat) {
    blob = input.file.slice(0, input.file.size, input.validation.mime);
    pixelPreserving = true;
  } else if (sameCoreFormat && input.preset !== 'remove-all') {
    try {
      input.onProgress?.('processing');
      blob = await sanitizeMetadataContainer(input.file, input.validation.format, input.policy);
      pixelPreserving = true;
    } catch (error) {
      if (!(error instanceof SelectiveRewriteUnavailable)) throw error;
      const encoded = await reencodeWithoutMetadata(input);
      blob = encoded.blob;
      metadataRemovedVerified = encoded.metadataRemovedVerified;
    }
  } else {
    const encoded = await reencodeWithoutMetadata(input);
    blob = encoded.blob;
    metadataRemovedVerified = encoded.metadataRemovedVerified;
  }

  assertNotCancelled(input.signal);
  input.onProgress?.('finalizing');
  const filename = buildDerivativeFilename(input.file.name, input.outputFormat, 'privacy-clean');
  const outputValidation: ImageValidationReport = {
    ...input.validation,
    format: input.outputFormat,
    mime: `image/${input.outputFormat}`,
    supportedByCoreCodec: true,
    supportedByConverter: true,
    warnings: []
  };
  const inspection = await inspectImageMetadata(blob, outputValidation, filename);
  const verification = verifyMetadataPolicy(
    input.sourceInspection,
    inspection,
    input.policy,
    !pixelPreserving
  );

  if (!verification.verified) {
    throw new AppError(
      'METADATA_FAILED',
      'The exported container still includes metadata selected for removal.'
    );
  }

  return {
    blob,
    filename,
    inspection,
    verification,
    pixelPreserving,
    metadataRemovedVerified:
      metadataRemovedVerified ||
      (selected.length > 0 &&
        selected.every((category) => !inspection.categoriesPresent[category])),
    durationMs: performance.now() - startedAt
  };
}

export function verifyMetadataPolicy(
  source: MetadataInspection,
  output: MetadataInspection,
  policy: MetadataRemovalPolicy,
  fullReencode = false
): MetadataVerification {
  const expected = metadataCategories.filter(
    (category) => policy[category] && source.categoriesPresent[category]
  );
  const failed = expected.filter((category) => output.categoriesPresent[category]);
  const removed = expected.filter((category) => !output.categoriesPresent[category]);
  const retained = metadataCategories.filter(
    (category) => source.categoriesPresent[category] && output.categoriesPresent[category]
  );
  const additionalRemovals = metadataCategories.filter(
    (category) =>
      source.categoriesPresent[category] && !policy[category] && !output.categoriesPresent[category]
  );
  const verified = failed.length === 0;
  let message = 'No selected metadata was present in the source.';
  if (expected.length > 0 && verified) {
    message = fullReencode
      ? `Verified ${removed.length} selected categor${removed.length === 1 ? 'y' : 'ies'} removed; re-encoding also removed remaining source metadata.`
      : `Verified ${removed.length} selected categor${removed.length === 1 ? 'y' : 'ies'} removed from the output container.`;
  } else if (!verified) {
    message = `${failed.length} selected categor${failed.length === 1 ? 'y remains' : 'ies remain'} in the output.`;
  }
  return { verified, removed, retained, additionalRemovals, message };
}

async function reencodeWithoutMetadata(input: CleanMetadataInput) {
  return processNativeImage({
    file: input.file,
    detectedMime: input.validation.mime,
    detectedFormat: input.validation.format,
    ...(input.validation.dimensions ? { dimensions: input.validation.dimensions } : {}),
    options: {
      outputFormat: input.outputFormat,
      quality: input.quality,
      background: '#ffffff'
    },
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.onProgress ? { onProgress: input.onProgress } : {})
  });
}

async function sanitizeMetadataContainer(
  file: Blob,
  format: CoreImageFormat,
  policy: MetadataRemovalPolicy
) {
  if (format === 'jpeg') return sanitizeJpeg(file, policy);
  if (format === 'png') return sanitizePng(file, policy);
  return sanitizeWebp(file, policy);
}

async function sanitizeJpeg(file: Blob, policy: MetadataRemovalPolicy) {
  const parts: BlobPart[] = [file.slice(0, 2)];
  let offset = 2;
  let segments = 0;
  while (offset + 4 <= file.size && segments < MAX_CONTAINER_SEGMENTS) {
    const header = await readBlob(file, offset, 4);
    if (header[0] !== 0xff) throw new SelectiveRewriteUnavailable();
    const marker = header[1];
    if (marker === undefined) throw new SelectiveRewriteUnavailable();
    if (marker === 0xda || marker === 0xd9) {
      parts.push(file.slice(offset));
      return new Blob(parts, { type: 'image/jpeg' });
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(file.slice(offset, offset + 2));
      offset += 2;
      segments += 1;
      continue;
    }
    const length = readUint16(header, 2);
    const end = offset + 2 + length;
    if (length < 2 || end > file.size) throw new SelectiveRewriteUnavailable();
    const payloadLength = length - 2;
    let keep = true;
    let replacement: Uint8Array | undefined;
    if (marker === 0xe1 || marker === 0xe2 || marker === 0xed) {
      if (payloadLength > MAX_METADATA_BLOCK_BYTES) {
        if (policyTouchesContainerMetadata(policy)) throw new SelectiveRewriteUnavailable();
      } else {
        const payload = await readBlob(file, offset + 4, payloadLength);
        if (marker === 0xe1 && startsWithAscii(payload, EXIF_HEADER)) {
          if (policy.exif) {
            keep = false;
          } else if (policyTouchesExif(policy)) {
            const scrubbed = scrubExifTiff(payload.subarray(EXIF_HEADER.length), policy);
            if (!scrubbed) throw new SelectiveRewriteUnavailable();
            replacement = buildJpegSegment(marker, joinBytes(asciiBytes(EXIF_HEADER), scrubbed));
          }
        } else if (marker === 0xe1) {
          keep = !shouldRemoveXmp(policy);
        } else if (marker === 0xe2) {
          keep = !policy.icc;
        } else {
          keep = !shouldRemoveIptc(policy);
        }
      }
    }
    if (keep) parts.push(replacement ? ownedBuffer(replacement) : file.slice(offset, end));
    offset = end;
    segments += 1;
  }
  throw new SelectiveRewriteUnavailable();
}

async function sanitizePng(file: Blob, policy: MetadataRemovalPolicy) {
  const parts: BlobPart[] = [file.slice(0, 8)];
  let offset = 8;
  let segments = 0;
  while (offset + 12 <= file.size && segments < MAX_CONTAINER_SEGMENTS) {
    const header = await readBlob(file, offset, 8);
    const length = readUint32(header, 0);
    const type = ascii(header, 4, 4);
    const end = offset + 12 + length;
    if (end > file.size) throw new SelectiveRewriteUnavailable();
    let keep = true;
    let replacement: Uint8Array | undefined;
    if (['eXIf', 'iCCP', 'iTXt', 'tEXt', 'zTXt'].includes(type)) {
      if (length > MAX_METADATA_BLOCK_BYTES) {
        if (policyTouchesContainerMetadata(policy)) throw new SelectiveRewriteUnavailable();
      } else {
        const payload = await readBlob(file, offset + 8, length);
        if (type === 'eXIf' && policy.exif) {
          keep = false;
        } else if (type === 'eXIf' && policyTouchesExif(policy)) {
          const scrubbed = scrubExifTiff(payload, policy);
          if (!scrubbed) throw new SelectiveRewriteUnavailable();
          replacement = buildPngChunk(type, scrubbed);
        } else if (type === 'iCCP') keep = !policy.icc;
        else if (type !== 'eXIf') keep = !shouldRemovePngText(type, payload, policy);
      }
    }
    if (keep) parts.push(replacement ? ownedBuffer(replacement) : file.slice(offset, end));
    offset = end;
    segments += 1;
    if (type === 'IEND') return new Blob(parts, { type: 'image/png' });
  }
  throw new SelectiveRewriteUnavailable();
}

async function sanitizeWebp(file: Blob, policy: MetadataRemovalPolicy) {
  const chunkParts: BlobPart[] = [];
  let chunkBytes = 0;
  let offset = 12;
  let segments = 0;
  let keepsExif = false;
  let keepsXmp = false;
  let keepsIcc = false;
  let vp8x: Uint8Array | undefined;

  while (offset + 8 <= file.size && segments < MAX_CONTAINER_SEGMENTS) {
    const header = await readBlob(file, offset, 8);
    const type = ascii(header, 0, 4);
    const length = readUint32Le(header, 4);
    const end = offset + 8 + length + (length % 2);
    if (end > file.size) throw new SelectiveRewriteUnavailable();
    let keep = true;
    let replacement: Uint8Array | undefined;
    if (type === 'VP8X') {
      vp8x = await readBlob(file, offset, end - offset);
      keep = false;
    } else if (type === 'EXIF') {
      if (length > MAX_METADATA_BLOCK_BYTES) throw new SelectiveRewriteUnavailable();
      const payload = await readBlob(file, offset + 8, length);
      if (policy.exif) {
        keep = false;
      } else if (policyTouchesExif(policy)) {
        const hasHeader = startsWithAscii(payload, EXIF_HEADER);
        const scrubbed = scrubExifTiff(
          hasHeader ? payload.subarray(EXIF_HEADER.length) : payload,
          policy
        );
        if (!scrubbed) throw new SelectiveRewriteUnavailable();
        replacement = buildWebpChunk(
          type,
          hasHeader ? joinBytes(asciiBytes(EXIF_HEADER), scrubbed) : scrubbed
        );
      }
      keepsExif = keep;
    } else if (type === 'XMP ') {
      if (length > MAX_METADATA_BLOCK_BYTES && policyTouchesContainerMetadata(policy)) {
        throw new SelectiveRewriteUnavailable();
      }
      const payload =
        length <= MAX_METADATA_BLOCK_BYTES ? await readBlob(file, offset + 8, length) : undefined;
      keep = payload ? !shouldRemoveXmp(policy) : true;
      keepsXmp = keep;
    } else if (type === 'ICCP') {
      keep = !policy.icc;
      keepsIcc = keep;
    }
    if (keep) {
      const part = replacement ? ownedBuffer(replacement) : file.slice(offset, end);
      chunkParts.push(part);
      chunkBytes += replacement?.byteLength ?? end - offset;
    }
    offset = end;
    segments += 1;
  }
  if (offset !== file.size || segments >= MAX_CONTAINER_SEGMENTS) {
    throw new SelectiveRewriteUnavailable();
  }

  if (vp8x) {
    const nextVp8x = vp8x.slice();
    if (nextVp8x.length >= 9) {
      let flags = nextVp8x[8] ?? 0;
      flags = keepsIcc ? flags | 0x20 : flags & ~0x20;
      flags = keepsExif ? flags | 0x08 : flags & ~0x08;
      flags = keepsXmp ? flags | 0x04 : flags & ~0x04;
      nextVp8x[8] = flags;
    }
    chunkParts.unshift(nextVp8x);
    chunkBytes += nextVp8x.byteLength;
  }
  const riffHeader = new Uint8Array(12);
  riffHeader.set(asciiBytes('RIFF'), 0);
  writeUint32Le(riffHeader, 4, 4 + chunkBytes);
  riffHeader.set(asciiBytes('WEBP'), 8);
  return new Blob([riffHeader, ...chunkParts], { type: 'image/webp' });
}

function scrubExifTiff(bytes: Uint8Array, policy: MetadataRemovalPolicy) {
  if (bytes.length < 8) return undefined;
  const output = bytes.slice();
  const byteOrder = ascii(output, 0, 2);
  const littleEndian = byteOrder === 'II';
  if (!littleEndian && byteOrder !== 'MM') return undefined;
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  if (safeUint16(view, 2, littleEndian) !== 42) return undefined;
  const ifd0Offset = safeUint32(view, 4, littleEndian);
  if (ifd0Offset === undefined) return undefined;
  const ifd0 = parseIfdEntries(view, ifd0Offset, littleEndian);
  if (!ifd0) return undefined;
  const exifPointer = ifd0.entries.find((entry) => entry.tag === 0x8769);
  const gpsPointer = ifd0.entries.find((entry) => entry.tag === 0x8825);
  const exifOffset = exifPointer ? readEntryPointer(view, exifPointer, littleEndian) : 0;
  const gpsOffset = gpsPointer ? readEntryPointer(view, gpsPointer, littleEndian) : 0;
  const exifIfd = exifOffset ? parseIfdEntries(view, exifOffset, littleEndian) : undefined;
  const gpsIfd = gpsOffset ? parseIfdEntries(view, gpsOffset, littleEndian) : undefined;
  if ((exifOffset && !exifIfd) || (gpsOffset && !gpsIfd)) return undefined;

  scrubTaggedEntries(output, ifd0.entries, ifd0TagsForPolicy(policy));
  if (exifIfd) scrubTaggedEntries(output, exifIfd.entries, exifTagsForPolicy(policy));

  if (policy.location && gpsPointer) {
    if (!gpsIfd) return undefined;
    zeroIfd(output, gpsIfd);
    zeroEntry(output, gpsPointer);
  }

  if (policy.thumbnail && ifd0.nextOffset) {
    const thumbnailIfd = parseIfdEntries(view, ifd0.nextOffset, littleEndian);
    if (!thumbnailIfd) return undefined;
    const dataOffsetEntry = thumbnailIfd.entries.find((entry) => entry.tag === 0x0201);
    const dataLengthEntry = thumbnailIfd.entries.find((entry) => entry.tag === 0x0202);
    const dataOffset = dataOffsetEntry ? readEntryPointer(view, dataOffsetEntry, littleEndian) : 0;
    const dataLength = dataLengthEntry ? readEntryPointer(view, dataLengthEntry, littleEndian) : 0;
    if (dataOffset > 0 && dataLength > 0) {
      if (dataOffset + dataLength > output.length) return undefined;
      output.fill(0, dataOffset, dataOffset + dataLength);
    }
    zeroIfd(output, thumbnailIfd);
    output.fill(0, ifd0.nextPointerOffset, ifd0.nextPointerOffset + 4);
  }
  return output;
}

interface RawExifEntry {
  readonly tag: number;
  readonly type: number;
  readonly count: number;
  readonly entryOffset: number;
  readonly dataOffset: number;
  readonly dataLength: number;
}

interface RawIfd {
  readonly tableOffset: number;
  readonly tableEnd: number;
  readonly entries: readonly RawExifEntry[];
  readonly nextOffset: number;
  readonly nextPointerOffset: number;
}

function parseIfdEntries(
  view: DataView,
  offset: number,
  littleEndian: boolean
): RawIfd | undefined {
  if (offset < 0 || offset + 2 > view.byteLength) return undefined;
  const count = safeUint16(view, offset, littleEndian);
  if (count === undefined || count > 2048) return undefined;
  const tableEnd = offset + 2 + count * 12 + 4;
  if (tableEnd > view.byteLength) return undefined;
  const entries: RawExifEntry[] = [];
  const sizes: Readonly<Record<number, number>> = {
    1: 1,
    2: 1,
    3: 2,
    4: 4,
    5: 8,
    7: 1,
    9: 4,
    10: 8
  };
  for (let index = 0; index < count; index += 1) {
    const entryOffset = offset + 2 + index * 12;
    const tag = safeUint16(view, entryOffset, littleEndian);
    const type = safeUint16(view, entryOffset + 2, littleEndian);
    const valueCount = safeUint32(view, entryOffset + 4, littleEndian);
    const size = type === undefined ? undefined : sizes[type];
    if (tag === undefined || type === undefined || valueCount === undefined || !size) continue;
    const dataLength = size * valueCount;
    if (valueCount > 65536 || dataLength > MAX_METADATA_BLOCK_BYTES) return undefined;
    const dataOffset =
      dataLength <= 4 ? entryOffset + 8 : safeUint32(view, entryOffset + 8, littleEndian);
    if (dataOffset === undefined || dataOffset + dataLength > view.byteLength) return undefined;
    entries.push({ tag, type, count: valueCount, entryOffset, dataOffset, dataLength });
  }
  const nextPointerOffset = offset + 2 + count * 12;
  return {
    tableOffset: offset,
    tableEnd,
    entries,
    nextOffset: safeUint32(view, nextPointerOffset, littleEndian) ?? 0,
    nextPointerOffset
  };
}

function ifd0TagsForPolicy(policy: MetadataRemovalPolicy) {
  const tags = new Set<number>();
  if (policy.camera) [0x010f, 0x0110].forEach((tag) => tags.add(tag));
  if (policy.dates) tags.add(0x0132);
  if (policy.software) [0x000b, 0x0131, 0x013c].forEach((tag) => tags.add(tag));
  if (policy.author) [0x013b, 0x8298].forEach((tag) => tags.add(tag));
  return tags;
}

function exifTagsForPolicy(policy: MetadataRemovalPolicy) {
  const tags = new Set<number>();
  if (policy.camera) {
    [0x927c, 0xa430, 0xa431, 0xa432, 0xa433, 0xa434, 0xa435].forEach((tag) => tags.add(tag));
  }
  if (policy.location) tags.add(0x927c);
  if (policy.dates) {
    [0x9003, 0x9004, 0x9010, 0x9011, 0x9012, 0x9290, 0x9291, 0x9292].forEach((tag) =>
      tags.add(tag)
    );
  }
  if (policy.author) tags.add(0xa430);
  return tags;
}

function scrubTaggedEntries(
  bytes: Uint8Array,
  entries: readonly RawExifEntry[],
  tags: ReadonlySet<number>
) {
  for (const entry of entries) if (tags.has(entry.tag)) zeroEntry(bytes, entry);
}

function zeroIfd(bytes: Uint8Array, ifd: RawIfd) {
  for (const entry of ifd.entries) zeroEntryData(bytes, entry);
  bytes.fill(0, ifd.tableOffset, ifd.tableEnd);
}

function zeroEntry(bytes: Uint8Array, entry: RawExifEntry) {
  zeroEntryData(bytes, entry);
  bytes.fill(0, entry.entryOffset, entry.entryOffset + 12);
}

function zeroEntryData(bytes: Uint8Array, entry: RawExifEntry) {
  if (entry.dataLength > 4) bytes.fill(0, entry.dataOffset, entry.dataOffset + entry.dataLength);
}

function readEntryPointer(view: DataView, entry: RawExifEntry, littleEndian: boolean) {
  if (entry.type !== 4 || entry.count !== 1) return 0;
  return safeUint32(view, entry.entryOffset + 8, littleEndian) ?? 0;
}

function policyTouchesExif(policy: MetadataRemovalPolicy) {
  return (
    policy.exif ||
    policy.location ||
    policy.camera ||
    policy.dates ||
    policy.software ||
    policy.author ||
    policy.thumbnail
  );
}

function policyTouchesContainerMetadata(policy: MetadataRemovalPolicy) {
  return policyTouchesExif(policy) || policy.xmp || policy.iptc || policy.icc;
}

function shouldRemoveXmp(policy: MetadataRemovalPolicy) {
  return (
    policy.xmp ||
    policy.location ||
    policy.camera ||
    policy.dates ||
    policy.software ||
    policy.author
  );
}

function shouldRemoveIptc(policy: MetadataRemovalPolicy) {
  return policy.iptc || policy.location || policy.dates || policy.author;
}

function shouldRemovePngText(type: string, payload: Uint8Array, policy: MetadataRemovalPolicy) {
  const nullIndex = payload.indexOf(0);
  const keyword = decodeText(payload.subarray(0, nullIndex < 0 ? payload.length : nullIndex));
  const normalized = keyword.toLocaleLowerCase();
  if (normalized.includes('xmp')) return shouldRemoveXmp(policy);
  if (normalized.includes('iptc')) return shouldRemoveIptc(policy);
  if (policy.location && /gps|location|latitude|longitude|city|country/.test(normalized))
    return true;
  if (policy.camera && /camera|lens|model|make/.test(normalized)) return true;
  if (policy.dates && /date|time|created|modified/.test(normalized)) return true;
  if (policy.software && /software|application|creator tool/.test(normalized)) return true;
  if (policy.author && /author|artist|copyright|creator/.test(normalized)) return true;
  return type === 'zTXt' && policyTouchesContainerMetadata(policy);
}

function buildJpegSegment(marker: number, payload: Uint8Array) {
  const output = new Uint8Array(payload.length + 4);
  output[0] = 0xff;
  output[1] = marker;
  writeUint16(output, 2, payload.length + 2);
  output.set(payload, 4);
  return output;
}

function buildPngChunk(type: string, payload: Uint8Array) {
  const output = new Uint8Array(payload.length + 12);
  writeUint32(output, 0, payload.length);
  output.set(asciiBytes(type), 4);
  output.set(payload, 8);
  writeUint32(output, output.length - 4, crc32(output.subarray(4, output.length - 4)));
  return output;
}

function buildWebpChunk(type: string, payload: Uint8Array) {
  const output = new Uint8Array(8 + payload.length + (payload.length % 2));
  output.set(asciiBytes(type), 0);
  writeUint32Le(output, 4, payload.length);
  output.set(payload, 8);
  return output;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function assertNotCancelled(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new AppError('CANCELLED', 'Metadata cleaning was cancelled.');
}

async function readBlob(file: Blob, offset: number, length: number) {
  return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
}

function startsWithAscii(bytes: Uint8Array, value: string) {
  if (bytes.length < value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function asciiBytes(value: string) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function decodeText(bytes: Uint8Array) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function joinBytes(...parts: readonly Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
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

function writeUint16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeUint32Le(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function safeUint16(view: DataView, offset: number, littleEndian: boolean) {
  return offset >= 0 && offset + 2 <= view.byteLength
    ? view.getUint16(offset, littleEndian)
    : undefined;
}

function safeUint32(view: DataView, offset: number, littleEndian: boolean) {
  return offset >= 0 && offset + 4 <= view.byteLength
    ? view.getUint32(offset, littleEndian)
    : undefined;
}
