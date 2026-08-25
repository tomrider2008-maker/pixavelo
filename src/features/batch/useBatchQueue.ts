import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppError, toAppError } from '../../engine/errors/AppError';
import {
  filesWithinCollectionBudget,
  INTAKE_CONCURRENCY,
  MAX_RETAINED_OUTPUT_BYTES,
  totalBlobBytes
} from '../../engine/memory/browserBudgets';
import { createZipBlob } from '../../engine/export/createZip';
import { processNativeImage } from '../../engine/pipeline/processNativeImage';
import { validateImageFile } from '../../engine/validation/validateFile';
import { clearProcessingActivity, setProcessingActivity } from '../../stores/processingActivity';
import type { ImageFormat, ProcessingStage } from '../../types/images';
import {
  DEFAULT_BATCH_RECIPE,
  outputNamesForJobs,
  parseBatchRecipe,
  processingOptionsForJob
} from './recipe';
import { calculateBatchStatistics } from './statistics';
import type { BatchJob, BatchRecipe, BatchRunState } from './types';
import { mapWithConcurrency } from '../../utils/boundedConcurrency';

const MAX_DISPATCHED_JOBS = 4;
const RECIPE_STORAGE_KEY = 'pixavelo.batch-recipe.v1';

export function useBatchQueue(initialFiles: readonly File[] = []) {
  const [jobs, setJobs] = useState<readonly BatchJob[]>([]);
  const [recipe, setRecipeState] = useState<BatchRecipe>(readSavedRecipe);
  const [runState, setRunState] = useState<BatchRunState>('idle');
  const [startedAt, setStartedAt] = useState<number>();
  const [endedAt, setEndedAt] = useState<number>();
  const jobsRef = useRef<readonly BatchJob[]>([]);
  const recipeRef = useRef(recipe);
  const runStateRef = useRef(runState);
  const controllersRef = useRef(new Map<string, AbortController>());
  const previewUrlsRef = useRef(new Set<string>());
  const outputUrlsRef = useRef(new Set<string>());
  const removedIdsRef = useRef(new Set<string>());
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  const commitJobs = useCallback(
    (updater: (current: readonly BatchJob[]) => readonly BatchJob[]) => {
      setJobs((current) => {
        const next = updater(current);
        jobsRef.current = next;
        return next;
      });
    },
    []
  );

  const updateJob = useCallback(
    (id: string, update: Partial<BatchJob>) => {
      commitJobs((current) => current.map((job) => (job.id === id ? { ...job, ...update } : job)));
    },
    [commitJobs]
  );

  const discardOutput = useCallback((job: BatchJob) => {
    if (!job.output) return;
    URL.revokeObjectURL(job.output.url);
    outputUrlsRef.current.delete(job.output.url);
  }, []);

  const validateJob = useCallback(
    async (job: BatchJob) => {
      try {
        const validation = await validateImageFile(job.file);
        if (!mountedRef.current || removedIdsRef.current.has(job.id)) return;
        const previewUrl = canPreviewOriginal(validation.format)
          ? URL.createObjectURL(job.file)
          : undefined;
        if (previewUrl) previewUrlsRef.current.add(previewUrl);
        updateJob(job.id, {
          validation,
          status: validation.supportedByConverter ? 'waiting' : 'failed',
          ...(previewUrl ? { previewUrl } : {}),
          ...(validation.supportedByConverter
            ? { error: undefined, errorCode: undefined }
            : {
                error: `${validation.format.toUpperCase()} has no available local decoder.`,
                errorCode: 'UNSUPPORTED_FORMAT'
              })
        });
      } catch (error: unknown) {
        if (!mountedRef.current || removedIdsRef.current.has(job.id)) return;
        const appError = toAppError(error, 'INVALID_FILE');
        updateJob(job.id, {
          status: 'failed',
          error: appError.userMessage,
          errorCode: appError.code
        });
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
      const entries: BatchJob[] = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        selected: true,
        status: 'preparing',
        attempt: 0,
        addedAt: Date.now()
      }));
      if (entries.length === 0) return 0;
      commitJobs((current) => [...current, ...entries]);
      void mapWithConcurrency(entries, INTAKE_CONCURRENCY, validateJob);
      if (runStateRef.current === 'completed') {
        runStateRef.current = 'idle';
        setRunState('idle');
      }
      return entries.length;
    },
    [commitJobs, validateJob]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    addFiles(initialFiles);
  }, [addFiles, initialFiles]);

  const runJob = useCallback(
    async (snapshot: BatchJob) => {
      const current = jobsRef.current.find((job) => job.id === snapshot.id);
      if (!current?.validation?.supportedByConverter || controllersRef.current.has(current.id)) {
        return;
      }
      const controller = new AbortController();
      controllersRef.current.set(current.id, controller);
      if (current.output) discardOutput(current);
      updateJob(current.id, {
        status: 'preparing',
        stage: 'preparing',
        output: undefined,
        error: undefined,
        errorCode: undefined,
        startedAt: Date.now(),
        finishedAt: undefined
      });

      try {
        const result = await processNativeImage({
          file: current.file,
          detectedMime: current.validation.mime,
          detectedFormat: current.validation.format,
          ...(current.validation.dimensions ? { dimensions: current.validation.dimensions } : {}),
          options: processingOptionsForJob(recipeRef.current, current),
          signal: controller.signal,
          onProgress: (stage) => updateJob(current.id, { stage, status: statusForStage(stage) })
        });
        if (!mountedRef.current || removedIdsRef.current.has(current.id)) return;
        const retainedBytes = totalBlobBytes(
          jobsRef.current.flatMap((job) =>
            job.id !== current.id && job.output ? [job.output.blob] : []
          )
        );
        if (retainedBytes + result.blob.size > MAX_RETAINED_OUTPUT_BYTES) {
          throw new AppError(
            'MEMORY_LIMIT',
            'Batch outputs exceed the 512 MiB retained-output budget.'
          );
        }
        const url = URL.createObjectURL(result.blob);
        outputUrlsRef.current.add(url);
        updateJob(current.id, {
          status: 'completed',
          stage: undefined,
          output: {
            ...result,
            url,
            filename: current.outputName ?? fallbackOutputName(current, recipeRef.current)
          },
          finishedAt: Date.now()
        });
      } catch (error: unknown) {
        if (!mountedRef.current || removedIdsRef.current.has(current.id)) return;
        const appError = toAppError(error, 'ENCODE_FAILED');
        updateJob(current.id, {
          status: appError.code === 'CANCELLED' ? 'cancelled' : 'failed',
          stage: undefined,
          error: appError.userMessage,
          errorCode: appError.code,
          finishedAt: Date.now()
        });
      } finally {
        controllersRef.current.delete(current.id);
        if (runStateRef.current === 'cancelling' && controllersRef.current.size === 0) {
          runStateRef.current = 'idle';
          setRunState('idle');
        }
      }
    },
    [discardOutput, updateJob]
  );

  useEffect(() => {
    if (runState !== 'running') return;
    const active = jobs.filter((job) => isActive(job.status)).length;
    const waiting = jobs.filter((job) => job.status === 'waiting');
    const available = Math.max(0, MAX_DISPATCHED_JOBS - active);
    for (const job of waiting.slice(0, available)) void runJob(job);

    if (waiting.length === 0 && active === 0 && jobs.length > 0) {
      queueMicrotask(() => {
        const current = jobsRef.current;
        const hasPendingWork = current.some(
          (job) => job.status === 'waiting' || isActive(job.status)
        );
        if (!mountedRef.current || runStateRef.current !== 'running' || hasPendingWork) return;
        runStateRef.current = 'completed';
        setRunState('completed');
        setEndedAt(Date.now());
      });
    }
  }, [jobs, runJob, runState]);

  const prepareOutputNames = useCallback(() => {
    const names = outputNamesForJobs(jobsRef.current, recipeRef.current);
    commitJobs((current) =>
      current.map((job, index) => ({ ...job, outputName: names[index] ?? job.outputName }))
    );
  }, [commitJobs]);

  const start = useCallback(() => {
    prepareOutputNames();
    setStartedAt((current) => current ?? Date.now());
    setEndedAt(undefined);
    runStateRef.current = 'running';
    setRunState('running');
  }, [prepareOutputNames]);

  const pause = useCallback(() => {
    if (runStateRef.current !== 'running') return;
    runStateRef.current = 'paused';
    setRunState('paused');
  }, []);

  const resume = useCallback(() => {
    if (runStateRef.current !== 'paused') return;
    runStateRef.current = 'running';
    setRunState('running');
  }, []);

  const cancelAll = useCallback(() => {
    runStateRef.current = 'cancelling';
    setRunState('cancelling');
    commitJobs((current) =>
      current.map((job) =>
        job.status === 'waiting'
          ? {
              ...job,
              status: 'cancelled',
              error: 'Processing was cancelled.',
              errorCode: 'CANCELLED'
            }
          : job
      )
    );
    for (const controller of controllersRef.current.values()) controller.abort();
    setEndedAt(Date.now());
  }, [commitJobs]);

  const retryJob = useCallback(
    (id: string) => {
      const job = jobsRef.current.find((candidate) => candidate.id === id);
      if (
        !job ||
        controllersRef.current.has(id) ||
        (job.status !== 'failed' && job.status !== 'cancelled')
      )
        return;
      if (job.output) discardOutput(job);
      if (!job.validation?.supportedByConverter) {
        updateJob(id, { status: 'preparing', attempt: job.attempt + 1, error: undefined });
        void validateJob(job);
        return;
      }
      updateJob(id, {
        status: 'waiting',
        attempt: job.attempt + 1,
        output: undefined,
        error: undefined,
        errorCode: undefined
      });
      if (runStateRef.current !== 'paused') {
        runStateRef.current = 'running';
        setRunState('running');
        setEndedAt(undefined);
      }
    },
    [discardOutput, updateJob, validateJob]
  );

  const retryFailed = useCallback(() => {
    let retried = 0;
    for (const job of jobsRef.current) {
      if (job.status !== 'failed' && job.status !== 'cancelled') continue;
      retried += 1;
      retryJob(job.id);
    }
    return retried;
  }, [retryJob]);

  const cancelJob = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id);
      if (controller) controller.abort();
      else {
        const job = jobsRef.current.find((candidate) => candidate.id === id);
        if (job?.status === 'waiting') {
          updateJob(id, {
            status: 'cancelled',
            error: 'Processing was cancelled.',
            errorCode: 'CANCELLED'
          });
        }
      }
    },
    [updateJob]
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

  const clearQueue = useCallback(() => {
    for (const job of [...jobsRef.current]) removeJob(job.id);
    setStartedAt(undefined);
    setEndedAt(undefined);
    runStateRef.current = 'idle';
    setRunState('idle');
  }, [removeJob]);

  const setSelected = useCallback(
    (id: string, selected: boolean) => updateJob(id, { selected }),
    [updateJob]
  );

  const setAllSelected = useCallback(
    (selected: boolean) => commitJobs((current) => current.map((job) => ({ ...job, selected }))),
    [commitJobs]
  );

  const setRecipe = useCallback((next: BatchRecipe) => {
    recipeRef.current = next;
    setRecipeState(next);
  }, []);

  const applyRecipe = useCallback(() => {
    const names = outputNamesForJobs(jobsRef.current, recipeRef.current);
    commitJobs((current) =>
      current.map((job, index) => {
        if (job.output) discardOutput(job);
        return {
          ...job,
          outputName: names[index] ?? job.outputName,
          ...(job.validation?.supportedByConverter
            ? {
                status: 'waiting' as const,
                output: undefined,
                error: undefined,
                errorCode: undefined
              }
            : {})
        };
      })
    );
    setStartedAt(undefined);
    setEndedAt(undefined);
    runStateRef.current = 'idle';
    setRunState('idle');
  }, [commitJobs, discardOutput]);

  const saveRecipe = useCallback(() => {
    localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(recipeRef.current));
  }, []);

  const createCompletedZip = useCallback(async (selectedOnly = false) => {
    const completed = jobsRef.current.filter(
      (job) => job.output && (!selectedOnly || job.selected)
    );
    return createZipBlob(
      completed.flatMap((job) =>
        job.output ? [{ name: job.output.filename, blob: job.output.blob }] : []
      )
    );
  }, []);

  const statistics = useMemo(
    () => calculateBatchStatistics(jobs, startedAt, endedAt),
    [endedAt, jobs, startedAt]
  );

  useEffect(() => {
    const active = jobs.filter((job) => isActive(job.status));
    setProcessingActivity({
      queued: jobs.filter((job) => job.status === 'waiting').length,
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
    recipe,
    runState,
    statistics,
    addFiles,
    setRecipe,
    applyRecipe,
    saveRecipe,
    start,
    pause,
    resume,
    cancelAll,
    cancelJob,
    retryJob,
    retryFailed,
    removeJob,
    removeSelected,
    clearCompleted,
    clearQueue,
    setSelected,
    setAllSelected,
    createCompletedZip
  } as const;
}

function statusForStage(stage: ProcessingStage): BatchJob['status'] {
  if (stage === 'preparing') return 'preparing';
  if (stage === 'decoding') return 'decoding';
  if (stage === 'encoding') return 'encoding';
  return 'processing';
}

function isActive(status: BatchJob['status']) {
  return ['preparing', 'decoding', 'processing', 'encoding'].includes(status);
}

function canPreviewOriginal(format: ImageFormat) {
  return ['jpeg', 'png', 'webp', 'avif', 'bmp', 'gif', 'ico'].includes(format);
}

function fallbackOutputName(job: BatchJob, recipe: BatchRecipe) {
  return outputNamesForJobs([job], recipe)[0] ?? `pixavelo-output.${recipe.outputFormat}`;
}

function readSavedRecipe(): BatchRecipe {
  try {
    const raw = localStorage.getItem(RECIPE_STORAGE_KEY);
    if (!raw) return DEFAULT_BATCH_RECIPE;
    return parseBatchRecipe(JSON.parse(raw));
  } catch {
    return DEFAULT_BATCH_RECIPE;
  }
}
