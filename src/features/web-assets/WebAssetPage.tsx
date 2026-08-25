import {
  Check,
  Clipboard,
  Code2,
  FileArchive,
  ImageDown,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toAppError } from '../../engine/errors/AppError';
import { clearProcessingActivity, setProcessingActivity } from '../../stores/processingActivity';
import { formatBytes } from '../../utils/format';
import { ImageToolInput } from '../tools/ImageToolInput';
import { canPreviewOriginal } from '../tools/previewCapabilities';
import { useImageTool } from '../tools/useImageTool';
import { generateIconAssets, generateResponsiveAssets } from './generateWebAssets';
import { buildSrcsetMarkup, normalizeBreakpoints, verifiedAssetCount } from './webAssetModel';
import type { GeneratedWebBundle, WebAssetFormat, WebAssetMode } from './types';

const DEFAULT_WIDTHS = [480, 768, 1200, 1600];
const FORMAT_OPTIONS: readonly { id: WebAssetFormat; label: string }[] = [
  { id: 'webp', label: 'WebP' },
  { id: 'avif', label: 'AVIF' },
  { id: 'jpeg', label: 'JPEG fallback' }
];

export default function WebAssetPage() {
  const tool = useImageTool();
  const [mode, setMode] = useState<WebAssetMode>('responsive');
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);
  const [formats, setFormats] = useState<readonly WebAssetFormat[]>(['webp', 'avif', 'jpeg']);
  const [quality, setQuality] = useState(0.8);
  const [preventUpscale, setPreventUpscale] = useState(true);
  const [bundle, setBundle] = useState<GeneratedWebBundle>();
  const [zipUrl, setZipUrl] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, label: '' });
  const [error, setError] = useState<string>();
  const [codeTab, setCodeTab] = useState<'picture' | 'srcset'>('picture');
  const controllerRef = useRef<AbortController | null>(null);
  const zipUrlRef = useRef<string | undefined>(undefined);

  const clearBundle = useCallback(() => {
    setBundle(undefined);
    if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    zipUrlRef.current = undefined;
    setZipUrl(undefined);
  }, []);

  const chooseFile = useCallback(
    async (file: File | undefined) => {
      clearBundle();
      setError(undefined);
      await tool.chooseFile(file);
    },
    [clearBundle, tool]
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    clearBundle();
    tool.removeFile();
    setMode('responsive');
    setWidths(DEFAULT_WIDTHS);
    setFormats(['webp', 'avif', 'jpeg']);
    setQuality(0.8);
    setPreventUpscale(true);
    setError(undefined);
  }, [clearBundle, tool]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    },
    []
  );

  const generate = async () => {
    if (!tool.file || !tool.validation?.supportedByConverter) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    clearBundle();
    setError(undefined);
    setProcessing(true);
    setProcessingActivity({ queued: 0, active: 1, stage: 'processing' });
    try {
      const onProgress = (completed: number, total: number, label: string) =>
        setProgress({ completed, total, label });
      const result =
        mode === 'responsive'
          ? await generateResponsiveAssets({
              file: tool.file,
              validation: tool.validation,
              settings: { widths, formats, quality, preventUpscale, includeZip: true },
              signal: controller.signal,
              onProgress
            })
          : await generateIconAssets({
              file: tool.file,
              validation: tool.validation,
              quality,
              signal: controller.signal,
              onProgress
            });
      setBundle(result);
      const nextZipUrl = URL.createObjectURL(result.zip);
      zipUrlRef.current = nextZipUrl;
      setZipUrl(nextZipUrl);
    } catch (cause: unknown) {
      const appError = toAppError(cause, 'ENCODE_FAILED');
      setError(
        appError.code === 'CANCELLED' ? 'Asset generation was cancelled.' : appError.userMessage
      );
    } finally {
      setProcessing(false);
      clearProcessingActivity();
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const sourceWidth = tool.validation?.dimensions?.width ?? 0;
  const effectiveWidths = useMemo(
    () => normalizeBreakpoints(widths, sourceWidth || 32_768, preventUpscale),
    [preventUpscale, sourceWidth, widths]
  );
  const code = bundle
    ? codeTab === 'picture' || mode === 'icons'
      ? bundle.markup
      : buildSrcsetMarkup(tool.file?.name ?? 'image', effectiveWidths, formats[0] ?? 'webp')
    : mode === 'responsive'
      ? 'Generate assets to receive verified production markup.'
      : 'Generate icons to receive verified <link> markup.';
  const canGenerate = Boolean(
    tool.file &&
    tool.validation?.supportedByConverter &&
    !processing &&
    (mode === 'icons' || (effectiveWidths.length > 0 && formats.length > 0))
  );

  return (
    <section className="web-assets-workspace" aria-labelledby="web-assets-title">
      <header className="web-assets-heading">
        <div>
          <h1 id="web-assets-title">Web Asset Studio</h1>
          <p>Generate responsive images, modern formats, favicons and app icons locally.</p>
        </div>
        <div className="web-assets-heading__actions">
          <button className="button button--secondary" type="button" onClick={reset}>
            <RotateCcw size={17} aria-hidden="true" /> Reset
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!canGenerate}
            onClick={() => void generate()}
          >
            {processing ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
            Generate assets
          </button>
        </div>
      </header>

      <ImageToolInput
        file={tool.file}
        validation={tool.validation}
        sourceUrl={tool.sourceUrl}
        status={processing ? 'processing' : tool.status}
        error={tool.error}
        actionLabel="Choose an image for web assets"
        onChoose={(file) => void chooseFile(file)}
        onRemove={reset}
      />

      {tool.file && tool.validation?.supportedByConverter ? (
        <>
          <div className="web-asset-modes" role="tablist" aria-label="Asset studio mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'responsive'}
              onClick={() => {
                clearBundle();
                setMode('responsive');
              }}
            >
              <ImageDown size={16} aria-hidden="true" /> Responsive images
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'icons'}
              onClick={() => {
                clearBundle();
                setMode('icons');
              }}
            >
              <Star size={16} aria-hidden="true" /> Icons &amp; favicon
            </button>
          </div>

          <div className="web-assets-layout">
            <SourcePreview
              file={tool.file}
              sourceUrl={tool.sourceUrl}
              format={tool.validation.format}
              width={tool.validation.dimensions?.width}
              height={tool.validation.dimensions?.height}
            />

            <div className="web-assets-main">
              {mode === 'responsive' ? (
                <ResponsiveControls
                  widths={widths}
                  formats={formats}
                  sourceWidth={sourceWidth}
                  onWidths={(next) => {
                    clearBundle();
                    setWidths(next);
                  }}
                  onFormats={(next) => {
                    clearBundle();
                    setFormats(next);
                  }}
                />
              ) : (
                <IconPlan />
              )}
              <section className="web-markup-panel" aria-labelledby="production-markup-title">
                <header>
                  <div>
                    <span>Production markup</span>
                    <h2 id="production-markup-title">
                      {mode === 'responsive' ? 'Responsive HTML' : 'Icon links'}
                    </h2>
                  </div>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(code)}
                  >
                    <Clipboard size={15} aria-hidden="true" /> Copy code
                  </button>
                </header>
                {mode === 'responsive' ? (
                  <div className="web-markup-tabs" role="tablist" aria-label="Markup format">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={codeTab === 'picture'}
                      onClick={() => setCodeTab('picture')}
                    >
                      <Code2 size={14} /> Picture
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={codeTab === 'srcset'}
                      onClick={() => setCodeTab('srcset')}
                    >
                      Srcset
                    </button>
                  </div>
                ) : null}
                <pre tabIndex={0}>{code}</pre>
              </section>
            </div>

            <aside className="web-assets-inspector" aria-label="Export settings">
              <header>
                <span>Export settings</span>
                <strong>{mode === 'responsive' ? 'Responsive package' : 'Icon package'}</strong>
              </header>
              <label className="range-field">
                <span>
                  Quality <output>{Math.round(quality * 100)}</output>
                </span>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={quality * 100}
                  onChange={(event) => {
                    clearBundle();
                    setQuality(event.currentTarget.valueAsNumber / 100);
                  }}
                />
              </label>
              {mode === 'responsive' ? (
                <>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={preventUpscale}
                      onChange={(event) => {
                        clearBundle();
                        setPreventUpscale(event.currentTarget.checked);
                      }}
                    />
                    Prevent upscaling
                  </label>
                  <dl className="web-output-summary">
                    <div>
                      <dt>Planned assets</dt>
                      <dd>{effectiveWidths.length * formats.length}</dd>
                    </div>
                    <div>
                      <dt>Widths</dt>
                      <dd>{effectiveWidths.length}</dd>
                    </div>
                    <div>
                      <dt>Formats</dt>
                      <dd>{formats.length}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="web-icon-note">
                  Square center crops produce favicon PNGs, favicon.ico, Apple touch icon, PWA icons
                  and a manifest.
                </p>
              )}

              {processing ? (
                <div className="web-generation-progress" role="status" aria-live="polite">
                  <LoaderCircle className="spin" size={17} aria-hidden="true" />
                  <span>
                    <strong>{progress.label}</strong>
                    <small>
                      {progress.completed} of {progress.total || '…'} verified
                    </small>
                  </span>
                </div>
              ) : null}
              {error ? (
                <p className="web-asset-error" role="alert">
                  {error}
                </p>
              ) : null}
              {bundle ? (
                <div className="web-verified-output">
                  <span>
                    <Check size={17} aria-hidden="true" /> Output package verified
                  </span>
                  <dl>
                    <div>
                      <dt>Assets</dt>
                      <dd>{bundle.assets.length}</dd>
                    </div>
                    <div>
                      <dt>Verified</dt>
                      <dd>{verifiedAssetCount(bundle.assets)}</dd>
                    </div>
                    <div>
                      <dt>Output</dt>
                      <dd>{formatBytes(bundle.totalBytes)}</dd>
                    </div>
                  </dl>
                  {zipUrl ? (
                    <a
                      className="button button--primary"
                      href={zipUrl}
                      download={`${mode}-web-assets.zip`}
                    >
                      <FileArchive size={17} aria-hidden="true" /> Download ZIP
                    </a>
                  ) : null}
                </div>
              ) : (
                <button
                  className="button button--primary web-assets-generate"
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void generate()}
                >
                  <Sparkles size={17} aria-hidden="true" /> Generate assets
                </button>
              )}
              {processing ? (
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => controllerRef.current?.abort()}
                >
                  Cancel
                </button>
              ) : null}
              <div className="web-local-note">
                <ShieldCheck size={17} aria-hidden="true" />
                <span>
                  <strong>Processed locally</strong>
                  <small>No image upload or remote API.</small>
                </span>
              </div>
            </aside>
          </div>
          {createPortal(
            <button
              className="button button--primary web-assets-mobile-action"
              type="button"
              disabled={!canGenerate}
              onClick={() => void generate()}
            >
              {processing ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
              Generate assets
            </button>,
            document.body
          )}
        </>
      ) : null}
    </section>
  );
}

function SourcePreview({
  file,
  sourceUrl,
  format,
  width,
  height
}: {
  readonly file: File;
  readonly sourceUrl: string | undefined;
  readonly format: string;
  readonly width: number | undefined;
  readonly height: number | undefined;
}) {
  return (
    <aside className="web-source-panel">
      <header>
        <span>Source preview</span>
        <strong>{file.name}</strong>
      </header>
      <div className="web-source-preview">
        {sourceUrl && canPreviewOriginal(format as never) ? (
          <img src={sourceUrl} alt={`Preview of ${file.name}`} />
        ) : (
          <ImageDown size={44} aria-hidden="true" />
        )}
      </div>
      <dl>
        <div>
          <dt>Dimensions</dt>
          <dd>{width && height ? `${width} × ${height}` : 'Decoded on export'}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{format.toUpperCase()}</dd>
        </div>
        <div>
          <dt>File size</dt>
          <dd>{formatBytes(file.size)}</dd>
        </div>
      </dl>
      <p>
        <ShieldCheck size={16} /> Original bytes stay on this device.
      </p>
    </aside>
  );
}

function ResponsiveControls({
  widths,
  formats,
  sourceWidth,
  onWidths,
  onFormats
}: {
  readonly widths: readonly number[];
  readonly formats: readonly WebAssetFormat[];
  readonly sourceWidth: number;
  readonly onWidths: (widths: number[]) => void;
  readonly onFormats: (formats: readonly WebAssetFormat[]) => void;
}) {
  return (
    <section className="responsive-output-panel" aria-labelledby="responsive-output-title">
      <header>
        <div>
          <span>Responsive outputs</span>
          <h2 id="responsive-output-title">Breakpoints &amp; formats</h2>
        </div>
        <button
          className="button button--secondary"
          type="button"
          disabled={widths.length >= 8}
          onClick={() => onWidths([...widths, Math.min(32_768, (widths.at(-1) ?? 320) + 320)])}
        >
          <Plus size={15} /> Add breakpoint
        </button>
      </header>
      <div className="responsive-format-toggles" aria-label="Output formats">
        {FORMAT_OPTIONS.map((option) => (
          <label key={option.id}>
            <input
              type="checkbox"
              checked={formats.includes(option.id)}
              onChange={(event) =>
                onFormats(
                  event.currentTarget.checked
                    ? [...formats, option.id]
                    : formats.filter((format) => format !== option.id)
                )
              }
            />
            {option.label}
          </label>
        ))}
      </div>
      <div className="breakpoint-list">
        <div className="breakpoint-list__labels" aria-hidden="true">
          <span>Width</span>
          <span>Output formats</span>
          <span>Source fit</span>
        </div>
        {widths.map((width, index) => (
          <div className="breakpoint-row" key={`${index}-${width}`}>
            <label>
              <span className="sr-only">Breakpoint {index + 1} width</span>
              <input
                type="number"
                min="16"
                max="32768"
                value={width}
                onChange={(event) =>
                  onWidths(
                    widths.map((entry, entryIndex) =>
                      entryIndex === index ? event.currentTarget.valueAsNumber : entry
                    )
                  )
                }
              />
              <small>px</small>
            </label>
            <span>
              {formats.map((format) => format.toUpperCase()).join(' · ') || 'Choose a format'}
            </span>
            <span>{sourceWidth && width > sourceWidth ? 'Will be capped' : 'Preserve ratio'}</span>
            <button
              className="icon-button"
              type="button"
              disabled={widths.length === 1}
              onClick={() => onWidths(widths.filter((_, entryIndex) => entryIndex !== index))}
              aria-label={`Remove ${width}px breakpoint`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function IconPlan() {
  return (
    <section className="responsive-output-panel icon-plan" aria-labelledby="icon-plan-title">
      <header>
        <div>
          <span>Icon outputs</span>
          <h2 id="icon-plan-title">Favicon &amp; app icon package</h2>
        </div>
      </header>
      <div className="icon-size-rail">
        {[16, 32, 48, 180, 192, 512].map((size) => (
          <span key={size}>
            <strong>{size}</strong>
            <small>{size < 100 ? 'Favicon' : size === 180 ? 'Apple' : 'PWA'}</small>
          </span>
        ))}
      </div>
      <ul>
        <li>
          <Check size={15} /> PNG icons with verified square dimensions
        </li>
        <li>
          <Check size={15} /> Multi-size favicon.ico with embedded PNG images
        </li>
        <li>
          <Check size={15} /> Standards-based site.webmanifest and head links
        </li>
      </ul>
    </section>
  );
}
