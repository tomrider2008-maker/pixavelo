import { describe, expect, it, vi } from 'vitest';
import { validateImageFile } from './validateFile';

function pngFile(name = 'image.png', width = 16, height = 12, type = 'image/png') {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], name, { type });
}

describe('validateImageFile', () => {
  it('validates signature and dimensions instead of trusting extension', async () => {
    const report = await validateImageFile(pngFile('photo.jpg', 640, 480, 'image/jpeg'));
    expect(report.format).toBe('png');
    expect(report.mime).toBe('image/png');
    expect(report.dimensions).toMatchObject({ width: 640, height: 480 });
    expect(report.warnings.map((warning) => warning.code)).toEqual([
      'EXTENSION_MISMATCH',
      'MIME_MISMATCH'
    ]);
  });

  it('rejects empty files', async () => {
    await expect(
      validateImageFile(new File([], 'empty.png', { type: 'image/png' }))
    ).rejects.toMatchObject({ code: 'INVALID_FILE' });
  });

  it('rejects declared dimensions over the safety limit', async () => {
    await expect(validateImageFile(pngFile('bomb.png', 32_769, 4_000))).rejects.toMatchObject({
      code: 'PIXEL_LIMIT'
    });
  });

  it('declares advanced formats processable with a static-export warning', async () => {
    const gif = new File(
      [Uint8Array.from([...new TextEncoder().encode('GIF89a'), 2, 0, 3, 0])],
      'animation.gif',
      {
        type: 'image/gif'
      }
    );
    const report = await validateImageFile(gif);
    expect(report.format).toBe('gif');
    expect(report.supportedByCoreCodec).toBe(false);
    expect(report.supportedByConverter).toBe(true);
    expect(report.decoder).toMatchObject({ label: 'Browser native', loadedOnDemand: false });
    expect(report.warnings).toContainEqual(
      expect.objectContaining({ code: 'ANIMATION_FIRST_FRAME' })
    );
  });

  it('rejects files whose safe dimensions are absent from bounded preflight', async () => {
    const gif = new File([new TextEncoder().encode('GIF89a')], 'missing-dimensions.gif', {
      type: 'image/gif'
    });
    await expect(validateImageFile(gif)).rejects.toMatchObject({ code: 'INVALID_FILE' });
  });

  it('rejects oversized SVG bytes before whole-file text decoding', async () => {
    const bytes = new Uint8Array(5 * 1024 * 1024 + 1);
    bytes.set(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'));
    const svg = new File([bytes], 'oversized.svg', { type: 'image/svg+xml' });
    const text = vi.spyOn(File.prototype, 'text');
    await expect(validateImageFile(svg)).rejects.toMatchObject({ code: 'MEMORY_LIMIT' });
    expect(text).not.toHaveBeenCalled();
    text.mockRestore();
  });

  it('rejects SVG active content before preview or decoding', async () => {
    const svg = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
      'unsafe.svg',
      { type: 'image/svg+xml' }
    );
    await expect(validateImageFile(svg)).rejects.toMatchObject({ code: 'UNSAFE_SVG' });
  });
});
