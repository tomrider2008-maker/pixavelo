import type { ImageDimensions } from '../../types/images';

export type MemoryCategory = 'small' | 'medium' | 'large' | 'extreme';

export interface MemoryEstimate {
  readonly decodedBytes: number;
  readonly workingBytes: number;
  readonly category: MemoryCategory;
  readonly recommendedConcurrency: number;
}

const MEBIBYTE = 1024 * 1024;

export function estimateImageMemory(dimensions: ImageDimensions): MemoryEstimate {
  const decodedBytes = dimensions.pixels * 4;
  const workingBytes = Math.ceil(decodedBytes * 2.5);

  if (workingBytes > 768 * MEBIBYTE || dimensions.megapixels > 100) {
    return { decodedBytes, workingBytes, category: 'extreme', recommendedConcurrency: 1 };
  }

  if (workingBytes > 320 * MEBIBYTE || dimensions.megapixels > 40) {
    return { decodedBytes, workingBytes, category: 'large', recommendedConcurrency: 1 };
  }

  if (workingBytes > 96 * MEBIBYTE || dimensions.megapixels > 12) {
    return { decodedBytes, workingBytes, category: 'medium', recommendedConcurrency: 2 };
  }

  return { decodedBytes, workingBytes, category: 'small', recommendedConcurrency: 4 };
}

export function getWorkerLimit(hardwareConcurrency = navigator.hardwareConcurrency): number {
  const logicalCores = Number.isFinite(hardwareConcurrency) ? hardwareConcurrency : 2;
  return Math.max(1, Math.min(4, Math.floor(logicalCores) - 1 || 1));
}
