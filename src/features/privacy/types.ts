import type { ImageFormat } from '../../types/images';

export type MetadataSection = 'general' | 'exif' | 'gps' | 'other';
export type MetadataPresence = 'present' | 'not-present' | 'unknown';

export type MetadataCategory =
  | 'location'
  | 'camera'
  | 'dates'
  | 'software'
  | 'author'
  | 'exif'
  | 'xmp'
  | 'iptc'
  | 'thumbnail'
  | 'icc';

export type PrivacyPreset = 'preserve-all' | 'location-only' | 'privacy-clean' | 'remove-all';

export interface MetadataField {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly category?: MetadataCategory;
}

export interface PrivacySignal {
  readonly id: 'location' | 'camera' | 'software' | 'date' | 'author';
  readonly label: string;
  readonly presence: MetadataPresence;
  readonly detail: string;
}

export interface MetadataInspection {
  readonly format: ImageFormat;
  readonly mime: string;
  readonly general: readonly MetadataField[];
  readonly exif: readonly MetadataField[];
  readonly gps: readonly MetadataField[];
  readonly other: readonly MetadataField[];
  readonly signals: readonly PrivacySignal[];
  readonly categoriesPresent: Readonly<Record<MetadataCategory, boolean>>;
  readonly metadataBytes: number;
  readonly warnings: readonly string[];
}

export type MetadataRemovalPolicy = Readonly<Record<MetadataCategory, boolean>>;

export interface MetadataVerification {
  readonly verified: boolean;
  readonly removed: readonly MetadataCategory[];
  readonly retained: readonly MetadataCategory[];
  readonly additionalRemovals: readonly MetadataCategory[];
  readonly message: string;
}

export interface MetadataCleanResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly inspection: MetadataInspection;
  readonly verification: MetadataVerification;
  readonly pixelPreserving: boolean;
  readonly metadataRemovedVerified: boolean;
  readonly durationMs: number;
}
