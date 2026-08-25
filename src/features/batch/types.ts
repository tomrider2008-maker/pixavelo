import type {
  CoreImageFormat,
  ImageFitMode,
  ImageRotation,
  ImageValidationReport,
  ProcessedImage,
  ProcessingStage,
  WatermarkPosition
} from '../../types/images';
import type { AppErrorCode } from '../../engine/errors/AppError';

export type BatchJobStatus =
  | 'preparing'
  | 'waiting'
  | 'decoding'
  | 'processing'
  | 'encoding'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BatchRunState = 'idle' | 'running' | 'paused' | 'cancelling' | 'completed';
export type BatchQueueFilter = 'all' | 'waiting' | 'running' | 'completed' | 'failed';
export type BatchResizeMode = 'none' | 'longest-edge' | 'exact';

export interface BatchWatermark {
  readonly enabled: boolean;
  readonly text: string;
  readonly position: WatermarkPosition;
  readonly opacity: number;
  readonly sizePercent: number;
  readonly color: string;
}

export interface BatchRecipe {
  readonly outputFormat: CoreImageFormat;
  readonly resizeMode: BatchResizeMode;
  readonly longestEdge: number;
  readonly width: number;
  readonly height: number;
  readonly fitMode: ImageFitMode;
  readonly preventUpscale: boolean;
  readonly quality: number;
  readonly rotation: ImageRotation;
  readonly flipHorizontal: boolean;
  readonly flipVertical: boolean;
  readonly background: string;
  readonly namingPattern: string;
  readonly metadataPolicy: 'remove-all';
  readonly watermark: BatchWatermark;
}

export interface BatchOutput extends ProcessedImage {
  readonly url: string;
  readonly filename: string;
}

export interface BatchJob {
  readonly id: string;
  readonly file: File;
  readonly selected: boolean;
  readonly status: BatchJobStatus;
  readonly attempt: number;
  readonly addedAt: number;
  readonly previewUrl?: string | undefined;
  readonly validation?: ImageValidationReport | undefined;
  readonly stage?: ProcessingStage | undefined;
  readonly outputName?: string | undefined;
  readonly output?: BatchOutput | undefined;
  readonly error?: string | undefined;
  readonly errorCode?: AppErrorCode | undefined;
  readonly startedAt?: number | undefined;
  readonly finishedAt?: number | undefined;
}

export interface BatchStatistics {
  readonly selected: number;
  readonly completed: number;
  readonly failed: number;
  readonly remaining: number;
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly reductionPercent: number;
  readonly durationMs: number;
  readonly throughputPerMinute: number;
}
