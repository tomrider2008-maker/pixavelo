import { describe, expect, it } from 'vitest';
import { clampCrop, fitCropToAspect, transformCrop } from './cropMath';

describe('crop math', () => {
  it('centers the largest crop for an aspect ratio', () => {
    expect(fitCropToAspect(2400, 1600, 1)).toEqual({ x: 400, y: 0, width: 1600, height: 1600 });
    expect(fitCropToAspect(1600, 2400, 16 / 9)).toEqual({
      x: 0,
      y: 750,
      width: 1600,
      height: 900
    });
  });

  it('clamps numeric crops inside the source', () => {
    expect(clampCrop({ x: -20, y: 900, width: 1200, height: 900 }, 1000, 1000)).toEqual({
      x: 0,
      y: 900,
      width: 1000,
      height: 100
    });
  });

  it('moves and resizes without escaping source bounds', () => {
    const crop = { x: 100, y: 100, width: 400, height: 300 };
    expect(transformCrop(crop, 'move', 900, -200, 1000, 800)).toEqual({
      x: 600,
      y: 0,
      width: 400,
      height: 300
    });
    expect(transformCrop(crop, 'se', 900, 900, 1000, 800)).toEqual({
      x: 100,
      y: 100,
      width: 900,
      height: 700
    });
  });
});
