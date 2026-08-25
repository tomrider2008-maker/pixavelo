import type { ResizeMethod } from './resizeProfiles';

export interface ResizeRequest {
  readonly method: ResizeMethod;
  readonly width: number;
  readonly height: number;
  readonly percentage: number;
  readonly edge: number;
  readonly megapixels: number;
}

export function resolveResizeDimensions(
  sourceWidth: number,
  sourceHeight: number,
  request: ResizeRequest
) {
  const source = safeDimensions(sourceWidth, sourceHeight);
  const width = clampDimension(request.width);
  const height = clampDimension(request.height);
  const edge = clampDimension(request.edge);

  switch (request.method) {
    case 'exact':
      return { width, height };
    case 'width':
      return scaleToWidth(source.width, source.height, width);
    case 'height':
      return scaleToHeight(source.width, source.height, height);
    case 'percentage':
      return scale(source.width, source.height, clamp(request.percentage, 1, 800) / 100);
    case 'max-width':
      return source.width <= width ? source : scaleToWidth(source.width, source.height, width);
    case 'max-height':
      return source.height <= height ? source : scaleToHeight(source.width, source.height, height);
    case 'max-bounds': {
      const ratio = Math.min(1, width / source.width, height / source.height);
      return scale(source.width, source.height, ratio);
    }
    case 'longest-edge':
      return scale(source.width, source.height, edge / Math.max(source.width, source.height));
    case 'shortest-edge':
      return scale(source.width, source.height, edge / Math.min(source.width, source.height));
    case 'megapixels': {
      const targetPixels = clamp(request.megapixels, 0.01, 120) * 1_000_000;
      return scale(
        source.width,
        source.height,
        Math.sqrt(targetPixels / (source.width * source.height))
      );
    }
  }
}

function safeDimensions(width: number, height: number) {
  return { width: clampDimension(width), height: clampDimension(height) };
}

function scaleToWidth(width: number, height: number, targetWidth: number) {
  return scale(width, height, targetWidth / width);
}

function scaleToHeight(width: number, height: number, targetHeight: number) {
  return scale(width, height, targetHeight / height);
}

function scale(width: number, height: number, ratio: number) {
  return {
    width: clampDimension(width * ratio),
    height: clampDimension(height * ratio)
  };
}

export function clampDimension(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(32_768, Math.max(1, Math.round(value)));
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
