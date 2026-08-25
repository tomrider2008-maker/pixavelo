export type WebAssetMode = 'responsive' | 'icons';
export type WebAssetFormat = 'webp' | 'avif' | 'jpeg';

export interface ResponsiveAssetSettings {
  readonly widths: readonly number[];
  readonly formats: readonly WebAssetFormat[];
  readonly quality: number;
  readonly preventUpscale: boolean;
  readonly includeZip: boolean;
}

export interface GeneratedWebAsset {
  readonly filename: string;
  readonly blob: Blob;
  readonly format: WebAssetFormat | 'png' | 'ico' | 'json';
  readonly width?: number;
  readonly height?: number;
  readonly verified: boolean;
}

export interface GeneratedWebBundle {
  readonly mode: WebAssetMode;
  readonly assets: readonly GeneratedWebAsset[];
  readonly markup: string;
  readonly zip: Blob;
  readonly totalBytes: number;
}
