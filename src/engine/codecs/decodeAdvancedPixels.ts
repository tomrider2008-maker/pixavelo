import type { ImageFormat } from '../../types/images';
import type { DecodedPixels } from './decodedPixels';

export async function decodeAdvancedPixels(
  format: ImageFormat,
  input: ArrayBuffer
): Promise<DecodedPixels> {
  if (format === 'avif') {
    const { decodeAvif } = await import('./avifDecoder');
    return decodeAvif(input);
  }
  if (format === 'heic' || format === 'heif') {
    const { decodeHeif } = await import('./heifDecoder');
    return decodeHeif(input);
  }
  if (format === 'tiff') {
    const { decodeTiff } = await import('./tiffDecoder');
    return decodeTiff(input);
  }
  throw new Error(`No pixel-buffer decoder is registered for ${format}.`);
}
