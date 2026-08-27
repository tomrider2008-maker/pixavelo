import type { ImageFormat, ImageValidationReport } from '../../types/images';
import { formatBytes } from '../../utils/format';

export type IntakeAnalysisItem =
  | {
      readonly file: File;
      readonly validation: ImageValidationReport;
      readonly error?: never;
    }
  | {
      readonly file: File;
      readonly error: string;
      readonly validation?: never;
    };

export type IntakeActionRoute =
  '/batch' | '/convert' | '/optimize' | '/resize' | '/edit' | '/web-assets';

export interface IntakeActionChoice {
  readonly route: IntakeActionRoute;
  readonly label: string;
  readonly reason: string;
  readonly recommended: boolean;
}

export interface IntakeAggregateFacts {
  readonly count: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly totalBytes: number;
  readonly formats: readonly ImageFormat[];
  readonly maximumDimensions: {
    readonly width: number;
    readonly height: number;
    readonly edge: number;
    readonly pixels: number;
    readonly megapixels: number;
  };
}

export interface IntakeRecommendation {
  readonly validFiles: readonly File[];
  readonly errors: readonly { readonly file: File; readonly message: string }[];
  readonly facts: IntakeAggregateFacts;
  readonly reason: string;
  readonly evidence: readonly string[];
  readonly recommendation: IntakeActionChoice | undefined;
  readonly choices: readonly IntakeActionChoice[];
}

const LARGE_FILE_BYTES = 5 * 1024 * 1024;
const LARGE_IMAGE_PIXELS = 12_000_000;
const LARGE_IMAGE_EDGE = 2560;

const ADVANCED_FORMATS = new Set<ImageFormat>([
  'avif',
  'heic',
  'heif',
  'tiff',
  'bmp',
  'gif',
  'svg',
  'ico'
]);

const ACTIONS: Readonly<Record<IntakeActionRoute, Omit<IntakeActionChoice, 'recommended'>>> = {
  '/batch': {
    route: '/batch',
    label: 'Open Batch Studio',
    reason: 'Apply one bounded recipe across multiple validated images.'
  },
  '/convert': {
    route: '/convert',
    label: 'Open Convert',
    reason: 'Choose and verify a target image format.'
  },
  '/optimize': {
    route: '/optimize',
    label: 'Open Optimize',
    reason: 'Measure encoded size, reduction, and visual fidelity.'
  },
  '/resize': {
    route: '/resize',
    label: 'Open Resize',
    reason: 'Set exact dimensions, crop, or transform the image.'
  },
  '/edit': {
    route: '/edit',
    label: 'Open Image Editor',
    reason: 'Start with non-destructive visual adjustments.'
  },
  '/web-assets': {
    route: '/web-assets',
    label: 'Open Web Assets',
    reason: 'Generate responsive variants and production markup.'
  }
};

const SINGLE_FILE_ACTIONS: readonly IntakeActionRoute[] = [
  '/edit',
  '/optimize',
  '/resize',
  '/convert',
  '/web-assets'
];

export function recommendIntakeActions(items: readonly IntakeAnalysisItem[]): IntakeRecommendation {
  const validItems = items.filter(hasValidation);
  const errors = items.flatMap((item) =>
    'error' in item ? [{ file: item.file, message: item.error }] : []
  );
  const facts = aggregateFacts(items, validItems);
  const evidence = aggregateEvidence(facts);

  if (validItems.length === 0) {
    return {
      validFiles: [],
      errors,
      facts,
      reason: 'No selected file completed local validation, so no workflow is recommended.',
      evidence,
      recommendation: undefined,
      choices: []
    };
  }

  const decision = chooseRecommendation(validItems);
  const routes =
    validItems.length > 1
      ? (['/batch', '/convert'] as const)
      : [decision.route, ...SINGLE_FILE_ACTIONS.filter((route) => route !== decision.route)];
  const choices = routes.map((route, index) => ({
    ...ACTIONS[route],
    recommended: index === 0
  }));

  return {
    validFiles: validItems.map((item) => item.file),
    errors,
    facts,
    reason: decision.reason,
    evidence: [decision.evidence, ...evidence],
    recommendation: choices[0],
    choices
  };
}

function hasValidation(
  item: IntakeAnalysisItem
): item is Extract<IntakeAnalysisItem, { readonly validation: ImageValidationReport }> {
  return 'validation' in item;
}

function aggregateFacts(
  items: readonly IntakeAnalysisItem[],
  validItems: readonly Extract<IntakeAnalysisItem, { readonly validation: ImageValidationReport }>[]
): IntakeAggregateFacts {
  let maximumWidth = 0;
  let maximumHeight = 0;
  let maximumEdge = 0;
  let maximumPixels = 0;

  for (const item of validItems) {
    const dimensions = item.validation.dimensions;
    if (!dimensions) continue;
    maximumWidth = Math.max(maximumWidth, dimensions.width);
    maximumHeight = Math.max(maximumHeight, dimensions.height);
    maximumEdge = Math.max(maximumEdge, dimensions.width, dimensions.height);
    maximumPixels = Math.max(maximumPixels, dimensions.pixels);
  }

  return {
    count: items.length,
    validCount: validItems.length,
    invalidCount: items.length - validItems.length,
    totalBytes: items.reduce((total, item) => total + item.file.size, 0),
    formats: [...new Set(validItems.map((item) => item.validation.format))].sort(),
    maximumDimensions: {
      width: maximumWidth,
      height: maximumHeight,
      edge: maximumEdge,
      pixels: maximumPixels,
      megapixels: maximumPixels / 1_000_000
    }
  };
}

function aggregateEvidence(facts: IntakeAggregateFacts): string[] {
  const evidence = [
    `${facts.validCount} of ${facts.count} selected file${facts.count === 1 ? '' : 's'} passed local validation.`,
    `${formatBytes(facts.totalBytes)} selected in total.`
  ];
  if (facts.formats.length > 0) {
    evidence.push(
      `Detected formats: ${facts.formats.map((format) => format.toUpperCase()).join(', ')}.`
    );
  }
  if (facts.invalidCount > 0) {
    evidence.push(
      `${facts.invalidCount} file${facts.invalidCount === 1 ? '' : 's'} could not be included.`
    );
  }
  return evidence;
}

function chooseRecommendation(
  validItems: readonly Extract<IntakeAnalysisItem, { readonly validation: ImageValidationReport }>[]
): { readonly route: IntakeActionRoute; readonly reason: string; readonly evidence: string } {
  if (validItems.length > 1) {
    return {
      route: '/batch',
      reason: 'Batch Studio is recommended because more than one validated image is selected.',
      evidence: `${validItems.length} validated images can share one batch recipe.`
    };
  }

  const item = validItems[0];
  if (!item) throw new Error('A valid intake item was expected.');
  const format = item.validation.format;
  if (ADVANCED_FORMATS.has(format)) {
    return {
      route: '/convert',
      reason: 'Convert is recommended because this source uses an advanced import format.',
      evidence: `${format.toUpperCase()} is handled through Pixavelo's advanced import path.`
    };
  }

  if (item.file.size >= LARGE_FILE_BYTES) {
    return {
      route: '/optimize',
      reason: 'Optimize is recommended because the source meets the large-file review threshold.',
      evidence: `${formatBytes(item.file.size)} meets or exceeds the 5 MiB review threshold.`
    };
  }

  const dimensions = item.validation.dimensions;
  if (
    dimensions &&
    (dimensions.pixels > LARGE_IMAGE_PIXELS ||
      Math.max(dimensions.width, dimensions.height) > LARGE_IMAGE_EDGE)
  ) {
    const maximumEdge = Math.max(dimensions.width, dimensions.height);
    const dimensionEvidence =
      dimensions.pixels > LARGE_IMAGE_PIXELS
        ? `${dimensions.megapixels.toFixed(1)} MP exceeds the 12 MP review threshold.`
        : `${maximumEdge}px on the longest edge exceeds the 2560px review threshold.`;
    return {
      route: '/resize',
      reason: 'Resize is recommended because the decoded dimensions exceed a review threshold.',
      evidence: dimensionEvidence
    };
  }

  return {
    route: '/edit',
    reason:
      'The file has no measured size or dimension signal requiring a specialist workflow, so Edit is the neutral starting point.',
    evidence:
      'File characteristics alone do not reveal the intended task; all alternatives remain available.'
  };
}
