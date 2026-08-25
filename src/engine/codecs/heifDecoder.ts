import type { DecodedPixels } from './decodedPixels';

export async function decodeHeif(input: ArrayBuffer): Promise<DecodedPixels> {
  const { decode } = await import('@discourse/heic');
  const decoded = await decode(input);
  if (
    !decoded.width ||
    !decoded.height ||
    decoded.data.length !== decoded.width * decoded.height * 4
  ) {
    throw new Error('The HEIF decoder returned an invalid pixel buffer.');
  }
  return {
    width: decoded.width,
    height: decoded.height,
    data: new Uint8ClampedArray(decoded.data)
  };
}
