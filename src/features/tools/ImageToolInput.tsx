import { AlertTriangle, FileImage, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import type { ImageValidationReport } from '../../types/images';
import { formatBytes } from '../../utils/format';
import { canPreviewOriginal } from './previewCapabilities';
import type { ImageToolStatus } from './useImageTool';

interface ImageToolInputProps {
  readonly file: File | undefined;
  readonly validation: ImageValidationReport | undefined;
  readonly sourceUrl: string | undefined;
  readonly status: ImageToolStatus;
  readonly error: string | undefined;
  readonly actionLabel: string;
  readonly onChoose: (file: File | undefined) => void;
  readonly onRemove: () => void;
}

export function ImageToolInput({
  file,
  validation,
  sourceUrl,
  status,
  error,
  actionLabel,
  onChoose,
  onRemove
}: ImageToolInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const chooseFirst = (files: FileList | readonly File[]) => onChoose(Array.from(files)[0]);

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFirst(event.dataTransfer.files);
  };

  return (
    <>
      <input
        ref={inputRef}
        data-image-input
        className="sr-only"
        type="file"
        aria-label="Choose an image"
        accept="image/jpeg,image/png,image/webp,image/avif,image/bmp,image/gif,image/svg+xml,image/x-icon,image/heic,image/heif,image/tiff,.jpg,.jpeg,.jfif,.png,.webp,.avif,.bmp,.gif,.svg,.ico,.heic,.heif,.tif,.tiff"
        onChange={(event) => {
          chooseFirst(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
        }}
      />

      {file ? (
        <div className="tool-file-row">
          <span className="tool-file-row__thumbnail">
            {sourceUrl && canPreviewOriginal(validation?.format) ? (
              <img src={sourceUrl} alt="" />
            ) : (
              <FileImage size={22} aria-hidden="true" />
            )}
          </span>
          <span className="tool-file-row__copy">
            <strong title={file.name}>{file.name}</strong>
            <small>
              {validation?.format.toUpperCase() ?? 'Checking'} ·{' '}
              {validation?.dimensions
                ? `${validation.dimensions.width} × ${validation.dimensions.height} · `
                : ''}
              {formatBytes(file.size)}
            </small>
            {error ? (
              <em role="alert">
                <AlertTriangle size={13} aria-hidden="true" /> {error}
              </em>
            ) : null}
          </span>
          <span className="tool-file-row__actions">
            <button
              className="button button--secondary tool-file-row__replace"
              type="button"
              disabled={status === 'processing'}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw size={16} aria-hidden="true" /> Replace
            </button>
            <button
              className="icon-button"
              type="button"
              disabled={status === 'processing'}
              onClick={onRemove}
            >
              <Trash2 size={17} aria-hidden="true" />
              <span className="sr-only">Remove {file.name}</span>
            </button>
          </span>
        </div>
      ) : (
        <button
          className={`tool-intake${dragging ? ' tool-intake--dragging' : ''}`}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setDragging(false);
          }}
          onDrop={onDrop}
        >
          <ImagePlus size={30} aria-hidden="true" />
          <strong>{actionLabel}</strong>
          <span>Choose or drop one supported image · advanced decoders load on demand</span>
        </button>
      )}
    </>
  );
}
