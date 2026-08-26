import type { ConversionSettings } from './types';

export type ConversionPresetId =
  | 'balanced-jpeg'
  | 'web-delivery'
  | 'lossless-png'
  | 'max-compat'
  | 'custom';

export interface ConversionPreset {
  readonly id: Exclude<ConversionPresetId, 'custom'>;
  readonly label: string;
  readonly settings: ConversionSettings;
}

export const conversionPresets: readonly ConversionPreset[] = [
  {
    id: 'balanced-jpeg',
    label: 'Balanced JPEG',
    settings: {
      outputFormat: 'jpeg',
      quality: 88,
      background: '#ffffff',
      namingPattern: '{name}-converted',
      autoProcess: false,
      qualityMode: 'quality',
      targetKb: 200,
      stripMetadata: true
    }
  },
  {
    id: 'web-delivery',
    label: 'Web delivery',
    settings: {
      outputFormat: 'webp',
      quality: 82,
      background: '#ffffff',
      namingPattern: '{name}-web',
      autoProcess: false,
      qualityMode: 'quality',
      targetKb: 200,
      stripMetadata: true
    }
  },
  {
    id: 'lossless-png',
    label: 'Lossless PNG',
    settings: {
      outputFormat: 'png',
      quality: 100,
      background: '#ffffff',
      namingPattern: '{name}-converted',
      autoProcess: false,
      qualityMode: 'quality',
      targetKb: 200,
      stripMetadata: true
    }
  },
  {
    id: 'max-compat',
    label: 'Max compatibility JPEG',
    settings: {
      outputFormat: 'jpeg',
      quality: 92,
      background: '#ffffff',
      namingPattern: '{name}-compat',
      autoProcess: false,
      qualityMode: 'quality',
      targetKb: 200,
      stripMetadata: false
    }
  }
] as const;

export function settingsForPreset(id: ConversionPresetId): ConversionSettings | undefined {
  if (id === 'custom') return undefined;
  return conversionPresets.find((preset) => preset.id === id)?.settings;
}

export function identifyPreset(settings: ConversionSettings): ConversionPresetId {
  return (
    conversionPresets.find((preset) => settingsEqual(preset.settings, settings))?.id ?? 'custom'
  );
}

function settingsEqual(left: ConversionSettings, right: ConversionSettings) {
  return (
    left.outputFormat === right.outputFormat &&
    left.quality === right.quality &&
    left.background.toLowerCase() === right.background.toLowerCase() &&
    left.namingPattern === right.namingPattern &&
    left.autoProcess === right.autoProcess &&
    left.qualityMode === right.qualityMode &&
    left.targetKb === right.targetKb &&
    left.stripMetadata === right.stripMetadata
  );
}
