import { Check, Info, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CoreImageFormat } from '../../types/images';
import { conversionPresets, identifyPreset, settingsForPreset } from './presets';
import { deletePreset, listSavedPresets, savePreset, type SavedPreset } from './savedPresets';
import type { ConversionSettings } from './types';

export function ConversionSettingsPanel({
  settings,
  disabled,
  onSetSettings,
  onUpdateSettings
}: {
  readonly settings: ConversionSettings;
  readonly disabled: boolean;
  readonly onSetSettings: (settings: ConversionSettings, invalidate?: boolean) => void;
  readonly onUpdateSettings: (update: Partial<ConversionSettings>, invalidate?: boolean) => void;
}) {
  const preset = identifyPreset(settings);
  const [savedPresets, setSavedPresets] = useState<readonly SavedPreset[]>(listSavedPresets);
  const [saveLabel, setSaveLabel] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const refreshSaved = () => setSavedPresets(listSavedPresets());

  const handleSavePreset = () => {
    if (!saveLabel.trim()) return;
    savePreset(saveLabel, settings);
    setSaveLabel('');
    setShowSaveInput(false);
    refreshSaved();
  };

  const handleDeleteSaved = (id: string) => {
    deletePreset(id);
    refreshSaved();
  };

  return (
    <aside className="conversion-settings" aria-labelledby="output-settings-title">
      <h2 id="output-settings-title">Output settings</h2>

      {/* ── Preset selector ──────────────────────────────────────── */}
      <label htmlFor="conversion-preset">Preset</label>
      <select
        id="conversion-preset"
        value={preset}
        disabled={disabled}
        onChange={(event) => {
          const id = event.currentTarget.value;
          // Check built-in presets first
          const builtIn = settingsForPreset(id as typeof preset);
          if (builtIn) {
            onSetSettings(builtIn);
            return;
          }
          // Check saved presets
          const saved = savedPresets.find((p) => p.id === id);
          if (saved) onSetSettings(saved.settings);
        }}
      >
        {conversionPresets.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
        {savedPresets.map((p) => (
          <option key={p.id} value={p.id}>
            ★ {p.label}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>

      {/* ── Save custom preset ───────────────────────────────────── */}
      {showSaveInput ? (
        <div className="settings-save-row">
          <input
            type="text"
            placeholder="Preset name…"
            value={saveLabel}
            maxLength={60}
            autoFocus
            onChange={(e) => setSaveLabel(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSavePreset();
              if (e.key === 'Escape') setShowSaveInput(false);
            }}
          />
          <button
            type="button"
            className="button button--secondary"
            onClick={handleSavePreset}
            disabled={!saveLabel.trim()}
          >
            Save
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setShowSaveInput(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button button--quiet settings-save-btn"
          onClick={() => setShowSaveInput(true)}
          disabled={disabled}
        >
          <Save size={13} aria-hidden="true" /> Save current as preset…
        </button>
      )}

      {/* ── Saved preset management ──────────────────────────────── */}
      {savedPresets.length > 0 && (
        <div className="settings-saved-list">
          {savedPresets.map((p) => (
            <div key={p.id} className="settings-saved-item">
              <span>{p.label}</span>
              <button
                type="button"
                className="icon-button icon-button--small"
                aria-label={`Delete preset ${p.label}`}
                onClick={() => handleDeleteSaved(p.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Global output format ─────────────────────────────────── */}
      <label htmlFor="output-format">Global output format</label>
      <select
        id="output-format"
        value={settings.outputFormat}
        disabled={disabled}
        onChange={(event) =>
          onUpdateSettings({ outputFormat: event.currentTarget.value as CoreImageFormat })
        }
      >
        <option value="jpeg">JPEG</option>
        <option value="png">PNG</option>
        <option value="webp">WebP</option>
      </select>

      {/* ── Quality mode toggle ───────────────────────────────────── */}
      {settings.outputFormat !== 'png' && (
        <fieldset className="settings-quality-mode">
          <legend>Quality mode</legend>
          <label className="radio-row">
            <input
              type="radio"
              name="quality-mode"
              value="quality"
              checked={settings.qualityMode === 'quality'}
              disabled={disabled}
              onChange={() => onUpdateSettings({ qualityMode: 'quality' })}
            />
            Quality slider
          </label>
          <label className="radio-row">
            <input
              type="radio"
              name="quality-mode"
              value="target"
              checked={settings.qualityMode === 'target'}
              disabled={disabled}
              onChange={() => onUpdateSettings({ qualityMode: 'target' })}
            />
            Target file size
          </label>
        </fieldset>
      )}

      {/* ── Quality slider or target KB ──────────────────────────── */}
      {settings.outputFormat !== 'png' && settings.qualityMode === 'quality' && (
        <label className="range-field">
          <span>
            Quality <output>{settings.quality}</output>
          </span>
          <input
            type="range"
            min="20"
            max="100"
            step="1"
            value={settings.quality}
            disabled={disabled}
            onChange={(event) => onUpdateSettings({ quality: event.currentTarget.valueAsNumber })}
          />
          <small>Lower quality, smaller size · Higher quality, larger size</small>
        </label>
      )}

      {settings.outputFormat !== 'png' && settings.qualityMode === 'target' && (
        <label className="target-field" htmlFor="target-kb">
          <span>Target file size (KB)</span>
          <input
            id="target-kb"
            type="number"
            min="10"
            max="51200"
            step="10"
            value={settings.targetKb}
            disabled={disabled}
            onChange={(event) =>
              onUpdateSettings({ targetKb: Math.max(10, event.currentTarget.valueAsNumber) })
            }
          />
          <small>The encoder will binary-search for the closest quality. Max 12 passes.</small>
        </label>
      )}

      {/* ── Transparency background ──────────────────────────────── */}
      <label className="color-field">
        <span>Transparency background</span>
        <span className="color-field__control">
          <input
            type="color"
            value={settings.background}
            disabled={disabled}
            onChange={(event) => onUpdateSettings({ background: event.currentTarget.value })}
          />
          <code>{settings.background.toUpperCase()}</code>
        </span>
      </label>

      {/* ── Naming pattern ───────────────────────────────────────── */}
      <label className="naming-field" htmlFor="naming-pattern">
        <span>Naming pattern</span>
        <input
          id="naming-pattern"
          value={settings.namingPattern}
          disabled={disabled}
          maxLength={120}
          spellCheck={false}
          onChange={(event) =>
            onUpdateSettings({ namingPattern: event.currentTarget.value }, false)
          }
        />
        <small>
          Tokens: {'{name}'}, {'{ext}'}, {'{index}'}, {'{date}'}, {'{width}'}, {'{height}'}
        </small>
      </label>

      {/* ── Metadata strip toggle ────────────────────────────────── */}
      <label className="toggle-field">
        <input
          type="checkbox"
          checked={settings.stripMetadata}
          disabled={disabled}
          onChange={(event) => onUpdateSettings({ stripMetadata: event.currentTarget.checked })}
        />
        <span>Strip EXIF / metadata</span>
      </label>
      {!settings.stripMetadata && (
        <small className="settings-metadata-warn">
          ⚠ EXIF data (including GPS location) may be present in output files.
        </small>
      )}

      {/* ── Auto-process toggle ──────────────────────────────────── */}
      <label className="toggle-field">
        <input
          type="checkbox"
          checked={settings.autoProcess}
          disabled={disabled}
          onChange={(event) => onUpdateSettings({ autoProcess: event.currentTarget.checked })}
        />
        <span>Auto-process on add</span>
      </label>

      {/* ── Static facts ─────────────────────────────────────────── */}
      <div className="settings-facts">
        <span>
          <Check size={15} aria-hidden="true" /> Orientation normalized
        </span>
        <span>
          <Check size={15} aria-hidden="true" /> Output decoded and verified
        </span>
        <span>
          <Check size={15} aria-hidden="true" /> No uploads
        </span>
      </div>
      <div className="settings-note" role="note">
        <Info size={16} aria-hidden="true" /> Advanced formats are import-only. Per-file output
        overrides take precedence.
      </div>
    </aside>
  );
}
