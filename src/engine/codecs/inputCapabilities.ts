import type { ImageFormat, InputDecoderDeclaration } from '../../types/images';

export interface InputFormatCapability extends InputDecoderDeclaration {
  readonly format: Exclude<ImageFormat, 'unknown'>;
  readonly formatLabel: string;
  readonly detail: string;
}

export const inputFormatCapabilities = [
  declaration(
    'jpeg',
    'JPEG',
    'native-canvas',
    'Browser native',
    'core-native',
    false,
    'Decode and encode'
  ),
  declaration(
    'png',
    'PNG',
    'native-canvas',
    'Browser native',
    'core-native',
    false,
    'Decode and encode'
  ),
  declaration(
    'webp',
    'WebP',
    'native-canvas',
    'Browser native',
    'core-native',
    false,
    'Decode and encode'
  ),
  declaration(
    'avif',
    'AVIF',
    'native-advanced',
    'Native + local fallback',
    'browser-native',
    false,
    'Import; native-first with a lazy WASM fallback',
    true
  ),
  declaration(
    'bmp',
    'BMP',
    'native-advanced',
    'Browser native',
    'browser-native',
    false,
    'Import; verified per file'
  ),
  declaration(
    'gif',
    'GIF',
    'native-advanced',
    'Browser native',
    'browser-native',
    false,
    'Static export; animation disclosed'
  ),
  declaration(
    'svg',
    'SVG',
    'sanitized-svg',
    'Sanitized browser',
    'browser-native',
    false,
    'Strict active-content rejection'
  ),
  declaration(
    'ico',
    'ICO',
    'native-advanced',
    'Browser native',
    'browser-native',
    false,
    'Browser-selected embedded size'
  ),
  declaration(
    'heic',
    'HEIC',
    'heif-wasm',
    'HEIF WASM',
    'lazy-wasm',
    true,
    'Primary image; loaded on demand'
  ),
  declaration(
    'heif',
    'HEIF',
    'heif-wasm',
    'HEIF WASM',
    'lazy-wasm',
    true,
    'Primary image; loaded on demand'
  ),
  declaration(
    'tiff',
    'TIFF',
    'tiff-js',
    'TIFF decoder',
    'lazy-javascript',
    true,
    'First page; loaded on demand'
  )
] as const satisfies readonly InputFormatCapability[];

const byFormat = new Map<ImageFormat, InputFormatCapability>(
  inputFormatCapabilities.map((capability) => [capability.format, capability])
);

export const advancedInputCapabilities = inputFormatCapabilities.filter(
  (capability) => !['jpeg', 'png', 'webp'].includes(capability.format)
);

export function getInputFormatCapability(format: ImageFormat): InputFormatCapability | undefined {
  return byFormat.get(format);
}

export function isConverterInputFormat(format: ImageFormat): boolean {
  return byFormat.has(format);
}

function declaration(
  format: Exclude<ImageFormat, 'unknown'>,
  formatLabel: string,
  id: string,
  label: string,
  route: InputDecoderDeclaration['route'],
  loadedOnDemand: boolean,
  detail: string,
  fallbackLoadedOnDemand = false
): InputFormatCapability {
  return {
    format,
    formatLabel,
    id,
    label,
    route,
    loadedOnDemand,
    detail,
    ...(fallbackLoadedOnDemand ? { fallbackLoadedOnDemand: true } : {})
  };
}
