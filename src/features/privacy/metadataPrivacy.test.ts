import { describe, expect, it } from 'vitest';
import type { ImageValidationReport } from '../../types/images';
import { cleanImageMetadata } from './metadataCleaner';
import { inspectImageMetadata } from './metadataInspector';
import { policyForPreset } from './metadataPresets';

const validation: ImageValidationReport = {
  format: 'jpeg',
  mime: 'image/jpeg',
  dimensions: { width: 1, height: 1, pixels: 1, megapixels: 0.000001 },
  supportedByCoreCodec: true,
  supportedByConverter: true,
  decoder: {
    id: 'native-jpeg',
    label: 'Browser JPEG',
    route: 'core-native',
    loadedOnDemand: false
  },
  warnings: []
};

describe('Phase 8 metadata privacy engine', () => {
  it('inspects bounded JPEG EXIF, GPS, XMP, IPTC, ICC and real bit depth', async () => {
    const file = metadataBearingJpeg();
    const inspection = await inspectImageMetadata(file, validation, file.name);

    expect(inspection.categoriesPresent).toMatchObject({
      location: true,
      camera: true,
      dates: true,
      software: true,
      author: true,
      exif: true,
      xmp: true,
      iptc: true,
      icc: true
    });
    expect(inspection.general.find((field) => field.id === 'bit-depth')?.value).toContain(
      '8 bits/channel'
    );
    expect(inspection.exif.find((field) => field.id === 'make')?.value).toBe('ACME');
    expect(inspection.gps.find((field) => field.id === 'coordinates')?.value).toContain(
      '37.808333'
    );
  });

  it('removes location selectively, preserves pixels and verifies the exported container', async () => {
    const file = metadataBearingJpeg();
    const sourceInspection = await inspectImageMetadata(file, validation, file.name);
    const result = await cleanImageMetadata({
      file,
      validation,
      sourceInspection,
      policy: policyForPreset('location-only'),
      preset: 'location-only',
      outputFormat: 'jpeg',
      quality: 0.92
    });

    expect(result.pixelPreserving).toBe(true);
    expect(result.metadataRemovedVerified).toBe(true);
    expect(result.verification.verified).toBe(true);
    expect(result.verification.removed).toContain('location');
    expect(result.inspection.categoriesPresent.location).toBe(false);
    expect(result.inspection.categoriesPresent.camera).toBe(true);
    expect(result.inspection.categoriesPresent.icc).toBe(true);
    expect(result.verification.additionalRemovals).toEqual(expect.arrayContaining(['xmp', 'iptc']));
  });

  it('preserves ICC in Privacy Clean and supports explicit whole-EXIF removal', async () => {
    const file = metadataBearingJpeg();
    const sourceInspection = await inspectImageMetadata(file, validation, file.name);
    const privateResult = await cleanImageMetadata({
      file,
      validation,
      sourceInspection,
      policy: policyForPreset('privacy-clean'),
      preset: 'privacy-clean',
      outputFormat: 'jpeg',
      quality: 0.92
    });

    expect(privateResult.inspection.categoriesPresent.icc).toBe(true);
    expect(privateResult.inspection.categoriesPresent.camera).toBe(false);
    expect(privateResult.inspection.categoriesPresent.exif).toBe(true);

    const exifPolicy = { ...policyForPreset('preserve-all'), exif: true };
    const exifResult = await cleanImageMetadata({
      file,
      validation,
      sourceInspection,
      policy: exifPolicy,
      preset: 'custom',
      outputFormat: 'jpeg',
      quality: 0.92
    });
    expect(exifResult.inspection.categoriesPresent.exif).toBe(false);
    expect(exifResult.inspection.categoriesPresent.icc).toBe(true);
    expect(exifResult.verification.removed).toContain('exif');
  });

  it('does not label a preserve-all copy as metadata-removed', async () => {
    const file = metadataBearingJpeg();
    const sourceInspection = await inspectImageMetadata(file, validation, file.name);
    const result = await cleanImageMetadata({
      file,
      validation,
      sourceInspection,
      policy: policyForPreset('preserve-all'),
      preset: 'preserve-all',
      outputFormat: 'jpeg',
      quality: 0.92
    });

    expect(result.blob.size).toBe(file.size);
    expect(result.pixelPreserving).toBe(true);
    expect(result.metadataRemovedVerified).toBe(false);
    expect(result.verification.removed).toEqual([]);
  });

  it('stops retaining metadata after the cumulative block budget', async () => {
    const bytes = join(
      Uint8Array.from([0xff, 0xd8]),
      ...Array.from({ length: 129 }, () => jpegSegment(0xe1, new Uint8Array())),
      Uint8Array.from([0xff, 0xda, 0xff, 0xd9])
    );
    const file = new File([bytes], 'bounded-metadata.jpg', { type: 'image/jpeg' });
    const inspection = await inspectImageMetadata(file, validation, file.name);
    expect(inspection.warnings).toContain(
      'JPEG metadata reached the 32 MiB aggregate inspection limit.'
    );
  });

  it.each([
    ['png', metadataBearingPng],
    ['webp', metadataBearingWebp]
  ] as const)('selectively verifies GPS removal in %s containers', async (format, createFile) => {
    const file = createFile();
    const report: ImageValidationReport = { ...validation, format, mime: `image/${format}` };
    const sourceInspection = await inspectImageMetadata(file, report, file.name);
    expect(sourceInspection.categoriesPresent.location).toBe(true);
    expect(sourceInspection.categoriesPresent.icc).toBe(true);

    const result = await cleanImageMetadata({
      file,
      validation: report,
      sourceInspection,
      policy: policyForPreset('location-only'),
      preset: 'location-only',
      outputFormat: format,
      quality: 0.92
    });

    expect(result.pixelPreserving).toBe(true);
    expect(result.verification.verified).toBe(true);
    expect(result.inspection.categoriesPresent.location).toBe(false);
    expect(result.inspection.categoriesPresent.icc).toBe(true);
  });
});

function metadataBearingJpeg() {
  const exif = join(asciiBytes('Exif\0\0'), buildExifTiff());
  const xmp = asciiBytes(
    'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description photoshop:City="Yangon" xmp:CreatorTool="Pixavelo Test"/></x:xmpmeta>'
  );
  const iptc = Uint8Array.from([
    0x1c,
    0x02,
    0x5a,
    0x00,
    0x06,
    ...asciiBytes('Yangon'),
    0x1c,
    0x02,
    0x50,
    0x00,
    0x09,
    ...asciiBytes('Test User')
  ]);
  const sof = Uint8Array.from([8, 0, 1, 0, 1, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0]);
  const bytes = join(
    Uint8Array.from([0xff, 0xd8]),
    jpegSegment(0xe1, exif),
    jpegSegment(0xe1, xmp),
    jpegSegment(0xe2, asciiBytes('ICC_PROFILE\0test-profile')),
    jpegSegment(0xed, iptc),
    jpegSegment(0xc0, sof),
    Uint8Array.from([0xff, 0xda, 0xff, 0xd9])
  );
  return new File([bytes.buffer], 'travel-with-private-data.jpg', { type: 'image/jpeg' });
}

function metadataBearingPng() {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, 1);
  view.setUint32(4, 1);
  ihdr[8] = 16;
  ihdr[9] = 6;
  const xmpText = join(
    asciiBytes('XML:com.adobe.xmp\0'),
    Uint8Array.from([0, 0, 0, 0, 0]),
    asciiBytes('<x:xmpmeta><rdf:Description photoshop:City="Yangon"/></x:xmpmeta>')
  );
  const bytes = join(
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('eXIf', buildExifTiff()),
    pngChunk('iCCP', asciiBytes('Pixavelo profile\0test-profile')),
    pngChunk('iTXt', xmpText),
    pngChunk('IEND', new Uint8Array())
  );
  return new File([bytes.buffer], 'private.png', { type: 'image/png' });
}

function metadataBearingWebp() {
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x2c;
  const chunks = join(
    webpChunk('VP8X', vp8x),
    webpChunk('EXIF', buildExifTiff()),
    webpChunk(
      'XMP ',
      asciiBytes('<x:xmpmeta><rdf:Description photoshop:City="Yangon"/></x:xmpmeta>')
    ),
    webpChunk('ICCP', asciiBytes('test-profile')),
    webpChunk('VP8 ', Uint8Array.from([0, 0, 0, 0]))
  );
  const header = new Uint8Array(12);
  header.set(asciiBytes('RIFF'), 0);
  new DataView(header.buffer).setUint32(4, 4 + chunks.length, true);
  header.set(asciiBytes('WEBP'), 8);
  const bytes = join(header, chunks);
  return new File([bytes.buffer], 'private.webp', { type: 'image/webp' });
}

function buildExifTiff() {
  const bytes = new Uint8Array(320);
  const view = new DataView(bytes.buffer);
  bytes.set(asciiBytes('II'), 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);

  const ifd0Entries = [
    [0x010f, 2, 5, 100],
    [0x0110, 2, 8, 108],
    [0x0131, 2, 13, 120],
    [0x013b, 2, 10, 136],
    [0x8769, 4, 1, 160],
    [0x8825, 4, 1, 190]
  ] as const;
  writeIfd(view, 8, ifd0Entries);
  bytes.set(asciiBytes('ACME\0'), 100);
  bytes.set(asciiBytes('CAM-100\0'), 108);
  bytes.set(asciiBytes('Studio 4.2\0'), 120);
  bytes.set(asciiBytes('Test User\0'), 136);

  writeIfd(view, 160, [[0x9003, 2, 20, 296]]);
  bytes.set(asciiBytes('2026:08:25 10:30:00\0'), 296);

  view.setUint16(190, 4, true);
  writeEntry(view, 192, 0x0001, 2, 2, 0x004e);
  writeEntry(view, 204, 0x0002, 5, 3, 248);
  writeEntry(view, 216, 0x0003, 2, 2, 0x0045);
  writeEntry(view, 228, 0x0004, 5, 3, 272);
  view.setUint32(240, 0, true);
  writeRationals(view, 248, [
    [37, 1],
    [48, 1],
    [30, 1]
  ]);
  writeRationals(view, 272, [
    [96, 1],
    [9, 1],
    [0, 1]
  ]);
  return bytes;
}

function writeIfd(
  view: DataView,
  offset: number,
  entries: readonly (readonly [number, number, number, number])[]
) {
  view.setUint16(offset, entries.length, true);
  entries.forEach((entry, index) => writeEntry(view, offset + 2 + index * 12, ...entry));
  view.setUint32(offset + 2 + entries.length * 12, 0, true);
}

function writeEntry(
  view: DataView,
  offset: number,
  tag: number,
  type: number,
  count: number,
  value: number
) {
  view.setUint16(offset, tag, true);
  view.setUint16(offset + 2, type, true);
  view.setUint32(offset + 4, count, true);
  view.setUint32(offset + 8, value, true);
}

function writeRationals(
  view: DataView,
  offset: number,
  values: readonly (readonly [number, number])[]
) {
  values.forEach(([numerator, denominator], index) => {
    view.setUint32(offset + index * 8, numerator, true);
    view.setUint32(offset + index * 8 + 4, denominator, true);
  });
}

function jpegSegment(marker: number, payload: Uint8Array) {
  const bytes = new Uint8Array(payload.length + 4);
  bytes.set([0xff, marker, ((payload.length + 2) >>> 8) & 0xff, (payload.length + 2) & 0xff]);
  bytes.set(payload, 4);
  return bytes;
}

function pngChunk(type: string, payload: Uint8Array) {
  const bytes = new Uint8Array(payload.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, payload.length);
  bytes.set(asciiBytes(type), 4);
  bytes.set(payload, 8);
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)));
  return bytes;
}

function webpChunk(type: string, payload: Uint8Array) {
  const bytes = new Uint8Array(8 + payload.length + (payload.length % 2));
  bytes.set(asciiBytes(type), 0);
  new DataView(bytes.buffer).setUint32(4, payload.length, true);
  bytes.set(payload, 8);
  return bytes;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function asciiBytes(value: string) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function join(...parts: readonly Uint8Array[]) {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
