import { describe, expect, it } from 'vitest';
import { advancedInputCapabilities, getInputFormatCapability } from './inputCapabilities';

describe('advanced input capability declarations', () => {
  it('declares every Phase 4 format exactly once', () => {
    expect(advancedInputCapabilities.map((item) => item.format)).toEqual([
      'avif',
      'bmp',
      'gif',
      'svg',
      'ico',
      'heic',
      'heif',
      'tiff'
    ]);
    expect(new Set(advancedInputCapabilities.map((item) => item.format)).size).toBe(8);
  });

  it('keeps heavy codecs lazy and advanced formats import-only', () => {
    expect(getInputFormatCapability('heic')).toMatchObject({
      route: 'lazy-wasm',
      loadedOnDemand: true
    });
    expect(getInputFormatCapability('tiff')).toMatchObject({
      route: 'lazy-javascript',
      loadedOnDemand: true
    });
  });
});
