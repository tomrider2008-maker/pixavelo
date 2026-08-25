import {
  Archive,
  Clipboard,
  Download,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  Play,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotifications } from '../../components/feedback/Notifications';
import { createZipBlob } from '../../engine/export/createZip';
import { toAppError } from '../../engine/errors/AppError';
import { clearIntakeSession, getIntakeSession } from '../../services/intakeSession';
import type { CoreImageFormat } from '../../types/images';
import { formatBytes } from '../../utils/format';
import { filesFromClipboardData, readClipboardImageFiles } from './clipboard';
import { AdvancedFormatCapabilities } from './AdvancedFormatCapabilities';
import { ConversionQueue } from './ConversionQueue';
import { ConversionSettingsPanel } from './ConversionSettingsPanel';
import { buildConversionFilename, deduplicateFilenames } from './naming';
import type { ConversionJob, ConversionQueueFilter } from './types';
import { useConversionQueue } from './useConversionQueue';

interface IntakeLocationState {
  readonly sessionId?: string;
}

export default function ConverterPage() {
  const location = useLocation();
  const state = location.state as IntakeLocationState | null;
  const initialFiles = useMemo(() => getIntakeSession(state?.sessionId), [state?.sessionId]);
  const queue = useConversionQueue(initialFiles, readRequestedFormat());
  const [filter, setFilter] = useState<ConversionQueueFilter>('all');
  const [dragging, setDragging] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const archiveControllerRef = useRef<AbortController | undefined>(undefined);
  const { notify } = useNotifications();
  const enqueueFiles = queue.addFiles;

  useEffect(() => {
    clearIntakeSession(state?.sessionId);
  }, [state?.sessionId]);

  useEffect(
    () => () => {
      archiveControllerRef.current?.abort();
    },
    []
  );

  const addFiles = useCallback(
    (files: FileList | readonly File[], source: string) => {
      const requested = files.length;
      const count = enqueueFiles(files);
      if (count > 0) {
        notify({
          title: `${count} file${count === 1 ? '' : 's'} added`,
          message:
            count < requested
              ? `${source} files were capped by the 500-file or 512 MiB intake budget.`
              : `${source} files are being validated locally.`
        });
      }
      return count;
    },
    [enqueueFiles, notify]
  );

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (!event.clipboardData) return;
      const files = filesFromClipboardData(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        addFiles(files, 'Pasted');
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  const pasteFromClipboard = async () => {
    try {
      const files = await readClipboardImageFiles();
      if (files.length === 0) {
        notify({
          title: 'No image found',
          message: 'Copy an image, then use Paste or press Ctrl/Cmd + V.'
        });
        return;
      }
      addFiles(files, 'Clipboard');
    } catch {
      notify({
        title: 'Use the keyboard to paste',
        message:
          'This browser does not allow clipboard reading from the button. Press Ctrl/Cmd + V.',
        tone: 'error'
      });
    }
  };

  const processAll = async () => {
    const result = await queue.processReadyJobs();
    if (result.attempted === 0) return;
    notify({
      title: result.failed === 0 ? 'Local processing finished' : 'Some files need attention',
      message: `${result.completed} of ${result.attempted} outputs were decoded and verified.`,
      tone: result.failed === 0 ? 'success' : 'error'
    });
  };

  const retryJob = async (job: ConversionJob) => {
    const result = await queue.processReadyJobs(new Set([job.id]));
    notify({
      title: result.completed === 1 ? 'Output verified' : 'Retry did not complete',
      message:
        result.completed === 1
          ? `${job.file.name} is ready to download.`
          : 'The file remains in the queue with its latest error.',
      tone: result.completed === 1 ? 'success' : 'error'
    });
  };

  const filenames = useMemo(() => {
    const raw = queue.jobs.map((job, index) =>
      buildConversionFilename(
        job.file.name,
        job.formatOverride ?? queue.settings.outputFormat,
        queue.settings.namingPattern,
        index
      )
    );
    const unique = deduplicateFilenames(raw);
    return new Map(
      queue.jobs.map((job, index) => [job.id, unique[index] ?? raw[index] ?? 'pixavelo-output.jpg'])
    );
  }, [queue.jobs, queue.settings.namingPattern, queue.settings.outputFormat]);

  const completedJobs = queue.jobs.filter(
    (job): job is ConversionJob & { readonly output: NonNullable<ConversionJob['output']> } =>
      job.status === 'completed' && job.output !== undefined
  );
  const counts = countStatuses(queue.jobs);
  const processing = counts.active > 0;
  const pending = counts.ready + counts.validating;
  const sourceTotal = queue.jobs.reduce((total, job) => total + job.file.size, 0);
  const outputTotal = completedJobs.reduce((total, job) => total + job.output.size, 0);
  const selectedCount = queue.jobs.filter((job) => job.selected).length;
  const visibleJobs = queue.jobs.filter((job) => matchesFilter(job, filter));
  const allSelected = queue.jobs.length > 0 && selectedCount === queue.jobs.length;

  const downloadCompleted = async (requireSettled: boolean) => {
    if (completedJobs.length === 0) return;
    if (completedJobs.length === 1 && !requireSettled) {
      const [job] = completedJobs;
      if (job) triggerDownload(job.output.url, filenames.get(job.id) ?? 'pixavelo-output');
      return;
    }

    const controller = new AbortController();
    archiveControllerRef.current?.abort();
    archiveControllerRef.current = controller;
    setArchiveBusy(true);
    setArchiveProgress(`Preparing 0 of ${completedJobs.length}`);
    try {
      const archive = await createZipBlob(
        completedJobs.map((job) => ({
          name: filenames.get(job.id) ?? 'pixavelo-output',
          blob: job.output.blob,
          modifiedAt: new Date(job.file.lastModified || Date.now())
        })),
        {
          signal: controller.signal,
          onProgress: (completed, total) => setArchiveProgress(`Preparing ${completed} of ${total}`)
        }
      );
      const url = URL.createObjectURL(archive);
      triggerDownload(url, buildArchiveName());
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      notify({
        title: 'ZIP archive verified',
        message: `${completedJobs.length} outputs were packaged locally.`,
        tone: 'success'
      });
    } catch (error: unknown) {
      const appError = toAppError(error, 'ZIP_FAILED');
      if (appError.code !== 'CANCELLED') {
        notify({
          title: 'Archive could not be created',
          message: appError.userMessage,
          tone: 'error'
        });
      }
    } finally {
      if (archiveControllerRef.current === controller) archiveControllerRef.current = undefined;
      setArchiveBusy(false);
      setArchiveProgress(undefined);
    }
  };

  const cancelRemaining = () => {
    queue.cancelAll();
    archiveControllerRef.current?.abort();
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files, 'Dropped');
  };

  return (
    <section
      className={`converter-page converter-workspace${dragging ? ' converter-workspace--dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="workspace-header">
        <div>
          <h1>Convert images</h1>
          <p>
            <span className="converter-copy--desktop">
              Convert mixed image files locally. Review every output before download.
            </span>
            <span className="converter-copy--mobile">Convert mixed files locally.</span>
          </p>
        </div>
      </header>

      <div className="converter-toolbar" aria-label="Converter commands">
        <button
          className="button button--secondary"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus size={18} aria-hidden="true" /> Add images
        </button>
        <button
          className="button button--secondary converter-toolbar__folder"
          type="button"
          onClick={() => folderInputRef.current?.click()}
        >
          <FolderOpen size={18} aria-hidden="true" /> Add folder
        </button>
        <button
          className="button button--secondary converter-toolbar__paste"
          type="button"
          onClick={() => void pasteFromClipboard()}
        >
          <Clipboard size={17} aria-hidden="true" /> Paste
        </button>
        <input
          ref={inputRef}
          data-image-input
          className="sr-only"
          type="file"
          aria-label="Choose image files"
          accept="image/*,.jfif,.heic,.heif,.tif,.tiff,.ico"
          multiple
          onChange={(event) => {
            addFiles(event.currentTarget.files ?? [], 'Selected');
            event.currentTarget.value = '';
          }}
        />
        <input
          ref={(node) => {
            folderInputRef.current = node;
            node?.setAttribute('webkitdirectory', '');
          }}
          data-folder-input
          className="sr-only"
          type="file"
          aria-label="Choose image folder"
          multiple
          onChange={(event) => {
            addFiles(event.currentTarget.files ?? [], 'Folder');
            event.currentTarget.value = '';
          }}
        />
        <AdvancedFormatCapabilities />
        <span className="converter-toolbar__count">
          {queue.jobs.length} file{queue.jobs.length === 1 ? '' : 's'}
          {selectedCount > 0 && selectedCount !== queue.jobs.length
            ? ` · ${selectedCount} selected`
            : ''}
        </span>
        {selectedCount > 0 ? (
          <button
            className="button button--quiet converter-toolbar__remove"
            type="button"
            onClick={queue.removeSelected}
            disabled={processing}
          >
            <Trash2 size={16} aria-hidden="true" /> Remove selected
          </button>
        ) : null}
        <button
          className="button button--primary"
          type="button"
          disabled={pending === 0 || processing}
          onClick={() => void processAll()}
        >
          {processing ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />}
          Process all
        </button>
      </div>

      <div className="converter-layout">
        <main className="converter-queue">
          {queue.jobs.length === 0 ? (
            <button
              className="converter-empty"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus size={36} aria-hidden="true" />
              <strong>Add or drop images to begin</strong>
              <span>Core and advanced image formats can be mixed in one verified local queue.</span>
            </button>
          ) : (
            <>
              <div className="queue-filters" role="tablist" aria-label="Filter conversion queue">
                <FilterButton
                  id="all"
                  label="All"
                  count={queue.jobs.length}
                  active={filter === 'all'}
                  onSelect={setFilter}
                />
                <FilterButton
                  id="ready"
                  label="Ready"
                  count={counts.ready}
                  active={filter === 'ready'}
                  onSelect={setFilter}
                />
                <FilterButton
                  id="active"
                  label="Processing"
                  count={counts.active}
                  active={filter === 'active'}
                  onSelect={setFilter}
                />
                <FilterButton
                  id="completed"
                  label="Completed"
                  count={counts.completed}
                  active={filter === 'completed'}
                  onSelect={setFilter}
                />
                {counts.issues > 0 ? (
                  <FilterButton
                    id="issues"
                    label="Issues"
                    count={counts.issues}
                    active={filter === 'issues'}
                    onSelect={setFilter}
                  />
                ) : null}
              </div>
              <ConversionQueue
                jobs={visibleJobs}
                allSelected={allSelected}
                globalFormat={queue.settings.outputFormat}
                background={queue.settings.background}
                filenames={filenames}
                onSetAllSelected={queue.setAllSelected}
                onSetSelected={queue.setSelected}
                onSetFormatOverride={queue.setFormatOverride}
                onCancel={queue.cancelJob}
                onRetry={(job) => void retryJob(job)}
                onRemove={queue.removeJob}
              />
            </>
          )}
        </main>

        <ConversionSettingsPanel
          settings={queue.settings}
          disabled={processing}
          onSetSettings={queue.setSettings}
          onUpdateSettings={queue.updateSettings}
        />
      </div>

      {queue.jobs.length > 0 ? (
        <footer className="converter-summary" aria-label="Queue summary">
          <div className="converter-summary__statuses">
            <span className="status-count status-count--complete">
              {counts.completed} completed
            </span>
            <span className="status-count status-count--active">{counts.active} processing</span>
            <span className="status-count status-count--ready">{counts.ready} ready</span>
          </div>
          <div className="converter-summary__size">
            <strong>{formatBytes(sourceTotal)}</strong>
            <small>Source total</small>
          </div>
          <div className="converter-summary__size converter-summary__size--output">
            <strong>{formatBytes(outputTotal)}</strong>
            <small>Output available</small>
          </div>
          <div className="converter-summary__actions">
            <button
              className="button button--primary converter-summary__mobile-process"
              type="button"
              disabled={pending === 0 || processing}
              onClick={() => void processAll()}
            >
              <Play size={17} aria-hidden="true" /> Process remaining
            </button>
            {completedJobs.length > 0 ? (
              <button
                className="button button--secondary converter-summary__desktop-action"
                type="button"
                disabled={archiveBusy}
                onClick={() => void downloadCompleted(false)}
              >
                <Download size={17} aria-hidden="true" /> Download completed
              </button>
            ) : null}
            <button
              className="button button--primary converter-summary__zip"
              type="button"
              disabled={archiveBusy || completedJobs.length < 2 || pending > 0 || processing}
              onClick={() => void downloadCompleted(true)}
            >
              {archiveBusy ? <LoaderCircle className="spin" size={17} /> : <Archive size={17} />}
              {archiveProgress ?? 'Download ZIP'}
            </button>
            {processing || archiveBusy ? (
              <button className="button button--quiet" type="button" onClick={cancelRemaining}>
                <X size={16} aria-hidden="true" /> Cancel remaining
              </button>
            ) : counts.completed > 0 ? (
              <button
                className="button button--quiet converter-summary__desktop-action"
                type="button"
                onClick={queue.clearCompleted}
              >
                Clear completed
              </button>
            ) : null}
          </div>
          <div className="converter-summary__privacy">
            <ShieldCheck size={16} aria-hidden="true" /> Processed entirely on this device
          </div>
        </footer>
      ) : null}

      {dragging ? <div className="converter-drop-overlay">Release to add files</div> : null}
    </section>
  );
}

function FilterButton({
  id,
  label,
  count,
  active,
  onSelect
}: {
  readonly id: ConversionQueueFilter;
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly onSelect: (filter: ConversionQueueFilter) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? 'queue-filter queue-filter--active' : 'queue-filter'}
      onClick={() => onSelect(id)}
    >
      {label} <span>{count}</span>
    </button>
  );
}

function countStatuses(jobs: readonly ConversionJob[]) {
  return {
    validating: jobs.filter((job) => job.status === 'validating').length,
    ready: jobs.filter((job) => job.status === 'ready').length,
    active: jobs.filter((job) => job.status === 'processing').length,
    completed: jobs.filter((job) => job.status === 'completed').length,
    issues: jobs.filter((job) => ['failed', 'unsupported', 'cancelled'].includes(job.status)).length
  };
}

function matchesFilter(job: ConversionJob, filter: ConversionQueueFilter) {
  if (filter === 'all') return true;
  if (filter === 'ready') return job.status === 'ready' || job.status === 'validating';
  if (filter === 'active') return job.status === 'processing';
  if (filter === 'completed') return job.status === 'completed';
  return job.status === 'failed' || job.status === 'unsupported' || job.status === 'cancelled';
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function buildArchiveName() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `pixavelo-converted-${date}.zip`;
}

function readRequestedFormat(): CoreImageFormat {
  const requested = new URLSearchParams(window.location.search).get('to');
  return requested === 'png' || requested === 'webp' || requested === 'jpeg' ? requested : 'jpeg';
}
