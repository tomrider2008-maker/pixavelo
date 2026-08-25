import { encodeToTarget, type SizedOutput } from './encodeToTarget';

interface TargetResizeOptions<T extends SizedOutput> {
  readonly width: number;
  readonly height: number;
  readonly targetBytes: number;
  readonly encode: (width: number, height: number, quality: number) => Promise<T>;
  readonly minimumQuality?: number;
  readonly maximumQuality?: number;
  readonly maximumPasses?: number;
  readonly maximumResizePasses?: number;
  readonly allowResize?: boolean;
  readonly minimumLongEdge?: number;
  readonly onAttempt?: () => void;
}

export interface TargetResizeResult<T extends SizedOutput> {
  readonly output: T;
  readonly quality: number;
  readonly attempts: number;
  readonly targetSatisfied: boolean;
  readonly width: number;
  readonly height: number;
  readonly resizePasses: number;
}

export async function encodeToTargetWithResize<T extends SizedOutput>(
  options: TargetResizeOptions<T>
): Promise<TargetResizeResult<T>> {
  const maximumPasses = Math.max(2, Math.min(16, Math.round(options.maximumPasses ?? 10)));
  const maximumResizePasses = Math.max(
    0,
    Math.min(4, Math.round(options.maximumResizePasses ?? 3))
  );
  let width = positiveInteger(options.width);
  let height = positiveInteger(options.height);
  let attempts = 0;
  let resizePasses = 0;

  for (;;) {
    const remainingPasses = maximumPasses - attempts;
    if (remainingPasses < 2) {
      throw new RangeError('Target-size search exhausted its pass budget without an output.');
    }
    const result = await encodeToTarget<T>({
      targetBytes: options.targetBytes,
      ...(options.minimumQuality === undefined ? {} : { minimumQuality: options.minimumQuality }),
      ...(options.maximumQuality === undefined ? {} : { maximumQuality: options.maximumQuality }),
      maximumPasses: remainingPasses,
      encode: (quality) => options.encode(width, height, quality),
      ...(options.onAttempt === undefined ? {} : { onAttempt: options.onAttempt })
    });
    attempts += result.attempts;

    if (
      result.targetSatisfied ||
      !options.allowResize ||
      resizePasses >= maximumResizePasses ||
      maximumPasses - attempts < 2
    ) {
      return { ...result, attempts, width, height, resizePasses };
    }

    const next = nextTargetDimensions(
      width,
      height,
      options.targetBytes,
      result.output.size,
      options.minimumLongEdge
    );
    if (!next) return { ...result, attempts, width, height, resizePasses };
    width = next.width;
    height = next.height;
    resizePasses += 1;
  }
}

export function nextTargetDimensions(
  width: number,
  height: number,
  targetBytes: number,
  actualBytes: number,
  minimumLongEdge = 320
) {
  const longEdge = Math.max(width, height);
  if (longEdge <= minimumLongEdge || actualBytes <= targetBytes) return undefined;
  const estimatedScale = Math.sqrt(targetBytes / actualBytes) * 0.96;
  const scale = Math.min(0.9, Math.max(0.5, estimatedScale));
  const minimumScale = Math.min(1, minimumLongEdge / longEdge);
  const safeScale = Math.max(minimumScale, scale);
  const next = {
    width: Math.max(1, Math.round(width * safeScale)),
    height: Math.max(1, Math.round(height * safeScale))
  };
  return next.width === width && next.height === height ? undefined : next;
}

function positiveInteger(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError('Dimensions must be positive.');
  return Math.max(1, Math.round(value));
}
