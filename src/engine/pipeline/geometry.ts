import type { ImageCrop, ImageRotation, NativeProcessingOptions } from '../../types/images';

export interface TransformGeometry {
  readonly crop: ImageCrop;
  readonly drawWidth: number;
  readonly drawHeight: number;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly rotation: ImageRotation;
}

export function resolveTransformGeometry(
  sourceWidth: number,
  sourceHeight: number,
  options: Pick<
    NativeProcessingOptions,
    'crop' | 'fitMode' | 'height' | 'preventUpscale' | 'rotation' | 'width'
  >
): TransformGeometry {
  const requestedCrop = normalizeCrop(sourceWidth, sourceHeight, options.crop);
  const requested = targetDimensions(
    requestedCrop.width,
    requestedCrop.height,
    options.width,
    options.height
  );
  const fitted = resolveFit(
    requestedCrop,
    requested,
    options.fitMode ?? 'crop',
    Boolean(options.preventUpscale)
  );
  const rotation = normalizeRotation(options.rotation ?? 0);
  const rotatedBounds = resolveRotatedBounds(fitted.outputWidth, fitted.outputHeight, rotation);

  return {
    crop: fitted.crop,
    drawWidth: fitted.drawWidth,
    drawHeight: fitted.drawHeight,
    outputWidth: rotatedBounds.width,
    outputHeight: rotatedBounds.height,
    rotation
  };
}

function normalizeRotation(rotation: number) {
  if (!Number.isFinite(rotation)) return 0;
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

function resolveRotatedBounds(width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return {
    width: Math.max(1, Math.ceil(width * cosine + height * sine - 1e-8)),
    height: Math.max(1, Math.ceil(width * sine + height * cosine - 1e-8))
  };
}

function resolveFit(
  crop: ImageCrop,
  requested: { readonly width: number; readonly height: number },
  fitMode: NonNullable<NativeProcessingOptions['fitMode']>,
  preventUpscale: boolean
) {
  if (fitMode === 'contain') {
    const scale = Math.min(requested.width / crop.width, requested.height / crop.height);
    const safeScale = preventUpscale ? Math.min(1, scale) : scale;
    const width = Math.max(1, Math.round(crop.width * safeScale));
    const height = Math.max(1, Math.round(crop.height * safeScale));
    return { crop, drawWidth: width, drawHeight: height, outputWidth: width, outputHeight: height };
  }

  if (fitMode === 'pad') {
    const scale = Math.min(requested.width / crop.width, requested.height / crop.height);
    const safeScale = preventUpscale ? Math.min(1, scale) : scale;
    return {
      crop,
      drawWidth: Math.max(1, Math.round(crop.width * safeScale)),
      drawHeight: Math.max(1, Math.round(crop.height * safeScale)),
      outputWidth: requested.width,
      outputHeight: requested.height
    };
  }

  const nextCrop =
    fitMode === 'cover' ? cropToAspect(crop, requested.width / requested.height) : crop;
  const output = preventUpscale
    ? constrainToSource(requested.width, requested.height, nextCrop.width, nextCrop.height)
    : requested;
  return {
    crop: nextCrop,
    drawWidth: output.width,
    drawHeight: output.height,
    outputWidth: output.width,
    outputHeight: output.height
  };
}

function cropToAspect(crop: ImageCrop, ratio: number): ImageCrop {
  const currentRatio = crop.width / crop.height;
  if (Math.abs(currentRatio - ratio) < 0.0001) return crop;
  if (currentRatio > ratio) {
    const width = Math.max(1, Math.round(crop.height * ratio));
    return { ...crop, x: crop.x + Math.round((crop.width - width) / 2), width };
  }
  const height = Math.max(1, Math.round(crop.width / ratio));
  return { ...crop, y: crop.y + Math.round((crop.height - height) / 2), height };
}

function normalizeCrop(
  sourceWidth: number,
  sourceHeight: number,
  requested?: ImageCrop
): ImageCrop {
  if (!requested) return { x: 0, y: 0, width: sourceWidth, height: sourceHeight };

  const x = clampInteger(requested.x, 0, Math.max(0, sourceWidth - 1));
  const y = clampInteger(requested.y, 0, Math.max(0, sourceHeight - 1));
  const width = clampInteger(requested.width, 1, sourceWidth - x);
  const height = clampInteger(requested.height, 1, sourceHeight - y);
  return { x, y, width, height };
}

function targetDimensions(
  sourceWidth: number,
  sourceHeight: number,
  requestedWidth?: number,
  requestedHeight?: number
) {
  const width = positiveInteger(requestedWidth);
  const height = positiveInteger(requestedHeight);
  if (width && height) return { width, height };
  if (width) {
    return {
      width,
      height: Math.max(1, Math.round((sourceHeight / sourceWidth) * width))
    };
  }
  if (height) {
    return {
      width: Math.max(1, Math.round((sourceWidth / sourceHeight) * height)),
      height
    };
  }
  return { width: sourceWidth, height: sourceHeight };
}

function constrainToSource(
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number
) {
  const scale = Math.min(1, sourceWidth / width, sourceHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function positiveInteger(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.max(1, Math.round(value));
}

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
