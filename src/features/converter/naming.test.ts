import { describe, expect, it } from 'vitest';
import { buildConversionFilename, deduplicateFilenames } from './naming';

describe('conversion filenames', () => {
  it('expands supported naming tokens and appends the codec extension', () => {
    expect(buildConversionFilename('summer.photo.png', 'webp', '{name}-{index}', 2)).toBe(
      'summer.photo-03.webp'
    );
  });

  it('does not duplicate an extension supplied by the pattern', () => {
    expect(buildConversionFilename('photo.jpg', 'png', '{name}.{ext}', 0)).toBe('photo.png');
  });

  it('sanitizes path characters after token interpolation', () => {
    expect(buildConversionFilename('../danger?.png', 'jpeg', '{name}:converted', 0)).toBe(
      '.._danger__converted.jpg'
    );
  });

  it('deduplicates names case-insensitively without changing order', () => {
    expect(deduplicateFilenames(['Photo.jpg', 'photo.jpg', 'photo.jpg'])).toEqual([
      'Photo.jpg',
      'photo (2).jpg',
      'photo (3).jpg'
    ]);
  });
});
