import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../engine/pipeline/imageAdjustments';
import type { NativeProcessingOptions } from '../../types/images';
import type { EditorExportSettings, EditorRecipe, EditorTool } from './types';
import {
  createEditorCutoutSettings,
  isCutoutOperation,
  isRemoveOperation
} from '../../types/editorPixelEdits';

export function createEditorRecipe(width: number, height: number): EditorRecipe {
  return {
    crop: { x: 0, y: 0, width, height },
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    canvas: { enabled: false, width, height, background: '#ffffff' },
    adjustments: { ...DEFAULT_IMAGE_ADJUSTMENTS },
    pixelOperations: [],
    cutout: createEditorCutoutSettings(Math.min(width, height))
  };
}

export function recipeToProcessingOptions(
  recipe: EditorRecipe,
  output: EditorExportSettings
): NativeProcessingOptions {
  return {
    outputFormat: output.format,
    ...(output.format === 'png' ? {} : { quality: output.quality / 100 }),
    crop: recipe.crop,
    rotation: recipe.rotation,
    flipHorizontal: recipe.flipHorizontal,
    flipVertical: recipe.flipVertical,
    adjustments: recipe.adjustments,
    ...(recipe.pixelOperations.length > 0
      ? {
          pixelOperations: recipe.pixelOperations,
          cutout:
            output.format === 'jpeg' && recipe.cutout.background === 'transparent'
              ? { ...recipe.cutout, background: 'color' as const }
              : recipe.cutout
        }
      : {}),
    ...(recipe.canvas.enabled
      ? {
          width: recipe.canvas.width,
          height: recipe.canvas.height,
          fitMode: 'pad' as const,
          background: recipe.canvas.background
        }
      : output.format === 'jpeg'
        ? { background: recipe.canvas.background }
        : {})
  };
}

export function resetToolRecipe(
  recipe: EditorRecipe,
  original: EditorRecipe,
  tool: EditorTool
): EditorRecipe {
  if (tool === 'crop') return { ...recipe, crop: original.crop };
  if (tool === 'rotate') return { ...recipe, rotation: original.rotation };
  if (tool === 'flip') {
    return {
      ...recipe,
      flipHorizontal: original.flipHorizontal,
      flipVertical: original.flipVertical
    };
  }
  if (tool === 'canvas') return { ...recipe, canvas: original.canvas };
  if (tool === 'remove') {
    const pixelOperations = recipe.pixelOperations.filter(
      (operation) => !isRemoveOperation(operation)
    );
    return pixelOperations.length === recipe.pixelOperations.length
      ? recipe
      : { ...recipe, pixelOperations };
  }
  if (tool === 'cutout') {
    const pixelOperations = recipe.pixelOperations.filter(
      (operation) => !isCutoutOperation(operation)
    );
    return pixelOperations.length === recipe.pixelOperations.length &&
      sameCutout(recipe.cutout, original.cutout)
      ? recipe
      : { ...recipe, pixelOperations, cutout: original.cutout };
  }
  return { ...recipe, adjustments: original.adjustments };
}

export function countRecipeEdits(recipe: EditorRecipe, original: EditorRecipe) {
  let edits = 0;
  if (!sameCrop(recipe.crop, original.crop)) edits += 1;
  if (recipe.rotation !== original.rotation) edits += 1;
  if (recipe.flipHorizontal !== original.flipHorizontal) edits += 1;
  if (recipe.flipVertical !== original.flipVertical) edits += 1;
  if (
    recipe.canvas.enabled !== original.canvas.enabled ||
    recipe.canvas.width !== original.canvas.width ||
    recipe.canvas.height !== original.canvas.height ||
    recipe.canvas.background !== original.canvas.background
  )
    edits += 1;
  for (const key of Object.keys(recipe.adjustments) as (keyof typeof recipe.adjustments)[]) {
    if (recipe.adjustments[key] !== original.adjustments[key]) edits += 1;
  }
  edits += recipe.pixelOperations.length;
  return edits;
}

export function recipesEqual(left: EditorRecipe, right: EditorRecipe) {
  return (
    left.rotation === right.rotation &&
    left.flipHorizontal === right.flipHorizontal &&
    left.flipVertical === right.flipVertical &&
    sameCrop(left.crop, right.crop) &&
    left.canvas.enabled === right.canvas.enabled &&
    left.canvas.width === right.canvas.width &&
    left.canvas.height === right.canvas.height &&
    left.canvas.background === right.canvas.background &&
    left.pixelOperations === right.pixelOperations &&
    sameCutout(left.cutout, right.cutout) &&
    Object.keys(left.adjustments).every(
      (key) =>
        left.adjustments[key as keyof typeof left.adjustments] ===
        right.adjustments[key as keyof typeof right.adjustments]
    )
  );
}

function sameCutout(left: EditorRecipe['cutout'], right: EditorRecipe['cutout']) {
  return (
    left.smooth === right.smooth &&
    left.feather === right.feather &&
    left.expand === right.expand &&
    left.referenceDimension === right.referenceDimension &&
    left.background === right.background &&
    left.color === right.color &&
    left.blur === right.blur
  );
}

function sameCrop(left: EditorRecipe['crop'], right: EditorRecipe['crop']) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
