import UTIF from 'utif';
import type { DecodedPixels } from './decodedPixels';

export function decodeTiff(input: ArrayBuffer): DecodedPixels {
  const directories = UTIF.decode(input);
  const firstPage = directories[0];
  if (!firstPage) throw new Error('The TIFF file does not contain a decodable image directory.');
  UTIF.decodeImage(input, firstPage);
  const width = firstPage.width;
  const height = firstPage.height;
  if (!width || !height) throw new Error('The TIFF decoder returned invalid dimensions.');
  const rgba = UTIF.toRGBA8(firstPage);
  if (rgba.length !== width * height * 4) {
    throw new Error('The TIFF decoder returned an invalid pixel buffer.');
  }
  return { width, height, data: new Uint8ClampedArray(rgba) };
}
