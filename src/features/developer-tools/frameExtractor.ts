import { AppError } from '../../engine/errors/AppError';
import { MAX_RETAINED_OUTPUT_BYTES } from '../../engine/memory/browserBudgets';
import { validateImageFile } from '../../engine/validation/validateFile';

const MAX_FRAMES = 120;
const MAX_FRAME_PIXELS = 40_000_000;
const MAX_AGGREGATE_FRAME_PIXELS = 120_000_000;

interface DecodedFrame {
  readonly image: CanvasImageSource & {
    readonly displayWidth: number;
    readonly displayHeight: number;
    close(): void;
  };
  readonly complete: boolean;
}

interface LocalImageDecoder {
  readonly tracks: {
    readonly ready: Promise<void>;
    readonly selectedTrack?: { readonly frameCount: number };
  };
  decode(options: { frameIndex: number }): Promise<DecodedFrame>;
  close(): void;
}

interface LocalImageDecoderConstructor {
  new (options: { data: ReadableStream<Uint8Array>; type: string }): LocalImageDecoder;
  isTypeSupported(type: string): Promise<boolean>;
}

export interface ExtractedFrame {
  readonly filename: string;
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
}

export async function extractImageFrames(
  file: File,
  options: {
    readonly maximumFrames?: number;
    readonly signal?: AbortSignal;
    readonly onProgress?: (completed: number, total: number) => void;
  } = {}
) {
  const validation = await validateImageFile(file);
  if (!validation.supportedByConverter) {
    throw new AppError('UNSUPPORTED_FORMAT', 'The selected file has no verified local decoder.');
  }
  const Decoder = Reflect.get(globalThis, 'ImageDecoder') as
    LocalImageDecoderConstructor | undefined;
  if (!Decoder || typeof file.stream !== 'function') {
    throw new AppError(
      'UNSUPPORTED_BROWSER_FEATURE',
      'Animated frame extraction requires the browser ImageDecoder API.'
    );
  }
  if (!(await Decoder.isTypeSupported(validation.mime))) {
    throw new AppError(
      'UNSUPPORTED_FORMAT',
      `${file.type || 'This format'} cannot be frame-decoded.`
    );
  }
  const decoder = new Decoder({ data: file.stream(), type: validation.mime });
  try {
    await decoder.tracks.ready;
    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
    if (frameCount < 1) throw new AppError('DECODE_FAILED', 'No decodable frames were found.');
    const total = Math.min(
      frameCount,
      Math.max(1, Math.min(MAX_FRAMES, options.maximumFrames ?? MAX_FRAMES))
    );
    const frames: ExtractedFrame[] = [];
    let aggregatePixels = 0;
    let aggregateBytes = 0;
    for (let index = 0; index < total; index += 1) {
      if (options.signal?.aborted) throw new AppError('CANCELLED');
      const decoded = await decoder.decode({ frameIndex: index });
      try {
        const width = decoded.image.displayWidth;
        const height = decoded.image.displayHeight;
        const pixels = width * height;
        if (
          !Number.isSafeInteger(pixels) ||
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          width < 1 ||
          height < 1 ||
          width > 32_768 ||
          height > 32_768 ||
          pixels > MAX_FRAME_PIXELS ||
          aggregatePixels + pixels > MAX_AGGREGATE_FRAME_PIXELS
        ) {
          throw new AppError('PIXEL_LIMIT', 'Animated frame dimensions exceed safety limits.');
        }
        aggregatePixels += pixels;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context)
          throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
        context.drawImage(decoded.image, 0, 0);
        const blob = await canvasToBlob(canvas);
        aggregateBytes += blob.size;
        if (aggregateBytes > MAX_RETAINED_OUTPUT_BYTES) {
          throw new AppError('MEMORY_LIMIT', 'Extracted frames exceed the 512 MiB output budget.');
        }
        frames.push({
          filename: `frame-${String(index + 1).padStart(3, '0')}.png`,
          blob,
          width,
          height
        });
      } finally {
        decoded.image.close();
      }
      options.onProgress?.(index + 1, total);
    }
    return { frames, sourceFrameCount: frameCount, truncated: frameCount > total };
  } finally {
    decoder.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError('ENCODE_FAILED'))),
      'image/png'
    )
  );
}
