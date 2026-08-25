import type { ImageFormat } from '../../types/images';
import { assertSvgSourceSize, sanitizeSvg } from '../validation/sanitizeSvg';

export async function prepareImageInput(
  file: Blob,
  format: ImageFormat,
  detectedMime: string
): Promise<Blob> {
  if (format !== 'svg') return file;
  assertSvgSourceSize(file.size);
  const sanitized = sanitizeSvg(await file.text());
  return new Blob([sanitized.text], { type: detectedMime });
}
