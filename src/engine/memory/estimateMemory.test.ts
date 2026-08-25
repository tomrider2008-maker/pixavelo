import { describe, expect, it } from 'vitest';
import { estimateImageMemory, getWorkerLimit } from './estimateMemory';

const dimensions = (width: number, height: number) => ({
  width,
  height,
  pixels: width * height,
  megapixels: (width * height) / 1_000_000
});

describe('estimateImageMemory', () => {
  it('classifies small images for bounded parallel work', () => {
    expect(estimateImageMemory(dimensions(1200, 800))).toMatchObject({
      category: 'small',
      recommendedConcurrency: 4
    });
  });

  it('serializes extreme decoded buffers', () => {
    expect(estimateImageMemory(dimensions(14_000, 10_000))).toMatchObject({
      category: 'extreme',
      recommendedConcurrency: 1
    });
  });

  it('caps worker count and keeps at least one worker', () => {
    expect(getWorkerLimit(32)).toBe(4);
    expect(getWorkerLimit(1)).toBe(1);
  });
});
