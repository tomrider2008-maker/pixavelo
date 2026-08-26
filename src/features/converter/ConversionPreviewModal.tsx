import { X, Download } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatBytes } from '../../utils/format';
import type { ConversionJob } from './types';

export function ConversionPreviewModal({
  job,
  filename,
  onClose
}: {
  readonly job: ConversionJob;
  readonly filename: string;
  readonly onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    dialog.addEventListener('keydown', handler);
    return () => dialog.removeEventListener('keydown', handler);
  }, [onClose]);

  const sizeDelta = job.output ? job.output.size - job.file.size : 0;
  const pctChange = job.file.size > 0 ? Math.round((Math.abs(sizeDelta) / job.file.size) * 100) : 0;
  const savedOrGrew = sizeDelta < 0 ? 'saved' : 'added';

  return (
    <dialog
      ref={dialogRef}
      className="preview-modal"
      aria-label={`Preview: ${job.file.name}`}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="preview-modal__content">
        <header className="preview-modal__header">
          <h2>{job.file.name}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close preview"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="preview-modal__panels">
          <figure className="preview-modal__panel">
            <div className="preview-modal__image-wrap">
              {job.previewUrl ? (
                <img src={job.previewUrl} alt="Original" />
              ) : (
                <div className="preview-modal__no-preview">No preview available</div>
              )}
            </div>
            <figcaption>
              <strong>Original</strong>
              <span>{formatBytes(job.file.size)}</span>
              {job.validation?.dimensions ? (
                <span>
                  {job.validation.dimensions.width} × {job.validation.dimensions.height}
                </span>
              ) : null}
            </figcaption>
          </figure>

          <figure className="preview-modal__panel">
            <div className="preview-modal__image-wrap">
              {job.output ? (
                <img src={job.output.url} alt="Converted output" />
              ) : (
                <div className="preview-modal__no-preview">Processing…</div>
              )}
            </div>
            <figcaption>
              <strong>Output · {(job.formatOverride ?? 'JPEG').toUpperCase()}</strong>
              {job.output ? (
                <>
                  <span>{formatBytes(job.output.size)}</span>
                  <span>
                    {job.output.width} × {job.output.height}
                  </span>
                  <span
                    className={`preview-modal__delta preview-modal__delta--${sizeDelta <= 0 ? 'savings' : 'growth'}`}
                  >
                    {sizeDelta <= 0 ? '▼' : '▲'} {pctChange}% {savedOrGrew}
                  </span>
                </>
              ) : null}
            </figcaption>
          </figure>
        </div>

        {job.output ? (
          <footer className="preview-modal__footer">
            <a className="button button--primary" href={job.output.url} download={filename}>
              <Download size={16} aria-hidden="true" /> Download output
            </a>
            <button type="button" className="button button--secondary" onClick={onClose}>
              Close
            </button>
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
