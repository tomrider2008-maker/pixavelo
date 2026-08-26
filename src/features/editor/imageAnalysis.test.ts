import { describe, expect, it } from 'vitest';
import { analyzePixelBuffer } from './imageAnalysis';

describe('editor image analysis', () => {
  it('builds normalized local histograms and ignores transparent pixels', () => {
    const analysis = analyzePixelBuffer(
      new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255, 20, 20, 20, 0])
    );

    expect(analysis.sampledPixels).toBe(3);
    expect(analysis.red).toHaveLength(32);
    expect(Math.max(...analysis.red)).toBe(1);
    expect(analysis.shadowPercent).toBeCloseTo(1 / 3);
    expect(analysis.highlightPercent).toBeCloseTo(1 / 3);
  });

  it('suggests brightening for dark pixels and recovery for bright pixels', () => {
    const dark = analyzePixelBuffer(new Uint8ClampedArray([18, 18, 18, 255]));
    const bright = analyzePixelBuffer(new Uint8ClampedArray([248, 248, 248, 255]));

    expect(dark.suggestedAdjustments.exposure).toBeGreaterThan(0);
    expect(dark.suggestedAdjustments.shadows).toBeGreaterThan(0);
    expect(bright.suggestedAdjustments.exposure).toBeLessThan(0);
    expect(bright.suggestedAdjustments.highlights).toBeLessThan(0);
  });

  it('returns safe neutral analysis for an empty buffer', () => {
    const analysis = analyzePixelBuffer(new Uint8ClampedArray());

    expect(analysis.sampledPixels).toBe(0);
    expect(analysis.meanLuminance).toBe(0.5);
    expect(analysis.suggestedAdjustments.exposure).toBe(0);
  });
});
