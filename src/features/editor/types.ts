import type { CoreImageFormat, ImageAdjustments, ImageCrop } from '../../types/images';
import type { EditorCutoutSettings, EditorPixelOperation } from '../../types/editorPixelEdits';

export type EditorTool =
  'looks' | 'crop' | 'rotate' | 'flip' | 'canvas' | 'adjust' | 'remove' | 'cutout';
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
  readonly pixelOperations: readonly EditorPixelOperation[];
  readonly cutout: EditorCutoutSettings;
}

export interface EditorExportSettings {
  readonly format: CoreImageFormat;
  readonly quality: number;
}
