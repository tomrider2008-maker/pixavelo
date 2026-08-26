import type { ImageCrop } from '../../types/images';

interface PixelColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const ANALYSIS_SIZE = 256;
const DEFAULT_THRESHOLD = 20;
const CONTENT_PADDING = 0.02;

export function findContentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = DEFAULT_THRESHOLD
): ImageCrop {
  if (width < 1 || height < 1 || data.length < width * height * 4) {
    return { x: 0, y: 0, width: Math.max(1, width), height: Math.max(1, height) };
  }

  const background = averageColors([
    readPixel(data, width, 0, 0),
    readPixel(data, width, width - 1, 0),
    readPixel(data, width, 0, height - 1),
    readPixel(data, width, width - 1, height - 1)
  ]);
  let top = height;
  let right = -1;
  let bottom = -1;
  let left = width;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = readPixel(data, width, x, y);
      if (!isContent(pixel, background, threshold)) continue;
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
    }
  }

  if (right < left || bottom < top) {
    return { x: 0, y: 0, width, height };
  }

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export async function calculateSmartTrim(file: File | Blob): Promise<ImageCrop> {
  const bitmap = await createImageBitmap(file).catch(() => undefined);
  if (!bitmap) throw new Error('The image could not be decoded for trim analysis.');

  const width = bitmap.width;
  const height = bitmap.height;
  const scale = Math.min(1, ANALYSIS_SIZE / Math.max(width, height));
  const analysisWidth = Math.max(1, Math.round(width * scale));
  const analysisHeight = Math.max(1, Math.round(height * scale));
  const canvas = new OffscreenCanvas(analysisWidth, analysisHeight);
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    bitmap.close();
    throw new Error('Local trim analysis is not supported in this browser.');
  }

  context.drawImage(bitmap, 0, 0, analysisWidth, analysisHeight);
  const pixels = context.getImageData(0, 0, analysisWidth, analysisHeight).data;
  bitmap.close();

  const bounds = findContentBounds(pixels, analysisWidth, analysisHeight);
  const detectedFullCanvas =
    bounds.x === 0 &&
    bounds.y === 0 &&
    bounds.width === analysisWidth &&
    bounds.height === analysisHeight;
  if (detectedFullCanvas) return { x: 0, y: 0, width, height };

  const unscaled = {
    x: bounds.x / scale,
    y: bounds.y / scale,
    width: bounds.width / scale,
    height: bounds.height / scale
  };
  const padX = width * CONTENT_PADDING;
  const padY = height * CONTENT_PADDING;
  const x = Math.max(0, unscaled.x - padX);
  const y = Math.max(0, unscaled.y - padY);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(Math.min(width - x, unscaled.width + padX * 2))),
    height: Math.max(1, Math.round(Math.min(height - y, unscaled.height + padY * 2)))
  };
}

function readPixel(data: Uint8ClampedArray, width: number, x: number, y: number): PixelColor {
  const index = (y * width + x) * 4;
  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
    a: data[index + 3] ?? 255
  };
}

function averageColors(colors: readonly PixelColor[]): PixelColor {
  const total = colors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b,
      a: sum.a + color.a
    }),
    { r: 0, g: 0, b: 0, a: 0 }
  );
  return {
    r: total.r / colors.length,
    g: total.g / colors.length,
    b: total.b / colors.length,
    a: total.a / colors.length
  };
}

function isContent(pixel: PixelColor, background: PixelColor, threshold: number) {
  if (pixel.a < 32 && background.a < 32) return false;
  if (Math.abs(pixel.a - background.a) > threshold * 2) return true;
  return (
    Math.abs(pixel.r - background.r) > threshold ||
    Math.abs(pixel.g - background.g) > threshold ||
    Math.abs(pixel.b - background.b) > threshold
  );
}
