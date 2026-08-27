import {
  createEditorCutoutSettings,
  type EditorCutoutSettings,
  type EditorPoint
} from '../../types/editorPixelEdits';

export interface EditorRemoveToolState {
  readonly mode: 'heal' | 'clone';
  readonly brushSize: number;
  readonly hardness: number;
  readonly feather: number;
  readonly showMask: boolean;
  readonly cloneSource: EditorPoint | undefined;
}

export interface EditorCutoutToolState {
  readonly mode: 'wand' | 'keep' | 'remove';
  readonly brushSize: number;
  readonly tolerance: number;
  readonly connected: boolean;
  readonly showMask: boolean;
  readonly settings: EditorCutoutSettings;
}

export function createEditorRemoveToolState(): EditorRemoveToolState {
  return {
    mode: 'heal',
    brushSize: 80,
    hardness: 72,
    feather: 24,
    showMask: true,
    cloneSource: undefined
  };
}

export function createEditorCutoutToolState(referenceDimension: number): EditorCutoutToolState {
  return {
    mode: 'wand',
    brushSize: 48,
    tolerance: 18,
    connected: true,
    showMask: true,
    settings: createEditorCutoutSettings(referenceDimension)
  };
}
