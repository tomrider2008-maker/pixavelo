export interface SizedOutput {
  readonly size: number;
}

export interface TargetEncodingResult<T extends SizedOutput> {
  readonly output: T;
  readonly quality: number;
  readonly attempts: number;
  readonly targetSatisfied: boolean;
}

interface TargetEncodingOptions<T extends SizedOutput> {
  readonly targetBytes: number;
  readonly encode: (quality: number) => Promise<T>;
  readonly minimumQuality?: number;
  readonly maximumQuality?: number;
  readonly maximumPasses?: number;
  readonly onAttempt?: () => void;
}

export async function encodeToTarget<T extends SizedOutput>(
  options: TargetEncodingOptions<T>
): Promise<TargetEncodingResult<T>> {
  if (!Number.isFinite(options.targetBytes) || options.targetBytes <= 0) {
    throw new RangeError('Target bytes must be a positive number.');
  }

  const minimumQuality = clamp(options.minimumQuality ?? 0.12, 0.01, 0.99);
  const maximumQuality = clamp(options.maximumQuality ?? 0.95, minimumQuality, 1);
  const maximumPasses = Math.max(2, Math.min(12, Math.round(options.maximumPasses ?? 8)));
  let attempts = 0;

  const encode = async (quality: number) => {
    options.onAttempt?.();
    attempts += 1;
    return options.encode(quality);
  };

  const maximum = await encode(maximumQuality);
  if (maximum.size <= options.targetBytes) {
    return {
      output: maximum,
      quality: maximumQuality,
      attempts,
      targetSatisfied: true
    };
  }

  const minimum = await encode(minimumQuality);
  if (minimum.size > options.targetBytes) {
    return {
      output: minimum,
      quality: minimumQuality,
      attempts,
      targetSatisfied: false
    };
  }

  let lowerQuality = minimumQuality;
  let upperQuality = maximumQuality;
  let bestOutput = minimum;
  let bestQuality = minimumQuality;

  while (attempts < maximumPasses) {
    const quality = roundQuality((lowerQuality + upperQuality) / 2);
    const output = await encode(quality);
    if (output.size <= options.targetBytes) {
      bestOutput = output;
      bestQuality = quality;
      lowerQuality = quality;
    } else {
      upperQuality = quality;
    }
  }

  return {
    output: bestOutput,
    quality: bestQuality,
    attempts,
    targetSatisfied: true
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundQuality(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
