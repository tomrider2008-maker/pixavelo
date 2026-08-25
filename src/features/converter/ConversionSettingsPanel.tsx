import { Check, Info } from 'lucide-react';
import type { CoreImageFormat } from '../../types/images';
import { conversionPresets, identifyPreset, settingsForPreset } from './presets';
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

  return (
    <aside className="conversion-settings" aria-labelledby="output-settings-title">
      <h2 id="output-settings-title">Output settings</h2>

      <label htmlFor="conversion-preset">Preset</label>
      <select
        id="conversion-preset"
        value={preset}
        disabled={disabled}
        onChange={(event) => {
          const selected = settingsForPreset(event.currentTarget.value as typeof preset);
          if (selected) onSetSettings(selected);
        }}
      >
        {conversionPresets.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>

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

      {settings.outputFormat === 'png' ? null : (
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
          Tokens: {'{name}'}, {'{ext}'}, {'{index}'}
        </small>
      </label>

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
