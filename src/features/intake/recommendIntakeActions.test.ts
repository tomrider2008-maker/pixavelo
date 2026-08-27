import { describe, expect, it } from 'vitest';
import type { ImageDimensions, ImageFormat, ImageValidationReport } from '../../types/images';
import {
  recommendIntakeActions,
  type IntakeActionRoute,
  type IntakeAnalysisItem
} from './recommendIntakeActions';

const MIB = 1024 * 1024;

describe('recommendIntakeActions', () => {
  it('recommends Batch Studio for more than one valid file and limits multi-file choices', () => {
    const result = recommendIntakeActions([
      validItem('one.jpg', 'jpeg'),
      invalidItem('broken.jpg', 'The signature could not be verified.'),
      validItem('two.png', 'png')
    ]);

    expect(result.recommendation?.route).toBe('/batch');
    expect(routes(result)).toEqual(['/batch', '/convert']);
    expect(result.reason).toContain('more than one validated image');
    expect(result.evidence[0]).toContain('2 validated images');
  });

  it.each(['avif', 'heic', 'heif', 'tiff', 'bmp', 'gif', 'svg', 'ico'] as const)(
    'recommends Convert for the advanced %s format',
    (format) => {
      const result = recommendIntakeActions([validItem(`source.${format}`, format)]);

      expect(result.recommendation?.route).toBe('/convert');
      expect(result.choices[0]?.recommended).toBe(true);
      expect(result.evidence[0]).toContain(format.toUpperCase());
    }
  );

  it('recommends Optimize at the inclusive 5 MiB boundary', () => {
    const result = recommendIntakeActions([validItem('large.jpg', 'jpeg', 5 * MIB)]);

    expect(result.recommendation?.route).toBe('/optimize');
    expect(result.evidence[0]).toContain('5 MiB');
  });

  it('does not apply the large-file recommendation one byte below 5 MiB', () => {
    const result = recommendIntakeActions([validItem('regular.jpg', 'jpeg', 5 * MIB - 1)]);

    expect(result.recommendation?.route).toBe('/edit');
  });

  it('recommends Resize above the 12 MP boundary', () => {
    const result = recommendIntakeActions([
      validItem('large-pixels.png', 'png', 100, dimensions(2560, 2560, 12_000_001))
    ]);

    expect(result.recommendation?.route).toBe('/resize');
    expect(result.evidence[0]).toContain('exceeds the 12 MP');
  });

  it('does not apply either resize boundary at exactly 12 MP and 2560px', () => {
    const result = recommendIntakeActions([
      validItem('boundary.png', 'png', 100, dimensions(2560, 2560, 12_000_000))
    ]);

    expect(result.recommendation?.route).toBe('/edit');
  });

  it('recommends Resize one pixel above the 2560px edge boundary', () => {
    const result = recommendIntakeActions([
      validItem('wide.webp', 'webp', 100, dimensions(2561, 1000))
    ]);

    expect(result.recommendation?.route).toBe('/resize');
    expect(result.evidence[0]).toContain('2561px');
  });

  it('uses Edit as a neutral default without claiming user intent', () => {
    const result = recommendIntakeActions([
      validItem('ordinary.jpg', 'jpeg', 200_000, dimensions(1600, 900))
    ]);

    expect(result.recommendation?.route).toBe('/edit');
    expect(result.reason).toContain('neutral starting point');
    expect(result.evidence[0]).toContain('do not reveal the intended task');
    expect(routes(result)).toEqual(['/edit', '/optimize', '/resize', '/convert', '/web-assets']);
  });

  it('gives advanced formats precedence over file-size and dimension signals', () => {
    const result = recommendIntakeActions([
      validItem('large.tiff', 'tiff', 8 * MIB, dimensions(5000, 4000))
    ]);

    expect(result.recommendation?.route).toBe('/convert');
  });

  it('gives the large-file threshold precedence over dimension signals', () => {
    const result = recommendIntakeActions([
      validItem('large.jpg', 'jpeg', 5 * MIB, dimensions(5000, 4000))
    ]);

    expect(result.recommendation?.route).toBe('/optimize');
  });

  it('returns errors and no actions when every selected file is invalid', () => {
    const result = recommendIntakeActions([
      invalidItem('broken.jpg', 'Invalid JPEG signature.'),
      invalidItem('notes.txt', 'This is not an image.')
    ]);

    expect(result.validFiles).toEqual([]);
    expect(result.errors.map((entry) => entry.message)).toEqual([
      'Invalid JPEG signature.',
      'This is not an image.'
    ]);
    expect(result.recommendation).toBeUndefined();
    expect(result.choices).toEqual([]);
    expect(result.reason).toContain('No selected file completed local validation');
  });

  it('aggregates selected bytes, valid formats, errors, and maximum dimension facts', () => {
    const first = validItem('wide.jpg', 'jpeg', 200, dimensions(2400, 1200));
    const second = validItem('tall.png', 'png', 300, dimensions(800, 2500));
    const failed = invalidItem('bad.gif', 'Damaged GIF.', 50);
    const result = recommendIntakeActions([first, second, failed]);

    expect(result.validFiles).toEqual([first.file, second.file]);
    expect(result.facts).toEqual({
      count: 3,
      validCount: 2,
      invalidCount: 1,
      totalBytes: 550,
      formats: ['jpeg', 'png'],
      maximumDimensions: {
        width: 2400,
        height: 2500,
        edge: 2500,
        pixels: 2_880_000,
        megapixels: 2.88
      }
    });
    expect(result.evidence).toContain('1 file could not be included.');
  });
});

function routes(result: ReturnType<typeof recommendIntakeActions>): IntakeActionRoute[] {
  return result.choices.map((choice) => choice.route);
}

function validItem(
  name: string,
  format: ImageFormat,
  size = 100,
  imageDimensions = dimensions(1200, 800)
): IntakeAnalysisItem & { readonly validation: ImageValidationReport } {
  return {
    file: fileOfSize(name, size, `image/${format}`),
    validation: {
      format,
      mime: `image/${format}`,
      dimensions: imageDimensions,
      supportedByCoreCodec: ['jpeg', 'png', 'webp'].includes(format),
      supportedByConverter: format !== 'unknown',
      decoder: {
        id: `test-${format}`,
        label: `${format} test decoder`,
        route: 'core-native',
        loadedOnDemand: false
      },
      warnings: []
    }
  };
}

function invalidItem(name: string, error: string, size = 100): IntakeAnalysisItem {
  return { file: fileOfSize(name, size, 'application/octet-stream'), error };
}

function fileOfSize(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type });
}

function dimensions(width: number, height: number, pixels = width * height): ImageDimensions {
  return { width, height, pixels, megapixels: pixels / 1_000_000 };
}
