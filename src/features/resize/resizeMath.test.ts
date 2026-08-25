import { describe, expect, it } from 'vitest';
import { resolveResizeDimensions, type ResizeRequest } from './resizeMath';

const base: ResizeRequest = {
  method: 'exact',
  width: 1200,
  height: 800,
  percentage: 50,
  edge: 1000,
  megapixels: 2
};

describe('resolveResizeDimensions', () => {
  it.each([
    ['exact', { width: 1200, height: 800 }],
    ['width', { width: 1200, height: 800 }],
    ['height', { width: 1200, height: 800 }],
    ['percentage', { width: 1200, height: 800 }],
    ['max-width', { width: 1200, height: 800 }],
    ['max-height', { width: 1200, height: 800 }],
    ['max-bounds', { width: 1200, height: 800 }],
    ['longest-edge', { width: 1000, height: 667 }],
    ['shortest-edge', { width: 1500, height: 1000 }]
  ] as const)('resolves the %s method', (method, expected) => {
    expect(resolveResizeDimensions(2400, 1600, { ...base, method })).toEqual(expected);
  });

  it('resolves megapixel targets without exceeding dimension safety limits', () => {
    const result = resolveResizeDimensions(4000, 3000, { ...base, method: 'megapixels' });
    expect(result.width * result.height).toBeCloseTo(2_000_000, -3);
    expect(
      resolveResizeDimensions(1, 1, { ...base, method: 'percentage', percentage: 1000 })
    ).toEqual({ width: 8, height: 8 });
  });
});
