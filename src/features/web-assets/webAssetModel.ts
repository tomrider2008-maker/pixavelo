import { sanitizeFilename } from '../../utils/filenames';
import type { GeneratedWebAsset, WebAssetFormat } from './types';

const MAX_BREAKPOINTS = 8;
const MIN_WIDTH = 16;
const MAX_WIDTH = 32_768;

export function normalizeBreakpoints(
  values: readonly number[],
  sourceWidth: number,
  preventUpscale: boolean
): number[] {
  const upperBound = preventUpscale ? Math.max(MIN_WIDTH, sourceWidth) : MAX_WIDTH;
  const normalized = new Set<number>();
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    normalized.add(Math.max(MIN_WIDTH, Math.min(upperBound, Math.round(value))));
    if (normalized.size === MAX_BREAKPOINTS) break;
  }
  return [...normalized].sort((left, right) => left - right);
}

export function sourceStem(filename: string) {
  const safe = sanitizeFilename(filename);
  const dot = safe.lastIndexOf('.');
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ascii = stem
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^A-Za-z0-9_-]+/g, '-')
    .replaceAll(/^[-_]+|[-_]+$/g, '')
    .slice(0, 96);
  return ascii || 'image';
}

export function buildWebAssetFilename(sourceName: string, width: number, format: WebAssetFormat) {
  return `${sourceStem(sourceName)}-${width}.${format === 'jpeg' ? 'jpg' : format}`;
}

export function buildResponsiveMarkup(
  sourceName: string,
  widths: readonly number[],
  formats: readonly WebAssetFormat[]
) {
  const stem = sourceStem(sourceName);
  const fallbackFormat = formats.includes('jpeg') ? 'jpeg' : (formats.at(-1) ?? 'webp');
  const sourceFormats = formats.filter((format) => format !== fallbackFormat);
  const sizes = widths.map((width) => `(max-width: ${width}px) 100vw`).join(', ');
  const sourceLines = sourceFormats.map(
    (format) =>
      `  <source type="image/${format}" srcset="${srcset(stem, widths, format)}" sizes="${sizes}, 100vw">`
  );
  const fallbackExtension = fallbackFormat === 'jpeg' ? 'jpg' : fallbackFormat;
  const largest = widths.at(-1) ?? 1;
  return [
    '<picture>',
    ...sourceLines,
    `  <img src="${stem}-${largest}.${fallbackExtension}"`,
    `       srcset="${srcset(stem, widths, fallbackFormat)}"`,
    `       sizes="${sizes}, 100vw"`,
    `       width="${largest}" alt="">`,
    '</picture>'
  ].join('\n');
}

export function buildSrcsetMarkup(
  sourceName: string,
  widths: readonly number[],
  format: WebAssetFormat
) {
  return srcset(sourceStem(sourceName), widths, format);
}

export function buildIconMarkup() {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">'
  ].join('\n');
}

export function buildIconManifest(name: string) {
  return JSON.stringify(
    {
      name,
      short_name: name.slice(0, 24),
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    null,
    2
  );
}

export function verifiedAssetCount(assets: readonly GeneratedWebAsset[]) {
  return assets.reduce((count, asset) => count + (asset.verified ? 1 : 0), 0);
}

function srcset(stem: string, widths: readonly number[], format: WebAssetFormat) {
  const extension = format === 'jpeg' ? 'jpg' : format;
  return widths.map((width) => `${stem}-${width}.${extension} ${width}w`).join(', ');
}
