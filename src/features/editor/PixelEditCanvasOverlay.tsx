import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { EditorPixelOperation, EditorPoint } from '../../types/editorPixelEdits';
import type { EditorCutoutToolState, EditorRemoveToolState } from './pixelToolState';
import type { EditorTool } from './types';

interface PixelEditCanvasOverlayProps {
  readonly activeTool: EditorTool;
  readonly referenceDimension: number;
  readonly remove: EditorRemoveToolState;
  readonly cutout: EditorCutoutToolState;
  readonly pending: readonly EditorPixelOperation[];
  readonly onOperation: (operation: EditorPixelOperation) => void;
  readonly onCloneSource: (point: EditorPoint | undefined) => void;
}

interface ActiveStroke {
  readonly pointerId: number;
  readonly points: EditorPoint[];
}

const MAX_STROKE_POINTS = 2048;

export function PixelEditCanvasOverlay({
  activeTool,
  referenceDimension,
  remove,
  cutout,
  pending,
  onOperation,
  onCloneSource
}: PixelEditCanvasOverlayProps) {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<ActiveStroke | undefined>(undefined);
  const keyboardPointRef = useRef<EditorPoint>({ x: 0.5, y: 0.5 });
  const pixelTool = activeTool === 'remove' || activeTool === 'cutout';
  if (!pixelTool) return null;

  const settings = activeTool === 'remove' ? remove : cutout;
  const brushSize = settings.brushSize;
  const showKeyboardCursor = (point: EditorPoint) => {
    const overlay = overlayRef.current;
    const cursor = cursorRef.current;
    if (!overlay || !cursor) return;
    const bounds = overlay.getBoundingClientRect();
    const size =
      (brushSize / Math.max(1, referenceDimension)) * Math.min(bounds.width, bounds.height);
    cursor.style.width = `${Math.max(8, size)}px`;
    cursor.style.height = `${Math.max(8, size)}px`;
    cursor.style.left = `${point.x * 100}%`;
    cursor.style.top = `${point.y * 100}%`;
    cursor.hidden = false;
  };

  const commitStroke = (points: readonly EditorPoint[]) => {
    const firstPoint = points[0];
    if (!firstPoint) return;
    const stroke = {
      points,
      size: brushSize,
      hardness: activeTool === 'remove' ? remove.hardness : 100,
      feather: activeTool === 'remove' ? remove.feather : cutout.settings.feather * 8,
      referenceDimension
    };
    if (activeTool === 'remove') {
      if (remove.mode === 'clone' && remove.cloneSource) {
        onOperation({
          kind: 'clone',
          stroke,
          source: remove.cloneSource,
          targetOrigin: firstPoint
        });
      } else {
        onOperation({ kind: 'heal', stroke });
      }
    } else if (cutout.mode !== 'wand') {
      onOperation({ kind: 'cutout-brush', action: cutout.mode, stroke });
    }
  };

  const commitPoint = (point: EditorPoint) => {
    if (activeTool === 'remove' && remove.mode === 'clone' && !remove.cloneSource) {
      onCloneSource(point);
    } else if (activeTool === 'cutout' && cutout.mode === 'wand') {
      onOperation({
        kind: 'cutout-wand',
        seed: point,
        tolerance: cutout.tolerance,
        connected: cutout.connected
      });
    } else {
      commitStroke([point]);
    }
  };

  const updateCursor = (event: PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    const cursor = cursorRef.current;
    if (!overlay || !cursor) return;
    const bounds = overlay.getBoundingClientRect();
    const size =
      (brushSize / Math.max(1, referenceDimension)) * Math.min(bounds.width, bounds.height);
    cursor.style.width = `${Math.max(8, size)}px`;
    cursor.style.height = `${Math.max(8, size)}px`;
    cursor.style.left = `${event.clientX - bounds.left}px`;
    cursor.style.top = `${event.clientY - bounds.top}px`;
    cursor.hidden = false;
  };

  const begin = (event: PointerEvent<HTMLDivElement>) => {
    updateCursor(event);
    const point = normalizedPoint(event);
    if (
      (activeTool === 'remove' && remove.mode === 'clone' && !remove.cloneSource) ||
      (activeTool === 'cutout' && cutout.mode === 'wand')
    ) {
      commitPoint(point);
      event.preventDefault();
      return;
    }
    strokeRef.current = { pointerId: event.pointerId, points: [point] };
    preparePreview(event.currentTarget);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    updateCursor(event);
    const active = strokeRef.current;
    if (active?.pointerId !== event.pointerId) return;
    const point = normalizedPoint(event);
    const previous = active.points.at(-1);
    if (previous ? Math.hypot(point.x - previous.x, point.y - previous.y) < 0.002 : false) return;
    if (active.points.length < MAX_STROKE_POINTS) active.points.push(point);
    drawPreview(event.currentTarget, previous ?? point, point, brushSize, referenceDimension);
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    const active = strokeRef.current;
    if (active?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    strokeRef.current = undefined;
    clearPreview(previewRef.current);
    commitStroke(active.points);
  };

  const cancel = () => {
    strokeRef.current = undefined;
    clearPreview(previewRef.current);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      cancel();
      event.preventDefault();
      return;
    }
    const current = keyboardPointRef.current;
    const step = event.shiftKey ? 0.1 : 0.02;
    const point =
      event.key === 'Home'
        ? { x: 0.02, y: 0.02 }
        : event.key === 'End'
          ? { x: 0.98, y: 0.98 }
          : event.key === 'ArrowLeft'
            ? { ...current, x: clamp(current.x - step) }
            : event.key === 'ArrowRight'
              ? { ...current, x: clamp(current.x + step) }
              : event.key === 'ArrowUp'
                ? { ...current, y: clamp(current.y - step) }
                : event.key === 'ArrowDown'
                  ? { ...current, y: clamp(current.y + step) }
                  : undefined;
    if (point) {
      keyboardPointRef.current = point;
      showKeyboardCursor(point);
      event.preventDefault();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    commitPoint(current);
    showKeyboardCursor(current);
    event.preventDefault();
  };

  const shownOperations = pending.filter((operation) =>
    activeTool === 'remove'
      ? operation.kind === 'heal' || operation.kind === 'clone'
      : operation.kind === 'cutout-wand' || operation.kind === 'cutout-brush'
  );

  return (
    <div
      ref={overlayRef}
      className={`editor-pixel-overlay editor-pixel-overlay--${activeTool}`}
      style={overlayStyle}
      role="application"
      aria-label={
        activeTool === 'remove' ? 'Remove and heal image canvas' : 'Background cutout image canvas'
      }
      tabIndex={0}
      aria-description="Use a pointer to paint, or move the keyboard cursor with the arrow keys, Home or End and apply with Enter or Space. Escape cancels the active stroke."
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={cancel}
      onPointerLeave={() => {
        if (cursorRef.current) cursorRef.current.hidden = true;
      }}
      onKeyDown={onKeyDown}
    >
      {settings.showMask ? (
        <svg
          className="editor-pixel-overlay__mask"
          style={layerStyle}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {shownOperations.map((operation, index) => (
            <OperationMark
              key={`${operation.kind}-${index}`}
              operation={operation}
              referenceDimension={referenceDimension}
            />
          ))}
        </svg>
      ) : null}
      <canvas
        ref={previewRef}
        className="editor-pixel-overlay__preview"
        style={layerStyle}
        aria-hidden="true"
      />
      {remove.cloneSource && activeTool === 'remove' ? (
        <svg
          className="editor-pixel-overlay__sample"
          viewBox="0 0 20 20"
          style={{
            ...sampleStyle,
            left: `${remove.cloneSource.x * 100}%`,
            top: `${remove.cloneSource.y * 100}%`
          }}
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="8" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M4 10h12M10 4v12" stroke="#fff" strokeWidth="1.5" />
        </svg>
      ) : null}
      <span
        ref={cursorRef}
        className="editor-pixel-overlay__cursor"
        style={cursorStyle}
        hidden
        aria-hidden="true"
      />
    </div>
  );
}

function OperationMark({
  operation,
  referenceDimension
}: {
  readonly operation: EditorPixelOperation;
  readonly referenceDimension: number;
}) {
  if (operation.kind === 'cutout-wand') {
    return (
      <circle
        cx={operation.seed.x * 100}
        cy={operation.seed.y * 100}
        r="1.1"
        className="editor-pixel-mark editor-pixel-mark--wand"
        fill="#ffcc66"
        stroke="#111827"
        strokeWidth="0.4"
      />
    );
  }
  const stroke = operation.stroke;
  const points = stroke.points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');
  const className =
    operation.kind === 'cutout-brush'
      ? `editor-pixel-mark editor-pixel-mark--${operation.action}`
      : `editor-pixel-mark editor-pixel-mark--${operation.kind}`;
  return (
    <polyline
      points={points}
      className={className}
      fill="none"
      stroke={markColor(operation)}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      strokeWidth={Math.max(0.6, (stroke.size / Math.max(1, referenceDimension)) * 100)}
    />
  );
}

function markColor(operation: EditorPixelOperation) {
  if (operation.kind === 'cutout-brush' && operation.action === 'keep')
    return 'rgba(62, 224, 151, 0.62)';
  if (operation.kind === 'heal' || operation.kind === 'cutout-brush')
    return 'rgba(250, 88, 123, 0.58)';
  return 'rgba(108, 132, 255, 0.56)';
}

function normalizedPoint(event: PointerEvent<HTMLDivElement>): EditorPoint {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width)),
    y: clamp((event.clientY - bounds.top) / Math.max(1, bounds.height))
  };
}

function preparePreview(overlay: HTMLDivElement) {
  const canvas = overlay.querySelector<HTMLCanvasElement>('.editor-pixel-overlay__preview');
  if (!canvas) return;
  const bounds = overlay.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(bounds.width));
  canvas.height = Math.max(1, Math.round(bounds.height));
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}

function drawPreview(
  overlay: HTMLDivElement,
  from: EditorPoint,
  to: EditorPoint,
  brushSize: number,
  referenceDimension: number
) {
  const canvas = overlay.querySelector<HTMLCanvasElement>('.editor-pixel-overlay__preview');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;
  context.strokeStyle = 'rgba(108, 132, 255, 0.52)';
  context.lineWidth = Math.max(
    6,
    (brushSize / Math.max(1, referenceDimension)) * Math.min(canvas.width, canvas.height)
  );
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(from.x * canvas.width, from.y * canvas.height);
  context.lineTo(to.x * canvas.width, to.y * canvas.height);
  context.stroke();
}

function clearPreview(canvas: HTMLCanvasElement | null) {
  canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 8,
  inset: 0,
  overflow: 'hidden',
  cursor: 'none',
  touchAction: 'none'
};

const layerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none'
};

const cursorStyle: CSSProperties = {
  position: 'absolute',
  border: '1.5px solid #fff',
  borderRadius: '50%',
  boxShadow: '0 0 0 1px #121826aa',
  pointerEvents: 'none',
  transform: 'translate(-50%, -50%)'
};

const sampleStyle: CSSProperties = {
  position: 'absolute',
  width: 20,
  height: 20,
  filter: 'drop-shadow(0 0 2px #3157f6)',
  pointerEvents: 'none',
  transform: 'translate(-50%, -50%)'
};
