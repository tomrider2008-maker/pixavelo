import {
  applyImageAdjustments,
  buildCanvasFilter,
  DEFAULT_IMAGE_ADJUSTMENTS
} from '../../engine/pipeline/imageAdjustments';
import { resolveTransformGeometry } from '../../engine/pipeline/geometry';
import type { EditorRecipe } from './types';
import type { DecodedEditorSource } from './decodeEditorSource';
import { applyPixelEdits } from '../../engine/pipeline/applyPixelEdits';

interface RenderEditorPreviewOptions {
  readonly maximumDimension?: number;
  readonly original?: boolean;
  readonly cropWorkspace?: boolean;
}

export function renderEditorPreview(
  source: DecodedEditorSource,
  canvas: HTMLCanvasElement,
  recipe: EditorRecipe,
  options: RenderEditorPreviewOptions = {}
) {
  const cropWorkspace = Boolean(options.cropWorkspace);
  const previewRecipe: EditorRecipe = cropWorkspace
    ? {
        ...recipe,
        crop: { x: 0, y: 0, width: source.width, height: source.height },
        canvas: { ...recipe.canvas, enabled: false }
      }
    : recipe;
  const processingOptions = {
    crop: previewRecipe.crop,
    rotation: previewRecipe.rotation,
    flipHorizontal: previewRecipe.flipHorizontal,
    flipVertical: previewRecipe.flipVertical,
    ...(previewRecipe.canvas.enabled
      ? {
          width: previewRecipe.canvas.width,
          height: previewRecipe.canvas.height,
          fitMode: 'pad' as const
        }
      : {})
  };
  const geometry = resolveTransformGeometry(source.width, source.height, processingOptions);
  const maximumDimension = options.maximumDimension ?? 2048;
  const scale = Math.min(
    8,
    maximumDimension / Math.max(geometry.outputWidth, geometry.outputHeight)
  );
  canvas.width = Math.max(1, Math.round(geometry.outputWidth * scale));
  canvas.height = Math.max(1, Math.round(geometry.outputHeight * scale));
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) throw new Error('2D canvas is unavailable.');

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (previewRecipe.canvas.enabled) {
    context.fillStyle = previewRecipe.canvas.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((geometry.rotation * Math.PI) / 180);
  context.scale(previewRecipe.flipHorizontal ? -1 : 1, previewRecipe.flipVertical ? -1 : 1);
  const adjustments = options.original ? DEFAULT_IMAGE_ADJUSTMENTS : previewRecipe.adjustments;
  context.filter = buildCanvasFilter(adjustments, scale);
  context.drawImage(
    source.drawable,
    geometry.crop.x,
    geometry.crop.y,
    geometry.crop.width,
    geometry.crop.height,
    (-geometry.drawWidth * scale) / 2,
    (-geometry.drawHeight * scale) / 2,
    geometry.drawWidth * scale,
    geometry.drawHeight * scale
  );
  context.restore();
  applyImageAdjustments(context, canvas.width, canvas.height, adjustments);
  if (!options.original) {
    applyPixelEdits(
      context,
      canvas.width,
      canvas.height,
      previewRecipe.pixelOperations,
      previewRecipe.cutout
    );
  }
  return { geometry, scale };
}
