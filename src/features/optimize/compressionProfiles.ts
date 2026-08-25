import type { CoreImageFormat } from '../../types/images';

export type CompressionProfileId =
  | 'maximum-quality'
  | 'high-quality'
  | 'balanced'
  | 'small-file'
  | 'maximum-compression'
  | 'web-optimized'
  | 'email-optimized';

export interface CompressionProfile {
  readonly id: CompressionProfileId;
  readonly label: string;
  readonly description: string;
  readonly quality: number;
  readonly outputFormat: CoreImageFormat | 'keep';
  readonly maximumLongEdge?: number;
  readonly preserveDimensions: boolean;
  readonly webOptimized: boolean;
}

export const COMPRESSION_PROFILES: readonly CompressionProfile[] = [
  {
    id: 'maximum-quality',
    label: 'Maximum Quality',
    description: 'Near-lossless visual quality with original dimensions.',
    quality: 96,
    outputFormat: 'keep',
    preserveDimensions: true,
    webOptimized: false
  },
  {
    id: 'high-quality',
    label: 'High Quality',
    description: 'High visual fidelity for photography and portfolios.',
    quality: 90,
    outputFormat: 'keep',
    preserveDimensions: true,
    webOptimized: false
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'A practical quality and file-size balance.',
    quality: 82,
    outputFormat: 'keep',
    preserveDimensions: true,
    webOptimized: false
  },
  {
    id: 'small-file',
    label: 'Small File',
    description: 'Smaller delivery files with restrained quality loss.',
    quality: 68,
    outputFormat: 'webp',
    maximumLongEdge: 2560,
    preserveDimensions: false,
    webOptimized: true
  },
  {
    id: 'maximum-compression',
    label: 'Maximum Compression',
    description: 'Aggressive compression for strict transfer limits.',
    quality: 45,
    outputFormat: 'webp',
    maximumLongEdge: 1920,
    preserveDimensions: false,
    webOptimized: true
  },
  {
    id: 'web-optimized',
    label: 'Web Optimized',
    description: 'WebP delivery capped for modern responsive websites.',
    quality: 78,
    outputFormat: 'webp',
    maximumLongEdge: 2560,
    preserveDimensions: false,
    webOptimized: true
  },
  {
    id: 'email-optimized',
    label: 'Email Optimized',
    description: 'Compatible JPEG sized for email and documents.',
    quality: 72,
    outputFormat: 'jpeg',
    maximumLongEdge: 1600,
    preserveDimensions: false,
    webOptimized: true
  }
] as const;

export const TARGET_SIZE_PRESETS = [50, 100, 200, 250, 500, 1024, 2048] as const;

export function findCompressionProfile(id: CompressionProfileId): CompressionProfile {
  const profile = COMPRESSION_PROFILES.find((candidate) => candidate.id === id);
  if (!profile) throw new RangeError(`Unknown compression profile: ${id}`);
  return profile;
}

export function constrainLongEdge(width: number, height: number, maximumLongEdge?: number) {
  if (!maximumLongEdge || Math.max(width, height) <= maximumLongEdge) return { width, height };
  const scale = maximumLongEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}
