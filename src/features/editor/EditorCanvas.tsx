import { Columns2, Maximize2, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { ImageCrop } from '../../types/images';
import { transformCrop, type CropHandle } from '../resize/cropMath';
import type { DecodedEditorSource } from './decodeEditorSource';
import { renderEditorPreview } from './renderEditorPreview';
import type { EditorCompareMode, EditorRecipe, EditorTool, EditorZoom } from './types';

interface EditorCanvasProps {
  readonly source: DecodedEditorSource;
  readonly recipe: EditorRecipe;
  readonly activeTool: EditorTool;
  readonly compareMode: EditorCompareMode;
  readonly comparison: number;
  readonly zoom: EditorZoom;
  readonly onComparison: (value: number) => void;
  readonly onCompareMode: (mode: EditorCompareMode) => void;
  readonly onZoom: (zoom: EditorZoom) => void;
  readonly onCropChange: (crop: ImageCrop) => void;
}

interface CropDrag {
  readonly pointerId: number;
  readonly handle: CropHandle;
  readonly clientX: number;
  readonly clientY: number;
  readonly crop: ImageCrop;
}

interface PanDrag {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly x: number;
  readonly y: number;
}

const cropHandles: readonly CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const zoomOptions: readonly EditorZoom[] = ['fit', 50, 100, 200, 400];

export function EditorCanvas({
  source,
  recipe,
  activeTool,
  compareMode,
  comparison,
  zoom,
  onComparison,
  onCompareMode,
  onZoom,
  onCropChange
}: EditorCanvasProps) {
  const originalRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const cropDragRef = useRef<CropDrag | undefined>(undefined);
  const panDragRef = useRef<PanDrag | undefined>(undefined);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const cropWorkspace = activeTool === 'crop';

  useEffect(() => {
    const original = originalRef.current;
    const output = outputRef.current;
    if (!original || !output) return;
    const frame = window.requestAnimationFrame(() => {
      renderEditorPreview(source, original, recipe, {
        original: true,
        cropWorkspace,
        maximumDimension: 1800
      });
      renderEditorPreview(source, output, recipe, {
        cropWorkspace,
        maximumDimension: 1800
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [cropWorkspace, recipe, source]);

  const onCropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!cropWorkspace) return;
    const target = event.target as HTMLElement;
    cropDragRef.current = {
      pointerId: event.pointerId,
      handle: (target.dataset.handle ?? 'move') as CropHandle,
      clientX: event.clientX,
      clientY: event.clientY,
      crop: recipe.crop
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onCropPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    const surface = surfaceRef.current;
    if (!drag || !surface || drag.pointerId !== event.pointerId) return;
    const bounds = surface.getBoundingClientRect();
    onCropChange(
      transformCrop(
        drag.crop,
        drag.handle,
        ((event.clientX - drag.clientX) / bounds.width) * source.width,
        ((event.clientY - drag.clientY) / bounds.height) * source.height,
        source.width,
        source.height,
        Math.max(12, Math.round(Math.min(source.width, source.height) * 0.03))
      )
    );
  };

  const endCropDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (cropDragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cropDragRef.current = undefined;
  };

  const onStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (cropWorkspace || zoom === 'fit' || zoom === 50 || zoom === 100) return;
    panDragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: pan.x,
      y: pan.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    setPan({
      x: drag.x + event.clientX - drag.clientX,
      y: drag.y + event.clientY - drag.clientY
    });
  };

  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (panDragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panDragRef.current = undefined;
  };

  const zoomScale = zoom === 'fit' ? 1 : zoom / 100;
  const outputClip = compareMode === 'slider' ? `inset(0 0 0 ${comparison}%)` : undefined;
  const selectZoom = (nextZoom: EditorZoom) => {
    if (nextZoom === 'fit' || nextZoom === 50 || nextZoom === 100) setPan({ x: 0, y: 0 });
    onZoom(nextZoom);
  };

  return (
    <section className="editor-canvas-region" aria-label="Image inspection canvas">
      <div
        className={`editor-stage editor-stage--${compareMode}${zoomScale > 1 ? ' editor-stage--pannable' : ''}`}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div
          ref={surfaceRef}
          className={`editor-image-surface${cropWorkspace ? ' editor-image-surface--crop' : ''}`}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})` }}
          data-testid="editor-preview-surface"
        >
          <canvas
            ref={originalRef}
            className="editor-preview editor-preview--original"
            aria-label="Original image preview"
          />
          <canvas
            ref={outputRef}
            className="editor-preview editor-preview--output"
            aria-label="Edited image preview"
            style={outputClip ? { clipPath: outputClip } : undefined}
          />

          {compareMode === 'slider' ? (
            <>
              <span
                className="editor-compare-divider"
                style={{ left: `${comparison}%` }}
                aria-hidden="true"
              >
                <Columns2 size={17} />
              </span>
              <input
                className="editor-compare-range"
                type="range"
                min="0"
                max="100"
                value={comparison}
                aria-label="Compare original and edited image"
                onChange={(event) => onComparison(event.currentTarget.valueAsNumber)}
              />
            </>
          ) : null}

          {cropWorkspace ? (
            <div
              className="editor-crop-selection"
              style={{
                left: `${(recipe.crop.x / source.width) * 100}%`,
                top: `${(recipe.crop.y / source.height) * 100}%`,
                width: `${(recipe.crop.width / source.width) * 100}%`,
                height: `${(recipe.crop.height / source.height) * 100}%`
              }}
              onPointerDown={onCropPointerDown}
              onPointerMove={onCropPointerMove}
              onPointerUp={endCropDrag}
              onPointerCancel={endCropDrag}
              role="group"
              aria-label="Interactive crop selection"
            >
              <span className="editor-crop-grid" aria-hidden="true" />
              {cropHandles.map((handle) => (
                <span
                  key={handle}
                  className={`editor-crop-handle editor-crop-handle--${handle}`}
                  data-handle={handle}
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="editor-viewbar">
        <label className="editor-compare-select">
          <span className="sr-only">Comparison mode</span>
          <Columns2 size={15} aria-hidden="true" />
          <select
            value={compareMode}
            onChange={(event) => onCompareMode(event.currentTarget.value as EditorCompareMode)}
          >
            <option value="slider">Compare: Slider</option>
            <option value="side-by-side">Side-by-side</option>
            <option value="original">Original only</option>
            <option value="output">Output only</option>
          </select>
        </label>
        <div className="editor-zoom-options" aria-label="Preview zoom">
          {zoomOptions.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={zoom === value}
              onClick={() => selectZoom(value)}
            >
              {value === 'fit' ? 'Fit' : `${value}%`}
            </button>
          ))}
        </div>
        <div className="editor-viewbar__fine-zoom" aria-hidden="true">
          <Minus size={14} />
          <span />
          <Plus size={14} />
        </div>
        <strong>
          {recipe.canvas.enabled ? recipe.canvas.width : recipe.crop.width} ×{' '}
          {recipe.canvas.enabled ? recipe.canvas.height : recipe.crop.height}
        </strong>
        <button
          className="icon-button icon-button--small"
          type="button"
          aria-label="Fit preview"
          onClick={() => selectZoom('fit')}
        >
          <Maximize2 size={15} />
        </button>
      </footer>
    </section>
  );
}
