import { recipesEqual } from './recipe';
import type { EditorRecipe } from './types';

export interface EditorHistoryEntry {
  readonly recipe: EditorRecipe;
  readonly label: string;
}

export interface EditorHistoryState {
  readonly original: EditorRecipe;
  readonly present: EditorRecipe;
  readonly past: readonly EditorHistoryEntry[];
  readonly future: readonly EditorHistoryEntry[];
  readonly lastGroup: string | undefined;
  readonly lastChangedAt: number;
}

export type EditorHistoryAction =
  | {
      readonly type: 'apply';
      readonly recipe: EditorRecipe;
      readonly label: string;
      readonly group?: string;
      readonly changedAt?: number;
    }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'restore-original' }
  | { readonly type: 'replace-source'; readonly recipe: EditorRecipe };

export function createEditorHistory(recipe: EditorRecipe): EditorHistoryState {
  return {
    original: recipe,
    present: recipe,
    past: [],
    future: [],
    lastGroup: undefined,
    lastChangedAt: 0
  };
}

export function editorHistoryReducer(
  state: EditorHistoryState,
  action: EditorHistoryAction
): EditorHistoryState {
  if (action.type === 'replace-source') return createEditorHistory(action.recipe);
  if (action.type === 'restore-original') return createEditorHistory(state.original);
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      ...state,
      present: previous.recipe,
      past: state.past.slice(0, -1),
      future: [{ recipe: state.present, label: previous.label }, ...state.future],
      lastGroup: undefined,
      lastChangedAt: 0
    };
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    if (!next) return state;
    return {
      ...state,
      present: next.recipe,
      past: [...state.past, { recipe: state.present, label: next.label }].slice(-100),
      future: state.future.slice(1),
      lastGroup: undefined,
      lastChangedAt: 0
    };
  }

  if (recipesEqual(state.present, action.recipe)) return state;
  const changedAt = action.changedAt ?? performance.now();
  const merge =
    Boolean(action.group) &&
    action.group === state.lastGroup &&
    changedAt - state.lastChangedAt <= 750;
  return {
    ...state,
    present: action.recipe,
    past: merge
      ? state.past
      : [...state.past, { recipe: state.present, label: action.label }].slice(-100),
    future: [],
    ...(action.group ? { lastGroup: action.group } : { lastGroup: undefined }),
    lastChangedAt: changedAt
  };
}
