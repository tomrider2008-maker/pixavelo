export type AppErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'DECODE_FAILED'
  | 'ENCODE_FAILED'
  | 'INVALID_FILE'
  | 'UNSAFE_SVG'
  | 'MEMORY_LIMIT'
  | 'PIXEL_LIMIT'
  | 'CODEC_LOAD_FAILED'
  | 'METADATA_FAILED'
  | 'ZIP_FAILED'
  | 'CANCELLED'
  | 'UNSUPPORTED_BROWSER_FEATURE'
  | 'OUTPUT_VALIDATION_FAILED';

const userMessages: Record<AppErrorCode, string> = {
  UNSUPPORTED_FORMAT: 'This image format is not available in the current processing engine.',
  DECODE_FAILED: 'The browser could not decode this image. It may be damaged or unsupported.',
  ENCODE_FAILED: 'The browser could not create the requested output format.',
  INVALID_FILE: 'This file is empty, damaged or not a recognized image.',
  UNSAFE_SVG: 'This SVG contains active or external content that Pixavelo will not render.',
  MEMORY_LIMIT: 'This image may require more memory than the browser can safely use.',
  PIXEL_LIMIT: 'The image dimensions exceed Pixavelo’s current safety limit.',
  CODEC_LOAD_FAILED: 'The required image codec could not be loaded.',
  METADATA_FAILED: 'Image metadata could not be processed safely.',
  ZIP_FAILED: 'The download archive could not be created.',
  CANCELLED: 'Processing was cancelled.',
  UNSUPPORTED_BROWSER_FEATURE:
    'This browser does not provide the required local processing feature.',
  OUTPUT_VALIDATION_FAILED: 'The encoded image could not be verified before download.'
};

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly userMessage: string;
  public readonly causeDetail?: string;

  public constructor(code: AppErrorCode, causeDetail?: string) {
    super(userMessages[code]);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessages[code];
    if (causeDetail !== undefined) this.causeDetail = causeDetail;
  }
}

export function toAppError(error: unknown, fallback: AppErrorCode): AppError {
  if (error instanceof AppError) return error;
  return new AppError(fallback, error instanceof Error ? error.message : String(error));
}
