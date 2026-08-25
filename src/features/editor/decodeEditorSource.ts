import { decodeAdvancedPixels } from '../../engine/codecs/decodeAdvancedPixels';
import { AppError } from '../../engine/errors/AppError';
import { prepareImageInput } from '../../engine/pipeline/prepareImageInput';
import type { ImageFormat } from '../../types/images';

export interface DecodedEditorSource {
  readonly drawable: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  readonly dispose: () => void;
}

export async function decodeEditorSource(
  file: Blob,
  format: ImageFormat,
  mime: string
): Promise<DecodedEditorSource> {
  const prepared = await prepareImageInput(file, format, mime);
  if (format === 'svg') return decodeSvg(prepared);
  if (format !== 'heic' && format !== 'heif' && format !== 'tiff') {
    try {
      const bitmap = await decodeWithOrientation(prepared);
      assertDimensions(bitmap.width, bitmap.height);
      return {
        drawable: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close()
      };
    } catch (error: unknown) {
      if (format !== 'avif') throw error;
    }
  }

  const decoded = await decodeAdvancedPixels(format, await prepared.arrayBuffer());
  assertDimensions(decoded.width, decoded.height);
  const canvas = document.createElement('canvas');
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext('2d');
  if (!context) throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
  const pixels = new ImageData(decoded.width, decoded.height);
  pixels.data.set(decoded.data);
  context.putImageData(pixels, 0, 0);
  return {
    drawable: canvas,
    width: canvas.width,
    height: canvas.height,
    dispose: () => undefined
  };
}

async function decodeWithOrientation(blob: Blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(blob);
  }
}

async function decodeSvg(blob: Blob): Promise<DecodedEditorSource> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new AppError('DECODE_FAILED', 'SVG could not be decoded.'));
      image.src = url;
    });
    assertDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
    context.drawImage(image, 0, 0);
    return {
      drawable: canvas,
      width: canvas.width,
      height: canvas.height,
      dispose: () => undefined
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function assertDimensions(width: number, height: number) {
  if (
    width <= 0 ||
    height <= 0 ||
    width > 32_768 ||
    height > 32_768 ||
    width * height > 120_000_000
  ) {
    throw new AppError('PIXEL_LIMIT', `Decoded dimensions ${width}×${height} are not safe.`);
  }
}
