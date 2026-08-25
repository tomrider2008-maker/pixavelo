import { Bookmark, Check, Download, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toAppError } from '../../engine/errors/AppError';
import {
  getAllLocalRecords,
  putLocalRecord,
  STORE_NAMES
} from '../../services/persistence/indexedDb';
import { createUtilityPreset, parseUtilityPreset } from './utilityModel';
import type { SpriteSheetSettings, UtilityPresetRecord, WatermarkUtilitySettings } from './types';

export function PresetUtility({
  watermark,
  sprite,
  onApply,
  onReadyChange
}: {
  readonly watermark: WatermarkUtilitySettings;
  readonly sprite: SpriteSheetSettings;
  readonly onApply: (preset: UtilityPresetRecord) => void;
  readonly onReadyChange: (ready: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('My utility preset');
  const [records, setRecords] = useState<readonly UtilityPresetRecord[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const current = useMemo(
    () => createUtilityPreset(name, watermark, sprite),
    [name, sprite, watermark]
  );
  const exportUrl = useMemo(
    () =>
      URL.createObjectURL(
        new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' })
      ),
    [current]
  );
  useEffect(() => () => URL.revokeObjectURL(exportUrl), [exportUrl]);
  useEffect(() => onReadyChange(Boolean(name.trim())), [name, onReadyChange]);
  const refresh = useCallback(async () => {
    try {
      const all = await getAllLocalRecords<unknown>(STORE_NAMES.presets);
      setRecords(
        all.flatMap((record) => {
          try {
            return [parseUtilityPreset(JSON.stringify(record))];
          } catch {
            return [];
          }
        })
      );
    } catch {
      setRecords([]);
    }
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);
  const save = async () => {
    setError('');
    try {
      await putLocalRecord(STORE_NAMES.presets, current);
      setStatus('Preset saved on this device.');
      await refresh();
    } catch (cause: unknown) {
      setError(toAppError(cause, 'INVALID_FILE').userMessage);
    }
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      if (file.size > 64 * 1024) throw new Error('Preset JSON exceeds 64 KiB.');
      const preset = parseUtilityPreset(await file.text());
      await putLocalRecord(STORE_NAMES.presets, preset);
      onApply(preset);
      setStatus(`${preset.name} imported and applied.`);
      await refresh();
    } catch (cause: unknown) {
      setError(toAppError(cause, 'INVALID_FILE').userMessage);
    }
  };
  return (
    <section className="utility-mode-panel preset-utility" aria-labelledby="presets-title">
      <header>
        <h2 id="presets-title">Local preset import &amp; export</h2>
        <p>Save reusable utility settings in IndexedDB or move them as versioned JSON.</p>
      </header>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="Import utility preset"
        onChange={(event) => {
          void importFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <div className="preset-workbench">
        <section>
          <Bookmark size={25} />
          <h3>Current configuration</h3>
          <label className="control-field">
            <span>Preset name</span>
            <input
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <button
            data-utility-primary
            className="button button--primary"
            type="button"
            disabled={!name.trim()}
            onClick={() => void save()}
          >
            <Bookmark size={16} /> Save locally
          </button>
          <a
            className="button button--secondary"
            href={exportUrl}
            download="pixavelo-utility-preset.json"
          >
            <Download size={16} /> Export JSON
          </a>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} /> Import JSON
          </button>
          {status ? (
            <p className="utility-success">
              <Check size={16} /> {status}
            </p>
          ) : null}
          {error ? (
            <p className="utility-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
        <section>
          <h3>Saved on this device</h3>
          {records.length ? (
            <ul>
              {records.map((record) => (
                <li key={record.id}>
                  <span>
                    <strong>{record.name}</strong>
                    <small>{new Date(record.createdAt).toLocaleString()}</small>
                  </span>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => onApply(record)}
                  >
                    Apply
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No local utility presets yet.</p>
          )}
        </section>
      </div>
    </section>
  );
}
