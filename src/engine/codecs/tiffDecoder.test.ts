import UTIF from 'utif';
import { describe, expect, it } from 'vitest';
import { decodeTiff } from './tiffDecoder';

describe('decodeTiff', () => {
  it('decodes a real TIFF image directory to verified RGBA pixels', () => {
    const rgba = Uint8Array.from([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128
    ]);
    const encoded = UTIF.encodeImage(rgba.buffer, 2, 2);
    const decoded = decodeTiff(encoded);
    expect(decoded).toMatchObject({ width: 2, height: 2 });
    expect(decoded.data).toHaveLength(16);
    expect([...decoded.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it('fails safely when the TIFF has no image directory', () => {
    expect(() => decodeTiff(new ArrayBuffer(12))).toThrow();
  });
});
