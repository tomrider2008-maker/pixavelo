/// <reference lib="webworker" />

import type { ProcessingStage } from '../types/images';
import type {
  FailureResponse,
  ProcessRequest,
  SuccessResponse,
  WorkerRequest,
  WorkerResponse
} from '../engine/workers/protocol';
import { encodeToTargetWithResize } from '../engine/pipeline/encodeToTargetWithResize';
import { resolveTransformGeometry } from '../engine/pipeline/geometry';
import { decodeAdvancedPixels } from '../engine/codecs/decodeAdvancedPixels';
import { detectImageFormat } from '../engine/validation/signatures';
import { outputHasMetadata } from '../engine/validation/outputMetadata';
import { stripOutputMetadata } from '../engine/validation/stripOutputMetadata';
import type { ImageFormat } from '../types/images';
import { drawTextWatermark } from '../engine/pipeline/drawWatermark';
import { applyImageAdjustments, buildCanvasFilter } from '../engine/pipeline/imageAdjustments';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const cancelledJobs = new Set<string>();

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === 'CANCEL') {
    cancelledJobs.add(event.data.jobId);
    return;
  }
  void processImage(event.data);
};

async function processImage(request: ProcessRequest) {
  let stage: ProcessingStage = 'preparing';
  let sourceBitmap: ImageBitmap | undefined;
  let sourceCanvas: OffscreenCanvas | undefined;
  let outputBitmap: ImageBitmap | undefined;

  try {
    progress(request.jobId, stage);
    assertNotCancelled(request.jobId);

    stage = 'decoding';
    progress(request.jobId, stage);
    const decoded = await decodeSource(request.input, request.inputMime, request.inputFormat);
    sourceBitmap = decoded.bitmap;
    sourceCanvas = decoded.canvas;
    const source = sourceBitmap ?? sourceCanvas;
    if (!source)
      throw new WorkerFailure('DECODE_FAILED', 'The decoder returned no drawable image.');
    assertDimensions(source.width, source.height);
    assertNotCancelled(request.jobId);

    stage = 'processing';
    progress(request.jobId, stage);
    const geometry = resolveTransformGeometry(source.width, source.height, request.options);
    const { outputWidth: width, outputHeight: height } = geometry;
    assertDimensions(width, height);

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: request.options.outputFormat !== 'jpeg' });
    if (!context)
      throw new WorkerFailure('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');

    if (request.options.outputFormat === 'jpeg' || request.options.fitMode === 'pad') {
      context.fillStyle = request.options.background ?? '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate((geometry.rotation * Math.PI) / 180);
    context.scale(request.options.flipHorizontal ? -1 : 1, request.options.flipVertical ? -1 : 1);
    context.filter = buildCanvasFilter(request.options.adjustments);
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
    applyImageAdjustments(context, width, height, request.options.adjustments);
    drawTextWatermark(context, width, height, request.options.watermark);
    sourceBitmap?.close();
    sourceBitmap = undefined;
    sourceCanvas = undefined;
    assertNotCancelled(request.jobId);

    stage = 'encoding';
    progress(request.jobId, stage);
    const mime = `image/${request.options.outputFormat}`;
    let encodingCanvas = canvas;
    const encodeAtSize = (targetWidth: number, targetHeight: number, quality: number) => {
      if (encodingCanvas.width !== targetWidth || encodingCanvas.height !== targetHeight) {
        const resized = new OffscreenCanvas(targetWidth, targetHeight);
        const resizedContext = resized.getContext('2d', {
          alpha: request.options.outputFormat !== 'jpeg'
        });
        if (!resizedContext)
          throw new WorkerFailure('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
        resizedContext.imageSmoothingEnabled = true;
        resizedContext.imageSmoothingQuality = 'high';
        resizedContext.drawImage(canvas, 0, 0, targetWidth, targetHeight);
        encodingCanvas = resized;
      }
      return encodingCanvas
        .convertToBlob({ type: mime, quality })
        .then((blob) => stripOutputMetadata(blob, request.options.outputFormat));
    };
    const encode = async (quality?: number) =>
      stripOutputMetadata(
        await canvas.convertToBlob({
          type: mime,
          ...(quality === undefined ? {} : { quality })
        }),
        request.options.outputFormat
      );
    const encoding = request.options.targetBytes
      ? await encodeToTargetWithResize<Blob>({
          width,
          height,
          targetBytes: request.options.targetBytes,
          ...(request.options.minimumQuality === undefined
            ? {}
            : { minimumQuality: request.options.minimumQuality }),
          ...(request.options.quality === undefined
            ? {}
            : { maximumQuality: request.options.quality }),
          ...(request.options.maximumEncodingPasses === undefined
            ? {}
            : { maximumPasses: request.options.maximumEncodingPasses }),
          ...(request.options.maximumResizePasses === undefined
            ? {}
            : { maximumResizePasses: request.options.maximumResizePasses }),
          allowResize:
            request.options.targetResizeMode === 'allow-resize' ||
            request.options.targetResizeMode === 'maximum-visual-quality',
          encode: encodeAtSize,
          onAttempt: () => assertNotCancelled(request.jobId)
        })
      : undefined;
    const outputBlob = encoding ? encoding.output : await encode(request.options.quality);
    if (outputBlob.type !== mime || outputBlob.size === 0) {
      throw new WorkerFailure(
        'ENCODE_FAILED',
        `Requested ${mime}, received ${outputBlob.type || 'an empty output'}.`
      );
    }
    assertNotCancelled(request.jobId);

    stage = 'finalizing';
    progress(request.jobId, stage);
    outputBitmap = await createImageBitmap(outputBlob);
    const outputWidth = encoding?.width ?? width;
    const outputHeight = encoding?.height ?? height;
    if (outputBitmap.width !== outputWidth || outputBitmap.height !== outputHeight) {
      throw new WorkerFailure(
        'OUTPUT_VALIDATION_FAILED',
        'Encoded dimensions did not match the request.'
      );
    }
    outputBitmap.close();
    outputBitmap = undefined;

    const output = await outputBlob.arrayBuffer();
    if (detectImageFormat(new Uint8Array(output.slice(0, 64))) !== request.options.outputFormat) {
      throw new WorkerFailure(
        'OUTPUT_VALIDATION_FAILED',
        'Encoded magic bytes did not match the requested output format.'
      );
    }
    const response: SuccessResponse = {
      type: 'SUCCESS',
      jobId: request.jobId,
      output,
      mime,
      size: output.byteLength,
      width: outputWidth,
      height: outputHeight,
      metadataRemovedVerified: !outputHasMetadata(
        new Uint8Array(output),
        request.options.outputFormat
      ),
      ...(encoding
        ? {
            qualityUsed: encoding.quality,
            encodingPasses: encoding.attempts,
            targetSatisfied: encoding.targetSatisfied,
            targetResizeApplied: encoding.resizePasses > 0
          }
        : request.options.quality === undefined
          ? {}
          : { qualityUsed: request.options.quality, encodingPasses: 1 })
    };
    workerScope.postMessage(response, [output]);
  } catch (error: unknown) {
    const failure = toWorkerFailure(error, stage);
    const response: FailureResponse = {
      type: 'FAILURE',
      jobId: request.jobId,
      code: failure.code,
      ...(failure.detail ? { detail: failure.detail } : {})
    };
    workerScope.postMessage(response);
  } finally {
    sourceBitmap?.close();
    outputBitmap?.close();
    cancelledJobs.delete(request.jobId);
  }
}

async function decodeWithOrientation(blob: Blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(blob);
  }
}

async function decodeSource(input: ArrayBuffer, mime: string, format: ImageFormat) {
  if (format !== 'heic' && format !== 'heif' && format !== 'tiff') {
    try {
      return {
        bitmap: await decodeWithOrientation(new Blob([input], { type: mime })),
        canvas: undefined
      };
    } catch (error: unknown) {
      if (format !== 'avif') throw error;
      const fallback = await decodeAdvancedPixels(format, input);
      return { bitmap: undefined, canvas: pixelsToCanvas(fallback) };
    }
  }
  const decoded = await decodeAdvancedPixels(format, input);
  return { bitmap: undefined, canvas: pixelsToCanvas(decoded) };
}

function pixelsToCanvas(decoded: Awaited<ReturnType<typeof decodeAdvancedPixels>>) {
  assertDimensions(decoded.width, decoded.height);
  const canvas = new OffscreenCanvas(decoded.width, decoded.height);
  const context = canvas.getContext('2d');
  if (!context) throw new WorkerFailure('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
  const pixels = new ImageData(decoded.width, decoded.height);
  pixels.data.set(decoded.data);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function assertDimensions(width: number, height: number) {
  const pixels = width * height;
  if (width <= 0 || height <= 0 || !Number.isSafeInteger(pixels)) {
    throw new WorkerFailure('DECODE_FAILED', 'The decoder returned invalid dimensions.');
  }
  if (width > 32_768 || height > 32_768 || pixels > 120_000_000) {
    throw new WorkerFailure(
      'PIXEL_LIMIT',
      `Decoded dimensions ${width}×${height} exceed safety limits.`
    );
  }
}

function assertNotCancelled(jobId: string) {
  if (cancelledJobs.has(jobId)) throw new WorkerFailure('CANCELLED');
}

function progress(jobId: string, stage: ProcessingStage) {
  const response: WorkerResponse = { type: 'PROGRESS', jobId, stage };
  workerScope.postMessage(response);
}

class WorkerFailure extends Error {
  public constructor(
    public readonly code: FailureResponse['code'],
    public readonly detail?: string
  ) {
    super(detail ?? code);
  }
}

function toWorkerFailure(error: unknown, stage: ProcessingStage): WorkerFailure {
  if (error instanceof WorkerFailure) return error;
  const detail = error instanceof Error ? error.message : String(error);
  if (stage === 'decoding') return new WorkerFailure('DECODE_FAILED', detail);
  if (stage === 'encoding') return new WorkerFailure('ENCODE_FAILED', detail);
  if (stage === 'finalizing') return new WorkerFailure('OUTPUT_VALIDATION_FAILED', detail);
  return new WorkerFailure('UNSUPPORTED_BROWSER_FEATURE', detail);
}

export {};
