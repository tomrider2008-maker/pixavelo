import type { ImageCodec } from './types';

export function loadTiffCodec(): Promise<ImageCodec> {
  return Promise.resolve({
    capabilities: {
      id: 'tiff-js',
      label: 'TIFF JavaScript decoder',
      supportedInputFormats: ['tiff'],
      supportedOutputFormats: [],
      supportsAlpha: true,
      supportsAnimation: false,
      supportsLossless: true,
      supportsQuality: false,
      supportsMetadata: false,
      supportsICC: false,
      maximumDimensions: 32_768,
      browserDependencies: [
        'Worker or browser JavaScript runtime',
        'OffscreenCanvas or HTML canvas'
      ],
      wasmRequired: false
    },
    available: true
  });
}
