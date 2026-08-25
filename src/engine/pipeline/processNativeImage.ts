import type {
  ImageDimensions,
  ImageFormat,
  NativeProcessingOptions,
  ProcessedImage,
  ProcessingStage
} from '../../types/images';
import { canUseNativeWorker, probeNativeEncoding } from '../codecs/nativeCodec';
import { AppError } from '../errors/AppError';
import { estimateImageMemory, type MemoryCategory } from '../memory/estimateMemory';
import { codecRegistry } from '../registry/defaultRegistry';
import { NativeWorkerPool } from '../workers/NativeWorkerPool';
import { processImageOnMainThread } from './processImageOnMainThread';
import { prepareImageInput } from './prepareImageInput';

const workerPool = new NativeWorkerPool();
let mainThreadQueue: Promise<void> = Promise.resolve();

interface ProcessNativeImageInput {
  readonly file: Blob;
  readonly detectedMime: string;
  readonly detectedFormat: ImageFormat;
  readonly options: NativeProcessingOptions;
  readonly dimensions?: ImageDimensions;
  readonly signal?: AbortSignal;
  readonly onProgress?: (stage: ProcessingStage) => void;
}

export async function processNativeImage(input: ProcessNativeImageInput): Promise<ProcessedImage> {
  if (input.options.targetBytes && input.options.outputFormat === 'png') {
    throw new AppError(
      'UNSUPPORTED_FORMAT',
      'Target-size compression requires the JPEG or WebP encoder.'
    );
  }

  const [decoder, encoder] = await Promise.all([
    codecRegistry.findDecoder(input.detectedFormat),
    codecRegistry.findEncoder(input.options.outputFormat)
  ]);
  if (!decoder) {
    throw new AppError(
      'UNSUPPORTED_BROWSER_FEATURE',
      `No available decoder is declared for ${input.detectedFormat.toUpperCase()}.`
    );
  }
  if (!encoder)
    throw new AppError('UNSUPPORTED_BROWSER_FEATURE', 'Native canvas codec is unavailable.');

  const encodingAvailable = await probeNativeEncoding(input.options.outputFormat);
  if (!encodingAvailable) {
    throw new AppError(
      'UNSUPPORTED_BROWSER_FEATURE',
      `The browser does not provide a real ${input.options.outputFormat.toUpperCase()} encoder.`
    );
  }

  const preparedInput = await prepareImageInput(
    input.file,
    input.detectedFormat,
    input.detectedMime
  );

  if (!canUseNativeWorker() || input.detectedFormat === 'svg') {
    return enqueueMainThreadProcessing({ ...input, file: preparedInput });
  }

  const buffer = await preparedInput.arrayBuffer();
  const category: MemoryCategory = input.dimensions
    ? estimateImageMemory(input.dimensions).category
    : 'medium';

  return workerPool.process({
    input: buffer,
    inputMime: input.detectedMime,
    inputFormat: input.detectedFormat,
    options: input.options,
    category,
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.onProgress ? { onProgress: input.onProgress } : {})
  });
}

function enqueueMainThreadProcessing(input: ProcessNativeImageInput): Promise<ProcessedImage> {
  const result = mainThreadQueue.then(() => processImageOnMainThread(input));
  mainThreadQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}
