import { decodeAvif } from '../../engine/codecs/avifDecoder';
import { AppError } from '../../engine/errors/AppError';
import { createZipBlob } from '../../engine/export/createZip';
import { processNativeImage } from '../../engine/pipeline/processNativeImage';
import { detectImageFormat } from '../../engine/validation/signatures';
import type { ImageValidationReport } from '../../types/images';
import {
  buildIconManifest,
  buildIconMarkup,
  buildResponsiveMarkup,
  buildWebAssetFilename,
  normalizeBreakpoints,
  sourceStem
} from './webAssetModel';
import { createIcoBlob } from './favicon';
import type { GeneratedWebAsset, GeneratedWebBundle, ResponsiveAssetSettings } from './types';

interface GenerateInput {
  readonly file: File;
  readonly validation: ImageValidationReport;
  readonly settings: ResponsiveAssetSettings;
  readonly signal?: AbortSignal;
  readonly onProgress?: (completed: number, total: number, label: string) => void;
}

export async function generateResponsiveAssets(input: GenerateInput): Promise<GeneratedWebBundle> {
  const dimensions = input.validation.dimensions;
  if (!dimensions) throw new AppError('DECODE_FAILED', 'Source dimensions are required.');
  const sourceWidth = dimensions.width;
  const widths = normalizeBreakpoints(
    input.settings.widths,
    sourceWidth,
    input.settings.preventUpscale
  );
  if (widths.length === 0 || input.settings.formats.length === 0) {
    throw new AppError('INVALID_FILE', 'Choose at least one breakpoint and output format.');
  }
  const total = widths.length * input.settings.formats.length;
  const assets: GeneratedWebAsset[] = [];
  let completed = 0;

  for (const width of widths) {
    let pngIntermediate: Blob | undefined;
    for (const format of input.settings.formats) {
      assertNotCancelled(input.signal);
      input.onProgress?.(completed, total, `Encoding ${width}px ${format.toUpperCase()}`);
      let asset: GeneratedWebAsset;
      if (format === 'avif') {
        pngIntermediate ??= (
          await processNativeImage({
            file: input.file,
            detectedMime: input.validation.mime,
            detectedFormat: input.validation.format,
            dimensions,
            options: { outputFormat: 'png', width, preventUpscale: input.settings.preventUpscale },
            ...(input.signal ? { signal: input.signal } : {})
          })
        ).blob;
        asset = await encodeAvifAsset(
          pngIntermediate,
          buildWebAssetFilename(input.file.name, width, format),
          input.settings.quality,
          input.signal
        );
      } else {
        const processed = await processNativeImage({
          file: input.file,
          detectedMime: input.validation.mime,
          detectedFormat: input.validation.format,
          dimensions,
          options: {
            outputFormat: format,
            width,
            quality: input.settings.quality,
            preventUpscale: input.settings.preventUpscale,
            background: '#ffffff'
          },
          ...(input.signal ? { signal: input.signal } : {})
        });
        asset = {
          filename: buildWebAssetFilename(input.file.name, processed.width, format),
          blob: processed.blob,
          format,
          width: processed.width,
          height: processed.height,
          verified: processed.metadataRemovedVerified
        };
      }
      assets.push(asset);
      completed += 1;
      input.onProgress?.(completed, total, `${asset.filename} verified`);
    }
  }

  const markup = buildResponsiveMarkup(
    input.file.name,
    [...new Set(assets.flatMap((asset) => (asset.width ? [asset.width] : [])))],
    input.settings.formats
  );
  const zip = await createZipBlob([
    ...assets.map((asset) => ({ name: asset.filename, blob: asset.blob })),
    { name: 'picture.html', blob: new Blob([markup], { type: 'text/html' }) }
  ]);
  return {
    mode: 'responsive',
    assets,
    markup,
    zip,
    totalBytes: assets.reduce((sum, asset) => sum + asset.blob.size, 0)
  };
}

export async function generateIconAssets(
  input: Omit<GenerateInput, 'settings'> & { quality: number }
) {
  const sizes = [16, 32, 48, 180, 192, 512] as const;
  const pngs: GeneratedWebAsset[] = [];
  for (const [index, size] of sizes.entries()) {
    assertNotCancelled(input.signal);
    input.onProgress?.(index, sizes.length + 2, `Rendering ${size}×${size} icon`);
    const processed = await processNativeImage({
      file: input.file,
      detectedMime: input.validation.mime,
      detectedFormat: input.validation.format,
      ...(input.validation.dimensions ? { dimensions: input.validation.dimensions } : {}),
      options: {
        outputFormat: 'png',
        width: size,
        height: size,
        fitMode: 'cover',
        quality: input.quality,
        background: '#ffffff'
      },
      ...(input.signal ? { signal: input.signal } : {})
    });
    const filename = iconFilename(size);
    pngs.push({
      filename,
      blob: processed.blob,
      format: 'png',
      width: size,
      height: size,
      verified: processed.metadataRemovedVerified
    });
    input.onProgress?.(index + 1, sizes.length + 2, `${filename} verified`);
  }
  const icoSources = pngs
    .filter((asset) => asset.width === 16 || asset.width === 32 || asset.width === 48)
    .map((asset) => ({ size: asset.width ?? 16, blob: asset.blob }));
  const ico = await createIcoBlob(icoSources);
  const manifest = buildIconManifest(sourceStem(input.file.name));
  const assets: GeneratedWebAsset[] = [
    ...pngs,
    { filename: 'favicon.ico', blob: ico, format: 'ico', verified: true },
    {
      filename: 'site.webmanifest',
      blob: new Blob([manifest], { type: 'application/manifest+json' }),
      format: 'json',
      verified: true
    }
  ];
  input.onProgress?.(sizes.length + 2, sizes.length + 2, 'Icon package verified');
  const markup = buildIconMarkup();
  const zip = await createZipBlob([
    ...assets.map((asset) => ({ name: asset.filename, blob: asset.blob })),
    { name: 'head-links.html', blob: new Blob([markup], { type: 'text/html' }) }
  ]);
  return {
    mode: 'icons',
    assets,
    markup,
    zip,
    totalBytes: assets.reduce((sum, asset) => sum + asset.blob.size, 0)
  } satisfies GeneratedWebBundle;
}

async function encodeAvifAsset(
  source: Blob,
  filename: string,
  quality: number,
  signal?: AbortSignal
): Promise<GeneratedWebAsset> {
  assertNotCancelled(signal);
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new AppError('UNSUPPORTED_BROWSER_FEATURE', '2D canvas is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const { default: encode } = await import('@jsquash/avif/encode.js');
    assertNotCancelled(signal);
    const buffer = await encode(pixels, {
      quality: Math.max(1, Math.min(100, Math.round(quality * 100))),
      speed: 6,
      bitDepth: 8
    });
    const blob = new Blob([buffer], { type: 'image/avif' });
    const signature = detectImageFormat(new Uint8Array(buffer).subarray(0, 64));
    if (signature !== 'avif' || blob.size === 0) {
      throw new AppError('OUTPUT_VALIDATION_FAILED', 'AVIF signature verification failed.');
    }
    const decoded = await decodeAvif(buffer);
    if (decoded.width !== bitmap.width || decoded.height !== bitmap.height) {
      throw new AppError('OUTPUT_VALIDATION_FAILED', 'AVIF dimensions did not verify.');
    }
    return {
      filename,
      blob,
      format: 'avif',
      width: decoded.width,
      height: decoded.height,
      verified: true
    };
  } finally {
    bitmap.close();
  }
}

function iconFilename(size: number) {
  if (size === 16) return 'favicon-16.png';
  if (size === 32) return 'favicon-32.png';
  if (size === 48) return 'favicon-48.png';
  if (size === 180) return 'apple-touch-icon.png';
  return `icon-${size}.png`;
}

function assertNotCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new AppError('CANCELLED');
}
