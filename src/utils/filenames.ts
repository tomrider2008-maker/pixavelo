import type { CoreImageFormat } from '../types/images';

const PATH_CHARACTERS = /[\\/:*?"<>|]/g;
const TRAILING_DOTS_OR_SPACES = /[. ]+$/g;

const extensionByFormat: Record<CoreImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp'
};

export function sanitizeFilename(name: string): string {
  const withoutControlCharacters = Array.from(name.normalize('NFC'), (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || code === 127 ? '_' : character;
  }).join('');
  const normalized = withoutControlCharacters
    .replace(PATH_CHARACTERS, '_')
    .replace(TRAILING_DOTS_OR_SPACES, '')
    .trim();
  return (normalized || 'image').slice(0, 180);
}

export function buildOutputFilename(sourceName: string, format: CoreImageFormat): string {
  const safeName = sanitizeFilename(sourceName);
  const lastDot = safeName.lastIndexOf('.');
  const stem = lastDot > 0 ? safeName.slice(0, lastDot) : safeName;
  return `${stem}.${extensionByFormat[format]}`;
}

export function buildDerivativeFilename(
  sourceName: string,
  format: CoreImageFormat,
  suffix: string
): string {
  const safeName = sanitizeFilename(sourceName);
  const lastDot = safeName.lastIndexOf('.');
  const stem = lastDot > 0 ? safeName.slice(0, lastDot) : safeName;
  const safeSuffix = sanitizeFilename(suffix).replaceAll('.', '-');
  return `${stem}-${safeSuffix}.${extensionByFormat[format]}`;
}
