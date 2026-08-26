import {
  AlertTriangle,
  Check,
  Download,
  Gauge,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
  X
} from 'lucide-react';
import { useMemo, useState, useEffect, type KeyboardEvent } from 'react';
import { useNotifications } from '../../components/feedback/Notifications';
import type { CoreImageFormat, TargetResizeMode } from '../../types/images';
import { formatBytes, formatReduction } from '../../utils/format';
import {
  analyzeBestSettings,
  calculateVisualFidelity,
  getDominantAmbientColor
} from '../../utils/imageAnalysis';
import { ImageToolInput } from '../tools/ImageToolInput';
import { canPreviewOriginal } from '../tools/previewCapabilities';
import { resolveOutputFormat, useImageTool } from '../tools/useImageTool';
import {
  COMPRESSION_PROFILES,
  TARGET_SIZE_PRESETS,
  constrainLongEdge,
  findCompressionProfile,
  type CompressionProfileId
} from './compressionProfiles';

type CompressionMode = 'profile' | 'target';
type OutputChoice = CoreImageFormat | 'keep';

const stageLabels = {
  preparing: 'Preparing locally',
  decoding: 'Decoding image',
  processing: 'Preparing pixels',
  encoding: 'Testing bounded compression passes',
  finalizing: 'Verifying output bytes'
} as const;

export default function OptimizePage() {
  const requestedTarget = readTargetPreset();
  const [mode, setMode] = useState<CompressionMode>(() => (requestedTarget ? 'target' : 'profile'));
  const [profileId, setProfileId] = useState<CompressionProfileId>('balanced');
  const [format, setFormat] = useState<OutputChoice>('keep');
  const [quality, setQuality] = useState(82);
  const [targetKb, setTargetKb] = useState(requestedTarget ?? 500);
  const [targetResizeMode, setTargetResizeMode] = useState<TargetResizeMode>('allow-resize');
  const [preserveDimensions, setPreserveDimensions] = useState(true);
  const [maximumLongEdge, setMaximumLongEdge] = useState(2560);
  const [webOptimized, setWebOptimized] = useState(false);
  const [comparison, setComparison] = useState(50);
  const tool = useImageTool();
  const { notify } = useNotifications();
  const [ambientColor, setAmbientColor] = useState<string>('transparent');
  const [fidelity, setFidelity] = useState<number | undefined>();

  useEffect(() => {
    if (tool.file) {
      getDominantAmbientColor(tool.file)
        .then(setAmbientColor)
        .catch(() => setAmbientColor('transparent'));
    } else {
      queueMicrotask(() => setAmbientColor('transparent'));
    }
  }, [tool.file]);

  useEffect(() => {
    if (!tool.file || !tool.output) {
      queueMicrotask(() => setFidelity(undefined));
      return;
    }
    // Fetch blob from the output URL to compare with source file
    fetch(tool.output.url)
      .then((res) => res.blob())
      .then((blob) => calculateVisualFidelity(tool.file as File, blob))
      .then(setFidelity)
      .catch(() => setFidelity(undefined));
  }, [tool.file, tool.output]);

  const sourceFormat = tool.validation?.format.toUpperCase() ?? 'source';
  const selectedFormat = resolveOutputFormat(format, tool.validation);
  const outputFormat = mode === 'target' && selectedFormat === 'png' ? 'webp' : selectedFormat;
  const previewSourceUrl = canPreviewOriginal(tool.validation?.format) ? tool.sourceUrl : undefined;
  const canProcess = Boolean(tool.validation?.supportedByConverter) && tool.status !== 'processing';
  const qualityDescription =
    quality >= 92
      ? 'Maximum'
      : quality >= 86
        ? 'High'
        : quality >= 72
          ? 'Balanced'
          : quality >= 55
            ? 'Compact'
            : 'Aggressive';
  const selectedProfile = findCompressionProfile(profileId);
  const targetPresetSelected = TARGET_SIZE_PRESETS.includes(
    targetKb as (typeof TARGET_SIZE_PRESETS)[number]
  );

  const requestedDimensions = useMemo(() => {
    const dimensions = tool.validation?.dimensions;
    if (!dimensions) return undefined;
    const shouldConstrain =
      mode === 'target' ? targetResizeMode === 'allow-resize' : !preserveDimensions;
    return shouldConstrain
      ? constrainLongEdge(dimensions.width, dimensions.height, maximumLongEdge)
      : { width: dimensions.width, height: dimensions.height };
  }, [maximumLongEdge, mode, preserveDimensions, targetResizeMode, tool.validation?.dimensions]);

  const changeMode = (nextMode: CompressionMode) => {
    if (nextMode === 'target' && format === 'png') setFormat('webp');
    setMode(nextMode);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === 'ArrowLeft' || event.key === 'Home' ? 'profile' : 'target';
    changeMode(nextMode);
    window.requestAnimationFrame(() => document.getElementById(`${nextMode}-tab`)?.focus());
  };

  const applySmartSuggest = async () => {
    if (!tool.file) return;
    const { format: bestFormat, quality: bestQuality } = await analyzeBestSettings(tool.file);
    setMode('profile');
    setFormat(bestFormat);
    setQuality(bestQuality);
    setProfileId('balanced');
    notify({
      title: 'Smart Suggest applied',
      message: `Analyzed image and applied optimal settings: ${bestFormat.toUpperCase()} at ${bestQuality} quality.`,
      tone: 'success'
    });
  };

  const applyProfile = (nextId: CompressionProfileId) => {
    const profile = findCompressionProfile(nextId);

    setProfileId(nextId);
    setQuality(profile.quality);
    setFormat(profile.outputFormat);
    setPreserveDimensions(profile.preserveDimensions);
    setWebOptimized(profile.webOptimized);
    if (profile.maximumLongEdge) setMaximumLongEdge(profile.maximumLongEdge);
  };

  const compress = async (isLive = false) => {
    const result = await tool.process(
      {
        outputFormat,
        ...(outputFormat === 'png' ? {} : { quality: quality / 100 }),
        ...(requestedDimensions
          ? { width: requestedDimensions.width, height: requestedDimensions.height }
          : {}),
        ...(mode === 'target'
          ? {
              targetBytes: Math.round(targetKb * 1024),
              targetResizeMode,
              minimumQuality: targetResizeMode === 'maximum-visual-quality' ? 0.78 : 0.12,
              maximumEncodingPasses: 12,
              maximumResizePasses: 3
            }
          : {}),
        ...(outputFormat === 'jpeg' ? { background: '#ffffff' } : {})
      },
      'optimized',
      isLive
    );
    if (!result || isLive) return;
    notify({
      title:
        result.targetSatisfied === false ? 'Closest safe output created' : 'Compression complete',
      message:
        result.targetSatisfied === false
          ? `${formatBytes(result.size)} is the smallest verified result within the configured quality and dimension limits.`
          : `${formatBytes(result.size)} output verified locally.`,
      tone: result.targetSatisfied === false ? 'error' : 'success'
    });
  };

  useEffect(() => {
    if (!tool.file || !tool.validation?.supportedByConverter) return;
    const timeout = setTimeout(() => {
      void compress(true);
    }, 150);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.file, mode, outputFormat, quality, targetKb, targetResizeMode, requestedDimensions]);

  const reset = () => {
    setMode(requestedTarget ? 'target' : 'profile');
    setProfileId('balanced');
    setFormat('keep');
    setQuality(82);
    setTargetKb(requestedTarget ?? 500);
    setTargetResizeMode('allow-resize');
    setPreserveDimensions(true);
    setMaximumLongEdge(2560);
    setWebOptimized(false);
    setComparison(50);
  };

  return (
    <section className="converter-page tool-page optimize-page phase5-optimize-page">
      <header className="workspace-header">
        <div>
          <h1>Compress images</h1>
          <p>Reduce file size locally without sacrificing control.</p>
        </div>
      </header>

      <ImageToolInput
        file={tool.file}
        validation={tool.validation}
        sourceUrl={tool.sourceUrl}
        status={tool.status}
        error={tool.error}
        actionLabel="Choose an image to compress"
        onChoose={(file) => void tool.chooseFile(file)}
        onRemove={tool.removeFile}
      />

      {tool.file ? (
        <div
          className="optimize-layout phase5-optimize-layout"
          style={{ '--ambient-color': ambientColor } as React.CSSProperties}
        >
          <div className="optimize-main">
            <header className="optimize-controls-header">
              <button
                type="button"
                className="button button--secondary smart-suggest-btn"
                onClick={() => void applySmartSuggest()}
              >
                <Wand2 size={16} /> Smart Suggest
              </button>
            </header>
            <div
              className="tool-tabs phase5-mode-tabs"
              role="tablist"
              aria-label="Compression mode"
            >
              <button
                id="profile-tab"
                role="tab"
                aria-selected={mode === 'profile'}
                aria-controls="compression-panel"
                tabIndex={mode === 'profile' ? 0 : -1}
                type="button"
                onClick={() => changeMode('profile')}
                onKeyDown={onTabKeyDown}
              >
                <Gauge size={16} aria-hidden="true" /> Quality profile
              </button>
              <button
                id="target-tab"
                role="tab"
                aria-selected={mode === 'target'}
                aria-controls="compression-panel"
                tabIndex={mode === 'target' ? 0 : -1}
                type="button"
                onClick={() => changeMode('target')}
                onKeyDown={onTabKeyDown}
              >
                <Gauge size={16} aria-hidden="true" /> Target file size
              </button>
            </div>

            <div
              id="compression-panel"
              className="compression-controls phase5-compression-controls"
              role="tabpanel"
              aria-labelledby={mode === 'profile' ? 'profile-tab' : 'target-tab'}
            >
              {mode === 'profile' ? (
                <div className="profile-control-grid">
                  <label className="control-field">
                    <span>Quality profile</span>
                    <select
                      value={profileId}
                      disabled={tool.status === 'processing'}
                      onChange={(event) =>
                        applyProfile(event.currentTarget.value as CompressionProfileId)
                      }
                    >
                      {COMPRESSION_PROFILES.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                    <small>{selectedProfile.description}</small>
                  </label>
                  <OutputFormatField
                    format={format}
                    sourceFormat={sourceFormat}
                    automaticFormat={outputFormat}
                    disabled={tool.status === 'processing'}
                    onChange={(nextFormat) => {
                      setFormat(nextFormat);
                    }}
                  />
                  <label className="range-field compression-quality">
                    <span>
                      Quality
                      <span className="quality-value">
                        <output>{quality}</output> <em>{qualityDescription}</em>
                      </span>
                    </span>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={quality}
                      disabled={outputFormat === 'png' || tool.status === 'processing'}
                      onChange={(event) => {
                        setQuality(event.currentTarget.valueAsNumber);
                        setProfileId('balanced');
                      }}
                    />
                    <small>
                      {outputFormat === 'png'
                        ? 'PNG is lossless; encoder quality does not apply.'
                        : 'Lower quality makes a smaller file; higher quality retains more detail.'}
                    </small>
                  </label>
                  <label className="check-field phase5-check-field">
                    <input
                      type="checkbox"
                      checked={preserveDimensions}
                      onChange={(event) => {
                        setPreserveDimensions(event.currentTarget.checked);
                      }}
                    />
                    Preserve dimensions
                  </label>
                </div>
              ) : (
                <>
                  <fieldset className="target-size-presets">
                    <legend>Target file size</legend>
                    <div className="target-size-preset-row">
                      {TARGET_SIZE_PRESETS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={targetKb === value ? 'selected' : ''}
                          aria-pressed={targetKb === value}
                          onClick={() => {
                            setTargetKb(value);
                          }}
                        >
                          {formatTargetPreset(value)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={!targetPresetSelected ? 'selected' : ''}
                        aria-pressed={!targetPresetSelected}
                        onClick={() => document.getElementById('custom-target-size')?.focus()}
                      >
                        Custom
                      </button>
                    </div>
                  </fieldset>

                  <div className="target-control-grid">
                    <OutputFormatField
                      format={format}
                      sourceFormat={sourceFormat}
                      automaticFormat={outputFormat}
                      disabled={tool.status === 'processing'}
                      hidePng
                      onChange={(nextFormat) => {
                        setFormat(nextFormat);
                      }}
                    />
                    <label className="control-field target-field">
                      <span>Maximum file size</span>
                      <span className="number-with-unit">
                        <input
                          id="custom-target-size"
                          aria-label="Maximum file size in KB"
                          type="number"
                          min="10"
                          max="102400"
                          step="10"
                          value={targetKb}
                          disabled={tool.status === 'processing'}
                          onChange={(event) => {
                            setTargetKb(
                              Math.max(
                                10,
                                Math.min(102400, event.currentTarget.valueAsNumber || 10)
                              )
                            );
                          }}
                        />
                        <span>KB</span>
                      </span>
                    </label>
                    <fieldset className="target-strategy">
                      <legend>Target strategy</legend>
                      <label>
                        <input
                          type="radio"
                          name="target-strategy"
                          checked={targetResizeMode === 'quality-only'}
                          onChange={() => {
                            setTargetResizeMode('quality-only');
                          }}
                        />
                        Quality only
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="target-strategy"
                          checked={targetResizeMode === 'allow-resize'}
                          onChange={() => {
                            setTargetResizeMode('allow-resize');
                          }}
                        />
                        Allow resize
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="target-strategy"
                          checked={targetResizeMode === 'maximum-visual-quality'}
                          onChange={() => {
                            setTargetResizeMode('maximum-visual-quality');
                          }}
                        />
                        Maximum visual quality
                      </label>
                    </fieldset>
                  </div>
                  <div className="bounded-search-note">
                    <Sparkles size={16} aria-hidden="true" />
                    <span>
                      <strong>Maximum visual quality</strong> · bounded local search against actual
                      output bytes
                    </span>
                  </div>
                </>
              )}

              <div className="compression-advanced-row">
                <label className="check-field">
                  <input type="checkbox" checked disabled />
                  <span>
                    Remove metadata
                    <small>
                      {tool.output?.metadataRemovedVerified
                        ? 'Absence verified in output bytes'
                        : 'Re-encoding omits source metadata'}
                    </small>
                  </span>
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={webOptimized}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;

                      setWebOptimized(checked);
                      if (checked) {
                        setFormat('webp');
                        setPreserveDimensions(false);
                        setMaximumLongEdge(2560);
                      }
                    }}
                  />
                  Web optimization
                </label>
                <label className="control-field maximum-edge-field">
                  <span>Maximum long edge</span>
                  <span className="number-with-unit">
                    <input
                      type="number"
                      min="320"
                      max="32768"
                      step="160"
                      value={maximumLongEdge}
                      disabled={mode === 'profile' && preserveDimensions}
                      onChange={(event) => {
                        setMaximumLongEdge(
                          Math.max(320, Math.min(32768, event.currentTarget.valueAsNumber || 320))
                        );
                      }}
                    />
                    <span>px</span>
                  </span>
                </label>
              </div>
            </div>

            <ComparisonPreview
              sourceUrl={previewSourceUrl}
              outputUrl={tool.output?.url}
              comparison={comparison}
              onChange={setComparison}
            />
          </div>

          <aside
            className="tool-summary phase5-output-summary"
            aria-labelledby="compression-summary-title"
          >
            <h2 id="compression-summary-title">Output summary</h2>
            {tool.output ? (
              <>
                <div className="tool-summary__hero">
                  <small>Verified output</small>
                  <strong>{formatBytes(tool.output.size)}</strong>
                  <span className={tool.output.size <= tool.file.size ? 'positive' : 'negative'}>
                    {formatReduction(tool.file.size, tool.output.size)}
                  </span>
                  {fidelity !== undefined && (
                    <span className="fidelity-badge" title="Structural Similarity Fidelity">
                      {fidelity}% Fidelity
                    </span>
                  )}
                </div>
                <dl className="tool-summary__facts">
                  <div>
                    <dt>Dimensions</dt>
                    <dd>
                      {tool.output.width} × {tool.output.height}
                    </dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>{tool.output.mime.replace('image/', '').toUpperCase()}</dd>
                  </div>
                  {tool.output.qualityUsed === undefined ? null : (
                    <div>
                      <dt>Quality used</dt>
                      <dd>{Math.round(tool.output.qualityUsed * 100)}</dd>
                    </div>
                  )}
                  {tool.output.encodingPasses === undefined ? null : (
                    <div>
                      <dt>Encoder passes</dt>
                      <dd>{tool.output.encodingPasses}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Metadata</dt>
                    <dd>
                      {tool.output.metadataRemovedVerified ? 'Removal verified' : 'Review required'}
                    </dd>
                  </div>
                </dl>
                {tool.output.targetSatisfied === false ? (
                  <div className="target-warning" role="status">
                    <AlertTriangle size={16} aria-hidden="true" /> The configured quality and
                    dimension limits could not reach {targetKb} KB.
                  </div>
                ) : mode === 'target' ? (
                  <div className="verified-line">
                    <Check size={15} aria-hidden="true" /> Output decoded and verified · target met
                    against actual Blob
                  </div>
                ) : (
                  <div className="verified-line">
                    <Check size={15} aria-hidden="true" /> Output decoded and verified
                  </div>
                )}
                {tool.output.targetResizeApplied ? (
                  <small className="summary-note">
                    Dimensions were reduced only after minimum quality missed the target.
                  </small>
                ) : null}
              </>
            ) : (
              <div className="tool-summary__empty">
                <Gauge size={25} aria-hidden="true" />
                <strong>Ready to measure</strong>
                <span>Results appear after a real local encode—never an estimate.</span>
              </div>
            )}

            {tool.status === 'processing' ? (
              <div className="processing-line" role="status" aria-live="polite">
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
                {tool.stage ? stageLabels[tool.stage] : 'Processing'}
              </div>
            ) : null}

            {tool.output ? (
              <a
                className="button button--primary"
                href={tool.output.url}
                download={tool.output.filename}
              >
                <Download size={17} aria-hidden="true" /> Download optimized image
              </a>
            ) : (
              <button
                className="button button--primary"
                type="button"
                disabled={!canProcess}
                onClick={() => void compress()}
              >
                {tool.status === 'processing' ? (
                  <LoaderCircle className="spin" size={17} aria-hidden="true" />
                ) : (
                  <Gauge size={17} aria-hidden="true" />
                )}
                Compress image
              </button>
            )}

            {tool.status === 'processing' ? (
              <button className="button button--secondary" type="button" onClick={tool.cancel}>
                <X size={17} aria-hidden="true" /> Cancel
              </button>
            ) : (
              <button className="button button--secondary" type="button" onClick={reset}>
                <RotateCcw size={17} aria-hidden="true" /> Reset
              </button>
            )}

            <div className="tool-summary__privacy">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <strong>Processed entirely on this device</strong>
                <small>Your image never leaves the browser.</small>
              </span>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function OutputFormatField({
  format,
  sourceFormat,
  automaticFormat,
  disabled,
  hidePng = false,
  onChange
}: {
  readonly format: OutputChoice;
  readonly sourceFormat: string;
  readonly automaticFormat?: CoreImageFormat;
  readonly disabled: boolean;
  readonly hidePng?: boolean;
  readonly onChange: (format: OutputChoice) => void;
}) {
  return (
    <label className="control-field">
      <span>Output format</span>
      <select
        value={format}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as OutputChoice)}
      >
        <option value="keep">
          {['JPEG', 'PNG', 'WEBP'].includes(sourceFormat)
            ? `Keep original (${sourceFormat})`
            : `Automatic (${automaticFormat?.toUpperCase() ?? 'JPEG'})`}
        </option>
        <option value="jpeg">JPEG</option>
        <option value="webp">WebP</option>
        {hidePng ? null : <option value="png">PNG</option>}
      </select>
    </label>
  );
}

function ComparisonPreview({
  sourceUrl,
  outputUrl,
  comparison,
  onChange
}: {
  readonly sourceUrl: string | undefined;
  readonly outputUrl: string | undefined;
  readonly comparison: number;
  readonly onChange: (value: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const imageUrl = outputUrl ?? sourceUrl;

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(1, z * delta), 10));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    setIsPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || zoom === 1) return;
    setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDoubleClick = () => {
    setZoom((z) => (z > 1 ? 1 : 2.5));
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="phase5-comparison-wrapper">
      <div className="comparison-toolbar">
        <label className="diff-toggle" title="Highlight compression artifacts">
          <input
            type="checkbox"
            checked={showDiff}
            onChange={(e) => setShowDiff(e.target.checked)}
          />
          <Wand2 size={14} /> Artifact Diff Mode
        </label>
        {zoom > 1 && <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>}
      </div>
      <div
        className="phase5-comparison"
        aria-label="Image comparison preview"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
      >
        <div
          className="comparison-pan-layer"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center',
            width: '100%',
            height: '100%'
          }}
        >
          {sourceUrl ? (
            <img
              className="phase5-comparison__original"
              src={sourceUrl}
              alt="Original preview"
              draggable={false}
            />
          ) : (
            <div className="phase5-comparison__placeholder">
              Preview becomes available after local decoding.
            </div>
          )}

          {imageUrl ? (
            <div
              className="phase5-comparison__output"
              style={{ clipPath: `inset(0 0 0 ${comparison}%)` }}
            >
              <img src={imageUrl} alt="Optimized preview" draggable={false} />
            </div>
          ) : null}

          {showDiff && imageUrl && sourceUrl && (
            <div
              className="phase5-comparison__diff"
              style={{ clipPath: `inset(0 0 0 ${comparison}%)` }}
            >
              <img src={imageUrl} alt="Diff overlay" draggable={false} />
            </div>
          )}
        </div>

        <span className="phase5-comparison__label phase5-comparison__label--original">
          Original
        </span>
        <span className="phase5-comparison__label phase5-comparison__label--output">
          {outputUrl ? 'Optimized' : 'Output preview'}
        </span>
        <span
          className="phase5-comparison__divider"
          style={{ left: `${comparison}%` }}
          aria-hidden="true"
        />
        <input
          aria-label="Compare original and optimized image"
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={comparison}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        />
      </div>
    </div>
  );
}

function formatTargetPreset(kb: number) {
  return kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`;
}

function readTargetPreset() {
  const preset = new URLSearchParams(window.location.search).get('preset');
  if (!preset) return undefined;
  const match = /^(\d+)(kb|mb)$/i.exec(preset);
  if (!match?.[1] || !match[2]) return undefined;
  const value = Number(match[1]);
  return match[2].toLowerCase() === 'mb' ? value * 1024 : value;
}
