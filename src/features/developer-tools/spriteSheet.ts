import { AppError } from '../../engine/errors/AppError';
import { processNativeImage } from '../../engine/pipeline/processNativeImage';
import { validateImageFile } from '../../engine/validation/validateFile';
import { sanitizeFilename } from '../../utils/filenames';
import { calculateSpriteLayout } from './utilityModel';
import type { SpriteSheetSettings } from './types';

export interface SpriteSheetResult {
  readonly image: Blob;
  readonly map: Blob;
  readonly width: number;
  readonly height: number;
  readonly itemCount: number;
}

export async function createSpriteSheet(
  files: readonly File[],
  settings: SpriteSheetSettings,
  options: {
    readonly signal?: AbortSignal;
    readonly onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<SpriteSheetResult> {
  if (files.length < 1) throw new AppError('INVALID_FILE', 'Choose at least one sprite image.');
  if (files.length > 100)
    throw new AppError('MEMORY_LIMIT', 'Sprite sheets support up to 100 files.');
  const layout = calculateSpriteLayout(files.length, settings);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext('2d');
  if (!context) throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
  if (settings.background !== 'transparent') {
    context.fillStyle = settings.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const map: Record<string, { x: number; y: number; width: number; height: number }> = {};

  for (const [index, file] of files.entries()) {
    if (options.signal?.aborted) throw new AppError('CANCELLED');
    const validation = await validateImageFile(file);
    if (!validation.supportedByConverter) {
      throw new AppError('UNSUPPORTED_FORMAT', `${file.name} has no verified local decoder.`);
    }
    const processed = await processNativeImage({
      file,
      detectedMime: validation.mime,
      detectedFormat: validation.format,
      ...(validation.dimensions ? { dimensions: validation.dimensions } : {}),
      options: {
        outputFormat: 'png',
        width: settings.cellWidth,
        height: settings.cellHeight,
        fitMode: 'contain',
        preventUpscale: true,
        background: settings.background === 'transparent' ? '#00000000' : settings.background
      },
      ...(options.signal ? { signal: options.signal } : {})
    });
    const bitmap = await createImageBitmap(processed.blob);
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const x = column * (settings.cellWidth + settings.gap);
    const y = row * (settings.cellHeight + settings.gap);
    context.drawImage(bitmap, x, y, settings.cellWidth, settings.cellHeight);
    bitmap.close();
    map[sanitizeFilename(file.name)] = {
      x,
      y,
      width: settings.cellWidth,
      height: settings.cellHeight
    };
    options.onProgress?.(index + 1, files.length);
  }

  const image = await canvasToBlob(canvas);
  const verification = await createImageBitmap(image);
  if (verification.width !== layout.width || verification.height !== layout.height) {
    verification.close();
    throw new AppError('OUTPUT_VALIDATION_FAILED', 'Sprite sheet dimensions did not verify.');
  }
  verification.close();
  return {
    image,
    map: new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' }),
    width: layout.width,
    height: layout.height,
    itemCount: files.length
  };
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError('ENCODE_FAILED'))),
      'image/png'
    )
  );
}
