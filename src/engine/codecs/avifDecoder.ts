import type { DecodedPixels } from './decodedPixels';

export async function decodeAvif(input: ArrayBuffer): Promise<DecodedPixels> {
  const { default: decode } = await import('@jsquash/avif/decode.js');
  const decoded = await decode(input, { bitDepth: 8 });
  if (!decoded?.width || !decoded.height) {
    throw new Error('The AVIF fallback decoder returned no image.');
  }
  if (decoded.data.length !== decoded.width * decoded.height * 4) {
    throw new Error('The AVIF fallback decoder returned an invalid pixel buffer.');
  }
  return {
    width: decoded.width,
    height: decoded.height,
    data: new Uint8ClampedArray(decoded.data)
  };
}
