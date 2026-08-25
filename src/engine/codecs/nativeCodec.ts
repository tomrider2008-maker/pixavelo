import type { CoreImageFormat } from '../../types/images';
import type { ImageCodec } from './types';

const encodingProbe = new Map<CoreImageFormat, Promise<boolean>>();

export function loadNativeCanvasCodec(): Promise<ImageCodec> {
  const available = canUseNativeWorker() || canUseMainThreadCanvas();

  return Promise.resolve({
    capabilities: {
      id: 'native-canvas',
      label: 'Browser native image codec',
      supportedInputFormats: ['jpeg', 'png', 'webp', 'avif', 'bmp', 'gif', 'svg', 'ico'],
      supportedOutputFormats: ['jpeg', 'png', 'webp'],
      supportsAlpha: true,
      supportsAnimation: false,
      supportsLossless: true,
      supportsQuality: true,
      supportsMetadata: false,
      supportsICC: false,
      maximumDimensions: 32_768,
      browserDependencies: [
        'createImageBitmap with per-file format verification',
        'OffscreenCanvas.convertToBlob or HTMLCanvasElement.toBlob'
      ],
      wasmRequired: false
    },
    available,
    ...(available
      ? {}
      : {
          unavailableReason:
            'Browser-native image decoding and canvas encoding are unavailable in this browser.'
        })
  });
}

export function canUseNativeWorker(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof createImageBitmap !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    'convertToBlob' in OffscreenCanvas.prototype
  );
}

export function canUseMainThreadCanvas(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof createImageBitmap !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'toBlob' in HTMLCanvasElement.prototype
  );
}

export function probeNativeEncoding(format: CoreImageFormat): Promise<boolean> {
  const cached = encodingProbe.get(format);
  if (cached) return cached;

  const probe = new Promise<boolean>((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob(
      (blob) => resolve(blob?.type === `image/${format}`),
      `image/${format}`,
      format === 'png' ? undefined : 0.8
    );
  });
  encodingProbe.set(format, probe);
  return probe;
}
