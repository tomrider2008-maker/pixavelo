import { describe, expect, it } from 'vitest';
import { detectImageFormat, readImageDimensions } from './signatures';

describe('detectImageFormat', () => {
  it.each([
    ['jpeg', [0xff, 0xd8, 0xff, 0xe0]],
    ['png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['gif', [...new TextEncoder().encode('GIF89a')]],
    ['bmp', [0x42, 0x4d, 0, 0]],
    ['tiff', [0x49, 0x49, 0x2a, 0x00]],
    ['ico', [0x00, 0x00, 0x01, 0x00]]
  ] as const)('detects %s from magic bytes', (format, signature) => {
    expect(detectImageFormat(Uint8Array.from(signature))).toBe(format);
  });

  it('detects WebP from both RIFF and WEBP markers', () => {
    const bytes = new Uint8Array(16);
    bytes.set(new TextEncoder().encode('RIFF'), 0);
    bytes.set(new TextEncoder().encode('WEBP'), 8);
    expect(detectImageFormat(bytes)).toBe('webp');
  });

  it('detects AVIF and HEIC brands', () => {
    const avif = new Uint8Array(16);
    avif.set(new TextEncoder().encode('ftypavif'), 4);
    const heic = new Uint8Array(16);
    heic.set(new TextEncoder().encode('ftypheic'), 4);
    expect(detectImageFormat(avif)).toBe('avif');
    expect(detectImageFormat(heic)).toBe('heic');
  });

  it('uses compatible ISO-BMFF brands instead of trusting only the major brand', () => {
    const bytes = new Uint8Array(24);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 24);
    bytes.set(new TextEncoder().encode('ftypmif1'), 4);
    bytes.set(new TextEncoder().encode('mif1avif'), 16);
    expect(detectImageFormat(bytes)).toBe('avif');
  });

  it('recognizes SVG without executing or rendering it', () => {
    const svg = new TextEncoder().encode(
      '<?xml version="1.0"?><svg><script>alert(1)</script></svg>'
    );
    expect(detectImageFormat(svg)).toBe('svg');
  });

  it('returns unknown for arbitrary content', () => {
    expect(detectImageFormat(new TextEncoder().encode('not an image'))).toBe('unknown');
  });
});

describe('readImageDimensions', () => {
  it('reads PNG IHDR dimensions', () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 1920);
    view.setUint32(20, 1080);

    expect(readImageDimensions('png', bytes)).toMatchObject({
      width: 1920,
      height: 1080,
      pixels: 2_073_600
    });
  });

  it('reads JPEG start-of-frame dimensions', () => {
    const bytes = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x38, 0x07,
      0x80, 0x03
    ]);
    expect(readImageDimensions('jpeg', bytes)).toMatchObject({ width: 1920, height: 1080 });
  });

  it('reads extended WebP dimensions', () => {
    const bytes = new Uint8Array(30);
    bytes.set(new TextEncoder().encode('RIFF'), 0);
    bytes.set(new TextEncoder().encode('WEBPVP8X'), 8);
    const widthMinusOne = 799;
    const heightMinusOne = 599;
    bytes.set([widthMinusOne & 0xff, (widthMinusOne >> 8) & 0xff, 0], 24);
    bytes.set([heightMinusOne & 0xff, (heightMinusOne >> 8) & 0xff, 0], 27);
    expect(readImageDimensions('webp', bytes)).toMatchObject({ width: 800, height: 600 });
  });

  it('reads GIF, BMP, TIFF and ICO dimensions without decoding pixels', () => {
    const gif = new Uint8Array(13);
    gif.set(new TextEncoder().encode('GIF89a'));
    new DataView(gif.buffer).setUint16(6, 7, true);
    new DataView(gif.buffer).setUint16(8, 5, true);

    const bmp = new Uint8Array(54);
    bmp.set(new TextEncoder().encode('BM'));
    const bmpView = new DataView(bmp.buffer);
    bmpView.setUint32(14, 40, true);
    bmpView.setInt32(18, 11, true);
    bmpView.setInt32(22, -9, true);

    const tiff = new Uint8Array(38);
    tiff.set([0x49, 0x49, 0x2a, 0x00]);
    const tiffView = new DataView(tiff.buffer);
    tiffView.setUint32(4, 8, true);
    tiffView.setUint16(8, 2, true);
    tiffView.setUint16(10, 256, true);
    tiffView.setUint16(12, 4, true);
    tiffView.setUint32(14, 1, true);
    tiffView.setUint32(18, 13, true);
    tiffView.setUint16(22, 257, true);
    tiffView.setUint16(24, 4, true);
    tiffView.setUint32(26, 1, true);
    tiffView.setUint32(30, 17, true);

    const ico = new Uint8Array(22);
    ico.set([0, 0, 1, 0, 1, 0, 32, 24]);

    expect(readImageDimensions('gif', gif)).toMatchObject({ width: 7, height: 5 });
    expect(readImageDimensions('bmp', bmp)).toMatchObject({ width: 11, height: 9 });
    expect(readImageDimensions('tiff', tiff)).toMatchObject({ width: 13, height: 17 });
    expect(readImageDimensions('ico', ico)).toMatchObject({ width: 32, height: 24 });
  });

  it('reads safety dimensions from an ISO-BMFF ispe box', () => {
    const bytes = new Uint8Array(48);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 24);
    bytes.set(new TextEncoder().encode('ftypavif'), 4);
    view.setUint32(24, 20);
    bytes.set(new TextEncoder().encode('ispe'), 28);
    view.setUint32(36, 1920);
    view.setUint32(40, 1080);
    expect(readImageDimensions('avif', bytes)).toMatchObject({ width: 1920, height: 1080 });
  });
});
