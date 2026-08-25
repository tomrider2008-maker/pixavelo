import { AppError } from '../../engine/errors/AppError';
import type { SpriteSheetSettings, UtilityPresetRecord, WatermarkUtilitySettings } from './types';

const MAX_BASE64_BYTES = 32 * 1024 * 1024;
const MAX_PRESET_CHARACTERS = 64 * 1024;
const BASE64_CHARACTERS = /^[A-Za-z0-9+/]*={0,2}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const WATERMARK_POSITIONS = new Set([
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
]);

export async function blobToDataUrl(blob: Blob) {
  if (blob.size > MAX_BASE64_BYTES) {
    throw new AppError('MEMORY_LIMIT', 'Base64 conversion is limited to 32 MiB per operation.');
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new AppError('INVALID_FILE'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new AppError('INVALID_FILE', 'Base64 conversion returned no text.'));
    reader.readAsDataURL(blob);
  });
}

export function decodeBase64Input(input: string) {
  const trimmed = input.trim();
  const dataUrl = /^data:([^;,]+)?;base64,(.*)$/s.exec(trimmed);
  const mime = dataUrl?.[1] ?? 'application/octet-stream';
  const base64 = (dataUrl?.[2] ?? trimmed).replaceAll(/\s/g, '');
  if (!base64 || base64.length % 4 !== 0 || !BASE64_CHARACTERS.test(base64)) {
    throw new AppError('INVALID_FILE', 'Base64 input is malformed.');
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const expectedBytes = (base64.length / 4) * 3 - padding;
  if (expectedBytes > MAX_BASE64_BYTES) {
    throw new AppError('MEMORY_LIMIT', 'Decoded Base64 is limited to 32 MiB.');
  }
  let binary: string;
  try {
    binary = atob(base64);
  } catch (cause: unknown) {
    throw new AppError('INVALID_FILE', cause instanceof Error ? cause.message : String(cause));
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { blob: new Blob([bytes], { type: mime }), mime, byteLength: bytes.byteLength };
}

export async function sha256Hex(blob: Blob) {
  if (blob.size > 64 * 1024 * 1024) {
    throw new AppError('MEMORY_LIMIT', 'SHA-256 is limited to 64 MiB to protect browser memory.');
  }
  const subtle = Reflect.get(globalThis.crypto, 'subtle') as SubtleCrypto | undefined;
  if (!subtle) throw new AppError('UNSUPPORTED_BROWSER_FEATURE', 'Web Crypto is unavailable.');
  const digest = await subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function greatestCommonDivisor(left: number, right: number) {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b > 0) [a, b] = [b, a % b];
  return a || 1;
}

export function calculateRatio(width: number, height: number) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const divisor = greatestCommonDivisor(safeWidth, safeHeight);
  return { width: safeWidth / divisor, height: safeHeight / divisor };
}

export function scaleDimensions(width: number, height: number, targetWidth: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const nextWidth = Math.max(1, Math.round(targetWidth));
  return {
    width: nextWidth,
    height: Math.max(1, Math.round((safeHeight / safeWidth) * nextWidth))
  };
}

export function calculateSpriteLayout(
  fileCount: number,
  settings: Pick<SpriteSheetSettings, 'cellWidth' | 'cellHeight' | 'columns' | 'gap'>
) {
  const count = Math.max(1, Math.round(fileCount));
  const columns = Math.max(1, Math.min(count, Math.round(settings.columns)));
  const rows = Math.ceil(count / columns);
  const width = columns * settings.cellWidth + Math.max(0, columns - 1) * settings.gap;
  const height = rows * settings.cellHeight + Math.max(0, rows - 1) * settings.gap;
  const pixels = width * height;
  if (width > 32_768 || height > 32_768 || pixels > 120_000_000) {
    throw new AppError('PIXEL_LIMIT', 'Sprite sheet dimensions exceed browser safety limits.');
  }
  return { columns, rows, width, height, pixels };
}

export function createUtilityPreset(
  name: string,
  watermark: WatermarkUtilitySettings,
  sprite: SpriteSheetSettings,
  now = new Date()
): UtilityPresetRecord {
  const safeName = name.trim().slice(0, 80) || 'Utility preset';
  return {
    id: `utility:${now.getTime()}:${safeName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`,
    kind: 'pixavelo-utility-preset',
    version: 1,
    name: safeName,
    createdAt: now.toISOString(),
    watermark: { ...watermark },
    sprite: { ...sprite }
  };
}

export function parseUtilityPreset(input: string): UtilityPresetRecord {
  if (input.length > MAX_PRESET_CHARACTERS) {
    throw new AppError('MEMORY_LIMIT', 'Preset JSON exceeds the 64 KiB limit.');
  }
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch (cause: unknown) {
    throw new AppError('INVALID_FILE', cause instanceof Error ? cause.message : String(cause));
  }
  if (!isRecord(value) || value.kind !== 'pixavelo-utility-preset' || value.version !== 1) {
    throw new AppError('INVALID_FILE', 'This is not a supported Pixavelo utility preset.');
  }
  if (
    typeof value.id !== 'string' ||
    value.id.length < 1 ||
    value.id.length > 180 ||
    typeof value.name !== 'string' ||
    value.name.trim().length < 1 ||
    value.name.length > 80 ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !isWatermarkSettings(value.watermark) ||
    !isSpriteSettings(value.sprite)
  ) {
    throw new AppError('INVALID_FILE', 'The utility preset fields are incomplete.');
  }
  return value as unknown as UtilityPresetRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWatermarkSettings(value: unknown): value is WatermarkUtilitySettings {
  return (
    isRecord(value) &&
    typeof value.text === 'string' &&
    value.text.length <= 200 &&
    typeof value.position === 'string' &&
    WATERMARK_POSITIONS.has(value.position) &&
    finiteRange(value.opacity, 0.05, 1) &&
    finiteRange(value.sizePercent, 0.01, 0.16) &&
    typeof value.color === 'string' &&
    HEX_COLOR.test(value.color) &&
    ['jpeg', 'png', 'webp'].includes(String(value.outputFormat)) &&
    finiteRange(value.quality, 0.3, 1)
  );
}

function isSpriteSettings(value: unknown): value is SpriteSheetSettings {
  return (
    isRecord(value) &&
    integerRange(value.cellWidth, 16, 2048) &&
    integerRange(value.cellHeight, 16, 2048) &&
    integerRange(value.columns, 1, 100) &&
    integerRange(value.gap, 0, 128) &&
    typeof value.background === 'string' &&
    (value.background === 'transparent' || HEX_COLOR.test(value.background))
  );
}

function finiteRange(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

function integerRange(value: unknown, minimum: number, maximum: number): value is number {
  return finiteRange(value, minimum, maximum) && Number.isInteger(value);
}
