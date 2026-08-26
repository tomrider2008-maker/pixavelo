import { describe, expect, it } from 'vitest';
import { findContentBounds } from './trimAnalysis';

function makePixels(width: number, height: number, color: readonly number[]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 4) pixels.set(color, index);
  return pixels;
}

function paintRectangle(
  pixels: Uint8ClampedArray,
  canvasWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly number[]
) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      pixels.set(color, (row * canvasWidth + column) * 4);
    }
  }
}

describe('findContentBounds', () => {
  it('finds a centered object against a flat background', () => {
    const pixels = makePixels(10, 8, [245, 245, 245, 255]);
    paintRectangle(pixels, 10, 2, 3, 5, 3, [25, 45, 65, 255]);

    expect(findContentBounds(pixels, 10, 8)).toEqual({ x: 2, y: 3, width: 5, height: 3 });
  });

  it('keeps the full canvas when no distinct content exists', () => {
    const pixels = makePixels(6, 4, [120, 130, 140, 255]);

    expect(findContentBounds(pixels, 6, 4)).toEqual({ x: 0, y: 0, width: 6, height: 4 });
  });

  it('detects opaque content on a transparent canvas', () => {
    const pixels = makePixels(7, 7, [0, 0, 0, 0]);
    paintRectangle(pixels, 7, 1, 2, 3, 4, [220, 80, 20, 255]);

    expect(findContentBounds(pixels, 7, 7)).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});
