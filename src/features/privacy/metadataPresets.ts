import type { MetadataCategory, MetadataRemovalPolicy, PrivacyPreset } from './types';

export const metadataCategories: readonly MetadataCategory[] = [
  'location',
  'camera',
  'dates',
  'software',
  'author',
  'exif',
  'xmp',
  'iptc',
  'thumbnail',
  'icc'
];

const preserveAll: MetadataRemovalPolicy = {
  location: false,
  camera: false,
  dates: false,
  software: false,
  author: false,
  exif: false,
  xmp: false,
  iptc: false,
  thumbnail: false,
  icc: false
};

export const privacyPresets: Readonly<Record<PrivacyPreset, MetadataRemovalPolicy>> = {
  'preserve-all': preserveAll,
  'location-only': {
    ...preserveAll,
    location: true
  },
  'privacy-clean': {
    ...preserveAll,
    location: true,
    camera: true,
    dates: true,
    software: true,
    author: true,
    xmp: true,
    iptc: true,
    thumbnail: true
  },
  'remove-all': Object.fromEntries(
    metadataCategories.map((category) => [category, true])
  ) as unknown as MetadataRemovalPolicy
};

export function policyForPreset(preset: PrivacyPreset): MetadataRemovalPolicy {
  return { ...privacyPresets[preset] };
}

export function removedCategories(policy: MetadataRemovalPolicy) {
  return metadataCategories.filter((category) => policy[category]);
}
