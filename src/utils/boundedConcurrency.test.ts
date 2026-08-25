import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './boundedConcurrency';

describe('mapWithConcurrency', () => {
  it('preserves order while bounding active work', async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapWithConcurrency(
      Array.from({ length: 120 }, (_, index) => index),
      4,
      async (value) => {
        active += 1;
        maximum = Math.max(maximum, active);
        await Promise.resolve();
        active -= 1;
        return value * 2;
      }
    );
    expect(maximum).toBe(4);
    expect(result).toHaveLength(120);
    expect(result[119]).toBe(238);
  });
});
