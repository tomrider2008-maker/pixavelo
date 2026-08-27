import { describe, expect, it, vi } from 'vitest';
import { createEditorCutoutSettings } from '../../types/editorPixelEdits';
import type { EditorBrushStroke, EditorPixelOperation } from '../../types/editorPixelEdits';
import { applyPixelEdits } from './applyPixelEdits';

describe('local editor pixel operations', () => {
  it('heals a painted object from its surrounding pixels', () => {
    const width = 9;
    const height = 9;
    const pixels = solidPixels(width, height, [28, 92, 180, 255]);
    setPixel(pixels, width, 4, 4, [240, 36, 42, 255]);
    const context = createContext(pixels, width, height);

    applyPixelEdits(
      context.value,
      width,
      height,
      [{ kind: 'heal', stroke: stroke([{ x: 0.5, y: 0.5 }], 3, 9) }],
      createEditorCutoutSettings(9)
    );

    expect(pixel(pixels, width, 4, 4)).toEqual([28, 92, 180, 255]);
    expect(context.putImageData).toHaveBeenCalledOnce();
  });

  it('clones from a selected source with a soft circular stroke', () => {
    const width = 10;
    const height = 10;
    const pixels = solidPixels(width, height, [24, 32, 44, 255]);
    setPixel(pixels, width, 2, 2, [238, 191, 40, 255]);
    const context = createContext(pixels, width, height);

    applyPixelEdits(
      context.value,
      width,
      height,
      [
        {
          kind: 'clone',
          source: { x: 0.25, y: 0.25 },
          targetOrigin: { x: 0.75, y: 0.75 },
          stroke: stroke([{ x: 0.75, y: 0.75 }], 2, 10)
        }
      ],
      createEditorCutoutSettings(10)
    );

    expect(pixel(pixels, width, 7, 7).slice(0, 3)).toEqual([238, 191, 40]);
  });

  it('removes matching background colors while retaining the subject', () => {
    const width = 3;
    const height = 1;
    const pixels = new Uint8ClampedArray([20, 120, 220, 255, 240, 60, 60, 255, 20, 120, 220, 255]);
    const context = createContext(pixels, width, height);
    const operations: readonly EditorPixelOperation[] = [
      {
        kind: 'cutout-wand',
        seed: { x: 0.1, y: 0.5 },
        tolerance: 0,
        connected: false
      }
    ];

    applyPixelEdits(context.value, width, height, operations, {
      ...createEditorCutoutSettings(1),
      smooth: 0,
      feather: 0
    });

    expect(pixel(pixels, width, 0, 0)[3]).toBe(0);
    expect(pixel(pixels, width, 1, 0)[3]).toBe(255);
    expect(pixel(pixels, width, 2, 0)[3]).toBe(0);
  });

  it('composites the selected subject over a solid local background', () => {
    const width = 2;
    const height = 1;
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 0, 0, 255]);
    const context = createContext(pixels, width, height);

    applyPixelEdits(
      context.value,
      width,
      height,
      [
        {
          kind: 'cutout-wand',
          seed: { x: 0.1, y: 0.5 },
          tolerance: 0,
          connected: true
        }
      ],
      {
        ...createEditorCutoutSettings(1),
        smooth: 0,
        feather: 0,
        background: 'color',
        color: '#ffffff'
      }
    );

    expect(pixel(pixels, width, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(pixels, width, 1, 0)).toEqual([255, 0, 0, 255]);
  });

  it('rejects unsafe full-resolution pixel workloads before reading the canvas', () => {
    const getImageData = vi.fn();
    const context = { getImageData, putImageData: vi.fn() } as unknown as CanvasRenderingContext2D;

    expect(() =>
      applyPixelEdits(
        context,
        5000,
        3000,
        [{ kind: 'heal', stroke: stroke([{ x: 0.5, y: 0.5 }], 20, 3000) }],
        createEditorCutoutSettings(3000)
      )
    ).toThrow(/13,000,000/);
    expect(getImageData).not.toHaveBeenCalled();
  });
});

function stroke(
  points: EditorBrushStroke['points'],
  size: number,
  referenceDimension: number
): EditorBrushStroke {
  return { points, size, hardness: 100, feather: 0, referenceDimension };
}

function solidPixels(
  width: number,
  height: number,
  color: readonly [number, number, number, number]
) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels.set(color, index * 4);
  }
  return pixels;
}

function setPixel(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  color: readonly [number, number, number, number]
) {
  pixels.set(color, (y * width + x) * 4);
}

function pixel(pixels: Uint8ClampedArray, width: number, x: number, y: number) {
  return Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
}

function createContext(pixels: Uint8ClampedArray, width: number, height: number) {
  const frame = { data: pixels, width, height, colorSpace: 'srgb' } as ImageData;
  const putImageData = vi.fn();
  return {
    putImageData,
    value: {
      getImageData: vi.fn(() => frame),
      putImageData
    } as unknown as CanvasRenderingContext2D
  };
}
