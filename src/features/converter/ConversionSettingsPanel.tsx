import {
  Check,
  Globe2,
  Image,
  Info,
  MonitorSmartphone,
  Save,
  Scale,
  Trash2,
  X
} from 'lucide-react';
import { useState } from 'react';
import { conversionPresets, identifyPreset, settingsForPreset } from './presets';
import { deletePreset, listSavedPresets, savePreset, type SavedPreset } from './savedPresets';
import type { ConversionSettings } from './types';

export function ConversionSettingsPanel({
  open = false,
  settings,
  disabled,
  onClose,
  onSetSettings,
  onUpdateSettings
}: {
  readonly open?: boolean;
  readonly settings: ConversionSettings;
  readonly disabled: boolean;
  readonly onClose?: () => void;
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
    savePreset(saveLabel, { ...settings, stripMetadata: true });
    setSaveLabel('');
    setShowSaveInput(false);
    refreshSaved();
  };

  const handleDeleteSaved = (id: string) => {
    deletePreset(id);
    refreshSaved();
  };

  const applyPreset = (id: string) => {
    const builtIn = settingsForPreset(id as typeof preset);
    if (builtIn) {
      onSetSettings({ ...builtIn, stripMetadata: true });
      return;
    }
    const saved = savedPresets.find((item) => item.id === id);
    if (saved) onSetSettings({ ...saved.settings, stripMetadata: true });
  };

  return (
    <aside
      id="conversion-settings-panel"
      className={`conversion-settings${open ? ' conversion-settings--open' : ''}`}
      aria-labelledby="output-settings-title"
    >
      <div className="conversion-settings__header">
        <div>
          <small>Batch defaults</small>
          <h2 id="output-settings-title">Output settings</h2>
        </div>
        <button
          className="icon-button conversion-settings__close"
          type="button"
          aria-label="Close output settings"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <fieldset className="conversion-preset-grid">
        <legend>Workflow presets</legend>
        {conversionPresets.map((item) => (
          <button
            key={item.id}
            type="button"
            className={preset === item.id ? 'selected' : ''}
            aria-pressed={preset === item.id}
            disabled={disabled}
            onClick={() => applyPreset(item.id)}
          >
            <PresetIcon id={item.id} />
            <span>
              <strong>{item.label}</strong>
              <small>{presetDescription(item.id)}</small>
            </span>
          </button>
        ))}
      </fieldset>

      <label className="conversion-settings__preset-library" htmlFor="conversion-preset">
        <span>Preset</span>
        <select
          id="conversion-preset"
          value={preset}
          disabled={disabled}
          onChange={(event) => applyPreset(event.currentTarget.value)}
        >
          {conversionPresets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          {savedPresets.map((item) => (
            <option key={item.id} value={item.id}>
              Saved · {item.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>

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

      <fieldset className="settings-segmented settings-format-switch">
        <legend>Global output format</legend>
        {(['jpeg', 'webp', 'png'] as const).map((format) => (
          <label key={format} className={settings.outputFormat === format ? 'selected' : ''}>
            <input
              type="radio"
              name="global-output-format"
              value={format}
              checked={settings.outputFormat === format}
              disabled={disabled}
              onChange={() => onUpdateSettings({ outputFormat: format })}
            />
            {format.toUpperCase()}
          </label>
        ))}
      </fieldset>

      {/* ── Quality mode toggle ───────────────────────────────────── */}
      {settings.outputFormat !== 'png' && (
        <fieldset className="settings-segmented settings-quality-mode">
          <legend>Quality mode</legend>
          <label className={settings.qualityMode === 'quality' ? 'selected' : ''}>
            <input
              type="radio"
              name="quality-mode"
              value="quality"
              checked={settings.qualityMode === 'quality'}
              disabled={disabled}
              onChange={() => onUpdateSettings({ qualityMode: 'quality' })}
            />
            Quality
          </label>
          <label className={settings.qualityMode === 'target' ? 'selected' : ''}>
            <input
              type="radio"
              name="quality-mode"
              value="target"
              checked={settings.qualityMode === 'target'}
              disabled={disabled}
              onChange={() => onUpdateSettings({ qualityMode: 'target' })}
            />
            Target size
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
      {settings.outputFormat === 'jpeg' ? (
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
          <small>Transparent pixels are flattened onto this color for JPEG.</small>
        </label>
      ) : null}

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

      <div className="settings-lock-row">
        <Check size={15} aria-hidden="true" />
        <span>
          <strong>Remove metadata</strong>
          <small>Re-encoding omits EXIF, location, and source metadata.</small>
        </span>
      </div>

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

function PresetIcon({ id }: { readonly id: (typeof conversionPresets)[number]['id'] }) {
  if (id === 'web-delivery') return <Globe2 size={16} aria-hidden="true" />;
  if (id === 'lossless-png') return <Image size={16} aria-hidden="true" />;
  if (id === 'max-compat') return <MonitorSmartphone size={16} aria-hidden="true" />;
  return <Scale size={16} aria-hidden="true" />;
}

function presetDescription(id: (typeof conversionPresets)[number]['id']) {
  if (id === 'web-delivery') return 'Modern web delivery';
  if (id === 'lossless-png') return 'Lossless pixels';
  if (id === 'max-compat') return 'Broad compatibility';
  return 'Quality and size';
}
