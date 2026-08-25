import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_ADJUSTMENTS,
  buildCanvasFilter,
  hasVisibleAdjustments,
  normalizeImageAdjustments,
  transformPixelBuffer
} from './imageAdjustments';

describe('image adjustments', () => {
  it('normalizes unsafe recipe values at the engine boundary', () => {
    expect(
      normalizeImageAdjustments({ ...DEFAULT_IMAGE_ADJUSTMENTS, exposure: 99, gamma: 0 })
    ).toMatchObject({ exposure: 3, gamma: 0.2 });
  });

  it('detects the untouched recipe and scales preview blur', () => {
    expect(hasVisibleAdjustments(DEFAULT_IMAGE_ADJUSTMENTS)).toBe(false);
    expect(buildCanvasFilter({ ...DEFAULT_IMAGE_ADJUSTMENTS, blur: 4 }, 0.5)).toBe('blur(2.00px)');
  });

  it('applies exposure and grayscale without changing alpha', () => {
    const pixels = new Uint8ClampedArray([40, 80, 120, 127]);
    transformPixelBuffer(pixels, 1, 1, {
      ...DEFAULT_IMAGE_ADJUSTMENTS,
      exposure: 1,
      grayscale: true
    });
    expect(pixels[0]).toBe(pixels[1]);
    expect(pixels[1]).toBe(pixels[2]);
    expect(pixels[3]).toBe(127);
    expect(pixels[0]).toBeGreaterThan(80);
  });

  it('sharpens a flat image without inventing color shifts', () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4).fill(80);
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
    transformPixelBuffer(pixels, 3, 3, {
      ...DEFAULT_IMAGE_ADJUSTMENTS,
      sharpness: 100
    });
    expect(Array.from(pixels)).toEqual(
      Array.from(new Uint8ClampedArray(3 * 3 * 4).fill(80)).map((value, index) =>
        index % 4 === 3 ? 255 : value
      )
    );
  });
});
