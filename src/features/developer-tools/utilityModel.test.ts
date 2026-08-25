import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../../engine/errors/AppError';
import type { SpriteSheetSettings, WatermarkUtilitySettings } from './types';
import {
  blobToDataUrl,
  calculateRatio,
  calculateSpriteLayout,
  createUtilityPreset,
  decodeBase64Input,
  parseUtilityPreset,
  scaleDimensions,
  sha256Hex
} from './utilityModel';

const watermark: WatermarkUtilitySettings = {
  text: '© Studio',
  position: 'bottom-right',
  opacity: 0.72,
  sizePercent: 0.04,
  color: '#ffffff',
  outputFormat: 'jpeg',
  quality: 0.9
};

const sprite: SpriteSheetSettings = {
  cellWidth: 128,
  cellHeight: 96,
  columns: 4,
  gap: 2,
  background: 'transparent'
};

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
});

describe('professional utility model', () => {
  it('encodes and decodes bounded Base64 data URLs', async () => {
    const source = new Blob([new Uint8Array([0, 1, 2, 250, 255])], {
      type: 'application/octet-stream'
    });
    const dataUrl = await blobToDataUrl(source);
    const decoded = decodeBase64Input(dataUrl);
    expect(decoded.mime).toBe('application/octet-stream');
    expect([...new Uint8Array(await decoded.blob.arrayBuffer())]).toEqual([0, 1, 2, 250, 255]);
    expect(() => decodeBase64Input('not-base64')).toThrow(AppError);
  });

  it('produces the standard SHA-256 digest', async () => {
    expect(await sha256Hex(new Blob(['abc']))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('calculates reduced ratios and proportional dimensions', () => {
    expect(calculateRatio(1920, 1080)).toEqual({ width: 16, height: 9 });
    expect(scaleDimensions(1920, 1080, 1280)).toEqual({ width: 1280, height: 720 });
  });

  it('calculates bounded sprite geometry', () => {
    expect(calculateSpriteLayout(10, sprite)).toEqual({
      columns: 4,
      rows: 3,
      width: 518,
      height: 292,
      pixels: 151256
    });
    expect(() =>
      calculateSpriteLayout(100, { cellWidth: 5000, cellHeight: 5000, columns: 10, gap: 0 })
    ).toThrow(AppError);
  });

  it('round-trips versioned presets and rejects unrelated JSON', () => {
    const preset = createUtilityPreset('Studio preset', watermark, sprite, new Date(0));
    expect(parseUtilityPreset(JSON.stringify(preset))).toEqual(preset);
    expect(() => parseUtilityPreset('{"version":1}')).toThrow(AppError);
    expect(() =>
      parseUtilityPreset(
        JSON.stringify({ ...preset, sprite: { ...preset.sprite, cellWidth: 50_000 } })
      )
    ).toThrow(AppError);
    expect(() =>
      parseUtilityPreset(
        JSON.stringify({ ...preset, watermark: { ...preset.watermark, position: 'outside' } })
      )
    ).toThrow(AppError);
  });
});
