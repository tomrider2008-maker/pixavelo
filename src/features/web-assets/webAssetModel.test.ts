import { describe, expect, it } from 'vitest';
import { createIcoBlob } from './favicon';
import {
  buildIconManifest,
  buildResponsiveMarkup,
  buildWebAssetFilename,
  normalizeBreakpoints,
  verifiedAssetCount
} from './webAssetModel';

describe('web asset model', () => {
  it('normalizes, caps, sorts and deduplicates breakpoint widths', () => {
    expect(normalizeBreakpoints([1600, 480.4, 480, 9000, -2], 2400, true)).toEqual([
      16, 480, 1600, 2400
    ]);
  });

  it('creates safe production filenames and complete picture markup', () => {
    expect(buildWebAssetFilename('../hero?.jpg', 768, 'jpeg')).toBe('hero-768.jpg');
    const markup = buildResponsiveMarkup('hero.jpg', [480, 960], ['avif', 'webp', 'jpeg']);
    expect(markup).toContain('<picture>');
    expect(markup).toContain('type="image/avif"');
    expect(markup).toContain('hero-960.jpg');
    expect(markup).toContain('960w');
  });

  it('keeps parsed picture candidates package-local for hostile filenames', () => {
    const markup = buildResponsiveMarkup(
      'https&#58;&#47;&#47;tracker.example&#47;pixel, 2x.jpg',
      [480, 960],
      ['avif', 'jpeg']
    );
    const document = new DOMParser().parseFromString(markup, 'text/html');
    const urls = [
      ...Array.from(document.querySelectorAll('source')).flatMap((source) =>
        source.srcset.split(',').map((candidate) => candidate.trim().split(/\s+/)[0])
      ),
      document.querySelector('img')?.getAttribute('src'),
      ...Array.from(document.querySelector('img')?.srcset.split(',') ?? []).map(
        (candidate) => candidate.trim().split(/\s+/)[0]
      )
    ].filter(Boolean);
    expect(urls.every((url) => /^[A-Za-z0-9_-]+-\d+\.(?:avif|jpg)$/.test(url ?? ''))).toBe(true);
  });

  it('builds a standards-based icon manifest', () => {
    const manifest = JSON.parse(buildIconManifest('Northstar')) as { icons: unknown[] };
    expect(manifest.icons).toHaveLength(2);
    expect(JSON.stringify(manifest)).toContain('icon-512.png');
  });

  it('creates an ICO directory whose offsets match its PNG payloads', async () => {
    const first = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const second = new Blob([new Uint8Array([4, 5])], { type: 'image/png' });
    const ico = await createIcoBlob([
      { size: 16, blob: first },
      { size: 32, blob: second }
    ]);
    const view = new DataView(await ico.arrayBuffer());
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);
    expect(view.getUint32(18, true)).toBe(38);
    expect(ico.size).toBe(43);
  });

  it('counts only outputs that passed verification', () => {
    expect(
      verifiedAssetCount([
        { filename: 'a.webp', blob: new Blob(), format: 'webp', verified: true },
        { filename: 'b.webp', blob: new Blob(), format: 'webp', verified: false }
      ])
    ).toBe(1);
  });
});
