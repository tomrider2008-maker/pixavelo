import { AppError } from '../../engine/errors/AppError';

export async function createIcoBlob(pngs: readonly { size: number; blob: Blob }[]) {
  if (pngs.length === 0 || pngs.length > 255) {
    throw new AppError('ENCODE_FAILED', 'ICO output requires between 1 and 255 PNG images.');
  }
  const entries = await Promise.all(
    pngs.map(async ({ size, blob }) => ({ size, bytes: new Uint8Array(await blob.arrayBuffer()) }))
  );
  const directorySize = 6 + entries.length * 16;
  let payloadOffset = directorySize;
  const header = new Uint8Array(directorySize);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, entries.length, true);

  entries.forEach((entry, index) => {
    const offset = 6 + index * 16;
    header[offset] = entry.size >= 256 ? 0 : entry.size;
    header[offset + 1] = entry.size >= 256 ? 0 : entry.size;
    header[offset + 2] = 0;
    header[offset + 3] = 0;
    view.setUint16(offset + 4, 1, true);
    view.setUint16(offset + 6, 32, true);
    view.setUint32(offset + 8, entry.bytes.byteLength, true);
    view.setUint32(offset + 12, payloadOffset, true);
    payloadOffset += entry.bytes.byteLength;
  });

  const output = new Blob([header, ...entries.map((entry) => entry.bytes)], {
    type: 'image/x-icon'
  });
  if (output.size !== payloadOffset) {
    throw new AppError('OUTPUT_VALIDATION_FAILED', 'ICO directory offsets were not valid.');
  }
  return output;
}
