import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileImage,
  LoaderCircle,
  MoreVertical,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import type { ProcessingStage } from '../../types/images';
import { formatBytes } from '../../utils/format';
import type { BatchJob } from './types';
import { calculateVirtualWindow } from './virtualWindow';

const STAGES: readonly ProcessingStage[] = [
  'preparing',
  'decoding',
  'processing',
  'encoding',
  'finalizing'
];

const STAGE_LABELS: Record<ProcessingStage, string> = {
  preparing: 'Preparing',
  decoding: 'Decoding',
  processing: 'Processing',
  encoding: 'Encoding',
  finalizing: 'Verifying output'
};

export function BatchQueue({
  jobs,
  allSelected,
  onSetAllSelected,
  onSetSelected,
  onCancel,
  onRetry,
  onRemove,
  onShowDetails
}: {
  readonly jobs: readonly BatchJob[];
  readonly allSelected: boolean;
  readonly onSetAllSelected: (selected: boolean) => void;
  readonly onSetSelected: (id: string, selected: boolean) => void;
  readonly onCancel: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onShowDetails: (job: BatchJob) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [mobile, setMobile] = useState(false);
  const deferredScrollTop = useDeferredValue(scrollTop);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const rowHeight = mobile ? 80 : 70;
  const viewportHeight = mobile ? 594 : 490;
  const shouldVirtualize = jobs.length > 40;
  const windowed = useMemo(
    () =>
      shouldVirtualize
        ? calculateVirtualWindow(jobs.length, rowHeight, viewportHeight, deferredScrollTop)
        : { start: 0, end: jobs.length, before: 0, after: 0 },
    [deferredScrollTop, jobs.length, rowHeight, shouldVirtualize, viewportHeight]
  );
  const visibleJobs = jobs.slice(windowed.start, windowed.end);

  return (
    <div className="batch-table">
      <div className="batch-table__head" aria-hidden="true">
        <span>
          <input
            aria-label="Select all files"
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onSetAllSelected(event.currentTarget.checked)}
          />
        </span>
        <span>File</span>
        <span>Source</span>
        <span>Output</span>
        <span>Stage</span>
        <span>Result</span>
        <span>Actions</span>
      </div>
      <ul
        className={`batch-list${shouldVirtualize ? ' batch-list--virtual' : ''}`}
        aria-label="Batch queue"
        onScroll={
          shouldVirtualize ? (event) => setScrollTop(event.currentTarget.scrollTop) : undefined
        }
      >
        {windowed.before > 0 ? (
          <li
            className="batch-list__spacer"
            style={{ height: windowed.before }}
            aria-hidden="true"
          />
        ) : null}
        {visibleJobs.map((job, localIndex) => (
          <BatchRow
            key={job.id}
            job={job}
            position={windowed.start + localIndex + 1}
            total={jobs.length}
            onSetSelected={onSetSelected}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
            onShowDetails={onShowDetails}
          />
        ))}
        {windowed.after > 0 ? (
          <li
            className="batch-list__spacer"
            style={{ height: windowed.after }}
            aria-hidden="true"
          />
        ) : null}
      </ul>
    </div>
  );
}

function BatchRow({
  job,
  position,
  total,
  onSetSelected,
  onCancel,
  onRetry,
  onRemove,
  onShowDetails
}: {
  readonly job: BatchJob;
  readonly position: number;
  readonly total: number;
  readonly onSetSelected: (id: string, selected: boolean) => void;
  readonly onCancel: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onShowDetails: (job: BatchJob) => void;
}) {
  const sourceFormat = job.validation?.format.toUpperCase() ?? 'Checking';
  const outputFormat = job.output?.mime.replace('image/', '').toUpperCase() ?? 'WEBP';
  const status = statusLabel(job);
  const active = ['preparing', 'decoding', 'processing', 'encoding'].includes(job.status);

  return (
    <li
      className={`batch-row batch-row--${job.status}`}
      aria-posinset={position}
      aria-setsize={total}
    >
      <label className="batch-row__select">
        <input
          type="checkbox"
          checked={job.selected}
          onChange={(event) => onSetSelected(job.id, event.currentTarget.checked)}
        />
        <span className="sr-only">Select {job.file.name}</span>
      </label>

      <span className="batch-row__file">
        <span className="batch-row__thumbnail" aria-hidden="true">
          {job.previewUrl ? <img src={job.previewUrl} alt="" /> : <FileImage size={22} />}
        </span>
        <span>
          <strong title={job.file.name}>{job.file.name}</strong>
          <small>
            {sourceFormat} · {formatBytes(job.file.size)}
          </small>
          <small className="batch-row__mobile-target">
            → {outputFormat} · {outputDimensions(job)}
          </small>
        </span>
      </span>

      <span className="batch-row__source">
        <strong>{sourceFormat}</strong>
        <small>{formatBytes(job.file.size)}</small>
        <small>
          {job.validation?.dimensions
            ? `${job.validation.dimensions.width} × ${job.validation.dimensions.height}`
            : 'Dimensions pending'}
        </small>
      </span>

      <span className="batch-row__output">
        <strong>{outputFormat}</strong>
        <small>{outputDimensions(job)}</small>
        {job.outputName ? <small title={job.outputName}>{job.outputName}</small> : null}
      </span>

      <span className="batch-row__stage" aria-live="polite">
        <strong className={`batch-status batch-status--${job.status}`}>
          <StatusIcon job={job} /> {status}
        </strong>
        {active && job.stage ? <StageProgress stage={job.stage} /> : null}
        {job.status === 'failed' || job.status === 'cancelled' ? (
          <span className="batch-row__inline-recovery">
            <button type="button" onClick={() => onRetry(job.id)}>
              Retry
            </button>
            <button type="button" onClick={() => onShowDetails(job)}>
              Details
            </button>
          </span>
        ) : null}
      </span>

      <span className="batch-row__result">
        {job.output ? (
          <>
            <strong>{formatBytes(job.output.size)}</strong>
            <small>
              {job.output.width} × {job.output.height}
            </small>
          </>
        ) : job.error ? (
          <em>{job.error}</em>
        ) : (
          <small>—</small>
        )}
      </span>

      <span className="batch-row__actions">
        {job.output ? (
          <a
            className="icon-button icon-button--small"
            href={job.output.url}
            download={job.output.filename}
          >
            <Download size={16} aria-hidden="true" />
            <span className="sr-only">Download {job.output.filename}</span>
          </a>
        ) : null}
        {active ? (
          <button
            className="icon-button icon-button--small"
            type="button"
            onClick={() => onCancel(job.id)}
          >
            <X size={16} aria-hidden="true" />
            <span className="sr-only">Cancel {job.file.name}</span>
          </button>
        ) : job.status === 'failed' || job.status === 'cancelled' ? (
          <button
            className="icon-button icon-button--small"
            type="button"
            onClick={() => onRetry(job.id)}
          >
            <RotateCcw size={16} aria-hidden="true" />
            <span className="sr-only">Retry {job.file.name}</span>
          </button>
        ) : null}
        <button
          className="icon-button icon-button--small"
          type="button"
          onClick={() => onRemove(job.id)}
        >
          <Trash2 size={16} aria-hidden="true" />
          <span className="sr-only">Remove {job.file.name}</span>
        </button>
        <button
          className="icon-button icon-button--small batch-row__more"
          type="button"
          onClick={() => onShowDetails(job)}
        >
          <MoreVertical size={16} aria-hidden="true" />
          <span className="sr-only">Details for {job.file.name}</span>
        </button>
      </span>
    </li>
  );
}

function StatusIcon({ job }: { readonly job: BatchJob }) {
  if (job.status === 'completed') return <CheckCircle2 size={16} aria-hidden="true" />;
  if (job.status === 'failed') return <AlertCircle size={16} aria-hidden="true" />;
  if (job.status === 'cancelled') return <X size={16} aria-hidden="true" />;
  if (['preparing', 'decoding', 'processing', 'encoding'].includes(job.status)) {
    return <LoaderCircle className="spin" size={16} aria-hidden="true" />;
  }
  return <span className="batch-status__waiting" aria-hidden="true" />;
}

function StageProgress({ stage }: { readonly stage: ProcessingStage }) {
  const activeIndex = STAGES.indexOf(stage);
  return (
    <span className="batch-stage-progress" aria-label={`${STAGE_LABELS[stage]} stage`}>
      {STAGES.map((candidate, index) => (
        <span
          key={candidate}
          className={index <= activeIndex ? 'batch-stage-progress__active' : undefined}
        />
      ))}
    </span>
  );
}

function statusLabel(job: BatchJob) {
  if (job.stage) return STAGE_LABELS[job.stage];
  return job.status.charAt(0).toUpperCase() + job.status.slice(1);
}

function outputDimensions(job: BatchJob) {
  if (job.output) return `${job.output.width} × ${job.output.height}`;
  if (job.validation?.dimensions) return 'Recipe dimensions';
  return 'Pending';
}
