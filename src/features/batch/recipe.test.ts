import { describe, expect, it } from 'vitest';
import type { ImageValidationReport } from '../../types/images';
import {
  DEFAULT_BATCH_RECIPE,
  outputNamesForJobs,
  parseBatchRecipe,
  processingOptionsForJob
} from './recipe';

const validation: ImageValidationReport = {
  format: 'png',
  mime: 'image/png',
  dimensions: { width: 4000, height: 3000, pixels: 12_000_000, megapixels: 12 },
  supportedByCoreCodec: true,
  supportedByConverter: true,
  decoder: {
    id: 'native',
    label: 'Browser decoder',
    route: 'core-native',
    loadedOnDemand: false
  },
  warnings: []
};

describe('Batch recipe', () => {
  it('resolves longest-edge dimensions without upscaling', () => {
    expect(processingOptionsForJob(DEFAULT_BATCH_RECIPE, { validation })).toMatchObject({
      outputFormat: 'webp',
      quality: 0.82,
      width: 1920,
      height: 1440,
      preventUpscale: true,
      rotation: 0
    });

    const small = {
      ...validation,
      dimensions: { width: 800, height: 600, pixels: 480_000, megapixels: 0.48 }
    };
    expect(processingOptionsForJob(DEFAULT_BATCH_RECIPE, { validation: small })).toMatchObject({
      width: 800,
      height: 600
    });
  });

  it('maps exact transforms and optional watermark into native options', () => {
    const options = processingOptionsForJob(
      {
        ...DEFAULT_BATCH_RECIPE,
        outputFormat: 'jpeg',
        resizeMode: 'exact',
        width: 1200,
        height: 630,
        fitMode: 'cover',
        rotation: 90,
        flipHorizontal: true,
        watermark: {
          ...DEFAULT_BATCH_RECIPE.watermark,
          enabled: true,
          text: 'Pixavelo'
        }
      },
      { validation }
    );
    expect(options).toMatchObject({
      outputFormat: 'jpeg',
      width: 1200,
      height: 630,
      fitMode: 'cover',
      rotation: 90,
      flipHorizontal: true,
      watermark: { text: 'Pixavelo', position: 'bottom-right' }
    });
  });

  it('produces Unicode-safe, deterministic, deduplicated names', () => {
    const jobs = [
      { file: new File(['a'], '旅行.png', { type: 'image/png' }) },
      { file: new File(['b'], '旅行.png', { type: 'image/png' }) }
    ];
    const names = outputNamesForJobs(jobs, {
      ...DEFAULT_BATCH_RECIPE,
      namingPattern: '{name}-web'
    });
    expect(names).toEqual(['旅行-web.webp', '旅行-web (2).webp']);
  });

  it('bounds untrusted locally stored recipes before they reach processing', () => {
    expect(
      parseBatchRecipe({
        outputFormat: 'executable',
        longestEdge: Number.POSITIVE_INFINITY,
        width: -20,
        height: 999_999,
        quality: 500,
        rotation: 45,
        background: 'url(https://example.test)',
        namingPattern: 'x'.repeat(500),
        watermark: {
          enabled: 'yes',
          text: 'w'.repeat(500),
          position: 'outside',
          opacity: -1,
          sizePercent: 99,
          color: 'not-a-color'
        }
      })
    ).toMatchObject({
      outputFormat: 'webp',
      longestEdge: 1920,
      width: 1,
      height: 32_768,
      quality: 100,
      rotation: 0,
      background: '#ffffff',
      watermark: {
        enabled: false,
        position: 'bottom-right',
        opacity: 0.05,
        sizePercent: 0.25,
        color: '#ffffff'
      }
    });
    expect(parseBatchRecipe({ namingPattern: 'x'.repeat(500) }).namingPattern).toHaveLength(200);
    expect(parseBatchRecipe({ watermark: { text: 'w'.repeat(500) } }).watermark.text).toHaveLength(
      200
    );
  });
});
