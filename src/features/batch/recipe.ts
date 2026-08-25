import type { ImageDimensions, NativeProcessingOptions } from '../../types/images';
import { buildConversionFilename, deduplicateFilenames } from '../converter/naming';
import type { BatchJob, BatchRecipe } from './types';

export const DEFAULT_BATCH_RECIPE: BatchRecipe = {
  outputFormat: 'webp',
  resizeMode: 'longest-edge',
  longestEdge: 1920,
  width: 1920,
  height: 1080,
  fitMode: 'contain',
  preventUpscale: true,
  quality: 82,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  background: '#ffffff',
  namingPattern: '{name}-web-{index}',
  metadataPolicy: 'remove-all',
  watermark: {
    enabled: false,
    text: '',
    position: 'bottom-right',
    opacity: 0.72,
    sizePercent: 0.035,
    color: '#ffffff'
  }
};

const CORE_FORMATS = ['jpeg', 'png', 'webp'] as const;
const RESIZE_MODES = ['none', 'longest-edge', 'exact'] as const;
const FIT_MODES = ['contain', 'cover', 'stretch', 'crop', 'pad'] as const;
const ROTATIONS = [0, 90, 180, 270] as const;
const WATERMARK_POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
] as const;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function parseBatchRecipe(value: unknown): BatchRecipe {
  if (!isRecord(value)) return DEFAULT_BATCH_RECIPE;
  const watermark = isRecord(value.watermark) ? value.watermark : {};

  return {
    outputFormat: member(value.outputFormat, CORE_FORMATS, DEFAULT_BATCH_RECIPE.outputFormat),
    resizeMode: member(value.resizeMode, RESIZE_MODES, DEFAULT_BATCH_RECIPE.resizeMode),
    longestEdge: boundedInteger(value.longestEdge, 32, 32_768, DEFAULT_BATCH_RECIPE.longestEdge),
    width: boundedInteger(value.width, 1, 32_768, DEFAULT_BATCH_RECIPE.width),
    height: boundedInteger(value.height, 1, 32_768, DEFAULT_BATCH_RECIPE.height),
    fitMode: member(value.fitMode, FIT_MODES, DEFAULT_BATCH_RECIPE.fitMode),
    preventUpscale: boolean(value.preventUpscale, DEFAULT_BATCH_RECIPE.preventUpscale),
    quality: boundedNumber(value.quality, 20, 100, DEFAULT_BATCH_RECIPE.quality),
    rotation: member(value.rotation, ROTATIONS, DEFAULT_BATCH_RECIPE.rotation),
    flipHorizontal: boolean(value.flipHorizontal, DEFAULT_BATCH_RECIPE.flipHorizontal),
    flipVertical: boolean(value.flipVertical, DEFAULT_BATCH_RECIPE.flipVertical),
    background: color(value.background, DEFAULT_BATCH_RECIPE.background),
    namingPattern: boundedText(value.namingPattern, 200, DEFAULT_BATCH_RECIPE.namingPattern),
    metadataPolicy: 'remove-all',
    watermark: {
      enabled: boolean(watermark.enabled, DEFAULT_BATCH_RECIPE.watermark.enabled),
      text: boundedText(watermark.text, 200, DEFAULT_BATCH_RECIPE.watermark.text),
      position: member(
        watermark.position,
        WATERMARK_POSITIONS,
        DEFAULT_BATCH_RECIPE.watermark.position
      ),
      opacity: boundedNumber(watermark.opacity, 0.05, 1, DEFAULT_BATCH_RECIPE.watermark.opacity),
      sizePercent: boundedNumber(
        watermark.sizePercent,
        0.005,
        0.25,
        DEFAULT_BATCH_RECIPE.watermark.sizePercent
      ),
      color: color(watermark.color, DEFAULT_BATCH_RECIPE.watermark.color)
    }
  };
}

export function processingOptionsForJob(
  recipe: BatchRecipe,
  job: Pick<BatchJob, 'validation'>
): NativeProcessingOptions {
  const resize = resolveResize(recipe, job.validation?.dimensions);
  return {
    outputFormat: recipe.outputFormat,
    ...(recipe.outputFormat === 'png' ? {} : { quality: recipe.quality / 100 }),
    background: recipe.background,
    rotation: recipe.rotation,
    flipHorizontal: recipe.flipHorizontal,
    flipVertical: recipe.flipVertical,
    preventUpscale: recipe.preventUpscale,
    fitMode: recipe.fitMode,
    ...resize,
    ...(recipe.watermark.enabled && recipe.watermark.text.trim()
      ? {
          watermark: {
            text: recipe.watermark.text.trim(),
            position: recipe.watermark.position,
            opacity: recipe.watermark.opacity,
            sizePercent: recipe.watermark.sizePercent,
            color: recipe.watermark.color
          }
        }
      : {})
  };
}

export function outputNamesForJobs(jobs: readonly Pick<BatchJob, 'file'>[], recipe: BatchRecipe) {
  return deduplicateFilenames(
    jobs.map((job, index) =>
      buildConversionFilename(job.file.name, recipe.outputFormat, recipe.namingPattern, index)
    )
  );
}

export function batchRecipeSummary(recipe: BatchRecipe) {
  const resize =
    recipe.resizeMode === 'none'
      ? 'Original size'
      : recipe.resizeMode === 'longest-edge'
        ? `${recipe.longestEdge} px`
        : `${recipe.width} × ${recipe.height}`;
  return `${recipe.outputFormat.toUpperCase()} · ${resize} · Quality ${recipe.quality} · Metadata removed`;
}

function resolveResize(recipe: BatchRecipe, dimensions: ImageDimensions | undefined) {
  if (recipe.resizeMode === 'none' || !dimensions) return {};
  if (recipe.resizeMode === 'exact') return { width: recipe.width, height: recipe.height };

  const longEdge = Math.max(dimensions.width, dimensions.height);
  const scale = recipe.preventUpscale
    ? Math.min(1, recipe.longestEdge / longEdge)
    : recipe.longestEdge / longEdge;
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale))
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function member<const Value extends string | number>(
  value: unknown,
  allowed: readonly Value[],
  fallback: Value
): Value {
  return allowed.includes(value as Value) ? (value as Value) : fallback;
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  return Math.round(boundedNumber(value, minimum, maximum, fallback));
}

function boundedText(value: unknown, maximumLength: number, fallback: string) {
  return typeof value === 'string' ? value.slice(0, maximumLength) : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}
