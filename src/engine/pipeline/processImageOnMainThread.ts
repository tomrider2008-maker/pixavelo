import type {
  ImageFormat,
  NativeProcessingOptions,
  ProcessedImage,
  ProcessingStage
} from '../../types/images';
import { decodeAdvancedPixels } from '../codecs/decodeAdvancedPixels';
import { AppError, toAppError } from '../errors/AppError';
import { encodeToTargetWithResize } from './encodeToTargetWithResize';
import { resolveTransformGeometry } from './geometry';
import { detectImageFormat } from '../validation/signatures';
import { outputHasMetadata } from '../validation/outputMetadata';
import { stripOutputMetadata } from '../validation/stripOutputMetadata';
import { drawTextWatermark } from './drawWatermark';
import { applyImageAdjustments, buildCanvasFilter } from './imageAdjustments';
import { applyPixelEdits } from './applyPixelEdits';

interface MainThreadProcessingInput {
  readonly file: Blob;
  readonly detectedFormat: ImageFormat;
  readonly options: NativeProcessingOptions;
  readonly signal?: AbortSignal;
  readonly onProgress?: (stage: ProcessingStage) => void;
}

export async function processImageOnMainThread(
  input: MainThreadProcessingInput
): Promise<ProcessedImage> {
  const startedAt = performance.now();
  let stage: ProcessingStage = 'preparing';
  let sourceBitmap: ImageBitmap | undefined;
  let sourceCanvas: HTMLCanvasElement | undefined;
  let outputBitmap: ImageBitmap | undefined;

  try {
    reportStage(input, stage);
    assertNotCancelled(input.signal);
    await yieldToBrowser();

    stage = 'decoding';
    reportStage(input, stage);
    const decoded = await decodeSource(input.file, input.detectedFormat);
    sourceBitmap = decoded.bitmap;
    sourceCanvas = decoded.canvas;
    const source = sourceBitmap ?? sourceCanvas;
    if (!source) throw new AppError('DECODE_FAILED', 'The decoder returned no drawable image.');
    assertDimensions(source.width, source.height);
    assertNotCancelled(input.signal);

    stage = 'processing';
    reportStage(input, stage);
    const geometry = resolveTransformGeometry(source.width, source.height, input.options);
    assertDimensions(geometry.outputWidth, geometry.outputHeight);
    const canvas = document.createElement('canvas');
    canvas.width = geometry.outputWidth;
    canvas.height = geometry.outputHeight;
    const context = canvas.getContext('2d', {
      alpha: input.options.outputFormat !== 'jpeg'
    });
    if (!context) throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');

    if (input.options.outputFormat === 'jpeg' || input.options.fitMode === 'pad') {
      context.fillStyle = input.options.background ?? '#ffffff';
      context.fillRect(0, 0, geometry.outputWidth, geometry.outputHeight);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.save();
    context.translate(geometry.outputWidth / 2, geometry.outputHeight / 2);
    context.rotate((geometry.rotation * Math.PI) / 180);
    context.scale(input.options.flipHorizontal ? -1 : 1, input.options.flipVertical ? -1 : 1);
    context.filter = buildCanvasFilter(input.options.adjustments);
    context.drawImage(
      source,
      geometry.crop.x,
      geometry.crop.y,
      geometry.crop.width,
      geometry.crop.height,
      -geometry.drawWidth / 2,
      -geometry.drawHeight / 2,
      geometry.drawWidth,
      geometry.drawHeight
    );
    context.restore();
    applyImageAdjustments(
      context,
      geometry.outputWidth,
      geometry.outputHeight,
      input.options.adjustments
    );
    applyPixelEdits(
      context,
      geometry.outputWidth,
      geometry.outputHeight,
      input.options.pixelOperations,
      input.options.cutout
    );
    drawTextWatermark(
      context,
      geometry.outputWidth,
      geometry.outputHeight,
      input.options.watermark
    );
    sourceBitmap?.close();
    sourceBitmap = undefined;
    sourceCanvas = undefined;
    assertNotCancelled(input.signal);

    stage = 'encoding';
    reportStage(input, stage);
    const mime = `image/${input.options.outputFormat}`;
    let encodingCanvas = canvas;
    const encodeAtSize = (width: number, height: number, quality: number) => {
      if (encodingCanvas.width !== width || encodingCanvas.height !== height) {
        const resized = document.createElement('canvas');
        resized.width = width;
        resized.height = height;
        const resizedContext = resized.getContext('2d', {
          alpha: input.options.outputFormat !== 'jpeg'
        });
        if (!resizedContext)
          throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
        resizedContext.imageSmoothingEnabled = true;
        resizedContext.imageSmoothingQuality = 'high';
        resizedContext.drawImage(canvas, 0, 0, width, height);
        encodingCanvas = resized;
      }
      return encodeCanvas(encodingCanvas, mime, quality).then((blob) =>
        stripOutputMetadata(blob, input.options.outputFormat)
      );
    };
    const encoding = input.options.targetBytes
      ? await encodeToTargetWithResize<Blob>({
          width: geometry.outputWidth,
          height: geometry.outputHeight,
          targetBytes: input.options.targetBytes,
          ...(input.options.minimumQuality === undefined
            ? {}
            : { minimumQuality: input.options.minimumQuality }),
          ...(input.options.quality === undefined ? {} : { maximumQuality: input.options.quality }),
          ...(input.options.maximumEncodingPasses === undefined
            ? {}
            : { maximumPasses: input.options.maximumEncodingPasses }),
          ...(input.options.maximumResizePasses === undefined
            ? {}
            : { maximumResizePasses: input.options.maximumResizePasses }),
          allowResize:
            input.options.targetResizeMode === 'allow-resize' ||
            input.options.targetResizeMode === 'maximum-visual-quality',
          encode: encodeAtSize,
          onAttempt: () => assertNotCancelled(input.signal)
        })
      : undefined;
    const outputBlob = encoding
      ? encoding.output
      : await stripOutputMetadata(
          await encodeCanvas(canvas, mime, input.options.quality),
          input.options.outputFormat
        );
    if (outputBlob.type !== mime || outputBlob.size === 0) {
      throw new AppError(
        'ENCODE_FAILED',
        `Requested ${mime}, received ${outputBlob.type || 'an empty output'}.`
      );
    }
    const outputBytes = new Uint8Array(await outputBlob.arrayBuffer());
    if (detectImageFormat(outputBytes.subarray(0, 64)) !== input.options.outputFormat) {
      throw new AppError(
        'OUTPUT_VALIDATION_FAILED',
        'Encoded magic bytes did not match the requested output format.'
      );
    }
    assertNotCancelled(input.signal);

    stage = 'finalizing';
    reportStage(input, stage);
    outputBitmap = await createImageBitmap(outputBlob);
    const outputWidth = encoding?.width ?? geometry.outputWidth;
    const outputHeight = encoding?.height ?? geometry.outputHeight;
    if (outputBitmap.width !== outputWidth || outputBitmap.height !== outputHeight) {
      throw new AppError(
        'OUTPUT_VALIDATION_FAILED',
        'Encoded dimensions did not match the request.'
      );
    }
    outputBitmap.close();
    outputBitmap = undefined;

    return {
      blob: outputBlob,
      mime,
      size: outputBlob.size,
      width: outputWidth,
      height: outputHeight,
      durationMs: performance.now() - startedAt,
      metadataRemovedVerified: !outputHasMetadata(outputBytes, input.options.outputFormat),
      ...(encoding
        ? {
            qualityUsed: encoding.quality,
            encodingPasses: encoding.attempts,
            targetSatisfied: encoding.targetSatisfied,
            targetResizeApplied: encoding.resizePasses > 0
          }
        : input.options.quality === undefined
          ? {}
          : { qualityUsed: input.options.quality, encodingPasses: 1 })
    };
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    const fallback =
      stage === 'decoding'
        ? 'DECODE_FAILED'
        : stage === 'encoding'
          ? 'ENCODE_FAILED'
          : stage === 'finalizing'
            ? 'OUTPUT_VALIDATION_FAILED'
            : 'UNSUPPORTED_BROWSER_FEATURE';
    throw toAppError(error, fallback);
  } finally {
    sourceBitmap?.close();
    outputBitmap?.close();
  }
}

async function decodeWithOrientation(blob: Blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(blob);
  }
}

async function decodeSource(blob: Blob, format: ImageFormat) {
  if (format === 'svg') return { bitmap: undefined, canvas: await decodeSvgToCanvas(blob) };
  if (format !== 'heic' && format !== 'heif' && format !== 'tiff') {
    try {
      return { bitmap: await decodeWithOrientation(blob), canvas: undefined };
    } catch (error: unknown) {
      if (format !== 'avif') throw error;
      const fallback = await decodeAdvancedPixels(format, await blob.arrayBuffer());
      return { bitmap: undefined, canvas: pixelsToCanvas(fallback) };
    }
  }
  const decoded = await decodeAdvancedPixels(format, await blob.arrayBuffer());
  return { bitmap: undefined, canvas: pixelsToCanvas(decoded) };
}

function pixelsToCanvas(decoded: Awaited<ReturnType<typeof decodeAdvancedPixels>>) {
  assertDimensions(decoded.width, decoded.height);
  const canvas = document.createElement('canvas');
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext('2d');
  if (!context) throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
  const pixels = new ImageData(decoded.width, decoded.height);
  pixels.data.set(decoded.data);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function decodeSvgToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new AppError('DECODE_FAILED', 'Sanitized SVG could not be decoded.'));
    });
    image.src = url;
    await loaded;
    assertDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
    context.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encodeCanvas(canvas: HTMLCanvasElement, mime: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError('ENCODE_FAILED'))),
      mime,
      quality
    );
  });
}

function assertDimensions(width: number, height: number) {
  const pixels = width * height;
  if (width <= 0 || height <= 0 || !Number.isSafeInteger(pixels)) {
    throw new AppError('DECODE_FAILED', 'The decoder returned invalid dimensions.');
  }
  if (width > 32_768 || height > 32_768 || pixels > 120_000_000) {
    throw new AppError(
      'PIXEL_LIMIT',
      `Decoded dimensions ${width}×${height} exceed safety limits.`
    );
  }
}

function assertNotCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new AppError('CANCELLED');
}

function reportStage(input: MainThreadProcessingInput, stage: ProcessingStage) {
  input.onProgress?.(stage);
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}
