import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ChevronDown,
  CircleSlash2,
  Download,
  Files,
  FolderPlus,
  ImagePlus,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import { useNotifications } from '../../components/feedback/Notifications';
import { Dialog } from '../../components/ui/Dialog';
import { formatBytes } from '../../utils/format';
import { filesFromClipboardData, readClipboardImageFiles } from '../converter/clipboard';
import { useIntakeSessionConsumer } from '../tools/useIntakeSessionConsumer';
import { BatchQueue } from './BatchQueue';
import { BatchRecipePanel } from './BatchRecipePanel';
import { batchRecipeSummary } from './recipe';
import type { BatchJob, BatchQueueFilter } from './types';
import { useBatchQueue } from './useBatchQueue';

const EMPTY_INTAKE_FILES: readonly File[] = [];

export default function BatchPage() {
  const queue = useBatchQueue(EMPTY_INTAKE_FILES);
  useIntakeSessionConsumer(queue.addFiles);
  const addFiles = queue.addFiles;
  const { notify } = useNotifications();
  const [filter, setFilter] = useState<BatchQueueFilter>('all');
  const [detailsJob, setDetailsJob] = useState<BatchJob>();
  const [dragging, setDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!event.clipboardData) return;
      const files = filesFromClipboardData(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      const added = addFiles(files);
      notify({
        title: `${added} image${added === 1 ? '' : 's'} added`,
        ...(added < files.length
          ? { message: 'The remaining files exceeded the 500-file or 512 MiB intake budget.' }
          : {})
      });
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [addFiles, notify]);

  const counts = useMemo(
    () => ({
      all: queue.jobs.length,
      waiting: queue.jobs.filter((job) => ['preparing', 'waiting'].includes(job.status)).length,
      running: queue.jobs.filter((job) =>
        ['decoding', 'processing', 'encoding'].includes(job.status)
      ).length,
      completed: queue.jobs.filter((job) => job.status === 'completed').length,
      failed: queue.jobs.filter((job) => ['failed', 'cancelled'].includes(job.status)).length
    }),
    [queue.jobs]
  );
  const filteredJobs = useMemo(
    () => queue.jobs.filter((job) => matchesFilter(job, filter)),
    [filter, queue.jobs]
  );
  const allSelected = filteredJobs.length > 0 && filteredJobs.every((job) => job.selected);
  const active = queue.runState === 'running' || queue.runState === 'cancelling';
  const canStart = counts.waiting > 0 && !active;
  const canRetry = counts.failed > 0;
  const completedSelected = queue.jobs.filter(
    (job) => job.status === 'completed' && job.selected
  ).length;

  const pasteFromClipboard = async () => {
    try {
      const files = await readClipboardImageFiles();
      if (files.length === 0) throw new Error('No image was found on the clipboard.');
      const added = queue.addFiles(files);
      notify({
        title: `${added} image${added === 1 ? '' : 's'} added`,
        ...(added < files.length
          ? { message: 'The remaining files exceeded the 500-file or 512 MiB intake budget.' }
          : {})
      });
    } catch (error: unknown) {
      notify({
        title: 'Clipboard unavailable',
        message: error instanceof Error ? error.message : 'Use Ctrl/Cmd + V instead.',
        tone: 'error'
      });
    }
  };

  const addSelectedFiles = (files: FileList | null) => {
    if (!files) return;
    const added = queue.addFiles(files);
    if (added > 0)
      notify({
        title: `${added} image${added === 1 ? '' : 's'} added`,
        ...(added < files.length
          ? { message: 'The remaining files exceeded the 500-file or 512 MiB intake budget.' }
          : {})
      });
  };

  const downloadZip = async (selectedOnly: boolean) => {
    try {
      const blob = await queue.createCompletedZip(selectedOnly);
      downloadBlob(
        blob,
        `pixavelo-${selectedOnly ? 'selected' : 'batch'}-${new Date().toISOString().slice(0, 10)}.zip`
      );
      notify({
        title: selectedOnly ? 'Selected outputs archived' : 'Batch ZIP verified',
        message: 'CRC32 values were calculated locally before download.',
        tone: 'success'
      });
    } catch (error: unknown) {
      notify({
        title: 'ZIP export failed',
        message: error instanceof Error ? error.message : 'The archive could not be created.',
        tone: 'error'
      });
    }
  };

  return (
    <section
      className={`batch-page${dragging ? ' batch-page--dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        addSelectedFiles(event.dataTransfer.files);
      }}
    >
      <header className="batch-page__heading">
        <div>
          <h1>Batch Studio</h1>
          <p>Build one local recipe. Run it safely across every image.</p>
        </div>
      </header>

      <input
        ref={imageInputRef}
        data-batch-image-input
        className="sr-only"
        type="file"
        aria-label="Choose batch images"
        accept="image/*,.avif,.heic,.heif,.tif,.tiff,.svg,.ico"
        multiple
        onChange={(event) => {
          addSelectedFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={(node) => {
          folderInputRef.current = node;
          node?.setAttribute('webkitdirectory', '');
        }}
        data-batch-folder-input
        className="sr-only"
        type="file"
        aria-label="Choose image folder for batch"
        multiple
        onChange={(event) => {
          addSelectedFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />

      <div className="batch-toolbar">
        <button
          className="button button--secondary"
          type="button"
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus size={17} aria-hidden="true" /> Add images
        </button>
        <button
          className="button button--secondary batch-toolbar__folder"
          type="button"
          onClick={() => folderInputRef.current?.click()}
        >
          <FolderPlus size={17} aria-hidden="true" /> Add folder
        </button>
        <button
          className="button button--secondary batch-toolbar__paste"
          type="button"
          onClick={() => void pasteFromClipboard()}
        >
          <Files size={17} aria-hidden="true" /> Paste
        </button>
        <span className="batch-toolbar__count">{queue.jobs.length} files</span>
        <button
          className="button button--primary batch-toolbar__start"
          type="button"
          disabled={!canStart && queue.runState !== 'paused'}
          onClick={queue.runState === 'paused' ? queue.resume : queue.start}
        >
          <Play size={17} aria-hidden="true" />
          {queue.runState === 'paused' ? 'Resume batch' : 'Start batch'}
        </button>
      </div>

      <div className="batch-command-row" aria-label="Queue controls">
        {queue.runState === 'paused' ? (
          <button type="button" onClick={queue.resume}>
            <Play size={16} aria-hidden="true" /> Resume
          </button>
        ) : (
          <button type="button" disabled={queue.runState !== 'running'} onClick={queue.pause}>
            <Pause size={16} aria-hidden="true" /> Pause
          </button>
        )}
        <button
          type="button"
          disabled={!active && queue.runState !== 'paused'}
          onClick={queue.cancelAll}
        >
          <CircleSlash2 size={16} aria-hidden="true" /> Cancel
        </button>
        <button
          type="button"
          disabled={!canRetry || queue.runState === 'cancelling'}
          onClick={() => {
            const retried = queue.retryFailed();
            notify({ title: `${retried} job${retried === 1 ? '' : 's'} queued for retry` });
          }}
        >
          <RotateCcw size={16} aria-hidden="true" /> Retry failed
        </button>
        <button type="button" disabled={counts.completed === 0} onClick={queue.clearCompleted}>
          <Trash2 size={16} aria-hidden="true" /> Clear completed
        </button>
        <button type="button" disabled={queue.jobs.length === 0} onClick={queue.removeSelected}>
          <X size={16} aria-hidden="true" /> Remove selected
        </button>
        <button type="button" disabled={queue.jobs.length === 0} onClick={queue.clearQueue}>
          Clear queue
        </button>
      </div>

      <details className="batch-mobile-recipe">
        <summary>
          <Layers3 size={19} aria-hidden="true" />
          <span>
            <strong>Batch recipe</strong>
            <small>{batchRecipeSummary(queue.recipe)}</small>
          </span>
          <span>Edit</span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <BatchRecipePanel
          recipe={queue.recipe}
          disabled={active}
          onChange={queue.setRecipe}
          onApply={queue.applyRecipe}
          onSave={() => {
            queue.saveRecipe();
            notify({ title: 'Batch preset saved', tone: 'success' });
          }}
        />
      </details>

      <div className="batch-layout">
        <div className="batch-workspace">
          <div className="batch-filters" role="tablist" aria-label="Batch queue filter">
            {(['all', 'waiting', 'running', 'completed', 'failed'] as const).map((value) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={filter === value}
                className={filter === value ? 'batch-filter--active' : undefined}
                onClick={() => setFilter(value)}
              >
                {filterLabel(value)} <span>{counts[value]}</span>
              </button>
            ))}
            <span className="batch-filters__selection">
              {queue.jobs.filter((job) => job.selected).length} selected
            </span>
          </div>

          {queue.jobs.length === 0 ? (
            <button
              className="batch-empty"
              type="button"
              onClick={() => imageInputRef.current?.click()}
            >
              <Layers3 size={28} aria-hidden="true" />
              <strong>Build a batch from local images</strong>
              <span>Drop files here or choose hundreds at once. Nothing is uploaded.</span>
              <small>JPEG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, GIF, BMP, SVG and ICO</small>
            </button>
          ) : filteredJobs.length === 0 ? (
            <div className="batch-empty batch-empty--filtered" role="status">
              <Archive size={25} aria-hidden="true" />
              <strong>No jobs in this view</strong>
              <span>Choose another queue filter.</span>
            </div>
          ) : (
            <BatchQueue
              jobs={filteredJobs}
              allSelected={allSelected}
              onSetAllSelected={(selected) => {
                const visibleIds = new Set(filteredJobs.map((job) => job.id));
                for (const job of queue.jobs) {
                  if (visibleIds.has(job.id)) queue.setSelected(job.id, selected);
                }
              }}
              onSetSelected={queue.setSelected}
              onCancel={queue.cancelJob}
              onRetry={queue.retryJob}
              onRemove={queue.removeJob}
              onShowDetails={setDetailsJob}
            />
          )}

          <BatchStatistics
            statistics={queue.statistics}
            completedSelected={completedSelected}
            onDownloadSelected={() => void downloadZip(true)}
            onDownloadAll={() => void downloadZip(false)}
          />
        </div>

        <BatchRecipePanel
          recipe={queue.recipe}
          disabled={active}
          onChange={queue.setRecipe}
          onApply={queue.applyRecipe}
          onSave={() => {
            queue.saveRecipe();
            notify({ title: 'Batch preset saved', tone: 'success' });
          }}
        />
      </div>

      <Dialog
        open={Boolean(detailsJob)}
        title={detailsJob ? `Job details for ${detailsJob.file.name}` : 'Job details'}
        onClose={() => setDetailsJob(undefined)}
        className="batch-details-dialog"
      >
        {detailsJob ? (
          <div className="batch-details">
            <header>
              <div>
                <h2>Job details</h2>
                <p>{detailsJob.file.name}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close job details"
                onClick={() => setDetailsJob(undefined)}
              >
                <X size={18} />
              </button>
            </header>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{statusText(detailsJob)}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{formatBytes(detailsJob.file.size)}</dd>
              </div>
              <div>
                <dt>Attempt</dt>
                <dd>{detailsJob.attempt + 1}</dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd>{detailsJob.output ? formatBytes(detailsJob.output.size) : 'Not available'}</dd>
              </div>
              <div>
                <dt>Metadata</dt>
                <dd>
                  {detailsJob.output?.metadataRemovedVerified ? 'Removal verified' : 'Pending'}
                </dd>
              </div>
            </dl>
            {detailsJob.error ? (
              <div className="batch-details__error" role="alert">
                <strong>{detailsJob.error}</strong>
                <p>
                  Possible reasons include unsupported compression, damaged bytes, a browser memory
                  limit, or an unavailable codec.
                </p>
                {detailsJob.errorCode ? (
                  <small>Diagnostic code: {detailsJob.errorCode}</small>
                ) : null}
              </div>
            ) : null}
            <footer>
              {detailsJob.status === 'failed' || detailsJob.status === 'cancelled' ? (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => {
                    queue.retryJob(detailsJob.id);
                    setDetailsJob(undefined);
                  }}
                >
                  <RotateCcw size={16} /> Retry
                </button>
              ) : null}
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  queue.removeJob(detailsJob.id);
                  setDetailsJob(undefined);
                }}
              >
                <Trash2 size={16} /> Remove
              </button>
            </footer>
          </div>
        ) : null}
      </Dialog>
    </section>
  );
}

function BatchStatistics({
  statistics,
  completedSelected,
  onDownloadSelected,
  onDownloadAll
}: {
  readonly statistics: ReturnType<typeof useBatchQueue>['statistics'];
  readonly completedSelected: number;
  readonly onDownloadSelected: () => void;
  readonly onDownloadAll: () => void;
}) {
  const values = [
    [statistics.selected, 'selected'],
    [statistics.completed, 'completed'],
    [statistics.failed, 'failed'],
    [statistics.remaining, 'remaining'],
    [formatBytes(statistics.sourceBytes), 'source'],
    [formatBytes(statistics.outputBytes), 'output'],
    [`${statistics.reductionPercent.toFixed(1)}%`, 'reduction'],
    [formatDuration(statistics.durationMs), 'elapsed'],
    [statistics.throughputPerMinute.toFixed(1), 'files/min']
  ] as const;

  return (
    <section className="batch-stats" aria-label="Batch statistics">
      <div className="batch-stats__values">
        {values.map(([value, label]) => (
          <span key={label} className={`batch-stat batch-stat--${label.replace('/', '-')}`}>
            <strong>{value}</strong>
            <small>{label}</small>
          </span>
        ))}
      </div>
      <div className="batch-stats__actions">
        <button
          className="button button--secondary"
          type="button"
          disabled={completedSelected === 0}
          onClick={onDownloadSelected}
        >
          <Download size={16} /> Download completed
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={statistics.completed === 0}
          onClick={onDownloadAll}
        >
          <Archive size={16} /> Download ZIP
        </button>
      </div>
      <p>
        <ShieldCheck size={15} aria-hidden="true" /> One failed file never stops the queue.
      </p>
    </section>
  );
}

function matchesFilter(job: BatchJob, filter: BatchQueueFilter) {
  if (filter === 'all') return true;
  if (filter === 'waiting') return ['preparing', 'waiting'].includes(job.status);
  if (filter === 'running') return ['decoding', 'processing', 'encoding'].includes(job.status);
  if (filter === 'failed') return ['failed', 'cancelled'].includes(job.status);
  return job.status === filter;
}

function filterLabel(filter: BatchQueueFilter) {
  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

function statusText(job: BatchJob) {
  return job.status.charAt(0).toUpperCase() + job.status.slice(1);
}

function formatDuration(durationMs: number) {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
