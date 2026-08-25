import type { TextWatermarkOptions } from '../../types/images';

type WatermarkContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function drawTextWatermark(
  context: WatermarkContext,
  width: number,
  height: number,
  watermark: TextWatermarkOptions | undefined
) {
  const text = watermark?.text.trim();
  if (!watermark || !text) return;

  const fontSize = Math.max(12, Math.round(Math.min(width, height) * watermark.sizePercent));
  const padding = Math.max(12, Math.round(fontSize * 0.72));
  context.save();
  context.globalAlpha = clamp(watermark.opacity, 0.05, 1);
  context.fillStyle = watermark.color;
  context.font = `650 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(0, 0, 0, 0.32)';
  context.shadowBlur = Math.max(2, Math.round(fontSize * 0.12));
  context.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.05));

  const position = resolvePosition(watermark.position, width, height, padding);
  context.textAlign = position.align;
  context.fillText(text, position.x, position.y, Math.max(1, width - padding * 2));
  context.restore();
}

function resolvePosition(
  position: TextWatermarkOptions['position'],
  width: number,
  height: number,
  padding: number
) {
  const right = position.endsWith('right');
  const left = position.endsWith('left');
  const top = position.startsWith('top');
  const bottom = position.startsWith('bottom');
  return {
    x: right ? width - padding : left ? padding : width / 2,
    y: bottom ? height - padding : top ? padding : height / 2,
    align: right ? ('right' as const) : left ? ('left' as const) : ('center' as const)
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
