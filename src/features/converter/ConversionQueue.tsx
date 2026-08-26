import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clipboard,
  Download,
  Eye,
  FileImage,
  GripVertical,
  LoaderCircle,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { CoreImageFormat, ProcessingStage } from '../../types/images';
import { formatBytes } from '../../utils/format';
import { ConversionPreviewModal } from './ConversionPreviewModal';
import type { ConversionJob } from './types';

const stageLabels: Record<ProcessingStage, string> = {
  preparing: 'Preparing',
  decoding: 'Decoding',
  processing: 'Processing',
  encoding: 'Encoding',
  finalizing: 'Verifying output'
};

const stageOrder: readonly ProcessingStage[] = [
  'preparing',
  'decoding',
  'processing',
  'encoding',
  'finalizing'
];

export function ConversionQueue({
  jobs,
  allSelected,
  globalFormat,
  background,
  filenames,
  onSetAllSelected,
  onSetSelected,
  onSetFormatOverride,
  onCancel,
  onRetry,
  onRemove,
  onReorder
}: {
  readonly jobs: readonly ConversionJob[];
  readonly allSelected: boolean;
  readonly globalFormat: CoreImageFormat;
  readonly background: string;
  readonly filenames: ReadonlyMap<string, string>;
  readonly onSetAllSelected: (selected: boolean) => void;
  readonly onSetSelected: (id: string, selected: boolean) => void;
  readonly onSetFormatOverride: (id: string, format: CoreImageFormat | undefined) => void;
  readonly onCancel: (id: string) => void;
  readonly onRetry: (job: ConversionJob) => void;
  readonly onRemove: (id: string) => void;
  readonly onReorder?: (fromId: string, toId: string) => void;
}) {
  return (
    <div className="conversion-table">
      <div className="conversion-table__head">
        <span className="conversion-table__select">
          <input
            type="checkbox"
            aria-label="Select all files"
            checked={allSelected}
            onChange={(event) => onSetAllSelected(event.currentTarget.checked)}
          />
        </span>
        <span>File</span>
        <span aria-hidden="true" />
        <span>Convert to</span>
        <span>Status / Result</span>
        <span>Actions</span>
      </div>
      <ul className="conversion-list" aria-label="Conversion queue">
        {jobs.length === 0 ? (
          <li className="conversion-list__empty">No files match this queue filter.</li>
        ) : (
          jobs.map((job) => (
            <ConversionRow
              key={job.id}
              job={job}
              globalFormat={globalFormat}
              background={background}
              filename={filenames.get(job.id) ?? 'pixavelo-output'}
              onSetSelected={onSetSelected}
              onSetFormatOverride={onSetFormatOverride}
              onCancel={onCancel}
              onRetry={onRetry}
              onRemove={onRemove}
              {...(onReorder ? { onReorder } : {})}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function ConversionRow({
  job,
  globalFormat,
  background,
  filename,
  onSetSelected,
  onSetFormatOverride,
  onCancel,
  onRetry,
  onRemove,
  onReorder
}: {
  readonly job: ConversionJob;
  readonly globalFormat: CoreImageFormat;
  readonly background: string;
  readonly filename: string;
  readonly onSetSelected: (id: string, selected: boolean) => void;
  readonly onSetFormatOverride: (id: string, format: CoreImageFormat | undefined) => void;
  readonly onCancel: (id: string) => void;
  readonly onRetry: (job: ConversionJob) => void;
  readonly onRemove: (id: string) => void;
  readonly onReorder?: (fromId: string, toId: string) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const dragRef = useRef<string | null>(null);

  const format = (job.validation?.format ?? job.detectedFormat)?.toUpperCase() ?? 'Checking';
  const outputFormat = job.formatOverride ?? globalFormat;
  const mayHaveTransparency =
    outputFormat === 'jpeg' &&
    ['png', 'webp', 'avif', 'gif', 'svg', 'ico', 'heic', 'heif', 'tiff'].includes(
      job.validation?.format ?? ''
    );
  const statusLabel =
    job.status === 'processing' && job.stage
      ? stageLabels[job.stage]
      : job.status === 'unsupported'
        ? 'Unsupported'
        : job.status.charAt(0).toUpperCase() + job.status.slice(1);

  // Size-savings badge
  const sizeDelta = job.output ? job.output.size - job.file.size : null;
  const pctChange =
    sizeDelta !== null && job.file.size > 0
      ? Math.round((Math.abs(sizeDelta) / job.file.size) * 100)
      : null;

  // Thumbnail: show output when completed, otherwise source
  const thumbnailSrc =
    job.status === 'completed' && job.output ? job.output.url : job.previewUrl;
  const thumbnailClickable = job.status === 'completed' && job.output;

  const copyToClipboard = async () => {
    if (!job.output) return;
    try {
      const blob = job.output.blob;
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  return (
    <li
      className={`conversion-row conversion-row--${job.status}`}
      draggable={!!onReorder}
      onDragStart={() => {
        dragRef.current = job.id;
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={() => {
        if (dragRef.current && dragRef.current !== job.id && onReorder) {
          onReorder(dragRef.current, job.id);
        }
        dragRef.current = null;
      }}
    >
      <label className="conversion-row__select">
        <input
          type="checkbox"
          checked={job.selected}
          onChange={(event) => onSetSelected(job.id, event.currentTarget.checked)}
        />
        <span className="sr-only">Select {job.file.name}</span>
      </label>

      <span className="conversion-row__source">
        {/* Drag handle */}
        {onReorder && (
          <span className="conversion-row__drag" aria-hidden="true">
            <GripVertical size={14} />
          </span>
        )}
        {/* Thumbnail — clickable when completed */}
        <button
          type="button"
          className={`conversion-row__thumbnail${thumbnailClickable ? ' conversion-row__thumbnail--clickable' : ''}`}
          aria-label={thumbnailClickable ? `Preview ${job.file.name}` : undefined}
          disabled={!thumbnailClickable}
          onClick={() => thumbnailClickable && setPreviewOpen(true)}
        >
          {thumbnailSrc ? (
            <img src={thumbnailSrc} alt="" />
          ) : (
            <FileImage size={22} aria-hidden="true" />
          )}
          {thumbnailClickable && (
            <span className="conversion-row__thumbnail-hint" aria-hidden="true">
              <Eye size={14} />
            </span>
          )}
        </button>
        <span className="conversion-row__file">
          <strong title={job.file.name}>{job.file.name}</strong>
          <small>
            {format} · {formatBytes(job.file.size)}
          </small>
          {job.validation?.dimensions ? (
            <small>
              {job.validation.dimensions.width} × {job.validation.dimensions.height}
            </small>
          ) : null}
          {job.validation ? (
            <small className={`decoder-badge decoder-badge--${job.validation.decoder.route}`}>
              {job.validation.decoder.label}
              {job.validation.decoder.loadedOnDemand
                ? ' · on demand'
                : job.validation.decoder.fallbackLoadedOnDemand
                  ? ' · lazy fallback'
                  : ''}
            </small>
          ) : null}
        </span>
      </span>

      <ArrowRight className="conversion-row__arrow" size={17} aria-hidden="true" />

      <label className="conversion-row__format">
        <span className="sr-only">Output format for {job.file.name}</span>
        <select
          value={job.formatOverride ?? 'global'}
          disabled={job.status === 'processing' || !job.validation?.supportedByConverter}
          onChange={(event) => {
            const value = event.currentTarget.value;
            onSetFormatOverride(
              job.id,
              value === 'global' ? undefined : (value as CoreImageFormat)
            );
          }}
        >
          <option value="global">Global ({globalFormat.toUpperCase()})</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
        </select>
      </label>

      <span className="conversion-row__result" aria-live="polite">
        <strong>
          <StatusIcon status={job.status} /> {statusLabel}
        </strong>
        {job.status === 'processing' && job.stage ? <StageProgress stage={job.stage} /> : null}
        {job.output ? (
          <small>
            {formatBytes(job.output.size)} · {job.output.width} × {job.output.height} ·{' '}
            {(job.output.durationMs / 1000).toFixed(2)}s
          </small>
        ) : null}
        {/* Size-savings badge */}
        {pctChange !== null && sizeDelta !== null && job.status === 'completed' ? (
          <span
            className={`savings-badge savings-badge--${sizeDelta <= 0 ? 'savings' : 'growth'}`}
            aria-label={`${sizeDelta <= 0 ? 'Saved' : 'Grew by'} ${pctChange}%`}
          >
            {sizeDelta <= 0 ? '▼' : '▲'} {pctChange}%
          </span>
        ) : null}
        {job.error ? <em>{job.error}</em> : null}
        {mayHaveTransparency && job.status !== 'completed' ? (
          <em>
            Transparency will use <span className="inline-color" style={{ background }} />{' '}
            {background.toUpperCase()}.
          </em>
        ) : null}
        {job.validation?.warnings.map((warning, index) => (
          <em className="conversion-row__warning" key={`${warning.code}-${index}`}>
            {warning.message}
          </em>
        ))}
      </span>

      <span className="conversion-row__actions">
        {job.output ? (
          <>
            <a className="icon-button icon-button--small" href={job.output.url} download={filename}>
              <Download size={17} />
              <span className="sr-only">Download {filename}</span>
            </a>
            {/* Copy to clipboard */}
            <button
              className={`icon-button icon-button--small${copyState === 'copied' ? ' icon-button--success' : copyState === 'error' ? ' icon-button--error' : ''}`}
              type="button"
              title={copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy to clipboard'}
              onClick={() => void copyToClipboard()}
            >
              {copyState === 'copied' ? <Check size={15} /> : <Clipboard size={15} />}
              <span className="sr-only">Copy {filename} to clipboard</span>
            </button>
            {/* Preview */}
            <button
              className="icon-button icon-button--small"
              type="button"
              title="Preview"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye size={15} />
              <span className="sr-only">Preview {filename}</span>
            </button>
          </>
        ) : null}
        {job.status === 'processing' ? (
          <button
            className="icon-button icon-button--small"
            type="button"
            onClick={() => onCancel(job.id)}
          >
            <X size={17} />
            <span className="sr-only">Cancel {job.file.name}</span>
          </button>
        ) : job.status === 'failed' || job.status === 'cancelled' ? (
          <button
            className="icon-button icon-button--small"
            type="button"
            disabled={!job.validation?.supportedByConverter}
            onClick={() => onRetry(job)}
          >
            <RotateCcw size={16} />
            <span className="sr-only">Retry {job.file.name}</span>
          </button>
        ) : null}
        <button
          className="icon-button icon-button--small"
          type="button"
          disabled={job.status === 'processing'}
          onClick={() => onRemove(job.id)}
        >
          <Trash2 size={16} />
          <span className="sr-only">Remove {job.file.name}</span>
        </button>
      </span>

      {/* Preview modal */}
      {previewOpen && job.output ? (
        <ConversionPreviewModal
          job={job}
          filename={filename}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </li>
  );
}

function StatusIcon({ status }: { readonly status: ConversionJob['status'] }) {
  if (status === 'validating' || status === 'processing') {
    return <LoaderCircle className="spin" size={16} aria-hidden="true" />;
  }
  if (status === 'completed') return <Check size={16} aria-hidden="true" />;
  if (status === 'failed' || status === 'unsupported') {
    return <AlertTriangle size={16} aria-hidden="true" />;
  }
  if (status === 'cancelled') return <X size={16} aria-hidden="true" />;
  return <FileImage size={16} aria-hidden="true" />;
}

function StageProgress({ stage }: { readonly stage: ProcessingStage }) {
  const index = stageOrder.indexOf(stage);
  return (
    <span
      className="stage-progress"
      aria-label={`${stageLabels[stage]}, stage ${index + 1} of ${stageOrder.length}`}
    >
      <span className={`stage-progress__fill stage-progress__fill--${index + 1}`} />
    </span>
  );
}
