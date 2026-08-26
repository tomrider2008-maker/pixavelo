import type { CoreImageFormat } from '../types/images';

export async function calculateVisualFidelity(sourceBlob: Blob, outputBlob: Blob): Promise<number> {
  const [sourceData, outputData] = await Promise.all([
    getImageData(sourceBlob, 256),
    getImageData(outputBlob, 256)
  ]);

  if (
    !sourceData ||
    sourceData.width !== outputData?.width ||
    sourceData.height !== outputData.height
  ) {
    return 100;
  }

  const { data: d1 } = sourceData;
  const { data: d2 } = outputData;
  let mseTotal = 0;
  const length = d1.length;

  for (let i = 0; i < length; i += 4) {
    const r = (d1[i] ?? 0) - (d2[i] ?? 0);
    const g = (d1[i + 1] ?? 0) - (d2[i + 1] ?? 0);
    const b = (d1[i + 2] ?? 0) - (d2[i + 2] ?? 0);
    mseTotal += (r * r + g * g + b * b) / 3;
  }

  const mse = mseTotal / (length / 4);
  if (mse === 0) return 100;

  const maxError = 255 * 255;
  const psnr = 10 * Math.log10(maxError / mse);

  const fidelity = Math.max(0, Math.min(100, ((psnr - 20) / 25) * 100));
  return Math.round(fidelity * 10) / 10;
}

export async function analyzeBestSettings(
  file: File
): Promise<{ format: CoreImageFormat; quality: number }> {
  const data = await getImageData(file, 64);
  if (!data) return { format: 'webp', quality: 82 };

  const pixels = data.data;
  let hasAlpha = false;
  const uniqueColors = new Set<number>();

  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 255) < 255) {
      hasAlpha = true;
      break;
    }
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    uniqueColors.add((r << 16) | (g << 8) | b);
  }

  if (hasAlpha) {
    return { format: 'png', quality: 100 };
  }

  if (uniqueColors.size < 256) {
    return { format: 'png', quality: 100 };
  }

  return { format: 'webp', quality: 85 };
}

export async function getDominantAmbientColor(file: File | Blob): Promise<string> {
  const data = await getImageData(file, 8);
  if (!data) return 'transparent';
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;

  for (let index = 0; index < data.data.length; index += 16) {
    const alpha = (data.data[index + 3] ?? 255) / 255;
    red += (data.data[index] ?? 0) * alpha;
    green += (data.data[index + 1] ?? 0) * alpha;
    blue += (data.data[index + 2] ?? 0) * alpha;
    samples += alpha;
  }

  if (samples === 0) return 'transparent';
  return `rgb(${Math.round(red / samples)} ${Math.round(green / samples)} ${Math.round(blue / samples)})`;
}

async function getImageData(blob: Blob, maxSize: number): Promise<ImageData | undefined> {
  const bitmap = await createImageBitmap(blob).catch(() => undefined);
  if (!bitmap) return undefined;

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return undefined;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  bitmap.close();
  return data;
}
