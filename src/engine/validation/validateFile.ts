import { AppError } from '../errors/AppError';
import { getInputFormatCapability, isConverterInputFormat } from '../codecs/inputCapabilities';
import type {
  CoreImageFormat,
  ImageFormat,
  ImageValidationReport,
  ValidationWarning
} from '../../types/images';
import { detectImageFormat, isAnimatedAvif, readImageDimensions } from './signatures';
import { assertSvgSourceSize, sanitizeSvg } from './sanitizeSvg';

const HEADER_BYTES = 64 * 1024;
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_DIMENSION = 32_768;
const MAX_PIXELS = 120_000_000;
const MAX_HEAVY_CODEC_BYTES = 128 * 1024 * 1024;
const CORE_FORMATS = new Set<CoreImageFormat>(['jpeg', 'png', 'webp']);

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  unknown: 'application/octet-stream'
};

const EXTENSION_BY_FORMAT: Record<ImageFormat, readonly string[]> = {
  jpeg: ['jpg', 'jpeg', 'jfif'],
  png: ['png'],
  webp: ['webp'],
  avif: ['avif'],
  bmp: ['bmp'],
  gif: ['gif'],
  heic: ['heic'],
  heif: ['heif'],
  tiff: ['tif', 'tiff'],
  svg: ['svg'],
  ico: ['ico'],
  unknown: []
};

export async function validateImageFile(file: File): Promise<ImageValidationReport> {
  if (file.size === 0) throw new AppError('INVALID_FILE', 'The file is empty.');
  if (file.size > MAX_FILE_BYTES) {
    throw new AppError(
      'MEMORY_LIMIT',
      `Source size ${file.size} exceeds the 500 MiB intake limit.`
    );
  }

  const bytes = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const format = detectImageFormat(bytes);
  if (format === 'unknown')
    throw new AppError('INVALID_FILE', 'No supported image signature was found.');

  if (['avif', 'heic', 'heif', 'tiff'].includes(format) && file.size > MAX_HEAVY_CODEC_BYTES) {
    throw new AppError(
      'MEMORY_LIMIT',
      `${format.toUpperCase()} source size exceeds the 128 MiB local decoder limit.`
    );
  }

  let dimensions = readImageDimensions(format, bytes);
  if (format === 'svg') {
    assertSvgSourceSize(file.size);
    const sanitized = sanitizeSvg(await file.text());
    dimensions = sanitized.dimensions;
  }
  if (!dimensions) {
    throw new AppError(
      'INVALID_FILE',
      'Safe image dimensions could not be established within the bounded header scan.'
    );
  }
  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    throw new AppError(
      'PIXEL_LIMIT',
      `Dimension ${dimensions.width}×${dimensions.height} exceeds ${MAX_DIMENSION}px.`
    );
  }
  if (dimensions.pixels > MAX_PIXELS) {
    throw new AppError(
      'PIXEL_LIMIT',
      `${dimensions.megapixels.toFixed(1)} MP exceeds the 120 MP safety limit.`
    );
  }

  const warnings: ValidationWarning[] = [];
  const extension = file.name.includes('.')
    ? file.name.split('.').at(-1)?.toLocaleLowerCase()
    : undefined;
  if (extension && !EXTENSION_BY_FORMAT[format].includes(extension)) {
    warnings.push({
      code: 'EXTENSION_MISMATCH',
      message: `The .${extension} extension does not match the detected ${format.toUpperCase()} signature.`
    });
  }

  const expectedMime = MIME_BY_FORMAT[format];
  if (
    file.type &&
    file.type !== expectedMime &&
    !(format === 'jpeg' && file.type === 'image/jpg')
  ) {
    warnings.push({
      code: 'MIME_MISMATCH',
      message: `The browser reported ${file.type}, but the file signature indicates ${expectedMime}.`
    });
  }

  if (format === 'gif') {
    warnings.push({
      code: 'ANIMATION_FIRST_FRAME',
      message: 'GIF import is static. Animated files export the first composited frame only.'
    });
  }
  if (format === 'avif' && isAnimatedAvif(bytes)) {
    warnings.push({
      code: 'ANIMATION_FIRST_FRAME',
      message: 'Animated AVIF export uses the first composited frame only.'
    });
  }
  if (format === 'tiff') {
    warnings.push({
      code: 'TIFF_FIRST_PAGE',
      message: 'TIFF import exports page 1 only; additional pages stay in the source file.'
    });
  }
  if (format === 'heic' || format === 'heif') {
    warnings.push({
      code: 'HEIF_PRIMARY_IMAGE',
      message:
        'HEIF import exports the primary image only; sequences and auxiliary images are not included.'
    });
  }
  if (format === 'ico') {
    warnings.push({
      code: 'ICO_BROWSER_SIZE',
      message: 'ICO import uses the embedded size selected by this browser.'
    });
  }

  const decoder = getInputFormatCapability(format);
  if (!decoder || !isConverterInputFormat(format)) {
    throw new AppError('UNSUPPORTED_FORMAT', `No decoder is declared for ${format}.`);
  }

  return {
    format,
    mime: expectedMime,
    dimensions,
    supportedByCoreCodec: CORE_FORMATS.has(format as CoreImageFormat),
    supportedByConverter: true,
    decoder: {
      id: decoder.id,
      label: decoder.label,
      route: decoder.route,
      loadedOnDemand: decoder.loadedOnDemand,
      ...(decoder.fallbackLoadedOnDemand ? { fallbackLoadedOnDemand: true } : {})
    },
    warnings
  };
}

export function mimeForFormat(format: CoreImageFormat): string {
  return MIME_BY_FORMAT[format];
}
