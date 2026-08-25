import type {
  ImageFormat,
  NativeProcessingOptions,
  ProcessedImage,
  ProcessingStage
} from '../../types/images';
import { AppError } from '../errors/AppError';
import { getWorkerLimit, type MemoryCategory } from '../memory/estimateMemory';
import type { WorkerRequest, WorkerResponse } from './protocol';

interface TaskInput {
  readonly input: ArrayBuffer;
  readonly inputMime: string;
  readonly inputFormat: ImageFormat;
  readonly options: NativeProcessingOptions;
  readonly category: MemoryCategory;
  readonly signal?: AbortSignal;
  readonly onProgress?: (stage: ProcessingStage) => void;
}

interface Task extends TaskInput {
  readonly jobId: string;
  readonly resolve: (result: ProcessedImage) => void;
  readonly reject: (error: AppError) => void;
  readonly onAbort: () => void;
  startedAt?: number;
}

interface WorkerSlot {
  worker: Worker;
  task: Task | undefined;
}

export class NativeWorkerPool {
  readonly #size: number;
  readonly #slots: WorkerSlot[] = [];
  readonly #queue: Task[] = [];

  public constructor(size = getWorkerLimit()) {
    this.#size = size;
  }

  public process(input: TaskInput): Promise<ProcessedImage> {
    return new Promise((resolve, reject) => {
      const jobId = crypto.randomUUID();
      const onAbort = () => this.cancel(jobId);
      const task: Task = { ...input, jobId, resolve, reject, onAbort };

      if (input.signal?.aborted) {
        reject(new AppError('CANCELLED'));
        return;
      }

      input.signal?.addEventListener('abort', onAbort, { once: true });
      this.#queue.push(task);
      this.pump();
    });
  }

  public terminate(): void {
    for (const slot of this.#slots) {
      slot.worker.terminate();
      slot.task?.reject(new AppError('CANCELLED', 'Worker pool terminated.'));
    }
    for (const task of this.#queue)
      task.reject(new AppError('CANCELLED', 'Worker pool terminated.'));
    this.#slots.length = 0;
    this.#queue.length = 0;
  }

  private ensureWorkers() {
    while (this.#slots.length < this.#size) this.#slots.push(this.createSlot());
  }

  private createSlot(): WorkerSlot {
    const slot: WorkerSlot = {
      worker: new Worker(new URL('../../workers/imageProcessor.worker.ts', import.meta.url), {
        type: 'module',
        name: 'pixavelo-image-processor'
      }),
      task: undefined
    };
    slot.worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.onMessage(slot, event.data);
    slot.worker.onerror = (event) => {
      event.preventDefault();
      const task = slot.task;
      if (task) this.finish(slot, task, new AppError('CODEC_LOAD_FAILED', event.message));
      slot.worker.terminate();
      slot.worker = this.createSlot().worker;
      slot.worker.onmessage = (message: MessageEvent<WorkerResponse>) =>
        this.onMessage(slot, message.data);
      slot.worker.onerror = (workerError) => {
        workerError.preventDefault();
        if (slot.task)
          this.finish(slot, slot.task, new AppError('CODEC_LOAD_FAILED', workerError.message));
      };
      this.pump();
    };
    return slot;
  }

  private pump() {
    if (this.#queue.length === 0) return;
    this.ensureWorkers();

    for (const slot of this.#slots) {
      if (slot.task) continue;
      const taskIndex = this.#queue.findIndex((task) => this.canRun(task.category));
      if (taskIndex < 0) continue;
      const [task] = this.#queue.splice(taskIndex, 1);
      if (!task) continue;

      task.startedAt = performance.now();
      slot.task = task;
      const request: WorkerRequest = {
        type: 'PROCESS',
        jobId: task.jobId,
        input: task.input,
        inputMime: task.inputMime,
        inputFormat: task.inputFormat,
        options: task.options
      };
      slot.worker.postMessage(request, [task.input]);
    }
  }

  private canRun(category: MemoryCategory) {
    const activeCategories = this.#slots.flatMap((slot) => (slot.task ? [slot.task.category] : []));
    if (activeCategories.includes('extreme') || activeCategories.includes('large')) return false;
    if (category === 'extreme' || category === 'large') return activeCategories.length === 0;
    if (category === 'medium')
      return activeCategories.filter((active) => active === 'medium').length < 2;
    return activeCategories.length < this.#size;
  }

  private onMessage(slot: WorkerSlot, message: WorkerResponse) {
    const task = slot.task;
    if (task?.jobId !== message.jobId) return;

    if (message.type === 'PROGRESS') {
      task.onProgress?.(message.stage);
      return;
    }

    if (message.type === 'FAILURE') {
      this.finish(slot, task, new AppError(message.code, message.detail));
      return;
    }

    const result: ProcessedImage = {
      blob: new Blob([message.output], { type: message.mime }),
      mime: message.mime,
      size: message.size,
      width: message.width,
      height: message.height,
      durationMs: performance.now() - (task.startedAt ?? performance.now()),
      metadataRemovedVerified: message.metadataRemovedVerified,
      ...(message.qualityUsed === undefined ? {} : { qualityUsed: message.qualityUsed }),
      ...(message.encodingPasses === undefined ? {} : { encodingPasses: message.encodingPasses }),
      ...(message.targetSatisfied === undefined
        ? {}
        : { targetSatisfied: message.targetSatisfied }),
      ...(message.targetResizeApplied === undefined
        ? {}
        : { targetResizeApplied: message.targetResizeApplied })
    };
    this.finish(slot, task, result);
  }

  private finish(slot: WorkerSlot, task: Task, result: ProcessedImage | AppError) {
    task.signal?.removeEventListener('abort', task.onAbort);
    slot.task = undefined;
    if (result instanceof AppError) task.reject(result);
    else task.resolve(result);
    this.pump();
  }

  private cancel(jobId: string) {
    const queuedIndex = this.#queue.findIndex((task) => task.jobId === jobId);
    if (queuedIndex >= 0) {
      const [task] = this.#queue.splice(queuedIndex, 1);
      if (task) {
        task.signal?.removeEventListener('abort', task.onAbort);
        task.reject(new AppError('CANCELLED'));
      }
      return;
    }

    const slot = this.#slots.find((candidate) => candidate.task?.jobId === jobId);
    if (slot?.task) {
      const request: WorkerRequest = { type: 'CANCEL', jobId };
      slot.worker.postMessage(request);
    }
  }
}
