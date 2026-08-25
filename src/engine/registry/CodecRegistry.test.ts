import { describe, expect, it, vi } from 'vitest';
import type { ImageCodec } from '../codecs/types';
import { CodecRegistry } from './CodecRegistry';

const codec: ImageCodec = {
  available: true,
  capabilities: {
    id: 'test',
    label: 'Test codec',
    supportedInputFormats: ['jpeg'],
    supportedOutputFormats: ['png'],
    supportsAlpha: true,
    supportsAnimation: false,
    supportsLossless: true,
    supportsQuality: false,
    supportsMetadata: false,
    supportsICC: false,
    maximumDimensions: 4096,
    browserDependencies: [],
    wasmRequired: false
  }
};

describe('CodecRegistry', () => {
  it('loads registrations lazily and caches the instance', async () => {
    const registry = new CodecRegistry();
    const load = vi.fn(() => Promise.resolve(codec));
    registry.register({ id: 'test', load });

    expect(load).not.toHaveBeenCalled();
    expect(await registry.findDecoder('jpeg')).toBe(codec);
    expect(await registry.findEncoder('png')).toBe(codec);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate registrations', () => {
    const registry = new CodecRegistry();
    registry.register({ id: 'test', load: () => Promise.resolve(codec) });
    expect(() => registry.register({ id: 'test', load: () => Promise.resolve(codec) })).toThrow(
      'already registered'
    );
  });
});
