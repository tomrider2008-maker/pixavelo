import { describe, expect, it } from 'vitest';
import {
  COMPRESSION_PROFILES,
  TARGET_SIZE_PRESETS,
  constrainLongEdge,
  findCompressionProfile
} from './compressionProfiles';

describe('compression profiles', () => {
  it('declares every required enterprise profile once', () => {
    expect(COMPRESSION_PROFILES.map((profile) => profile.label)).toEqual([
      'Maximum Quality',
      'High Quality',
      'Balanced',
      'Small File',
      'Maximum Compression',
      'Web Optimized',
      'Email Optimized'
    ]);
    expect(new Set(COMPRESSION_PROFILES.map((profile) => profile.id)).size).toBe(7);
  });

  it('centralizes every required target-size preset', () => {
    expect(TARGET_SIZE_PRESETS).toEqual([50, 100, 200, 250, 500, 1024, 2048]);
  });

  it('resolves profiles safely and constrains a long edge proportionally', () => {
    expect(findCompressionProfile('web-optimized').outputFormat).toBe('webp');
    expect(constrainLongEdge(4032, 3024, 2560)).toEqual({ width: 2560, height: 1920 });
    expect(constrainLongEdge(1200, 800, 2560)).toEqual({ width: 1200, height: 800 });
  });
});
