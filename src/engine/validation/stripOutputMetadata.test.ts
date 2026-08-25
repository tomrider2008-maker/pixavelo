import { describe, expect, it } from 'vitest';
import { outputHasMetadata } from './outputMetadata';
import { stripOutputMetadataBytes } from './stripOutputMetadata';

describe('output metadata stripping', () => {
  it('removes JPEG application metadata while retaining image segments', () => {
    const source = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x04, 0x45, 0x58, 0xff, 0xdb, 0x00, 0x04, 0x01, 0x02, 0xff,
      0xda, 0x00, 0x02, 0xff, 0xd9
    ]);
    const output = stripOutputMetadataBytes(source, 'jpeg');
    expect(outputHasMetadata(output, 'jpeg')).toBe(false);
    expect([...output]).toEqual([
      0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x01, 0x02, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9
    ]);
  });

  it('removes PNG metadata chunks without rewriting retained chunk bytes', () => {
    const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const metadata = pngChunk('tEXt', Uint8Array.from([1, 2]));
    const imageEnd = pngChunk('IEND', new Uint8Array());
    const output = stripOutputMetadataBytes(join(signature, metadata, imageEnd), 'png');
    expect(outputHasMetadata(output, 'png')).toBe(false);
    expect([...output]).toEqual([...join(signature, imageEnd)]);
  });

  it('removes WebP metadata chunks and updates the RIFF length', () => {
    const image = webpChunk('VP8 ', Uint8Array.from([1, 2]));
    const metadata = webpChunk('ICCP', Uint8Array.from([3, 4]));
    const source = webpFile(image, metadata);
    const output = stripOutputMetadataBytes(source, 'webp');
    expect(outputHasMetadata(output, 'webp')).toBe(false);
    expect(
      new DataView(output.buffer, output.byteOffset, output.byteLength).getUint32(4, true)
    ).toBe(output.length - 8);
    expect(new TextDecoder().decode(output.slice(12, 16))).toBe('VP8 ');
  });
});

function pngChunk(type: string, data: Uint8Array) {
  const chunk = new Uint8Array(12 + data.length);
  new DataView(chunk.buffer).setUint32(0, data.length);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(data, 8);
  return chunk;
}

function webpChunk(type: string, data: Uint8Array) {
  const chunk = new Uint8Array(8 + data.length + (data.length % 2));
  chunk.set(new TextEncoder().encode(type), 0);
  new DataView(chunk.buffer).setUint32(4, data.length, true);
  chunk.set(data, 8);
  return chunk;
}

function webpFile(...chunks: readonly Uint8Array[]) {
  const payload = join(...chunks);
  const output = new Uint8Array(12 + payload.length);
  output.set(new TextEncoder().encode('RIFF'), 0);
  new DataView(output.buffer).setUint32(4, output.length - 8, true);
  output.set(new TextEncoder().encode('WEBP'), 8);
  output.set(payload, 12);
  return output;
}

function join(...parts: readonly Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
