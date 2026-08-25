import type { ImageCodec } from './types';

export function loadAvifFallbackCodec(): Promise<ImageCodec> {
  return Promise.resolve({
    capabilities: {
      id: 'avif-wasm-fallback',
      label: 'AVIF WebAssembly fallback',
      supportedInputFormats: ['avif'],
      supportedOutputFormats: [],
      supportsAlpha: true,
      supportsAnimation: false,
      supportsLossless: true,
      supportsQuality: false,
      supportsMetadata: false,
      supportsICC: false,
      maximumDimensions: 32_768,
      browserDependencies: ['WebAssembly', 'OffscreenCanvas or HTML canvas'],
      wasmRequired: true
    },
    available: typeof WebAssembly !== 'undefined'
  });
}
