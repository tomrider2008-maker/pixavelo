import { useRef, type PointerEvent } from 'react';
import type { ImageCrop } from '../../types/images';
import { transformCrop, type CropHandle } from './cropMath';

interface CropPreviewProps {
  readonly sourceUrl?: string;
  readonly outputUrl?: string;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly crop: ImageCrop;
  readonly onChange: (crop: ImageCrop) => void;
  readonly onManualCrop: () => void;
  readonly interactionMode?: 'crop' | 'move';
}

interface DragState {
  readonly pointerId: number;
  readonly handle: CropHandle;
  readonly clientX: number;
  readonly clientY: number;
  readonly crop: ImageCrop;
}

const handles: readonly CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function CropPreview({
  sourceUrl,
  outputUrl,
  sourceWidth,
  sourceHeight,
  crop,
  onChange,
  onManualCrop,
  interactionMode = 'crop'
}: CropPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | undefined>(undefined);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (outputUrl) return;
    const target = event.target as HTMLElement;
    const handle = (
      interactionMode === 'move' ? 'move' : (target.dataset.handle ?? 'move')
    ) as CropHandle;
    dragRef.current = {
      pointerId: event.pointerId,
      handle,
      clientX: event.clientX,
      clientY: event.clientY,
      crop
    };
    previewRef.current?.setPointerCapture(event.pointerId);
    onManualCrop();
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const preview = previewRef.current;
    if (!drag || !preview || drag.pointerId !== event.pointerId) return;
    const bounds = preview.getBoundingClientRect();
    const deltaX = ((event.clientX - drag.clientX) / bounds.width) * sourceWidth;
    const deltaY = ((event.clientY - drag.clientY) / bounds.height) * sourceHeight;
    onChange(
      transformCrop(
        drag.crop,
        drag.handle,
        deltaX,
        deltaY,
        sourceWidth,
        sourceHeight,
        Math.max(8, Math.round(Math.min(sourceWidth, sourceHeight) * 0.02))
      )
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (previewRef.current?.hasPointerCapture(event.pointerId)) {
      previewRef.current.releasePointerCapture(event.pointerId);
    }
    dragRef.current = undefined;
  };

  return (
    <div
      ref={previewRef}
      className={`crop-preview crop-preview--${interactionMode}${outputUrl ? ' crop-preview--output' : ''}`}
      style={{ aspectRatio: `${sourceWidth} / ${sourceHeight}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="group"
      aria-label={outputUrl ? 'Transformed output preview' : 'Interactive crop preview'}
    >
      {outputUrl || sourceUrl ? (
        <img src={outputUrl ?? sourceUrl} alt={outputUrl ? 'Transformed output' : 'Source image'} />
      ) : (
        <div className="crop-preview__fallback">
          Advanced input decoded locally when you apply the resize.
        </div>
      )}
      {outputUrl ? (
        <span className="crop-preview__label">Verified output</span>
      ) : (
        <div
          className="crop-selection"
          style={{
            left: `${(crop.x / sourceWidth) * 100}%`,
            top: `${(crop.y / sourceHeight) * 100}%`,
            width: `${(crop.width / sourceWidth) * 100}%`,
            height: `${(crop.height / sourceHeight) * 100}%`
          }}
        >
          <span className="crop-selection__grid" aria-hidden="true" />
          {handles.map((handle) => (
            <span
              key={handle}
              className={`crop-handle crop-handle--${handle}`}
              data-handle={handle}
              aria-hidden="true"
            />
          ))}
        </div>
      )}
    </div>
  );
}
