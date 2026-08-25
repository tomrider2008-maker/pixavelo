import type { CoreImageFormat, WatermarkPosition } from '../../types/images';

export type ProfessionalUtilityMode =
  'watermark' | 'frames' | 'base64' | 'hash' | 'sprite' | 'calculators' | 'presets';

export interface WatermarkUtilitySettings {
  readonly text: string;
  readonly position: WatermarkPosition;
  readonly opacity: number;
  readonly sizePercent: number;
  readonly color: string;
  readonly outputFormat: CoreImageFormat;
  readonly quality: number;
}

export interface SpriteSheetSettings {
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly columns: number;
  readonly gap: number;
  readonly background: string;
}

export interface UtilityPresetRecord {
  readonly id: string;
  readonly kind: 'pixavelo-utility-preset';
  readonly version: 1;
  readonly name: string;
  readonly createdAt: string;
  readonly watermark: WatermarkUtilitySettings;
  readonly sprite: SpriteSheetSettings;
}
