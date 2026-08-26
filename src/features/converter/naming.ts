import type { CoreImageFormat } from '../../types/images';
import { sanitizeFilename } from '../../utils/filenames';

const extensionByFormat: Record<CoreImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp'
};

const TOKEN_PATTERN = /\{(name|ext|index|date|width|height)\}/g;

export interface OutputDimensions {
  readonly width: number;
  readonly height: number;
}

export function buildConversionFilename(
  sourceName: string,
  format: CoreImageFormat,
  pattern: string,
  index: number,
  outputDimensions?: OutputDimensions
): string {
  const safeSource = sanitizeFilename(sourceName);
  const lastDot = safeSource.lastIndexOf('.');
  const stem = lastDot > 0 ? safeSource.slice(0, lastDot) : safeSource;
  const extension = extensionByFormat[format];
  const template = pattern.trim() || '{name}-converted';
  const now = new Date();
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const interpolated = template.replace(TOKEN_PATTERN, (_match, token: string) => {
    if (token === 'name') return stem;
    if (token === 'ext') return extension;
    if (token === 'index') return String(index + 1).padStart(2, '0');
    if (token === 'date') return datePart;
    if (token === 'width') return outputDimensions ? String(outputDimensions.width) : 'w';
    if (token === 'height') return outputDimensions ? String(outputDimensions.height) : 'h';
    return _match;
  });
  const safeResult = sanitizeFilename(interpolated);
  return safeResult.toLocaleLowerCase().endsWith(`.${extension}`)
    ? safeResult
    : `${safeResult}.${extension}`;
}

export function deduplicateFilenames(names: readonly string[]): readonly string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let candidate = name;
    let suffix = 2;
    while (used.has(candidate.toLocaleLowerCase())) {
      candidate = insertSuffix(name, suffix);
      suffix += 1;
    }
    used.add(candidate.toLocaleLowerCase());
    return candidate;
  });
}

function insertSuffix(name: string, suffix: number) {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) return `${name} (${suffix})`;
  return `${name.slice(0, lastDot)} (${suffix})${name.slice(lastDot)}`;
}
