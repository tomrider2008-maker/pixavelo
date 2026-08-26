import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError, toAppError } from '../../engine/errors/AppError';
import {
  filesWithinCollectionBudget,
  INTAKE_CONCURRENCY,
  MAX_RETAINED_OUTPUT_BYTES,
  totalBlobBytes
} from '../../engine/memory/browserBudgets';
import { processNativeImage } from '../../engine/pipeline/processNativeImage';
import { validateImageFile } from '../../engine/validation/validateFile';
import { detectImageFormat } from '../../engine/validation/signatures';
import { clearProcessingActivity, setProcessingActivity } from '../../stores/processingActivity';
import type { CoreImageFormat, ImageFormat } from '../../types/images';
import type { ConversionJob, ConversionSettings } from './types';
import { mapWithConcurrency } from '../../utils/boundedConcurrency';

const MAX_DISPATCHED_JOBS = 4;

const defaultSettings: ConversionSettings = {
  outputFormat: 'jpeg',
  quality: 88,
  background: '#ffffff',
  namingPattern: '{name}-converted',
  autoProcess: false,
  qualityMode: 'quality',
  targetKb: 200,
  stripMetadata: true
};

interface QueueResult {
  readonly attempted: number;
  readonly completed: number;
  readonly failed: number;
}

export function useConversionQueue(
  initialFiles: readonly File[],
  initialFormat: CoreImageFormat = 'jpeg'
) {
  const [jobs, setJobs] = useState<readonly ConversionJob[]>([]);
  const [settings, setSettingsState] = useState<ConversionSettings>(() => ({
    ...defaultSettings,
    outputFormat: initialFormat
  }));
  const jobsRef = useRef<readonly ConversionJob[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  const previewUrlsRef = useRef(new Set<string>());
  const outputUrlsRef = useRef(new Set<string>());
  const removedIdsRef = useRef(new Set<string>());
  const initialFilesConsumed = useRef(false);
  const mountedRef = useRef(true);
  // Keep a stable ref for processReadyJobs so auto-process can call it without stale closure
  const processReadyJobsRef = useRef<((ids?: ReadonlySet<string>) => Promise<QueueResult>) | null>(
    null
  );

  const commitJobs = useCallback(
    (updater: (current: readonly ConversionJob[]) => readonly ConversionJob[]) => {
      setJobs((current) => {
        const next = updater(current);
        jobsRef.current = next;
        return next;
      });
    },
    []
  );

  const updateJob = useCallback(
    (id: string, update: Partial<ConversionJob>) => {
      commitJobs((current) => current.map((job) => (job.id === id ? { ...job, ...update } : job)));
    },
    [commitJobs]
  );

  const validateJobs = useCallback(
    async (entries: readonly ConversionJob[], autoProcessAfter: boolean) => {
      await mapWithConcurrency(entries, INTAKE_CONCURRENCY, async (entry) => {
        try {
          const validation = await validateImageFile(entry.file);
          if (!mountedRef.current || removedIdsRef.current.has(entry.id)) return;
          const previewUrl = canPreviewOriginal(validation.format)
            ? URL.createObjectURL(entry.file)
            : undefined;
          if (previewUrl) previewUrlsRef.current.add(previewUrl);
          updateJob(entry.id, {
            validation,
            detectedFormat: validation.format,
            ...(previewUrl ? { previewUrl } : {}),
            status: validation.supportedByConverter ? 'ready' : 'unsupported',
            ...(validation.supportedByConverter
              ? { error: undefined }
              : {
                  error: `${validation.format.toUpperCase()} has no available local decoder.`
                })
          });
        } catch (error: unknown) {
          if (!mountedRef.current || removedIdsRef.current.has(entry.id)) return;
          const appError = toAppError(error, 'INVALID_FILE');
          const detectedFormat = detectImageFormat(
            new Uint8Array(await entry.file.slice(0, 1024).arrayBuffer())
          );
          updateJob(entry.id, {
            status: 'failed',
            error: appError.userMessage,
            ...(detectedFormat === 'unknown' ? {} : { detectedFormat })
          });
        }
      });

      // Auto-process: trigger for the newly validated jobs that are ready
      if (autoProcessAfter && mountedRef.current && processReadyJobsRef.current) {
        const ids = new Set(entries.map((e) => e.id));
        await processReadyJobsRef.current(ids);
      }
    },
    [updateJob]
  );

  const addFiles = useCallback(
    (files: FileList | readonly File[]) => {
      const accepted = filesWithinCollectionBudget(
        jobsRef.current.map((job) => job.file),
        Array.from(files)
      );
      const entries: ConversionJob[] = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'validating',
        selected: true
      }));
      if (entries.length === 0) return 0;
      commitJobs((current) => [...current, ...entries]);
      // Read autoProcess from settingsState via ref to avoid stale closures
      const auto = settingsRef.current.autoProcess;
      void validateJobs(entries, auto);
      return entries.length;
    },
    [commitJobs, validateJobs]
  );

  // Keep a ref to current settings for use inside callbacks
  const settingsRef = useRef(settings);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (initialFilesConsumed.current) return;
    initialFilesConsumed.current = true;
    addFiles(initialFiles);
  }, [addFiles, initialFiles]);

  const discardOutput = useCallback((job: ConversionJob) => {
    if (!job.output) return;
    URL.revokeObjectURL(job.output.url);
    outputUrlsRef.current.delete(job.output.url);
  }, []);

  const invalidateOutputs = useCallback(
    (jobId?: string) => {
      commitJobs((current) =>
        current.map((job) => {
          if ((!jobId || job.id === jobId) && job.output) {
            discardOutput(job);
            return { ...job, status: 'ready', output: undefined, error: undefined };
          }
          return job;
        })
      );
    },
    [commitJobs, discardOutput]
  );

  const setSettings = useCallback(
    (next: ConversionSettings, invalidate = true) => {
      setSettingsState(next);
      // eslint-disable-next-line react-hooks/immutability
      settingsRef.current = next;
      if (invalidate) invalidateOutputs();
    },
    [invalidateOutputs]
  );

  const updateSettings = useCallback(
    (update: Partial<ConversionSettings>, invalidate = true) => {
      setSettingsState((current) => {
        const next = { ...current, ...update };
        settingsRef.current = next;
        return next;
      });
      if (invalidate) invalidateOutputs();
    },
    [invalidateOutputs]
  );

  const setFormatOverride = useCallback(
    (id: string, format: CoreImageFormat | undefined) => {
      const job = jobsRef.current.find((candidate) => candidate.id === id);
      if (job?.output) discardOutput(job);
      updateJob(id, {
        formatOverride: format,
        ...(job?.output ? { status: 'ready', output: undefined, error: undefined } : {})
      });
    },
    [discardOutput, updateJob]
  );

  const processJob = useCallback(
    async (job: ConversionJob, settingsSnapshot: ConversionSettings) => {
      if (!job.validation?.supportedByConverter) return false;
      const controller = new AbortController();
      controllersRef.current.set(job.id, controller);
      if (job.output) discardOutput(job);
      updateJob(job.id, {
        status: 'processing',
        stage: 'preparing',
        output: undefined,
        error: undefined
      });

      const outputFormat = job.formatOverride ?? settingsSnapshot.outputFormat;
      // Resolve target bytes from targetKb when in target mode
      const targetBytes =
        settingsSnapshot.qualityMode === 'target' && outputFormat !== 'png'
          ? settingsSnapshot.targetKb * 1024
          : undefined;

      try {
        const result = await processNativeImage({
          file: job.file,
          detectedMime: job.validation.mime,
          detectedFormat: job.validation.format,
          ...(job.validation.dimensions ? { dimensions: job.validation.dimensions } : {}),
          options: {
            outputFormat,
            ...(outputFormat === 'png'
              ? {}
              : targetBytes
                ? { targetBytes, minimumQuality: 20 / 100, maximumEncodingPasses: 12 }
                : { quality: settingsSnapshot.quality / 100 }),
            ...(outputFormat === 'jpeg' ? { background: settingsSnapshot.background } : {})
          },
          signal: controller.signal,
          onProgress: (stage) => updateJob(job.id, { stage })
        });
        if (!mountedRef.current || removedIdsRef.current.has(job.id)) return false;
        const retainedBytes = totalBlobBytes(
          jobsRef.current.flatMap((candidate) =>
            candidate.id !== job.id && candidate.output ? [candidate.output.blob] : []
          )
        );
        if (retainedBytes + result.blob.size > MAX_RETAINED_OUTPUT_BYTES) {
          throw new AppError(
            'MEMORY_LIMIT',
            'Converter outputs exceed the 512 MiB retained-output budget.'
          );
        }
        const url = URL.createObjectURL(result.blob);
        outputUrlsRef.current.add(url);
        updateJob(job.id, {
          status: 'completed',
          stage: undefined,
          output: { ...result, url },
          error: undefined
        });
        return true;
      } catch (error: unknown) {
        if (!mountedRef.current || removedIdsRef.current.has(job.id)) return false;
        const appError = toAppError(error, 'ENCODE_FAILED');
        updateJob(job.id, {
          status: appError.code === 'CANCELLED' ? 'cancelled' : 'failed',
          stage: undefined,
          error: appError.userMessage
        });
        return false;
      } finally {
        controllersRef.current.delete(job.id);
      }
    },
    [discardOutput, updateJob]
  );

  const processReadyJobs = useCallback(
    async (ids?: ReadonlySet<string>): Promise<QueueResult> => {
      const processable = jobsRef.current.filter(
        (job) =>
          (!ids || ids.has(job.id)) &&
          job.validation?.supportedByConverter &&
          (job.status === 'ready' || job.status === 'failed' || job.status === 'cancelled')
      );
      const settingsSnapshot = settingsRef.current;
      const results = await mapWithConcurrency(processable, MAX_DISPATCHED_JOBS, (job) =>
        processJob(job, settingsSnapshot)
      );
      const completed = results.filter(Boolean).length;
      return { attempted: processable.length, completed, failed: processable.length - completed };
    },
    [processJob]
  );

  // Keep processReadyJobsRef in sync for auto-process callback
  useEffect(() => {
    processReadyJobsRef.current = processReadyJobs;
  }, [processReadyJobs]);

  // Drag-to-reorder: swap two jobs by ID
  const reorderJob = useCallback(
    (fromId: string, toId: string) => {
      commitJobs((current) => {
        const fromIndex = current.findIndex((j) => j.id === fromId);
        const toIndex = current.findIndex((j) => j.id === toId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;
        const next = [...current];
        const [moved] = next.splice(fromIndex, 1);
        if (moved) next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [commitJobs]
  );

  const removeJob = useCallback(
    (id: string) => {
      removedIdsRef.current.add(id);
      controllersRef.current.get(id)?.abort();
      const job = jobsRef.current.find((candidate) => candidate.id === id);
      if (job?.previewUrl) {
        URL.revokeObjectURL(job.previewUrl);
        previewUrlsRef.current.delete(job.previewUrl);
      }
      if (job) discardOutput(job);
      commitJobs((current) => current.filter((candidate) => candidate.id !== id));
    },
    [commitJobs, discardOutput]
  );

  const removeSelected = useCallback(() => {
    for (const job of jobsRef.current) if (job.selected) removeJob(job.id);
  }, [removeJob]);

  const clearCompleted = useCallback(() => {
    for (const job of jobsRef.current) if (job.status === 'completed') removeJob(job.id);
  }, [removeJob]);

  const cancelJob = useCallback((id: string) => controllersRef.current.get(id)?.abort(), []);
  const cancelAll = useCallback(() => {
    for (const controller of controllersRef.current.values()) controller.abort();
  }, []);

  const setSelected = useCallback(
    (id: string, selected: boolean) => updateJob(id, { selected }),
    [updateJob]
  );
  const setAllSelected = useCallback(
    (selected: boolean) => commitJobs((current) => current.map((job) => ({ ...job, selected }))),
    [commitJobs]
  );

  useEffect(() => {
    const active = jobs.filter((job) => job.status === 'processing');
    setProcessingActivity({
      queued: jobs.filter((job) => job.status === 'ready').length,
      active: active.length,
      ...(active[0]?.stage ? { stage: active[0].stage } : {})
    });
    return clearProcessingActivity;
  }, [jobs]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      for (const controller of controllersRef.current.values()) controller.abort();
      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
      for (const url of outputUrlsRef.current) URL.revokeObjectURL(url);
    },
    []
  );

  return {
    jobs,
    settings,
    addFiles,
    setSettings,
    updateSettings,
    setFormatOverride,
    processReadyJobs,
    reorderJob,
    removeJob,
    removeSelected,
    clearCompleted,
    cancelJob,
    cancelAll,
    setSelected,
    setAllSelected
  } as const;
}

function canPreviewOriginal(format: ImageFormat): boolean {
  return ['jpeg', 'png', 'webp', 'avif', 'bmp', 'gif', 'ico'].includes(format);
}
