import type { ImageAdjustments } from '../../types/images';

export const DEFAULT_IMAGE_ADJUSTMENTS: ImageAdjustments = Object.freeze({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  gamma: 1,
  sharpness: 0,
  blur: 0,
  grayscale: false,
  sepia: false
});

type ImageContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function normalizeImageAdjustments(
  adjustments: Partial<ImageAdjustments> | undefined
): ImageAdjustments {
  return {
    brightness: clamp(adjustments?.brightness ?? 0, -100, 100),
    contrast: clamp(adjustments?.contrast ?? 0, -100, 100),
    saturation: clamp(adjustments?.saturation ?? 0, -100, 100),
    exposure: clamp(adjustments?.exposure ?? 0, -3, 3),
    highlights: clamp(adjustments?.highlights ?? 0, -100, 100),
    shadows: clamp(adjustments?.shadows ?? 0, -100, 100),
    temperature: clamp(adjustments?.temperature ?? 0, -100, 100),
    tint: clamp(adjustments?.tint ?? 0, -100, 100),
    gamma: clamp(adjustments?.gamma ?? 1, 0.2, 3),
    sharpness: clamp(adjustments?.sharpness ?? 0, 0, 100),
    blur: clamp(adjustments?.blur ?? 0, 0, 20),
    grayscale: Boolean(adjustments?.grayscale),
    sepia: Boolean(adjustments?.sepia)
  };
}

export function hasVisibleAdjustments(adjustments: ImageAdjustments | undefined) {
  if (!adjustments) return false;
  const normalized = normalizeImageAdjustments(adjustments);
  return Object.entries(normalized).some(([key, value]) =>
    key === 'gamma' ? value !== 1 : value !== 0 && value !== false
  );
}

export function buildCanvasFilter(adjustments: ImageAdjustments | undefined, scale = 1): string {
  const blur = normalizeImageAdjustments(adjustments).blur;
  return blur > 0 ? `blur(${Math.max(0.1, blur * scale).toFixed(2)}px)` : 'none';
}

export function transformPixelBuffer(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  adjustments: ImageAdjustments | undefined
) {
  const normalized = normalizeImageAdjustments(adjustments);
  applyColorAdjustments(pixels, normalized);
  if (normalized.sharpness > 0) sharpenPixels(pixels, width, height, normalized.sharpness);
  return pixels;
}

export function applyImageAdjustments(
  context: ImageContext,
  width: number,
  height: number,
  adjustments: ImageAdjustments | undefined
) {
  const normalized = normalizeImageAdjustments(adjustments);
  if (!needsPixelPass(normalized)) return;

  const rowsPerChunk = Math.max(8, Math.floor(2_000_000 / Math.max(1, width)));
  for (let y = 0; y < height; y += rowsPerChunk) {
    const rowCount = Math.min(rowsPerChunk, height - y);
    const imageData = context.getImageData(0, y, width, rowCount);
    applyColorAdjustments(imageData.data, normalized);
    context.putImageData(imageData, 0, y);
  }

  if (normalized.sharpness > 0) {
    applySharpnessInChunks(context, width, height, normalized.sharpness, rowsPerChunk);
  }
}

function applyColorAdjustments(pixels: Uint8ClampedArray, adjustments: ImageAdjustments) {
  const exposure = 2 ** adjustments.exposure;
  const brightness = 1 + adjustments.brightness / 100;
  const saturation = 1 + adjustments.saturation / 100;
  const contrast = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
  const inverseGamma = 1 / adjustments.gamma;
  const temperature = adjustments.temperature * 0.35;
  const tint = adjustments.tint * 0.25;

  for (let index = 0; index < pixels.length; index += 4) {
    let red = pixels[index] ?? 0;
    let green = pixels[index + 1] ?? 0;
    let blue = pixels[index + 2] ?? 0;

    red *= exposure * brightness;
    green *= exposure * brightness;
    blue *= exposure * brightness;

    red = contrast * (red - 128) + 128;
    green = contrast * (green - 128) + 128;
    blue = contrast * (blue - 128) + 128;

    let luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    red = luminance + (red - luminance) * saturation;
    green = luminance + (green - luminance) * saturation;
    blue = luminance + (blue - luminance) * saturation;

    const normalizedLuminance = clamp(luminance / 255, 0, 1);
    const tonalShift =
      (adjustments.shadows / 100) * 64 * (1 - normalizedLuminance) ** 2 +
      (adjustments.highlights / 100) * 64 * normalizedLuminance ** 2;
    red += tonalShift + temperature + tint * 0.5;
    green += tonalShift - tint;
    blue += tonalShift - temperature + tint * 0.5;

    red = 255 * (clamp(red, 0, 255) / 255) ** inverseGamma;
    green = 255 * (clamp(green, 0, 255) / 255) ** inverseGamma;
    blue = 255 * (clamp(blue, 0, 255) / 255) ** inverseGamma;

    if (adjustments.grayscale) {
      luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      red = luminance;
      green = luminance;
      blue = luminance;
    }
    if (adjustments.sepia) {
      const sourceRed = red;
      const sourceGreen = green;
      const sourceBlue = blue;
      red = sourceRed * 0.393 + sourceGreen * 0.769 + sourceBlue * 0.189;
      green = sourceRed * 0.349 + sourceGreen * 0.686 + sourceBlue * 0.168;
      blue = sourceRed * 0.272 + sourceGreen * 0.534 + sourceBlue * 0.131;
    }

    pixels[index] = clampByte(red);
    pixels[index + 1] = clampByte(green);
    pixels[index + 2] = clampByte(blue);
  }
}

function sharpenPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  sharpness: number
) {
  if (width < 2 || height < 2) return;
  const source = new Uint8ClampedArray(pixels);
  const amount = (sharpness / 100) * 0.8;
  const stride = width * 4;
  for (let y = 0; y < height; y += 1) {
    const up = Math.max(0, y - 1) * stride;
    const row = y * stride;
    const down = Math.min(height - 1, y + 1) * stride;
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - 1) * 4;
      const current = x * 4;
      const right = Math.min(width - 1, x + 1) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[row + current + channel] ?? 0;
        pixels[row + current + channel] = clampByte(
          center * (1 + amount * 4) -
            amount *
              ((source[row + left + channel] ?? center) +
                (source[row + right + channel] ?? center) +
                (source[up + current + channel] ?? center) +
                (source[down + current + channel] ?? center))
        );
      }
    }
  }
}

function applySharpnessInChunks(
  context: ImageContext,
  width: number,
  height: number,
  sharpness: number,
  rowsPerChunk: number
) {
  const stride = width * 4;
  let previousOriginalRow: Uint8ClampedArray | undefined;

  for (let y = 0; y < height; y += rowsPerChunk) {
    const rowCount = Math.min(rowsPerChunk, height - y);
    const sourceY = y === 0 ? 0 : y - 1;
    const sourceEnd = Math.min(height, y + rowCount + 1);
    const sourceRows = sourceEnd - sourceY;
    const imageData = context.getImageData(0, sourceY, width, sourceRows);
    if (previousOriginalRow) imageData.data.set(previousOriginalRow, 0);

    const centralOffset = y - sourceY;
    const lastCentralOffset = (centralOffset + rowCount - 1) * stride;
    previousOriginalRow = imageData.data.slice(lastCentralOffset, lastCentralOffset + stride);
    sharpenPixels(imageData.data, width, sourceRows, sharpness);

    const output = new ImageData(width, rowCount);
    output.data.set(
      imageData.data.subarray(centralOffset * stride, (centralOffset + rowCount) * stride)
    );
    context.putImageData(output, 0, y);
  }
}

function needsPixelPass(adjustments: ImageAdjustments) {
  return (
    adjustments.brightness !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.saturation !== 0 ||
    adjustments.exposure !== 0 ||
    adjustments.highlights !== 0 ||
    adjustments.shadows !== 0 ||
    adjustments.temperature !== 0 ||
    adjustments.tint !== 0 ||
    adjustments.gamma !== 1 ||
    adjustments.sharpness !== 0 ||
    adjustments.grayscale ||
    adjustments.sepia
  );
}

function clampByte(value: number) {
  return Math.round(clamp(value, 0, 255));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
