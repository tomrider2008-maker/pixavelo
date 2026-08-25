import { describe, expect, it } from 'vitest';
import { resolveTransformGeometry } from './geometry';

describe('resolveTransformGeometry', () => {
  it('preserves aspect ratio when only one dimension is requested', () => {
    expect(resolveTransformGeometry(2400, 1600, { width: 1200 })).toMatchObject({
      crop: { x: 0, y: 0, width: 2400, height: 1600 },
      drawWidth: 1200,
      drawHeight: 800,
      outputWidth: 1200,
      outputHeight: 800
    });
  });

  it('clamps crop coordinates and applies resize relative to the crop', () => {
    expect(
      resolveTransformGeometry(2000, 1200, {
        crop: { x: 1800, y: -20, width: 900, height: 600 },
        width: 400
      })
    ).toMatchObject({
      crop: { x: 1800, y: 0, width: 200, height: 600 },
      drawWidth: 400,
      drawHeight: 1200
    });
  });

  it('implements contain, cover, stretch and pad geometry honestly', () => {
    expect(
      resolveTransformGeometry(1200, 800, {
        width: 1000,
        height: 1000,
        fitMode: 'contain'
      })
    ).toMatchObject({ drawWidth: 1000, drawHeight: 667, outputWidth: 1000, outputHeight: 667 });

    expect(
      resolveTransformGeometry(1200, 800, { width: 1000, height: 1000, fitMode: 'cover' })
    ).toMatchObject({
      crop: { x: 200, y: 0, width: 800, height: 800 },
      drawWidth: 1000,
      drawHeight: 1000,
      outputWidth: 1000,
      outputHeight: 1000
    });

    expect(
      resolveTransformGeometry(1200, 800, { width: 1000, height: 1000, fitMode: 'stretch' })
    ).toMatchObject({ drawWidth: 1000, drawHeight: 1000, outputWidth: 1000, outputHeight: 1000 });

    expect(
      resolveTransformGeometry(1200, 800, { width: 1000, height: 1000, fitMode: 'pad' })
    ).toMatchObject({ drawWidth: 1000, drawHeight: 667, outputWidth: 1000, outputHeight: 1000 });
  });

  it('swaps output axes for quarter turns', () => {
    expect(
      resolveTransformGeometry(2400, 1600, { width: 1200, height: 800, rotation: 90 })
    ).toMatchObject({
      drawWidth: 1200,
      drawHeight: 800,
      outputWidth: 800,
      outputHeight: 1200,
      rotation: 90
    });
  });

  it('expands the output bounds for arbitrary non-destructive rotations', () => {
    expect(resolveTransformGeometry(1000, 500, { rotation: 45 })).toMatchObject({
      drawWidth: 1000,
      drawHeight: 500,
      outputWidth: 1061,
      outputHeight: 1061,
      rotation: 45
    });
  });

  it('prevents upscaling while preserving the requested ratio', () => {
    expect(
      resolveTransformGeometry(800, 600, {
        width: 1600,
        height: 900,
        preventUpscale: true
      })
    ).toMatchObject({ drawWidth: 800, drawHeight: 450, outputWidth: 800, outputHeight: 450 });
  });
});
