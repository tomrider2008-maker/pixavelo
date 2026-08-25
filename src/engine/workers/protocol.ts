import type { ImageFormat, NativeProcessingOptions, ProcessingStage } from '../../types/images';
import type { AppErrorCode } from '../errors/AppError';

export interface ProcessRequest {
  readonly type: 'PROCESS';
  readonly jobId: string;
  readonly input: ArrayBuffer;
  readonly inputMime: string;
  readonly inputFormat: ImageFormat;
  readonly options: NativeProcessingOptions;
}

export interface CancelRequest {
  readonly type: 'CANCEL';
  readonly jobId: string;
}

export type WorkerRequest = ProcessRequest | CancelRequest;

export interface ProgressResponse {
  readonly type: 'PROGRESS';
  readonly jobId: string;
  readonly stage: ProcessingStage;
}

export interface SuccessResponse {
  readonly type: 'SUCCESS';
  readonly jobId: string;
  readonly output: ArrayBuffer;
  readonly mime: string;
  readonly size: number;
  readonly width: number;
  readonly height: number;
  readonly qualityUsed?: number;
  readonly encodingPasses?: number;
  readonly targetSatisfied?: boolean;
  readonly targetResizeApplied?: boolean;
  readonly metadataRemovedVerified: boolean;
}

export interface FailureResponse {
  readonly type: 'FAILURE';
  readonly jobId: string;
  readonly code: AppErrorCode;
  readonly detail?: string;
}

export type WorkerResponse = ProgressResponse | SuccessResponse | FailureResponse;
