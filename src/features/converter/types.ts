import type {
  CoreImageFormat,
  ImageFormat,
  ImageValidationReport,
  ProcessedImage,
  ProcessingStage
} from '../../types/images';

export type ConversionJobStatus =
  'validating' | 'ready' | 'unsupported' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type ConversionQueueFilter = 'all' | 'ready' | 'active' | 'completed' | 'issues';

export type ConversionSortOrder = 'insertion' | 'name-asc' | 'size-desc' | 'format' | 'status';

export type QualityMode = 'quality' | 'target';

export interface ConversionOutput extends ProcessedImage {
  readonly url: string;
}

export interface ConversionJob {
  readonly id: string;
  readonly file: File;
  readonly status: ConversionJobStatus;
  readonly selected: boolean;
  readonly previewUrl?: string | undefined;
  readonly validation?: ImageValidationReport | undefined;
  readonly detectedFormat?: ImageFormat | undefined;
  readonly formatOverride?: CoreImageFormat | undefined;
  readonly stage?: ProcessingStage | undefined;
  readonly output?: ConversionOutput | undefined;
  readonly error?: string | undefined;
}

export interface ConversionSettings {
  readonly outputFormat: CoreImageFormat;
  readonly quality: number;
  readonly background: string;
  readonly namingPattern: string;
  readonly autoProcess: boolean;
  readonly qualityMode: QualityMode;
  readonly targetKb: number;
  readonly stripMetadata: boolean;
}
