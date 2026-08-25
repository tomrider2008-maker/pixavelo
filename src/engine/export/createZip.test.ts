import { describe, expect, it } from 'vitest';
import { createZipBlob } from './createZip';

describe('createZipBlob', () => {
  it('creates a valid stored UTF-8 ZIP with CRC and central directory', async () => {
    const archive = await createZipBlob([
      { name: 'hello.txt', blob: new Blob(['hello']) },
      { name: 'ပြောင်းလဲ.png', blob: new Blob([new Uint8Array([1, 2, 3])]) }
    ]);
    const bytes = new Uint8Array(await readBlobBuffer(archive));
    const view = new DataView(bytes.buffer);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
    expect(view.getUint32(14, true)).toBe(0x3610a686);
    expect(findSignature(bytes, 0x02014b50)).toBeGreaterThan(0);
    expect(view.getUint32(bytes.byteLength - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.byteLength - 12, true)).toBe(2);
    expect(new TextDecoder().decode(bytes)).toContain('ပြောင်းလဲ.png');
  });

  it('rejects empty archives', async () => {
    await expect(createZipBlob([])).rejects.toMatchObject({ code: 'ZIP_FAILED' });
  });

  it('rejects archives above the browser budget before reading entry data', async () => {
    const oversized = { size: 512 * 1024 * 1024, type: 'application/octet-stream' } as Blob;
    await expect(createZipBlob([{ name: 'oversized.bin', blob: oversized }])).rejects.toMatchObject(
      {
        code: 'MEMORY_LIMIT'
      }
    );
  });

  it('honors cancellation before reading output data', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createZipBlob([{ name: 'image.jpg', blob: new Blob(['data']) }], {
        signal: controller.signal
      })
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});

function findSignature(bytes: Uint8Array, signature: number) {
  const view = new DataView(bytes.buffer);
  for (let offset = 0; offset <= bytes.byteLength - 4; offset += 1) {
    if (view.getUint32(offset, true) === signature) return offset;
  }
  return -1;
}

function readBlobBuffer(blob: Blob): Promise<ArrayBuffer> {
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
