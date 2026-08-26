import type { ImageAdjustments } from '../../types/images';
import type { DecodedEditorSource } from './decodeEditorSource';

const HISTOGRAM_BINS = 32;

export interface EditorImageAnalysis {
  readonly red: readonly number[];
  readonly green: readonly number[];
  readonly blue: readonly number[];
  readonly luminance: readonly number[];
  readonly meanLuminance: number;
  readonly shadowPercent: number;
  readonly highlightPercent: number;
  readonly sampledPixels: number;
  readonly suggestedAdjustments: Pick<
    ImageAdjustments,
    'exposure' | 'contrast' | 'highlights' | 'shadows' | 'saturation' | 'sharpness'
  >;
}

export async function analyzeEditorSource(
  source: DecodedEditorSource
): Promise<EditorImageAnalysis> {
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  const scale = Math.min(1, 320 / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Local image analysis is unavailable.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source.drawable, 0, 0, width, height);
  return analyzePixelBuffer(context.getImageData(0, 0, width, height).data);
}

export function analyzePixelBuffer(pixels: Uint8ClampedArray): EditorImageAnalysis {
  const red = emptyBins();
  const green = emptyBins();
  const blue = emptyBins();
  const luminance = emptyBins();
  let sampledPixels = 0;
  let luminanceTotal = 0;
  let shadows = 0;
  let highlights = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if ((pixels[index + 3] ?? 0) === 0) continue;
    const r = pixels[index] ?? 0;
    const g = pixels[index + 1] ?? 0;
    const b = pixels[index + 2] ?? 0;
    const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const redBin = toBin(r);
    const greenBin = toBin(g);
    const blueBin = toBin(b);
    const luminanceBin = toBin(l);
    red[redBin] = (red[redBin] ?? 0) + 1;
    green[greenBin] = (green[greenBin] ?? 0) + 1;
    blue[blueBin] = (blue[blueBin] ?? 0) + 1;
    luminance[luminanceBin] = (luminance[luminanceBin] ?? 0) + 1;
    luminanceTotal += l;
    sampledPixels += 1;
    if (l < 38) shadows += 1;
    if (l > 217) highlights += 1;
  }

  const meanLuminance = sampledPixels === 0 ? 0.5 : luminanceTotal / sampledPixels / 255;
  const shadowPercent = sampledPixels === 0 ? 0 : shadows / sampledPixels;
  const highlightPercent = sampledPixels === 0 ? 0 : highlights / sampledPixels;
  const low = percentileBin(luminance, sampledPixels, 0.05) / (HISTOGRAM_BINS - 1);
  const high = percentileBin(luminance, sampledPixels, 0.95) / (HISTOGRAM_BINS - 1);
  const tonalRange = high - low;

  return {
    red: normalizeBins(red),
    green: normalizeBins(green),
    blue: normalizeBins(blue),
    luminance: normalizeBins(luminance),
    meanLuminance,
    shadowPercent,
    highlightPercent,
    sampledPixels,
    suggestedAdjustments: {
      exposure:
        sampledPixels === 0
          ? 0
          : round(clamp(Math.log2(0.46 / Math.max(0.08, meanLuminance)), -0.7, 0.7), 0.05),
      contrast: Math.round(clamp((0.68 - tonalRange) * 42, -8, 22)),
      shadows: Math.round(clamp(shadowPercent * 85, 0, 24)),
      highlights: -Math.round(clamp(highlightPercent * 90, 0, 24)),
      saturation: 5,
      sharpness: 8
    }
  };
}

function emptyBins() {
  return Array.from<number>({ length: HISTOGRAM_BINS }).fill(0);
}

function toBin(value: number) {
  return Math.min(HISTOGRAM_BINS - 1, Math.floor((value / 256) * HISTOGRAM_BINS));
}

function normalizeBins(values: readonly number[]) {
  const maximum = Math.max(1, ...values);
  return values.map((value) => value / maximum);
}

function percentileBin(values: readonly number[], total: number, percentile: number) {
  if (total === 0) return Math.round((HISTOGRAM_BINS - 1) * percentile);
  const target = total * percentile;
  let seen = 0;
  for (let index = 0; index < values.length; index += 1) {
    seen += values[index] ?? 0;
    if (seen >= target) return index;
  }
  return HISTOGRAM_BINS - 1;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function round(value: number, step: number) {
  return Math.round(value / step) * step;
}
