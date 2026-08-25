import type { ImageValidationReport } from '../../types/images';
import { formatBytes } from '../../utils/format';
import type { MetadataCategory, MetadataField, MetadataInspection, PrivacySignal } from './types';

const MAX_METADATA_BLOCK_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_METADATA_BYTES = 32 * 1024 * 1024;
const MAX_RETAINED_METADATA_BLOCKS = 128;
const MAX_CONTAINER_SEGMENTS = 4096;
const MAX_IFD_ENTRIES = 2048;
const EXIF_HEADER = 'Exif\0\0';
const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';

interface TextMetadata {
  readonly keyword: string;
  readonly text: string;
}

interface CollectedMetadata {
  readonly exifBlocks: readonly Uint8Array[];
  readonly xmpBlocks: readonly string[];
  readonly iptcBlocks: readonly Uint8Array[];
  readonly textBlocks: readonly TextMetadata[];
  readonly iccBytes: number;
  readonly bitDepth: string;
  readonly metadataBytes: number;
  readonly warnings: readonly string[];
}

interface ParsedExif {
  readonly ifd0: ReadonlyMap<number, unknown>;
  readonly exif: ReadonlyMap<number, unknown>;
  readonly gps: ReadonlyMap<number, unknown>;
  readonly hasThumbnail: boolean;
}

export async function inspectImageMetadata(
  file: Blob,
  validation: ImageValidationReport,
  filename = 'image'
): Promise<MetadataInspection> {
  const collected = await collectMetadata(file, validation.format);
  const parsed = collected.exifBlocks[0] ? parseExif(collected.exifBlocks[0]) : emptyExif();
  const xmpText = collected.xmpBlocks.join('\n');
  const iptc = parseIptc(collected.iptcBlocks);
  const textual = new Map(
    collected.textBlocks.map((entry) => [entry.keyword.toLocaleLowerCase(), entry.text])
  );

  const make = textValue(parsed.ifd0.get(0x010f));
  const model = textValue(parsed.ifd0.get(0x0110));
  const lensMake = textValue(parsed.exif.get(0xa433));
  const lensModel = textValue(parsed.exif.get(0xa434));
  const software =
    textValue(parsed.ifd0.get(0x0131)) ||
    extractXmpValue(xmpText, ['CreatorTool']) ||
    (textual.get('software') ?? '');
  const date =
    textValue(parsed.exif.get(0x9003)) ||
    textValue(parsed.exif.get(0x9004)) ||
    textValue(parsed.ifd0.get(0x0132)) ||
    extractXmpValue(xmpText, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']) ||
    iptc.date ||
    '';
  const artist =
    textValue(parsed.ifd0.get(0x013b)) ||
    extractXmpValue(xmpText, ['creator', 'Artist']) ||
    iptc.author ||
    (textual.get('author') ?? '');
  const copyright =
    textValue(parsed.ifd0.get(0x8298)) ||
    extractXmpValue(xmpText, ['rights', 'Copyright']) ||
    iptc.copyright ||
    (textual.get('copyright') ?? '');

  const gps = readGps(parsed.gps, xmpText, iptc);
  const cameraPresent = Boolean(make || model || lensMake || lensModel);
  const authorPresent = Boolean(artist || copyright);
  const categoriesPresent: Readonly<Record<MetadataCategory, boolean>> = {
    location: gps.present,
    camera: cameraPresent,
    dates: Boolean(date),
    software: Boolean(software),
    author: authorPresent,
    exif: collected.exifBlocks.length > 0,
    xmp: collected.xmpBlocks.length > 0,
    iptc: collected.iptcBlocks.length > 0,
    thumbnail: parsed.hasThumbnail,
    icc: collected.iccBytes > 0
  };

  const general = buildGeneralFields(file, validation, filename, collected.bitDepth);
  const exif = compactFields([
    field('make', 'Camera manufacturer', make, 'camera'),
    field('model', 'Camera model', model, 'camera'),
    field('lens-make', 'Lens manufacturer', lensMake, 'camera'),
    field('lens-model', 'Lens', lensModel, 'camera'),
    field('exposure', 'Exposure', formatExposure(parsed.exif.get(0x829a))),
    field('aperture', 'Aperture', formatAperture(parsed.exif.get(0x829d))),
    field('iso', 'ISO', numberText(parsed.exif.get(0x8827))),
    field('focal-length', 'Focal length', formatFocalLength(parsed.exif.get(0x920a))),
    field('flash', 'Flash', formatFlash(parsed.exif.get(0x9209))),
    field('date', 'Date taken', date, 'dates'),
    field('orientation', 'Orientation', formatOrientation(parsed.ifd0.get(0x0112))),
    field('software', 'Software', software, 'software'),
    field('artist', 'Artist', artist, 'author'),
    field('copyright', 'Copyright', copyright, 'author')
  ]);
  const gpsFields = compactFields([
    field('gps-status', 'GPS metadata', gps.present ? 'Present' : ''),
    field('coordinates', 'Coordinates', gps.coordinates, 'location'),
    field('latitude', 'Latitude', gps.latitude, 'location'),
    field('longitude', 'Longitude', gps.longitude, 'location'),
    field('altitude', 'Altitude', gps.altitude, 'location'),
    field('gps-date', 'GPS date', gps.date, 'location'),
    field('location-name', 'Location name', gps.locationName, 'location')
  ]);
  const other = compactFields([
    field(
      'xmp',
      'XMP',
      collected.xmpBlocks.length > 0 ? `${collected.xmpBlocks.length} block(s)` : '',
      'xmp'
    ),
    field(
      'iptc',
      'IPTC',
      collected.iptcBlocks.length > 0 ? `${collected.iptcBlocks.length} block(s)` : '',
      'iptc'
    ),
    field(
      'icc',
      'ICC profile',
      collected.iccBytes > 0 ? `Embedded · ${formatBytes(collected.iccBytes)}` : '',
      'icc'
    ),
    field('thumbnail', 'Embedded thumbnail', parsed.hasThumbnail ? 'Present' : '', 'thumbnail'),
    ...collected.textBlocks.slice(0, 12).map((entry, index) => ({
      id: `text-${index}`,
      label: entry.keyword || 'Text metadata',
      value: truncate(entry.text, 180)
    }))
  ]);

  const signals: readonly PrivacySignal[] = [
    signal('location', 'GPS Location', gps.present, gps.coordinates || gps.locationName),
    signal('camera', 'Camera Model', cameraPresent, [make, model].filter(Boolean).join(' ')),
    signal('software', 'Device Software', Boolean(software), software),
    signal('date', 'Date Taken', Boolean(date), date),
    signal('author', 'Author', authorPresent, artist || copyright)
  ];

  return {
    format: validation.format,
    mime: validation.mime,
    general,
    exif,
    gps: gpsFields,
    other,
    signals,
    categoriesPresent,
    metadataBytes: collected.metadataBytes,
    warnings: collected.warnings
  };
}

async function collectMetadata(file: Blob, format: ImageValidationReport['format']) {
  if (format === 'jpeg') return collectJpegMetadata(file);
  if (format === 'png') return collectPngMetadata(file);
  if (format === 'webp') return collectWebpMetadata(file);
  if (format === 'tiff') {
    const warnings: string[] = [];
    if (file.size > MAX_METADATA_BLOCK_BYTES) {
      warnings.push(
        'TIFF metadata exceeds the bounded inspector window; only the leading directory was read.'
      );
    }
    const exif = await readBlob(file, 0, Math.min(file.size, MAX_METADATA_BLOCK_BYTES));
    return collected({ exifBlocks: [exif], metadataBytes: exif.length, warnings });
  }
  return collected({
    warnings: [
      `${format.toUpperCase()} metadata fields are not exposed by the current safe parser.`
    ]
  });
}

async function collectJpegMetadata(file: Blob): Promise<CollectedMetadata> {
  const exifBlocks: Uint8Array[] = [];
  const xmpBlocks: string[] = [];
  const iptcBlocks: Uint8Array[] = [];
  const warnings: string[] = [];
  let iccBytes = 0;
  let metadataBytes = 0;
  let bitDepth = '';
  let offset = 2;
  let segments = 0;
  let retainedBlocks = 0;

  while (offset + 4 <= file.size && segments < MAX_CONTAINER_SEGMENTS) {
    const header = await readBlob(file, offset, 4);
    if (header[0] !== 0xff) break;
    const marker = header[1];
    if (marker === undefined || marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      segments += 1;
      continue;
    }
    const length = readUint16(header, 2);
    if (length < 2 || offset + 2 + length > file.size) {
      warnings.push('JPEG metadata ended at a malformed segment boundary.');
      break;
    }
    const payloadLength = length - 2;
    if (isJpegStartOfFrame(marker) && payloadLength >= 6) {
      const payload = await readBlob(file, offset + 4, 6);
      const precision = payload[0];
      const components = payload[5];
      if (precision && components) {
        bitDepth = `${precision} bits/channel · ${components} component${components === 1 ? '' : 's'}`;
      }
    }
    const isMetadata = marker === 0xe1 || marker === 0xe2 || marker === 0xed;
    if (isMetadata) {
      if (
        retainedBlocks >= MAX_RETAINED_METADATA_BLOCKS ||
        metadataBytes + payloadLength > MAX_TOTAL_METADATA_BYTES
      ) {
        warnings.push('JPEG metadata reached the 32 MiB aggregate inspection limit.');
        break;
      }
      if (payloadLength > MAX_METADATA_BLOCK_BYTES) {
        warnings.push('An oversized JPEG metadata segment was skipped.');
      } else {
        const payload = await readBlob(file, offset + 4, payloadLength);
        metadataBytes += payload.length;
        retainedBlocks += 1;
        if (marker === 0xe1 && startsWithAscii(payload, EXIF_HEADER)) {
          exifBlocks.push(payload.subarray(EXIF_HEADER.length));
        } else if (marker === 0xe1) {
          xmpBlocks.push(decodeMetadataText(stripAsciiHeader(payload, XMP_HEADER)));
        } else if (marker === 0xe2) {
          iccBytes += payload.length;
        } else {
          iptcBlocks.push(payload);
        }
      }
    }
    offset += 2 + length;
    segments += 1;
  }
  if (segments >= MAX_CONTAINER_SEGMENTS)
    warnings.push('JPEG segment scan reached its safety limit.');
  return collected({
    exifBlocks,
    xmpBlocks,
    iptcBlocks,
    iccBytes,
    bitDepth,
    metadataBytes,
    warnings
  });
}

async function collectPngMetadata(file: Blob): Promise<CollectedMetadata> {
  const exifBlocks: Uint8Array[] = [];
  const xmpBlocks: string[] = [];
  const textBlocks: TextMetadata[] = [];
  const iptcBlocks: Uint8Array[] = [];
  const warnings: string[] = [];
  let iccBytes = 0;
  let metadataBytes = 0;
  let bitDepth = '';
  let offset = 8;
  let segments = 0;
  let retainedBlocks = 0;

  while (offset + 12 <= file.size && segments < MAX_CONTAINER_SEGMENTS) {
    const header = await readBlob(file, offset, 8);
    const length = readUint32(header, 0);
    const type = ascii(header, 4, 4);
    const end = offset + 12 + length;
    if (end > file.size) {
      warnings.push('PNG metadata ended at a malformed chunk boundary.');
      break;
    }
    if (type === 'IHDR' && length >= 10) {
      const payload = await readBlob(file, offset + 8, 10);
      const depth = payload[8];
      const channels = pngChannels(payload[9]);
      if (depth) {
        bitDepth = channels
          ? `${depth} bits/channel · ${channels} channel${channels === 1 ? '' : 's'}`
          : `${depth} bits/channel`;
      }
    }
    const isMetadata = ['eXIf', 'iCCP', 'iTXt', 'tEXt', 'zTXt'].includes(type);
    if (isMetadata) {
      if (
        retainedBlocks >= MAX_RETAINED_METADATA_BLOCKS ||
        metadataBytes + length > MAX_TOTAL_METADATA_BYTES
      ) {
        warnings.push('PNG metadata reached the 32 MiB aggregate inspection limit.');
        break;
      }
      if (length > MAX_METADATA_BLOCK_BYTES) {
        warnings.push(`Oversized PNG ${type} metadata was skipped.`);
      } else {
        const payload = await readBlob(file, offset + 8, length);
        metadataBytes += payload.length;
        retainedBlocks += 1;
        if (type === 'eXIf') exifBlocks.push(payload);
        else if (type === 'iCCP') iccBytes += payload.length;
        else {
          const text = parsePngText(type, payload);
          textBlocks.push(text);
          if (/xmp/i.test(text.keyword) || /<\?xpacket|<x:xmpmeta/i.test(text.text)) {
            xmpBlocks.push(text.text);
          }
          if (/iptc/i.test(text.keyword)) iptcBlocks.push(payload);
        }
      }
    }
    offset = end;
    segments += 1;
    if (type === 'IEND') break;
  }
  if (segments >= MAX_CONTAINER_SEGMENTS) warnings.push('PNG chunk scan reached its safety limit.');
  return collected({
    exifBlocks,
    xmpBlocks,
    iptcBlocks,
    textBlocks,
    iccBytes,
    bitDepth,
    metadataBytes,
    warnings
  });
}

async function collectWebpMetadata(file: Blob): Promise<CollectedMetadata> {
  const exifBlocks: Uint8Array[] = [];
  const xmpBlocks: string[] = [];
  const warnings: string[] = [];
  let iccBytes = 0;
  let metadataBytes = 0;
  let offset = 12;
  let segments = 0;
  let retainedBlocks = 0;

  while (offset + 8 <= file.size && segments < MAX_CONTAINER_SEGMENTS) {
    const header = await readBlob(file, offset, 8);
    const type = ascii(header, 0, 4);
    const length = readUint32Le(header, 4);
    const end = offset + 8 + length + (length % 2);
    if (end > file.size) {
      warnings.push('WebP metadata ended at a malformed chunk boundary.');
      break;
    }
    if (['EXIF', 'XMP ', 'ICCP'].includes(type)) {
      if (
        retainedBlocks >= MAX_RETAINED_METADATA_BLOCKS ||
        metadataBytes + length > MAX_TOTAL_METADATA_BYTES
      ) {
        warnings.push('WebP metadata reached the 32 MiB aggregate inspection limit.');
        break;
      }
      if (length > MAX_METADATA_BLOCK_BYTES) {
        warnings.push(`Oversized WebP ${type.trim()} metadata was skipped.`);
      } else {
        const payload = await readBlob(file, offset + 8, length);
        metadataBytes += payload.length;
        retainedBlocks += 1;
        if (type === 'EXIF') {
          exifBlocks.push(
            startsWithAscii(payload, EXIF_HEADER) ? payload.subarray(EXIF_HEADER.length) : payload
          );
        } else if (type === 'XMP ') xmpBlocks.push(decodeMetadataText(payload));
        else iccBytes += payload.length;
      }
    }
    offset = end;
    segments += 1;
  }
  if (segments >= MAX_CONTAINER_SEGMENTS)
    warnings.push('WebP chunk scan reached its safety limit.');
  return collected({
    exifBlocks,
    xmpBlocks,
    iccBytes,
    bitDepth: '8 bits/channel',
    metadataBytes,
    warnings
  });
}

function parseExif(bytes: Uint8Array): ParsedExif {
  if (bytes.length < 8) return emptyExif();
  const byteOrder = ascii(bytes, 0, 2);
  const littleEndian = byteOrder === 'II';
  if (!littleEndian && byteOrder !== 'MM') return emptyExif();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (safeUint16(view, 2, littleEndian) !== 42) return emptyExif();
  const ifd0Offset = safeUint32(view, 4, littleEndian);
  if (ifd0Offset === undefined) return emptyExif();
  const ifd0 = parseIfd(view, ifd0Offset, littleEndian);
  const exifOffset = numberValue(ifd0.values.get(0x8769));
  const gpsOffset = numberValue(ifd0.values.get(0x8825));
  const exif = exifOffset > 0 ? parseIfd(view, exifOffset, littleEndian) : emptyIfd();
  const gps = gpsOffset > 0 ? parseIfd(view, gpsOffset, littleEndian) : emptyIfd();
  const thumbnailIfd = ifd0.nextOffset ? parseIfd(view, ifd0.nextOffset, littleEndian) : emptyIfd();
  const thumbnailOffset = numberValue(thumbnailIfd.values.get(0x0201));
  const thumbnailLength = numberValue(thumbnailIfd.values.get(0x0202));
  return {
    ifd0: ifd0.values,
    exif: exif.values,
    gps: gps.values,
    hasThumbnail:
      thumbnailOffset > 0 &&
      thumbnailLength > 0 &&
      thumbnailOffset + thumbnailLength <= bytes.length
  };
}

function parseIfd(view: DataView, offset: number, littleEndian: boolean) {
  if (offset < 0 || offset + 2 > view.byteLength) return emptyIfd();
  const count = safeUint16(view, offset, littleEndian) ?? 0;
  if (count > MAX_IFD_ENTRIES || offset + 2 + count * 12 + 4 > view.byteLength) return emptyIfd();
  const values = new Map<number, unknown>();
  for (let index = 0; index < count; index += 1) {
    const entryOffset = offset + 2 + index * 12;
    const tag = safeUint16(view, entryOffset, littleEndian);
    const type = safeUint16(view, entryOffset + 2, littleEndian);
    const valueCount = safeUint32(view, entryOffset + 4, littleEndian);
    if (tag === undefined || type === undefined || valueCount === undefined) continue;
    const value = readExifValue(view, entryOffset, type, valueCount, littleEndian);
    if (value !== undefined) values.set(tag, value);
  }
  return {
    values,
    nextOffset: safeUint32(view, offset + 2 + count * 12, littleEndian) ?? 0
  };
}

function readExifValue(
  view: DataView,
  entryOffset: number,
  type: number,
  count: number,
  littleEndian: boolean
): unknown {
  const sizes: Readonly<Record<number, number>> = {
    1: 1,
    2: 1,
    3: 2,
    4: 4,
    5: 8,
    7: 1,
    9: 4,
    10: 8
  };
  const size = sizes[type];
  if (!size || count > 65536 || size * count > MAX_METADATA_BLOCK_BYTES) return undefined;
  const byteLength = size * count;
  const valueOffset =
    byteLength <= 4 ? entryOffset + 8 : safeUint32(view, entryOffset + 8, littleEndian);
  if (valueOffset === undefined || valueOffset < 0 || valueOffset + byteLength > view.byteLength) {
    return undefined;
  }
  if (type === 2) {
    const bytes = new Uint8Array(view.buffer, view.byteOffset + valueOffset, byteLength);
    return decodeMetadataText(bytes).replace(/\0+$/g, '').trim();
  }
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const itemOffset = valueOffset + index * size;
    if (type === 1 || type === 7) values.push(view.getUint8(itemOffset));
    else if (type === 3) values.push(view.getUint16(itemOffset, littleEndian));
    else if (type === 4) values.push(view.getUint32(itemOffset, littleEndian));
    else if (type === 9) values.push(view.getInt32(itemOffset, littleEndian));
    else if (type === 5 || type === 10) {
      const numerator =
        type === 5
          ? view.getUint32(itemOffset, littleEndian)
          : view.getInt32(itemOffset, littleEndian);
      const denominator =
        type === 5
          ? view.getUint32(itemOffset + 4, littleEndian)
          : view.getInt32(itemOffset + 4, littleEndian);
      values.push(denominator === 0 ? 0 : numerator / denominator);
    }
  }
  return values.length === 1 ? values[0] : values;
}

function readGps(
  gps: ReadonlyMap<number, unknown>,
  xmp: string,
  iptc: ReturnType<typeof parseIptc>
) {
  const latitudeValues = numberArray(gps.get(0x0002));
  const longitudeValues = numberArray(gps.get(0x0004));
  const latitudeRef = textValue(gps.get(0x0001));
  const longitudeRef = textValue(gps.get(0x0003));
  const latitude = dmsToDecimal(latitudeValues, latitudeRef);
  const longitude = dmsToDecimal(longitudeValues, longitudeRef);
  const xmpLatitude = numericXmpValue(xmp, ['GPSLatitude', 'Latitude']);
  const xmpLongitude = numericXmpValue(xmp, ['GPSLongitude', 'Longitude']);
  const resolvedLatitude = latitude ?? xmpLatitude;
  const resolvedLongitude = longitude ?? xmpLongitude;
  const altitudeValue = numberValue(gps.get(0x0006));
  const altitudeRef = numberValue(gps.get(0x0005));
  const altitude = altitudeValue
    ? `${altitudeRef === 1 ? '-' : ''}${altitudeValue.toFixed(1)} m`
    : '';
  const locationName = iptc.location || extractXmpValue(xmp, ['Location', 'City', 'Country']);
  const date = textValue(gps.get(0x001d));
  const coordinates =
    resolvedLatitude !== undefined && resolvedLongitude !== undefined
      ? `${resolvedLatitude.toFixed(6)}, ${resolvedLongitude.toFixed(6)}`
      : '';
  return {
    present: Boolean(coordinates || altitude || date || locationName || gps.size > 0),
    coordinates,
    latitude: resolvedLatitude === undefined ? '' : resolvedLatitude.toFixed(6),
    longitude: resolvedLongitude === undefined ? '' : resolvedLongitude.toFixed(6),
    altitude,
    date,
    locationName
  };
}

function parseIptc(blocks: readonly Uint8Array[]) {
  let author = '';
  let copyright = '';
  let date = '';
  const locations: string[] = [];
  for (const bytes of blocks) {
    for (let offset = 0; offset + 5 <= bytes.length; offset += 1) {
      if (bytes[offset] !== 0x1c || bytes[offset + 1] !== 0x02) continue;
      const dataset = bytes[offset + 2];
      const length = readUint16(bytes, offset + 3);
      if (length > MAX_METADATA_BLOCK_BYTES || offset + 5 + length > bytes.length) continue;
      const value = decodeMetadataText(bytes.subarray(offset + 5, offset + 5 + length)).trim();
      if (dataset === 80) author ||= value;
      else if (dataset === 116) copyright ||= value;
      else if (dataset === 55) date ||= value;
      else if ([90, 92, 95, 101].includes(dataset ?? -1) && value) locations.push(value);
      offset += 4 + length;
    }
  }
  return { author, copyright, date, location: locations.join(', ') };
}

function buildGeneralFields(
  file: Blob,
  validation: ImageValidationReport,
  filename: string,
  bitDepth: string
): readonly MetadataField[] {
  const dimensions = validation.dimensions;
  return compactFields([
    field('filename', 'Filename', filename),
    field('format', 'Format', validation.format.toUpperCase()),
    field('mime', 'MIME', validation.mime),
    field('size', 'File size', formatBytes(file.size)),
    field(
      'dimensions',
      'Dimensions',
      dimensions ? `${dimensions.width} × ${dimensions.height}` : 'Decoder confirmation required'
    ),
    field('megapixels', 'Megapixels', dimensions ? `${dimensions.megapixels.toFixed(1)} MP` : ''),
    field(
      'aspect',
      'Aspect ratio',
      dimensions ? aspectRatio(dimensions.width, dimensions.height) : ''
    ),
    field('bit-depth', 'Bit depth', bitDepth || bitDepthForFormat(validation.format))
  ]);
}

function collected(input: Partial<CollectedMetadata>): CollectedMetadata {
  return {
    exifBlocks: input.exifBlocks ?? [],
    xmpBlocks: input.xmpBlocks ?? [],
    iptcBlocks: input.iptcBlocks ?? [],
    textBlocks: input.textBlocks ?? [],
    iccBytes: input.iccBytes ?? 0,
    bitDepth: input.bitDepth ?? '',
    metadataBytes: input.metadataBytes ?? 0,
    warnings: input.warnings ?? []
  };
}

function emptyExif(): ParsedExif {
  return { ifd0: new Map(), exif: new Map(), gps: new Map(), hasThumbnail: false };
}

function emptyIfd() {
  return { values: new Map<number, unknown>(), nextOffset: 0 };
}

function parsePngText(type: string, bytes: Uint8Array): TextMetadata {
  const nullIndex = bytes.indexOf(0);
  const keyword = decodeMetadataText(bytes.subarray(0, nullIndex < 0 ? bytes.length : nullIndex));
  if (nullIndex < 0) return { keyword, text: '' };
  if (type === 'tEXt') {
    return { keyword, text: decodeMetadataText(bytes.subarray(nullIndex + 1)) };
  }
  if (type === 'zTXt') {
    return { keyword, text: '[compressed text metadata]' };
  }
  let cursor = nullIndex + 1;
  const compressionFlag = bytes[cursor] ?? 0;
  cursor += 2;
  for (let field = 0; field < 2; field += 1) {
    while (cursor < bytes.length && bytes[cursor] !== 0) cursor += 1;
    cursor += 1;
  }
  return {
    keyword,
    text:
      compressionFlag === 1
        ? '[compressed international text metadata]'
        : decodeMetadataText(bytes.subarray(cursor))
  };
}

function field(
  id: string,
  label: string,
  value: string,
  category?: MetadataCategory
): MetadataField | undefined {
  if (!value) return undefined;
  return { id, label, value, ...(category ? { category } : {}) };
}

function compactFields(fields: readonly (MetadataField | undefined)[]) {
  return fields.filter((value): value is MetadataField => value !== undefined);
}

function signal(
  id: PrivacySignal['id'],
  label: string,
  present: boolean,
  detail: string
): PrivacySignal {
  return {
    id,
    label,
    presence: present ? 'present' : 'not-present',
    detail: detail || (present ? 'Detected in source metadata' : 'No readable value detected')
  };
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numberText(value: unknown) {
  const number = numberValue(value);
  return number > 0 ? String(Math.round(number)) : '';
}

function numberArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is number => typeof item === 'number');
  return typeof value === 'number' ? [value] : [];
}

function dmsToDecimal(values: readonly number[], reference: string) {
  if (values.length < 3) return undefined;
  const degrees = values[0] ?? 0;
  const minutes = values[1] ?? 0;
  const seconds = values[2] ?? 0;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return reference.toUpperCase() === 'S' || reference.toUpperCase() === 'W' ? -decimal : decimal;
}

function formatExposure(value: unknown) {
  const exposure = numberValue(value);
  if (exposure <= 0) return '';
  return exposure < 1 ? `1/${Math.round(1 / exposure)} s` : `${exposure.toFixed(2)} s`;
}

function formatAperture(value: unknown) {
  const aperture = numberValue(value);
  return aperture > 0 ? `f/${aperture.toFixed(1)}` : '';
}

function formatFocalLength(value: unknown) {
  const focalLength = numberValue(value);
  return focalLength > 0 ? `${focalLength.toFixed(1)} mm` : '';
}

function formatFlash(value: unknown) {
  const flash = numberValue(value);
  if (flash === 0) return '';
  return flash & 1 ? 'Fired' : 'Did not fire';
}

function formatOrientation(value: unknown) {
  const orientation = numberValue(value);
  const labels: Readonly<Record<number, string>> = {
    1: '1 · Normal',
    2: '2 · Mirrored horizontally',
    3: '3 · Rotated 180°',
    4: '4 · Mirrored vertically',
    5: '5 · Mirrored and rotated 270°',
    6: '6 · Rotated 90°',
    7: '7 · Mirrored and rotated 90°',
    8: '8 · Rotated 270°'
  };
  return labels[orientation] ?? '';
}

function extractXmpValue(source: string, names: readonly string[]) {
  if (!source) return '';
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const attribute = new RegExp(`(?:\\w+:)?${escaped}\\s*=\\s*["']([^"']+)["']`, 'i').exec(
      source
    )?.[1];
    if (attribute) return decodeXml(attribute);
    const element = new RegExp(`<(?:\\w+:)?${escaped}[^>]*>([^<]+)<\\/`, 'i').exec(source)?.[1];
    if (element) return decodeXml(element);
  }
  return '';
}

function numericXmpValue(source: string, names: readonly string[]) {
  const value = extractXmpValue(source, names);
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : undefined;
}

function decodeXml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();
}

function aspectRatio(width: number, height: number) {
  const divisor = greatestCommonDivisor(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function greatestCommonDivisor(left: number, right: number): number {
  return right === 0 ? left : greatestCommonDivisor(right, left % right);
}

function bitDepthForFormat(format: ImageValidationReport['format']) {
  if (
    format === 'jpeg' ||
    format === 'webp' ||
    format === 'avif' ||
    format === 'heic' ||
    format === 'heif'
  ) {
    return '8 bits/channel (typical)';
  }
  return format === 'png' ? 'From PNG header' : 'Not exposed safely';
}

function isJpegStartOfFrame(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function pngChannels(colorType: number | undefined) {
  if (colorType === 0 || colorType === 3) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  return 0;
}

function truncate(value: string, maximum: number) {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeMetadataText(bytes: Uint8Array) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0/g, '');
}

function stripAsciiHeader(bytes: Uint8Array, header: string) {
  return startsWithAscii(bytes, header) ? bytes.subarray(header.length) : bytes;
}

function startsWithAscii(bytes: Uint8Array, value: string) {
  if (bytes.length < value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

async function readBlob(file: Blob, offset: number, length: number) {
  return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
}

function readUint16(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readUint32Le(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) +
      ((bytes[offset + 1] ?? 0) << 8) +
      ((bytes[offset + 2] ?? 0) << 16) +
      (bytes[offset + 3] ?? 0) * 0x1000000) >>>
    0
  );
}

function safeUint16(view: DataView, offset: number, littleEndian: boolean) {
  return offset >= 0 && offset + 2 <= view.byteLength
    ? view.getUint16(offset, littleEndian)
    : undefined;
}

function safeUint32(view: DataView, offset: number, littleEndian: boolean) {
  return offset >= 0 && offset + 4 <= view.byteLength
    ? view.getUint32(offset, littleEndian)
    : undefined;
}
