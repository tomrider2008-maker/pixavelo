import { describe, expect, it } from 'vitest';
import { buildDerivativeFilename, buildOutputFilename, sanitizeFilename } from './filenames';

describe('filename utilities', () => {
  it('removes path and control characters', () => {
    expect(sanitizeFilename('../private\\photo\u0000.jpg')).toBe('.._private_photo_.jpg');
  });

  it('preserves Unicode while changing the output extension', () => {
    expect(buildOutputFilename('မင်္ဂလာပါ 📷.png', 'webp')).toBe('မင်္ဂလာပါ 📷.webp');
  });

  it('creates a safe fallback for blank names', () => {
    expect(buildOutputFilename('   ', 'jpeg')).toBe('image.jpg');
  });

  it('creates sanitized derivative names without replacing the source', () => {
    expect(buildDerivativeFilename('campaign.hero.png', 'webp', 'optimized:v2')).toBe(
      'campaign.hero-optimized_v2.webp'
    );
  });
});
