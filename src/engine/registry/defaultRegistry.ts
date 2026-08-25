import { loadNativeCanvasCodec } from '../codecs/nativeCodec';
import { CodecRegistry } from './CodecRegistry';

export const codecRegistry = new CodecRegistry();

codecRegistry.register({
  id: 'native-canvas',
  load: loadNativeCanvasCodec
});

codecRegistry.register({
  id: 'avif-wasm-fallback',
  load: () =>
    import('../codecs/avifCodec').then(({ loadAvifFallbackCodec }) => loadAvifFallbackCodec())
});

codecRegistry.register({
  id: 'heif-wasm',
  load: () => import('../codecs/heifCodec').then(({ loadHeifCodec }) => loadHeifCodec())
});

codecRegistry.register({
  id: 'tiff-js',
  load: () => import('../codecs/tiffCodec').then(({ loadTiffCodec }) => loadTiffCodec())
});
