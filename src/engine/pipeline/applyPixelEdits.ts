import type {
  EditorBrushStroke,
  EditorCloneOperation,
  EditorCutoutSettings,
  EditorPixelOperation
} from '../../types/editorPixelEdits';
import { MAX_PIXEL_EDIT_PIXELS } from '../../types/editorPixelEdits';

export function applyPixelEdits(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  operations: readonly EditorPixelOperation[] | undefined,
  cutout: EditorCutoutSettings | undefined
) {
  if (!operations || operations.length === 0) return;
  const pixelCount = width * height;
  if (pixelCount > MAX_PIXEL_EDIT_PIXELS) {
    throw new RangeError(
      `Local retouch supports up to ${MAX_PIXEL_EDIT_PIXELS.toLocaleString()} output pixels.`
    );
  }

  const frame = context.getImageData(0, 0, width, height);
  const healMask = new Uint8ClampedArray(pixelCount);
  const cloneOperations: EditorCloneOperation[] = [];
  const cutoutOperations: EditorPixelOperation[] = [];

  for (const operation of operations) {
    if (operation.kind === 'heal') paintStroke(healMask, width, height, operation.stroke, 'max');
    else if (operation.kind === 'clone') cloneOperations.push(operation);
    else cutoutOperations.push(operation);
  }

  if (healMask.some((value) => value > 0)) inpaint(frame.data, healMask, width, height);
  for (const operation of cloneOperations) clone(frame.data, width, height, operation);
  if (cutoutOperations.length > 0 && cutout) {
    applyCutout(frame.data, width, height, cutoutOperations, cutout);
  }
  context.putImageData(frame, 0, 0);
}

function inpaint(
  pixels: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number
) {
  const pixelCount = width * height;
  const original = new Uint8ClampedArray(pixels);
  const known = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const neighbours = new Int32Array(4);
  let tail = 0;

  for (let index = 0; index < pixelCount; index += 1) known[index] = read(mask, index) < 16 ? 1 : 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (known[index] === 0 && hasKnownNeighbour(known, index, width, height)) {
      known[index] = 2;
      queue[tail++] = index;
    }
  }

  for (let head = 0; head < tail; head += 1) {
    const index = read(queue, head);
    const neighbourCount = writeNeighbourIndexes(neighbours, index, width, height);
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    let count = 0;
    for (let neighbourIndex = 0; neighbourIndex < neighbourCount; neighbourIndex += 1) {
      const neighbour = read(neighbours, neighbourIndex);
      if (known[neighbour] !== 1) continue;
      const offset = neighbour * 4;
      red += read(pixels, offset);
      green += read(pixels, offset + 1);
      blue += read(pixels, offset + 2);
      alpha += read(pixels, offset + 3);
      count += 1;
    }
    if (count === 0) continue;
    const offset = index * 4;
    pixels[offset] = red / count;
    pixels[offset + 1] = green / count;
    pixels[offset + 2] = blue / count;
    pixels[offset + 3] = alpha / count;
    known[index] = 1;

    for (let neighbourIndex = 0; neighbourIndex < neighbourCount; neighbourIndex += 1) {
      const neighbour = read(neighbours, neighbourIndex);
      if (known[neighbour] !== 0) continue;
      known[neighbour] = 2;
      queue[tail++] = neighbour;
    }
  }

  for (let index = 0; index < pixelCount; index += 1) {
    const amount = read(mask, index) / 255;
    if (amount <= 0) continue;
    const offset = index * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      pixels[offset + channel] =
        read(original, offset + channel) * (1 - amount) + read(pixels, offset + channel) * amount;
    }
  }
}

function clone(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  operation: EditorCloneOperation
) {
  const source = new Uint8ClampedArray(pixels);
  const mask = new Uint8ClampedArray(width * height);
  paintStroke(mask, width, height, operation.stroke, 'max');
  const offsetX = Math.round((operation.source.x - operation.targetOrigin.x) * width);
  const offsetY = Math.round((operation.source.y - operation.targetOrigin.y) * height);

  for (let index = 0; index < mask.length; index += 1) {
    const amount = read(mask, index) / 255;
    if (amount <= 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const sourceX = clamp(x + offsetX, 0, width - 1);
    const sourceY = clamp(y + offsetY, 0, height - 1);
    const sourceOffset = (sourceY * width + sourceX) * 4;
    const targetOffset = index * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      pixels[targetOffset + channel] =
        read(pixels, targetOffset + channel) * (1 - amount) +
        read(source, sourceOffset + channel) * amount;
    }
  }
}

function applyCutout(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  operations: readonly EditorPixelOperation[],
  settings: EditorCutoutSettings
) {
  let mask = new Uint8ClampedArray(width * height);
  mask.fill(255);

  for (const operation of operations) {
    if (operation.kind === 'cutout-wand') {
      selectByColor(
        pixels,
        mask,
        width,
        height,
        operation.seed.x,
        operation.seed.y,
        operation.tolerance,
        operation.connected
      );
    } else if (operation.kind === 'cutout-brush') {
      paintStroke(
        mask,
        width,
        height,
        operation.stroke,
        operation.action === 'keep' ? 'max' : 'remove'
      );
    }
  }

  const scale = Math.min(width, height) / Math.max(1, settings.referenceDimension);
  const expand = Math.round(settings.expand * scale);
  if (expand !== 0) {
    const radius = Math.min(24, Math.max(1, Math.abs(expand)));
    const softened = boxBlurMask(mask, width, height, radius);
    const threshold = clamp(128 - expand * 12, 24, 232);
    for (let index = 0; index < mask.length; index += 1) {
      mask[index] = read(softened, index) >= threshold ? 255 : 0;
    }
  }
  const smooth = Math.min(12, Math.max(0, Math.round(settings.smooth * scale)));
  if (smooth > 0) mask = boxBlurMask(mask, width, height, smooth);
  const feather = Math.min(24, Math.max(0, Math.round(settings.feather * scale)));
  if (feather > 0) mask = boxBlurMask(mask, width, height, feather);

  if (settings.background === 'transparent') {
    for (let index = 0; index < mask.length; index += 1) {
      pixels[index * 4 + 3] = (read(pixels, index * 4 + 3) * read(mask, index)) / 255;
    }
    return;
  }

  if (settings.background === 'color') {
    const [red, green, blue] = parseColor(settings.color);
    for (let index = 0; index < mask.length; index += 1) {
      const amount = read(mask, index) / 255;
      const offset = index * 4;
      pixels[offset] = read(pixels, offset) * amount + red * (1 - amount);
      pixels[offset + 1] = read(pixels, offset + 1) * amount + green * (1 - amount);
      pixels[offset + 2] = read(pixels, offset + 2) * amount + blue * (1 - amount);
      pixels[offset + 3] = 255;
    }
    return;
  }

  const radius = Math.min(36, Math.max(1, Math.round(settings.blur * scale)));
  const blurred = boxBlurPixels(pixels, width, height, radius);
  for (let index = 0; index < mask.length; index += 1) {
    const amount = read(mask, index) / 255;
    const offset = index * 4;
    pixels[offset] = read(pixels, offset) * amount + read(blurred, offset) * (1 - amount);
    pixels[offset + 1] =
      read(pixels, offset + 1) * amount + read(blurred, offset + 1) * (1 - amount);
    pixels[offset + 2] =
      read(pixels, offset + 2) * amount + read(blurred, offset + 2) * (1 - amount);
    pixels[offset + 3] = 255;
  }
}

function selectByColor(
  pixels: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  normalizedX: number,
  normalizedY: number,
  tolerance: number,
  connected: boolean
) {
  const seedX = clamp(Math.floor(normalizedX * width), 0, width - 1);
  const seedY = clamp(Math.floor(normalizedY * height), 0, height - 1);
  const seedOffset = (seedY * width + seedX) * 4;
  const red = read(pixels, seedOffset);
  const green = read(pixels, seedOffset + 1);
  const blue = read(pixels, seedOffset + 2);
  const maximumDistance = (clamp(tolerance, 0, 100) / 100) * 441.7;
  const maximumDistanceSquared = maximumDistance * maximumDistance;
  const matches = (index: number) => {
    const offset = index * 4;
    const deltaRed = read(pixels, offset) - red;
    const deltaGreen = read(pixels, offset + 1) - green;
    const deltaBlue = read(pixels, offset + 2) - blue;
    return (
      deltaRed * deltaRed + deltaGreen * deltaGreen + deltaBlue * deltaBlue <=
      maximumDistanceSquared
    );
  };

  if (!connected) {
    for (let index = 0; index < mask.length; index += 1) {
      if (matches(index)) mask[index] = 0;
    }
    return;
  }

  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const neighbours = new Int32Array(4);
  let head = 0;
  let tail = 0;
  const seed = seedY * width + seedX;
  visited[seed] = 1;
  queue[tail++] = seed;
  while (head < tail) {
    const index = read(queue, head++);
    if (!matches(index)) continue;
    mask[index] = 0;
    const neighbourCount = writeNeighbourIndexes(neighbours, index, width, height);
    for (let neighbourIndex = 0; neighbourIndex < neighbourCount; neighbourIndex += 1) {
      const neighbour = read(neighbours, neighbourIndex);
      if (visited[neighbour] === 1) continue;
      visited[neighbour] = 1;
      queue[tail++] = neighbour;
    }
  }
}

function paintStroke(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  stroke: EditorBrushStroke,
  blend: 'max' | 'remove'
) {
  if (stroke.points.length === 0) return;
  const scale = Math.min(width, height) / Math.max(1, stroke.referenceDimension);
  const radius = Math.max(1, (stroke.size * scale) / 2);
  const hardness = clamp(stroke.hardness / 100, 0.04, 1);
  const feather = clamp(stroke.feather / 100, 0, 1);
  const inner = clamp(hardness * (1 - feather * 0.75), 0.02, 0.98);
  const stamp = (normalizedX: number, normalizedY: number) => {
    const centerX = normalizedX * width;
    const centerY = normalizedY * height;
    const left = clamp(Math.floor(centerX - radius), 0, width - 1);
    const right = clamp(Math.ceil(centerX + radius), 0, width - 1);
    const top = clamp(Math.floor(centerY - radius), 0, height - 1);
    const bottom = clamp(Math.ceil(centerY + radius), 0, height - 1);
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY) / radius;
        if (distance > 1) continue;
        const opacity =
          distance <= inner ? 255 : Math.round(255 * (1 - (distance - inner) / (1 - inner)));
        const index = y * width + x;
        mask[index] =
          blend === 'max'
            ? Math.max(read(mask, index), opacity)
            : Math.min(read(mask, index), 255 - opacity);
      }
    }
  };

  let previous = stroke.points[0];
  if (!previous) return;
  stamp(previous.x, previous.y);
  for (const point of stroke.points.slice(1)) {
    const distance = Math.hypot((point.x - previous.x) * width, (point.y - previous.y) * height);
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.35)));
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      stamp(
        previous.x + (point.x - previous.x) * progress,
        previous.y + (point.y - previous.y) * progress
      );
    }
    previous = point;
  }
}

function boxBlurMask(source: Uint8ClampedArray, width: number, height: number, radius: number) {
  const horizontal = new Uint8ClampedArray(source.length);
  const output = new Uint8ClampedArray(source.length);
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1)
      sum += read(source, y * width + clamp(x, 0, width - 1));
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = sum / (radius * 2 + 1);
      sum += read(source, y * width + clamp(x + radius + 1, 0, width - 1));
      sum -= read(source, y * width + clamp(x - radius, 0, width - 1));
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1)
      sum += read(horizontal, clamp(y, 0, height - 1) * width + x);
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / (radius * 2 + 1);
      sum += read(horizontal, clamp(y + radius + 1, 0, height - 1) * width + x);
      sum -= read(horizontal, clamp(y - radius, 0, height - 1) * width + x);
    }
  }
  return output;
}

function boxBlurPixels(source: Uint8ClampedArray, width: number, height: number, radius: number) {
  const horizontal = new Uint8ClampedArray(source.length);
  const output = new Uint8ClampedArray(source.length);
  const divisor = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    const sums = [0, 0, 0, 0];
    for (let x = -radius; x <= radius; x += 1) {
      const offset = (y * width + clamp(x, 0, width - 1)) * 4;
      for (let channel = 0; channel < 4; channel += 1)
        sums[channel] = read(sums, channel) + read(source, offset + channel);
    }
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1)
        horizontal[offset + channel] = read(sums, channel) / divisor;
      const add = (y * width + clamp(x + radius + 1, 0, width - 1)) * 4;
      const remove = (y * width + clamp(x - radius, 0, width - 1)) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        sums[channel] =
          read(sums, channel) + read(source, add + channel) - read(source, remove + channel);
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    const sums = [0, 0, 0, 0];
    for (let y = -radius; y <= radius; y += 1) {
      const offset = (clamp(y, 0, height - 1) * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1)
        sums[channel] = read(sums, channel) + read(horizontal, offset + channel);
    }
    for (let y = 0; y < height; y += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1)
        output[offset + channel] = read(sums, channel) / divisor;
      const add = (clamp(y + radius + 1, 0, height - 1) * width + x) * 4;
      const remove = (clamp(y - radius, 0, height - 1) * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        sums[channel] =
          read(sums, channel) +
          read(horizontal, add + channel) -
          read(horizontal, remove + channel);
      }
    }
  }
  return output;
}

function writeNeighbourIndexes(target: Int32Array, index: number, width: number, height: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  let count = 0;
  if (x > 0) target[count++] = index - 1;
  if (x < width - 1) target[count++] = index + 1;
  if (y > 0) target[count++] = index - width;
  if (y < height - 1) target[count++] = index + width;
  return count;
}

function hasKnownNeighbour(known: Uint8Array, index: number, width: number, height: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  return (
    (x > 0 && known[index - 1] === 1) ||
    (x < width - 1 && known[index + 1] === 1) ||
    (y > 0 && known[index - width] === 1) ||
    (y < height - 1 && known[index + width] === 1)
  );
}

function parseColor(color: string): [number, number, number] {
  const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (!match) return [255, 255, 255];
  return [
    Number.parseInt(match[1] ?? 'ff', 16),
    Number.parseInt(match[2] ?? 'ff', 16),
    Number.parseInt(match[3] ?? 'ff', 16)
  ];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function read(source: ArrayLike<number>, index: number) {
  return source[index] ?? 0;
}
