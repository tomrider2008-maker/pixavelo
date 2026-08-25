import type { ImageCodec } from './types';

export function loadHeifCodec(): Promise<ImageCodec> {
  return Promise.resolve({
    capabilities: {
      id: 'heif-wasm',
      label: 'HEIF WebAssembly decoder',
      supportedInputFormats: ['heic', 'heif'],
      supportedOutputFormats: [],
      supportsAlpha: true,
      supportsAnimation: false,
      supportsLossless: true,
      supportsQuality: false,
      supportsMetadata: false,
      supportsICC: false,
      maximumDimensions: 32_768,
      browserDependencies: ['WebAssembly', 'Worker', 'OffscreenCanvas or HTML canvas'],
      wasmRequired: true
    },
    available: typeof WebAssembly !== 'undefined'
  });
}
