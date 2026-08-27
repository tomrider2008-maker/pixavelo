import { describe, expect, it } from 'vitest';
import { createEditorHistory, editorHistoryReducer } from './history';
import {
  countRecipeEdits,
  createEditorRecipe,
  recipeToProcessingOptions,
  resetToolRecipe
} from './recipe';

describe('editor recipe history', () => {
  it('undoes, redoes and restores immutable recipe snapshots', () => {
    const original = createEditorRecipe(1200, 800);
    const changed = { ...original, rotation: 12 };
    const applied = editorHistoryReducer(createEditorHistory(original), {
      type: 'apply',
      recipe: changed,
      label: 'Straighten',
      changedAt: 1
    });
    expect(applied.present.rotation).toBe(12);
    const undone = editorHistoryReducer(applied, { type: 'undo' });
    expect(undone.present.rotation).toBe(0);
    expect(editorHistoryReducer(undone, { type: 'redo' }).present.rotation).toBe(12);
    expect(editorHistoryReducer(applied, { type: 'restore-original' }).past).toHaveLength(0);
  });

  it('coalesces rapid changes from the same control into one undo step', () => {
    const original = createEditorRecipe(100, 100);
    const first = editorHistoryReducer(createEditorHistory(original), {
      type: 'apply',
      recipe: { ...original, rotation: 1 },
      label: 'Straighten',
      group: 'rotation',
      changedAt: 100
    });
    const second = editorHistoryReducer(first, {
      type: 'apply',
      recipe: { ...original, rotation: 2 },
      label: 'Straighten',
      group: 'rotation',
      changedAt: 200
    });
    expect(second.past).toHaveLength(1);
    expect(editorHistoryReducer(second, { type: 'undo' }).present.rotation).toBe(0);
  });

  it('maps the retained recipe into the final export options', () => {
    const original = createEditorRecipe(1200, 800);
    const recipe = {
      ...original,
      crop: { x: 100, y: 50, width: 1000, height: 700 },
      flipHorizontal: true,
      adjustments: { ...original.adjustments, exposure: 0.5 }
    };
    expect(countRecipeEdits(recipe, original)).toBe(3);
    expect(recipeToProcessingOptions(recipe, { format: 'webp', quality: 82 })).toMatchObject({
      crop: recipe.crop,
      flipHorizontal: true,
      outputFormat: 'webp',
      quality: 0.82,
      adjustments: { exposure: 0.5 }
    });
  });

  it('retains local pixel operations for preview and full-resolution export', () => {
    const original = createEditorRecipe(800, 600);
    const operation = {
      kind: 'cutout-wand' as const,
      seed: { x: 0.02, y: 0.02 },
      tolerance: 12,
      connected: true
    };
    const recipe = {
      ...original,
      pixelOperations: [operation],
      cutout: { ...original.cutout, background: 'transparent' as const }
    };

    expect(countRecipeEdits(recipe, original)).toBe(1);
    expect(recipeToProcessingOptions(recipe, { format: 'png', quality: 100 })).toMatchObject({
      outputFormat: 'png',
      pixelOperations: [operation],
      cutout: { background: 'transparent' }
    });
    expect(recipeToProcessingOptions(recipe, { format: 'jpeg', quality: 90 })).toMatchObject({
      outputFormat: 'jpeg',
      cutout: { background: 'color' }
    });
  });

  it('resets removal and cutout operations independently', () => {
    const original = createEditorRecipe(400, 300);
    const removal = {
      kind: 'heal' as const,
      stroke: {
        points: [{ x: 0.5, y: 0.5 }],
        size: 30,
        hardness: 80,
        feather: 20,
        referenceDimension: 300
      }
    };
    const cutout = {
      kind: 'cutout-wand' as const,
      seed: { x: 0, y: 0 },
      tolerance: 10,
      connected: true
    };
    const recipe = {
      ...original,
      pixelOperations: [removal, cutout],
      cutout: { ...original.cutout, feather: 8 }
    };

    expect(resetToolRecipe(recipe, original, 'remove').pixelOperations).toEqual([cutout]);
    expect(resetToolRecipe(recipe, original, 'cutout')).toMatchObject({
      pixelOperations: [removal],
      cutout: original.cutout
    });
  });
});
