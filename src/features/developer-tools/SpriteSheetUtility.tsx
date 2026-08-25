import { Check, Download, FileImage, Grid2X2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toAppError } from '../../engine/errors/AppError';
import { formatBytes } from '../../utils/format';
import { createSpriteSheet, type SpriteSheetResult } from './spriteSheet';
import type { SpriteSheetSettings } from './types';
import { calculateSpriteLayout } from './utilityModel';

export function SpriteSheetUtility({
  settings,
  setSettings,
  onReadyChange
}: {
  readonly settings: SpriteSheetSettings;
  readonly setSettings: Dispatch<SetStateAction<SpriteSheetSettings>>;
  readonly onReadyChange: (ready: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<readonly File[]>([]);
  const [result, setResult] = useState<SpriteSheetResult>();
  const [imageUrl, setImageUrl] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState('');
  const layout = calculateSpriteLayout(Math.max(1, files.length), settings);
  useEffect(
    () => onReadyChange(files.length > 0 && !processing),
    [files.length, onReadyChange, processing]
  );
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (mapUrl) URL.revokeObjectURL(mapUrl);
    },
    [imageUrl, mapUrl]
  );
  const clearResult = () => {
    setResult(undefined);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (mapUrl) URL.revokeObjectURL(mapUrl);
    setImageUrl('');
    setMapUrl('');
  };
  const build = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError('');
    clearResult();
    try {
      const output = await createSpriteSheet(files, settings, {
        onProgress: (completed, total) => setProgress({ completed, total })
      });
      setResult(output);
      setImageUrl(URL.createObjectURL(output.image));
      setMapUrl(URL.createObjectURL(output.map));
    } catch (cause: unknown) {
      setError(toAppError(cause, 'ENCODE_FAILED').userMessage);
    } finally {
      setProcessing(false);
    }
  };
  const update = <Key extends keyof SpriteSheetSettings>(
    key: Key,
    value: SpriteSheetSettings[Key]
  ) => {
    clearResult();
    setSettings((current) => ({ ...current, [key]: value }));
  };
  return (
    <section className="utility-mode-panel sprite-utility" aria-labelledby="sprite-title">
      <header>
        <h2 id="sprite-title">Sprite sheet</h2>
        <p>Pack up to 100 local images into a verified PNG and JSON coordinate map.</p>
      </header>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        multiple
        accept="image/*"
        aria-label="Choose sprite images"
        onChange={(event) => {
          clearResult();
          setFiles(Array.from(event.currentTarget.files ?? []).slice(0, 100));
          event.currentTarget.value = '';
        }}
      />
      <div className="sprite-workbench">
        <section className="sprite-files">
          <button className="sprite-intake" type="button" onClick={() => inputRef.current?.click()}>
            <Grid2X2 size={28} />
            <strong>Choose sprite images</strong>
            <span>PNG, JPEG, WebP and supported formats</span>
          </button>
          {files.length ? (
            <ul>
              {files.slice(0, 12).map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  <FileImage size={15} />
                  <span>{file.name}</span>
                  <small>{formatBytes(file.size)}</small>
                </li>
              ))}
              {files.length > 12 ? <li>+ {files.length - 12} more</li> : null}
            </ul>
          ) : null}
        </section>
        <section className="sprite-settings">
          <h3>Sheet settings</h3>
          <div className="utility-number-grid">
            <label>
              <span>Cell width</span>
              <input
                type="number"
                min="16"
                max="2048"
                value={settings.cellWidth}
                onChange={(event) =>
                  update('cellWidth', clampInteger(event.currentTarget.valueAsNumber, 16, 2048))
                }
              />
            </label>
            <label>
              <span>Cell height</span>
              <input
                type="number"
                min="16"
                max="2048"
                value={settings.cellHeight}
                onChange={(event) =>
                  update('cellHeight', clampInteger(event.currentTarget.valueAsNumber, 16, 2048))
                }
              />
            </label>
            <label>
              <span>Columns</span>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.columns}
                onChange={(event) =>
                  update('columns', clampInteger(event.currentTarget.valueAsNumber, 1, 100))
                }
              />
            </label>
            <label>
              <span>Gap</span>
              <input
                type="number"
                min="0"
                max="128"
                value={settings.gap}
                onChange={(event) =>
                  update('gap', clampInteger(event.currentTarget.valueAsNumber, 0, 128))
                }
              />
            </label>
          </div>
          <label className="control-field">
            <span>Background</span>
            <select
              value={settings.background}
              onChange={(event) => update('background', event.currentTarget.value)}
            >
              <option value="transparent">Transparent</option>
              <option value="#ffffff">White</option>
              <option value="#000000">Black</option>
            </select>
          </label>
          <dl className="sprite-summary">
            <div>
              <dt>Canvas</dt>
              <dd>
                {layout.width} × {layout.height}
              </dd>
            </div>
            <div>
              <dt>Rows</dt>
              <dd>{layout.rows}</dd>
            </div>
            <div>
              <dt>Files</dt>
              <dd>{files.length}</dd>
            </div>
          </dl>
          <button
            data-utility-primary
            className="button button--primary"
            type="button"
            disabled={!files.length || processing}
            onClick={() => void build()}
          >
            {processing ? <LoaderCircle className="spin" size={16} /> : <Grid2X2 size={16} />} Build
            sprite sheet
          </button>
          {processing ? (
            <p role="status">
              {progress.completed} of {progress.total} images rendered
            </p>
          ) : null}
          {error ? (
            <p className="utility-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
        {result && imageUrl ? (
          <section className="sprite-result">
            <h3>
              <Check size={16} /> Verified output
            </h3>
            <img src={imageUrl} alt="Generated sprite sheet" />
            <p>
              {result.width} × {result.height} · {result.itemCount} sprites
            </p>
            <a className="button button--primary" href={imageUrl} download="sprite-sheet.png">
              <Download size={16} /> Download PNG
            </a>
            <a className="button button--secondary" href={mapUrl} download="sprite-map.json">
              <Download size={16} /> Download JSON map
            </a>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}
