export type FeatureStatus = 'available' | 'foundation' | 'planned';

export interface FeatureFlag {
  readonly id: string;
  readonly status: FeatureStatus;
  readonly phase: string;
  readonly explanation: string;
}

export const featureFlags = {
  converter: {
    id: 'converter',
    status: 'available',
    phase: 'Phase 4',
    explanation:
      'Mixed local queues, advanced input decoders, per-file output overrides and verified ZIP export are available.'
  },
  optimize: {
    id: 'optimize',
    status: 'available',
    phase: 'Phase 5',
    explanation:
      'Compression profiles and bounded actual-Blob target sizing run through the verified local engine.'
  },
  resize: {
    id: 'resize',
    status: 'available',
    phase: 'Phase 5',
    explanation:
      'Ten resize methods, five fit modes and centralized social/web presets share the verified local pipeline.'
  },
  batch: {
    id: 'batch',
    status: 'available',
    phase: 'Phase 6',
    explanation:
      'Resumable local scheduling, per-file recovery, batch recipes, measured statistics and verified ZIP export are available.'
  },
  editor: {
    id: 'editor',
    status: 'available',
    phase: 'Phase 7',
    explanation:
      'Crop, rotation, flip, canvas sizing, adjustments, history, comparison and zoom use a non-destructive recipe that encodes only on export.'
  },
  privacy: {
    id: 'privacy',
    status: 'available',
    phase: 'Phase 8',
    explanation:
      'Bounded metadata inspection, GPS/privacy signals, selective presets and post-export verification are available locally.'
  },
  webAssets: {
    id: 'web-assets',
    status: 'available',
    phase: 'Phase 9',
    explanation:
      'Verified responsive images, AVIF/WebP/JPEG markup, favicons, app icons, manifests and ZIP packages run locally.'
  },
  developerTools: {
    id: 'developer-tools',
    status: 'available',
    phase: 'Phase 10',
    explanation:
      'Watermarking, frame extraction, Base64, SHA-256, sprite sheets, calculators and versioned local presets are available.'
  }
} as const satisfies Record<string, FeatureFlag>;
