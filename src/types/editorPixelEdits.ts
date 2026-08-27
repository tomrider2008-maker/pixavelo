export interface EditorPoint {
  readonly x: number;
  readonly y: number;
}

export interface EditorBrushStroke {
  readonly points: readonly EditorPoint[];
  readonly size: number;
  readonly hardness: number;
  readonly feather: number;
  readonly referenceDimension: number;
}

export interface EditorHealOperation {
  readonly kind: 'heal';
  readonly stroke: EditorBrushStroke;
}

export interface EditorCloneOperation {
  readonly kind: 'clone';
  readonly stroke: EditorBrushStroke;
  readonly source: EditorPoint;
  readonly targetOrigin: EditorPoint;
}

export interface EditorCutoutWandOperation {
  readonly kind: 'cutout-wand';
  readonly seed: EditorPoint;
  readonly tolerance: number;
  readonly connected: boolean;
}

export interface EditorCutoutBrushOperation {
  readonly kind: 'cutout-brush';
  readonly action: 'keep' | 'remove';
  readonly stroke: EditorBrushStroke;
}

export type EditorPixelOperation =
  | EditorHealOperation
  | EditorCloneOperation
  | EditorCutoutWandOperation
  | EditorCutoutBrushOperation;

export type EditorCutoutBackground = 'transparent' | 'color' | 'blur';

export interface EditorCutoutSettings {
  readonly smooth: number;
  readonly feather: number;
  readonly expand: number;
  readonly referenceDimension: number;
  readonly background: EditorCutoutBackground;
  readonly color: string;
  readonly blur: number;
}

export const MAX_PIXEL_EDIT_PIXELS = 13_000_000;

export function createEditorCutoutSettings(referenceDimension: number): EditorCutoutSettings {
  return {
    smooth: 2,
    feather: 1,
    expand: 0,
    referenceDimension: Math.max(1, referenceDimension),
    background: 'transparent',
    color: '#ffffff',
    blur: 12
  };
}

export function isCutoutOperation(operation: EditorPixelOperation) {
  return operation.kind === 'cutout-wand' || operation.kind === 'cutout-brush';
}

export function isRemoveOperation(operation: EditorPixelOperation) {
  return operation.kind === 'heal' || operation.kind === 'clone';
}
