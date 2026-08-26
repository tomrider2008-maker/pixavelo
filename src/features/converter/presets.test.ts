import { describe, expect, it } from 'vitest';
import { identifyPreset, settingsForPreset } from './presets';

describe('conversion presets', () => {
  it('returns immutable built-in workflow settings', () => {
    expect(settingsForPreset('web-delivery')).toEqual({
      outputFormat: 'webp',
      quality: 82,
      background: '#ffffff',
      namingPattern: '{name}-web',
      autoProcess: false,
      qualityMode: 'quality',
      targetKb: 200,
      stripMetadata: true
    });
  });

  it('identifies edited settings as custom', () => {
    const settings = settingsForPreset('balanced-jpeg');
    expect(settings).toBeDefined();
    if (!settings) throw new Error('Balanced JPEG preset is missing.');
    expect(identifyPreset({ ...settings, quality: 87 })).toBe('custom');
  });
});
