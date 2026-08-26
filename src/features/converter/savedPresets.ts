import type { ConversionSettings } from './types';

const STORAGE_KEY = 'pixavelo-converter-saved-presets';
const MAX_SAVED_PRESETS = 10;

export interface SavedPreset {
  readonly id: string;
  readonly label: string;
  readonly settings: ConversionSettings;
  readonly savedAt: number;
}

function loadRaw(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedPreset);
  } catch {
    return [];
  }
}

function isValidSavedPreset(item: unknown): item is SavedPreset {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.label === 'string' &&
    typeof p.savedAt === 'number' &&
    typeof p.settings === 'object' &&
    p.settings !== null
  );
}

export function listSavedPresets(): readonly SavedPreset[] {
  return loadRaw();
}

export function savePreset(label: string, settings: ConversionSettings): SavedPreset {
  const presets = loadRaw();
  const newPreset: SavedPreset = {
    id: `saved-${crypto.randomUUID()}`,
    label: label.trim().slice(0, 60) || 'My preset',
    settings,
    savedAt: Date.now()
  };
  const updated = [newPreset, ...presets].slice(0, MAX_SAVED_PRESETS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newPreset;
}

export function deletePreset(id: string): void {
  const presets = loadRaw().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}
