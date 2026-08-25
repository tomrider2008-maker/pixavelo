import type { ImageValidationReport } from '../../types/images';

export function canPreviewOriginal(format: ImageValidationReport['format'] | undefined) {
  return Boolean(
    format && ['jpeg', 'png', 'webp', 'avif', 'bmp', 'gif', 'svg', 'ico'].includes(format)
  );
}
