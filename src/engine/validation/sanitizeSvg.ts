import { AppError } from '../errors/AppError';
import type { ImageDimensions } from '../../types/images';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const MAX_SVG_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_SVG_CHARACTERS = MAX_SVG_SOURCE_BYTES;
const BLOCKED_ELEMENTS = new Set([
  'script',
  'style',
  'animate',
  'animatemotion',
  'animatetransform',
  'set',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'canvas',
  'link',
  'meta',
  'base'
]);
const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src']);

export interface SanitizedSvg {
  readonly text: string;
  readonly dimensions?: ImageDimensions;
}

export function assertSvgSourceSize(size: number) {
  if (size > MAX_SVG_SOURCE_BYTES) {
    throw new AppError('MEMORY_LIMIT', 'SVG source exceeds the 5 MiB sanitization limit.');
  }
}

export function sanitizeSvg(source: string): SanitizedSvg {
  if (source.length > MAX_SVG_CHARACTERS) {
    throw new AppError('MEMORY_LIMIT', 'SVG source exceeds the 5 MiB sanitization limit.');
  }
  if (/<!\s*(?:doctype|entity)\b/i.test(source)) {
    throw new AppError('UNSAFE_SVG', 'SVG document types and entities are not permitted.');
  }

  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror')) {
    throw new AppError('INVALID_FILE', 'The SVG XML could not be parsed safely.');
  }
  const root = document.documentElement;
  if (root.localName.toLowerCase() !== 'svg' || root.namespaceURI !== SVG_NAMESPACE) {
    throw new AppError('INVALID_FILE', 'The document root is not an SVG element.');
  }

  const violations: string[] = [];
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    if (element.namespaceURI !== SVG_NAMESPACE) {
      violations.push(`foreign namespace <${element.localName}>`);
      continue;
    }
    if (BLOCKED_ELEMENTS.has(element.localName.toLowerCase())) {
      violations.push(`<${element.localName}>`);
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on')) violations.push(name);
      if (name === 'style') violations.push('style');
      if (URL_ATTRIBUTES.has(name) && !isInternalReference(value)) violations.push(name);
      if (/url\s*\(\s*['"]?(?!#)/i.test(value) || /(?:javascript|vbscript)\s*:/i.test(value)) {
        violations.push(name);
      }
    }
  }

  if (violations.length > 0) {
    const unique = [...new Set(violations)].slice(0, 4).join(', ');
    throw new AppError('UNSAFE_SVG', `Blocked active or external SVG content: ${unique}.`);
  }

  const serialized = new XMLSerializer().serializeToString(root);
  const dimensions = readSvgDimensions(root);
  return {
    text: serialized,
    ...(dimensions ? { dimensions } : {})
  };
}

function isInternalReference(value: string): boolean {
  return value === '' || value.startsWith('#');
}

function readSvgDimensions(root: Element): ImageDimensions | undefined {
  const width = parseSvgLength(root.getAttribute('width'));
  const height = parseSvgLength(root.getAttribute('height'));
  const viewBox = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const resolvedWidth = width ?? (viewBox?.length === 4 ? viewBox[2] : undefined);
  const resolvedHeight = height ?? (viewBox?.length === 4 ? viewBox[3] : undefined);
  if (!resolvedWidth || !resolvedHeight || resolvedWidth <= 0 || resolvedHeight <= 0)
    return undefined;
  const pixels = Math.round(resolvedWidth) * Math.round(resolvedHeight);
  if (!Number.isSafeInteger(pixels)) return undefined;
  return {
    width: Math.round(resolvedWidth),
    height: Math.round(resolvedHeight),
    pixels,
    megapixels: pixels / 1_000_000
  };
}

function parseSvgLength(value: string | null): number | undefined {
  if (!value || value.trim().endsWith('%')) return undefined;
  const match = /^([0-9]+(?:\.[0-9]+)?)(?:px)?$/i.exec(value.trim());
  if (!match) return undefined;
  const result = Number(match[1]);
  return Number.isFinite(result) ? result : undefined;
}
