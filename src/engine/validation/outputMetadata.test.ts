import { describe, expect, it } from 'vitest';
import { outputHasMetadata } from './outputMetadata';

describe('output metadata verification', () => {
  it('detects JPEG metadata application segments', () => {
    expect(outputHasMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x02]), 'jpeg')).toBe(
      true
    );
    expect(outputHasMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xda]), 'jpeg')).toBe(false);
  });

  it('detects PNG and WebP metadata chunks', () => {
    const png = new Uint8Array(8 + 12);
    png.set([0, 0, 0, 0], 8);
    png.set(new TextEncoder().encode('eXIf'), 12);
    expect(outputHasMetadata(png, 'png')).toBe(true);

    const webp = new Uint8Array(20);
    webp.set(new TextEncoder().encode('RIFF'), 0);
    webp.set(new TextEncoder().encode('WEBP'), 8);
    webp.set(new TextEncoder().encode('EXIF'), 12);
    expect(outputHasMetadata(webp, 'webp')).toBe(true);
  });
});
