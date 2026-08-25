import type { ImageCrop } from '../../types/images';

export type CropHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export function fitCropToAspect(
  sourceWidth: number,
  sourceHeight: number,
  ratio: number
): ImageCrop {
  const sourceRatio = sourceWidth / sourceHeight;
  const width = sourceRatio > ratio ? Math.round(sourceHeight * ratio) : sourceWidth;
  const height = sourceRatio > ratio ? sourceHeight : Math.round(sourceWidth / ratio);
  return {
    x: Math.round((sourceWidth - width) / 2),
    y: Math.round((sourceHeight - height) / 2),
    width,
    height
  };
}

export function clampCrop(crop: ImageCrop, sourceWidth: number, sourceHeight: number): ImageCrop {
  const x = clamp(Math.round(crop.x), 0, Math.max(0, sourceWidth - 1));
  const y = clamp(Math.round(crop.y), 0, Math.max(0, sourceHeight - 1));
  return {
    x,
    y,
    width: clamp(Math.round(crop.width), 1, sourceWidth - x),
    height: clamp(Math.round(crop.height), 1, sourceHeight - y)
  };
}

export function transformCrop(
  crop: ImageCrop,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  sourceWidth: number,
  sourceHeight: number,
  minimumSize = 20
): ImageCrop {
  if (handle === 'move') {
    return {
      ...crop,
      x: clamp(Math.round(crop.x + deltaX), 0, sourceWidth - crop.width),
      y: clamp(Math.round(crop.y + deltaY), 0, sourceHeight - crop.height)
    };
  }

  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;
  if (handle.includes('w')) left = clamp(Math.round(left + deltaX), 0, right - minimumSize);
  if (handle.includes('e'))
    right = clamp(Math.round(right + deltaX), left + minimumSize, sourceWidth);
  if (handle.includes('n')) top = clamp(Math.round(top + deltaY), 0, bottom - minimumSize);
  if (handle.includes('s'))
    bottom = clamp(Math.round(bottom + deltaY), top + minimumSize, sourceHeight);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
