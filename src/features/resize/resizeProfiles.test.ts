import { describe, expect, it } from 'vitest';
import {
  ASPECT_RATIOS,
  SOCIAL_PLATFORMS,
  SOCIAL_PRESETS,
  WEB_PRESETS,
  presetsForPlatform
} from './resizeProfiles';

describe('resize profiles', () => {
  it('centralizes all required social platforms and uses valid dimensions', () => {
    expect(new Set(SOCIAL_PRESETS.map((preset) => preset.platform))).toEqual(
      new Set(SOCIAL_PLATFORMS)
    );
    expect(SOCIAL_PRESETS.every((preset) => preset.width > 0 && preset.height > 0)).toBe(true);
    expect(SOCIAL_PRESETS.every((preset) => preset.sourceUrl.startsWith('https://'))).toBe(true);
  });

  it('keeps platform selection and web profiles in configuration', () => {
    expect(presetsForPlatform('Instagram').map((preset) => preset.id)).toContain(
      'instagram-portrait'
    );
    expect(WEB_PRESETS.map((preset) => preset.id)).toContain('open-graph');
  });

  it('declares every required fixed aspect ratio', () => {
    expect(Object.keys(ASPECT_RATIOS)).toEqual([
      '1:1',
      '4:3',
      '3:2',
      '16:9',
      '9:16',
      '4:5',
      '5:4',
      '21:9'
    ]);
  });
});
