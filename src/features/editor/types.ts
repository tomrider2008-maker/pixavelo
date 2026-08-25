import type { CoreImageFormat, ImageAdjustments, ImageCrop } from '../../types/images';

export type EditorTool = 'crop' | 'rotate' | 'flip' | 'canvas' | 'adjust';
export type EditorCompareMode = 'slider' | 'side-by-side' | 'original' | 'output';
export type EditorZoom = 'fit' | 50 | 100 | 200 | 400;

export interface EditorCanvasSettings {
  readonly enabled: boolean;
  readonly width: number;
  readonly height: number;
  readonly background: string;
}

export interface EditorRecipe {
  readonly crop: ImageCrop;
  readonly rotation: number;
  readonly flipHorizontal: boolean;
  readonly flipVertical: boolean;
  readonly canvas: EditorCanvasSettings;
  readonly adjustments: ImageAdjustments;
}

export interface EditorExportSettings {
  readonly format: CoreImageFormat;
  readonly quality: number;
}
