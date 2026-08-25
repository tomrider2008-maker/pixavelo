import { AppError } from '../errors/AppError';
import { MAX_ARCHIVE_BYTES } from '../memory/browserBudgets';

export interface ZipEntry {
  readonly name: string;
  readonly blob: Blob;
  readonly modifiedAt?: Date;
}

export interface CreateZipOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (completed: number, total: number) => void;
}

interface PreparedEntry extends ZipEntry {
  readonly filename: Uint8Array;
  readonly crc32: number;
  readonly localOffset: number;
  readonly dosDate: number;
  readonly dosTime: number;
}

const MAX_ZIP32_VALUE = 0xffffffff;
const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;
const VERSION_20 = 20;
const crcTable = buildCrcTable();

export async function createZipBlob(
  entries: readonly ZipEntry[],
  options: CreateZipOptions = {}
): Promise<Blob> {
  if (entries.length === 0) throw new AppError('ZIP_FAILED', 'The archive has no files.');
  if (entries.length > 0xffff)
    throw new AppError('ZIP_FAILED', 'ZIP32 supports at most 65,535 files.');

  const parts: BlobPart[] = [];
  const prepared: PreparedEntry[] = [];
  let offset = 0;

  for (const [index, entry] of entries.entries()) {
    assertNotCancelled(options.signal);
    if (entry.blob.size > MAX_ZIP32_VALUE) {
      throw new AppError('ZIP_FAILED', `${entry.name} exceeds the ZIP32 file-size limit.`);
    }
    const filename = new TextEncoder().encode(entry.name);
    if (filename.byteLength > 0xffff) {
      throw new AppError('ZIP_FAILED', 'An output filename is too long for ZIP32.');
    }
    if (offset + 30 + filename.byteLength + entry.blob.size > MAX_ARCHIVE_BYTES) {
      throw new AppError('MEMORY_LIMIT', 'The archive exceeds the 512 MiB browser budget.');
    }
    const crc32 = await crc32ForBlob(entry.blob, options.signal);
    const { dosDate, dosTime } = toDosDateTime(entry.modifiedAt ?? new Date());
    const localOffset = offset;
    const localHeader = makeLocalHeader(filename, entry.blob.size, crc32, dosDate, dosTime);
    parts.push(localHeader, entry.blob);
    offset += localHeader.byteLength + entry.blob.size;
    if (offset > MAX_ZIP32_VALUE) {
      throw new AppError('ZIP_FAILED', 'The archive exceeds the ZIP32 size limit.');
    }
    prepared.push({ ...entry, filename, crc32, localOffset, dosDate, dosTime });
    options.onProgress?.(index + 1, entries.length);
  }

  const centralOffset = offset;
  for (const entry of prepared) {
    const header = makeCentralHeader(entry);
    parts.push(header);
    offset += header.byteLength;
  }
  const centralSize = offset - centralOffset;
  parts.push(makeEndRecord(entries.length, centralSize, centralOffset));

  const archive = new Blob(parts, { type: 'application/zip' });
  if (archive.size === 0) throw new AppError('ZIP_FAILED', 'The archive was empty.');
  return archive;
}

function makeLocalHeader(
  filename: Uint8Array,
  size: number,
  crc32: number,
  dosDate: number,
  dosTime: number
) {
  const output = new Uint8Array(30 + filename.byteLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, VERSION_20, true);
  view.setUint16(6, UTF8_FLAG, true);
  view.setUint16(8, STORE_METHOD, true);
  view.setUint16(10, dosTime, true);
  view.setUint16(12, dosDate, true);
  view.setUint32(14, crc32, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, filename.byteLength, true);
  view.setUint16(28, 0, true);
  output.set(filename, 30);
  return output;
}

function makeCentralHeader(entry: PreparedEntry) {
  const output = new Uint8Array(46 + entry.filename.byteLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, VERSION_20, true);
  view.setUint16(6, VERSION_20, true);
  view.setUint16(8, UTF8_FLAG, true);
  view.setUint16(10, STORE_METHOD, true);
  view.setUint16(12, entry.dosTime, true);
  view.setUint16(14, entry.dosDate, true);
  view.setUint32(16, entry.crc32, true);
  view.setUint32(20, entry.blob.size, true);
  view.setUint32(24, entry.blob.size, true);
  view.setUint16(28, entry.filename.byteLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, entry.localOffset, true);
  output.set(entry.filename, 46);
  return output;
}

function makeEndRecord(entryCount: number, centralSize: number, centralOffset: number) {
  const output = new Uint8Array(22);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return output;
}

async function crc32ForBlob(blob: Blob, signal?: AbortSignal) {
  const stream = Reflect.get(blob, 'stream') as Blob['stream'] | undefined;
  if (typeof stream !== 'function') {
    const bytes = new Uint8Array(await readBlobBuffer(blob));
    return crc32ForBytes(bytes, signal);
  }

  const reader = stream.call(blob).getReader();
  let crc = 0xffffffff;
  let reading = true;
  try {
    while (reading) {
      assertNotCancelled(signal);
      const { done, value } = await reader.read();
      if (done) {
        reading = false;
      } else {
        for (const byte of value) {
          crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crc32ForBytes(bytes: Uint8Array, signal?: AbortSignal) {
  let crc = 0xffffffff;
  for (const [index, byte] of bytes.entries()) {
    if (index % 65_536 === 0) assertNotCancelled(signal);
    crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readBlobBuffer(blob: Blob): Promise<ArrayBuffer> {
  const arrayBuffer = Reflect.get(blob, 'arrayBuffer') as Blob['arrayBuffer'] | undefined;
  if (typeof arrayBuffer === 'function') return arrayBuffer.call(blob);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Blob reading failed.'));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('Blob reading did not return bytes.'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function toDosDateTime(date: Date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  };
}

function assertNotCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new AppError('CANCELLED');
}
