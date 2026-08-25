import { describe, expect, it, vi } from 'vitest';
import { encodeToTarget } from './encodeToTarget';

describe('encodeToTarget', () => {
  const encoder = (quality: number) => Promise.resolve({ size: Math.round(quality * 1000) });

  it('returns maximum quality immediately when it already meets the target', async () => {
    const encode = vi.fn(encoder);
    const result = await encodeToTarget({ targetBytes: 980, encode });

    expect(result).toMatchObject({ quality: 0.95, attempts: 1, targetSatisfied: true });
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('finds the highest tested quality below the target within a bounded pass count', async () => {
    const encode = vi.fn(encoder);
    const result = await encodeToTarget({ targetBytes: 600, encode, maximumPasses: 8 });

    expect(result.output.size).toBeLessThanOrEqual(600);
    expect(result.quality).toBeGreaterThan(0.58);
    expect(result.attempts).toBe(8);
    expect(encode).toHaveBeenCalledTimes(8);
  });

  it('reports an unreachable target honestly at minimum quality', async () => {
    const result = await encodeToTarget({
      targetBytes: 100,
      encode: (quality) => Promise.resolve({ size: 500 + Math.round(quality * 1000) })
    });

    expect(result).toMatchObject({ quality: 0.12, attempts: 2, targetSatisfied: false });
  });

  it('rejects invalid targets before invoking the encoder', async () => {
    const encode = vi.fn(encoder);
    await expect(encodeToTarget({ targetBytes: 0, encode })).rejects.toThrow(RangeError);
    expect(encode).not.toHaveBeenCalled();
  });
});
