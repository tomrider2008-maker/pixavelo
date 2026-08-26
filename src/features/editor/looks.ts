import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../engine/pipeline/imageAdjustments';
import type { ImageAdjustments } from '../../types/images';

export interface EditorLook {
  readonly id: 'clean' | 'vivid' | 'warm' | 'film' | 'mono';
  readonly label: string;
  readonly description: string;
  readonly adjustments: ImageAdjustments;
}

const look = (
  id: EditorLook['id'],
  label: string,
  description: string,
  adjustments: Partial<ImageAdjustments>
): EditorLook => ({
  id,
  label,
  description,
  adjustments: { ...DEFAULT_IMAGE_ADJUSTMENTS, ...adjustments }
});

export const EDITOR_LOOKS: readonly EditorLook[] = [
  look('clean', 'Clean', 'Balanced clarity', {
    brightness: 3,
    contrast: 5,
    shadows: 6,
    sharpness: 8
  }),
  look('vivid', 'Vivid', 'Crisp and colorful', {
    contrast: 12,
    saturation: 18,
    highlights: -8,
    shadows: 10,
    sharpness: 14
  }),
  look('warm', 'Warm', 'Soft golden color', {
    contrast: 5,
    saturation: 7,
    highlights: -10,
    shadows: 8,
    temperature: 20,
    tint: 3
  }),
  look('film', 'Film', 'Muted editorial tone', {
    contrast: -4,
    saturation: -12,
    highlights: -16,
    shadows: 12,
    temperature: 9,
    gamma: 0.96,
    sharpness: 5
  }),
  look('mono', 'Mono', 'Graphic monochrome', {
    contrast: 16,
    highlights: -14,
    shadows: 10,
    sharpness: 10,
    grayscale: true
  })
] as const;

export function activeEditorLook(adjustments: ImageAdjustments) {
  return EDITOR_LOOKS.find((entry) =>
    (Object.keys(entry.adjustments) as (keyof ImageAdjustments)[]).every(
      (key) => entry.adjustments[key] === adjustments[key]
    )
  );
}
