import { Check, Download, LoaderCircle, ShieldCheck } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { useImageTool } from '../tools/useImageTool';
import type { WatermarkPosition } from '../../types/images';
import { formatBytes } from '../../utils/format';
import type { WatermarkUtilitySettings } from './types';

const positions: readonly WatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
];

export function WatermarkUtility({
  tool,
  settings,
  setSettings,
  onExport
}: {
  readonly tool: ReturnType<typeof useImageTool>;
  readonly settings: WatermarkUtilitySettings;
  readonly setSettings: Dispatch<SetStateAction<WatermarkUtilitySettings>>;
  readonly onExport: () => void;
}) {
  const previewUrl = tool.output?.url ?? tool.sourceUrl;
  const update = <Key extends keyof WatermarkUtilitySettings>(
    key: Key,
    value: WatermarkUtilitySettings[Key]
  ) => {
    tool.discardOutput();
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="watermark-workbench">
      <section className="utility-preview-panel" aria-labelledby="watermark-preview-title">
        <header>
          <h2 id="watermark-preview-title">Preview</h2>
        </header>
        <div className="watermark-preview">
          {previewUrl ? <img src={previewUrl} alt="Watermark preview" /> : null}
          {!tool.output && settings.text.trim() ? (
            <span
              className={`watermark-preview__text watermark-preview__text--${settings.position}`}
              aria-hidden="true"
              style={{ color: settings.color, opacity: settings.opacity }}
            >
              {settings.text}
            </span>
          ) : null}
        </div>
        <footer>
          <span>Live placement preview</span>
          <strong>Local canvas</strong>
        </footer>
      </section>

      <section className="watermark-settings" aria-labelledby="watermark-settings-title">
        <header>
          <h2 id="watermark-settings-title">Watermark settings</h2>
        </header>
        <label className="control-field">
          <span>Text</span>
          <input
            value={settings.text}
            maxLength={180}
            onChange={(event) => update('text', event.currentTarget.value)}
          />
        </label>
        <fieldset className="watermark-position-field">
          <legend>Position</legend>
          <div>
            {positions.map((position) => (
              <button
                key={position}
                type="button"
                aria-label={position.replaceAll('-', ' ')}
                aria-pressed={settings.position === position}
                onClick={() => update('position', position)}
              >
                <span />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="range-field">
          <span>
            Opacity <output>{Math.round(settings.opacity * 100)}%</output>
          </span>
          <input
            type="range"
            min="5"
            max="100"
            value={settings.opacity * 100}
            onChange={(event) => update('opacity', event.currentTarget.valueAsNumber / 100)}
          />
        </label>
        <label className="range-field">
          <span>
            Size <output>{Math.round(settings.sizePercent * 100)}%</output>
          </span>
          <input
            type="range"
            min="1"
            max="16"
            value={settings.sizePercent * 100}
            onChange={(event) => update('sizePercent', event.currentTarget.valueAsNumber / 100)}
          />
        </label>
        <label className="color-control">
          <span>Color</span>
          <input
            type="color"
            value={settings.color}
            onChange={(event) => update('color', event.currentTarget.value)}
          />
          <code>{settings.color.toUpperCase()}</code>
        </label>
        <div className="utility-output-row">
          <label className="control-field">
            <span>Output format</span>
            <select
              value={settings.outputFormat}
              onChange={(event) =>
                update(
                  'outputFormat',
                  event.currentTarget.value as WatermarkUtilitySettings['outputFormat']
                )
              }
            >
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
          <label className="range-field">
            <span>
              Quality <output>{Math.round(settings.quality * 100)}</output>
            </span>
            <input
              type="range"
              min="30"
              max="100"
              disabled={settings.outputFormat === 'png'}
              value={settings.quality * 100}
              onChange={(event) => update('quality', event.currentTarget.valueAsNumber / 100)}
            />
          </label>
        </div>
      </section>

      <aside className="utility-validation-panel" aria-label="Output validation">
        <header>
          <h2>Output validation</h2>
        </header>
        <dl>
          <div>
            <dt>Dimensions</dt>
            <dd>
              {tool.output
                ? `${tool.output.width} × ${tool.output.height}`
                : tool.validation?.dimensions
                  ? `${tool.validation.dimensions.width} × ${tool.validation.dimensions.height}`
                  : 'Pending'}
            </dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{settings.outputFormat.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Output size</dt>
            <dd>{tool.output ? formatBytes(tool.output.size) : 'Measured after export'}</dd>
          </div>
          <div>
            <dt>Metadata</dt>
            <dd>
              {tool.output?.metadataRemovedVerified ? 'Removal verified' : 'Verified after export'}
            </dd>
          </div>
        </dl>
        {tool.status === 'processing' ? (
          <div className="utility-processing" role="status">
            <LoaderCircle className="spin" size={17} /> Encoding watermark…
          </div>
        ) : null}
        {tool.error ? (
          <p className="utility-error" role="alert">
            {tool.error}
          </p>
        ) : null}
        {tool.output ? (
          <>
            <p className="utility-success">
              <Check size={16} /> Ready to export
            </p>
            <a
              className="button button--primary"
              href={tool.output.url}
              download={tool.output.filename}
            >
              <Download size={17} /> Download watermarked image
            </a>
          </>
        ) : (
          <button
            data-utility-primary
            className="button button--primary"
            type="button"
            disabled={!tool.file || !settings.text.trim() || tool.status === 'processing'}
            onClick={onExport}
          >
            Export result
          </button>
        )}
        <p className="utility-local-note">
          <ShieldCheck size={17} />
          <span>
            <strong>Local processing</strong>
            <small>No data leaves this device.</small>
          </span>
        </p>
      </aside>
    </div>
  );
}
