import { describe, expect, it } from 'vitest';
import { encodeToTargetWithResize, nextTargetDimensions } from './encodeToTargetWithResize';

describe('target-size search with resize fallback', () => {
  it('keeps dimensions when quality alone reaches the target', async () => {
    const result = await encodeToTargetWithResize({
      width: 2400,
      height: 1600,
      targetBytes: 700,
      encode: (width, height, quality) =>
        Promise.resolve({ size: Math.round((width * height * quality) / 5000) }),
      allowResize: true,
      maximumPasses: 10
    });
    expect(result.targetSatisfied).toBe(true);
    expect(result.resizePasses).toBe(0);
    expect(result.width).toBe(2400);
  });

  it('reduces dimensions only after minimum quality misses the actual byte target', async () => {
    const result = await encodeToTargetWithResize({
      width: 4000,
      height: 3000,
      targetBytes: 100_000,
      encode: (width, height, quality) =>
        Promise.resolve({ size: Math.round(width * height * (0.08 + quality * 0.35)) }),
      allowResize: true,
      maximumPasses: 12
    });
    expect(result.targetSatisfied).toBe(true);
    expect(result.output.size).toBeLessThanOrEqual(100_000);
    expect(result.resizePasses).toBeGreaterThan(0);
    expect(result.width).toBeLessThan(4000);
    expect(result.attempts).toBeLessThanOrEqual(12);
  });

  it('reports an unreachable target without pretending it succeeded', async () => {
    const result = await encodeToTargetWithResize({
      width: 640,
      height: 480,
      targetBytes: 10,
      encode: () => Promise.resolve({ size: 1000 }),
      allowResize: true,
      minimumLongEdge: 320,
      maximumPasses: 6
    });
    expect(result.targetSatisfied).toBe(false);
    expect(result.output.size).toBe(1000);
    expect(result.attempts).toBeLessThanOrEqual(6);
  });

  it('derives a bounded proportional resize from measured bytes', () => {
    expect(nextTargetDimensions(4000, 3000, 100_000, 400_000)).toEqual({
      width: 2000,
      height: 1500
    });
  });
});
