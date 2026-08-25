import {
  Check,
  Clipboard,
  Download,
  FileArchive,
  Hash as HashIcon,
  LoaderCircle
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toAppError } from '../../engine/errors/AppError';
import { createZipBlob } from '../../engine/export/createZip';
import { formatBytes } from '../../utils/format';
import type { ImageValidationReport } from '../../types/images';
import { blobToDataUrl, decodeBase64Input, sha256Hex } from './utilityModel';
import { extractImageFrames } from './frameExtractor';

export function FrameUtility({
  file,
  validation
}: {
  readonly file: File | undefined;
  readonly validation: ImageValidationReport | undefined;
}) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'failed'>('idle');
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const controllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );
  const extract = async () => {
    if (!file) return;
    if (!validation?.supportedByConverter) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setStatus('processing');
    setError('');
    try {
      const result = await extractImageFrames(file, {
        maximumFrames: 120,
        signal: controller.signal,
        onProgress: (completed, total) => setProgress({ completed, total })
      });
      const zip = await createZipBlob(
        result.frames.map((frame) => ({ name: frame.filename, blob: frame.blob }))
      );
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(zip));
      setSummary(
        `${result.frames.length} of ${result.sourceFrameCount} frames verified${result.truncated ? ' · capped at 120' : ''}`
      );
      setStatus('complete');
    } catch (cause: unknown) {
      setError(toAppError(cause, 'DECODE_FAILED').userMessage);
      setStatus('failed');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
    }
  };
  return (
    <UtilitySplit
      title="Frame extraction"
      description="Extract up to 120 frames from animated images using the browser ImageDecoder API."
    >
      <div className="utility-action-panel">
        <FileArchive size={32} />
        <h3>{file?.name ?? 'Choose an animated image'}</h3>
        <p>GIF, WebP and other animated formats depend on browser ImageDecoder support.</p>
        {status === 'processing' ? (
          <p role="status">
            <LoaderCircle className="spin" size={16} /> {progress.completed} of{' '}
            {progress.total || '…'} frames
          </p>
        ) : null}
        {error ? (
          <p className="utility-error" role="alert">
            {error}
          </p>
        ) : null}
        {status === 'complete' ? (
          <p className="utility-success">
            <Check size={16} /> {summary}
          </p>
        ) : null}
        <button
          data-utility-primary
          className="button button--primary"
          type="button"
          disabled={!file || !validation?.supportedByConverter || status === 'processing'}
          onClick={() => void extract()}
        >
          Extract frames
        </button>
        {status === 'processing' ? (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => controllerRef.current?.abort()}
          >
            Cancel extraction
          </button>
        ) : null}
        {url ? (
          <a className="button button--secondary" href={url} download="extracted-frames.zip">
            <Download size={16} /> Download frame ZIP
          </a>
        ) : null}
      </div>
    </UtilitySplit>
  );
}

export function Base64Utility({ file }: { readonly file: File | undefined }) {
  const [encoded, setEncoded] = useState('');
  const [decodeInput, setDecodeInput] = useState('');
  const [decoded, setDecoded] = useState<{ url: string; bytes: number }>();
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      if (decoded?.url) URL.revokeObjectURL(decoded.url);
    },
    [decoded]
  );
  const encode = async () => {
    if (!file) return;
    setError('');
    try {
      setEncoded(await blobToDataUrl(file));
    } catch (cause: unknown) {
      setError(toAppError(cause, 'INVALID_FILE').userMessage);
    }
  };
  const decode = () => {
    setError('');
    try {
      const result = decodeBase64Input(decodeInput);
      if (decoded?.url) URL.revokeObjectURL(decoded.url);
      setDecoded({ url: URL.createObjectURL(result.blob), bytes: result.byteLength });
    } catch (cause: unknown) {
      setError(toAppError(cause, 'INVALID_FILE').userMessage);
    }
  };
  return (
    <UtilitySplit
      title="Base64"
      description="Encode the selected image or decode a bounded Base64/data URL locally."
    >
      <div className="data-utility-grid">
        <section>
          <h3>Encode image</h3>
          <p>{file ? `${file.name} · ${formatBytes(file.size)}` : 'Choose an image above.'}</p>
          <button
            data-utility-primary
            className="button button--primary"
            type="button"
            disabled={!file}
            onClick={() => void encode()}
          >
            Encode Base64
          </button>
          {encoded ? (
            <>
              <textarea readOnly aria-label="Encoded Base64" value={encoded} />
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void navigator.clipboard.writeText(encoded)}
              >
                <Clipboard size={15} /> Copy
              </button>
            </>
          ) : null}
        </section>
        <section>
          <h3>Decode Base64</h3>
          <textarea
            aria-label="Base64 to decode"
            placeholder="Paste a data URL or Base64 value"
            value={decodeInput}
            onChange={(event) => setDecodeInput(event.currentTarget.value)}
          />
          <button
            className="button button--secondary"
            type="button"
            disabled={!decodeInput.trim()}
            onClick={decode}
          >
            Decode safely
          </button>
          {decoded ? (
            <a className="button button--secondary" href={decoded.url} download="decoded-image">
              <Download size={15} /> Download {formatBytes(decoded.bytes)}
            </a>
          ) : null}
        </section>
      </div>
      {error ? (
        <p className="utility-error" role="alert">
          {error}
        </p>
      ) : null}
    </UtilitySplit>
  );
}

export function HashUtility({ file }: { readonly file: File | undefined }) {
  const [hash, setHash] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const calculate = async () => {
    if (!file) return;
    setProcessing(true);
    setError('');
    setHash('');
    try {
      setHash(await sha256Hex(file));
    } catch (cause: unknown) {
      setError(toAppError(cause, 'INVALID_FILE').userMessage);
    } finally {
      setProcessing(false);
    }
  };
  return (
    <UtilitySplit
      title="SHA-256 file hash"
      description="Create a standards-based checksum with Web Crypto. No filename or bytes are transmitted."
    >
      <div className="utility-action-panel">
        <HashIcon size={34} />
        <h3>{file?.name ?? 'Choose an image'}</h3>
        <p>
          {file
            ? `${formatBytes(file.size)} ready for hashing`
            : 'The selected file is hashed entirely in memory.'}
        </p>
        <button
          data-utility-primary
          className="button button--primary"
          type="button"
          disabled={!file || processing}
          onClick={() => void calculate()}
        >
          {processing ? <LoaderCircle className="spin" size={16} /> : <HashIcon size={16} />}{' '}
          Calculate SHA-256
        </button>
        {hash ? (
          <div className="hash-result">
            <code>{hash}</code>
            <button
              className="icon-button"
              type="button"
              aria-label="Copy SHA-256 hash"
              onClick={() => void navigator.clipboard.writeText(hash)}
            >
              <Clipboard size={16} />
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="utility-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </UtilitySplit>
  );
}

function UtilitySplit({
  title,
  description,
  children
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section
      className="utility-mode-panel"
      aria-labelledby={`utility-${title.replaceAll(/\W/g, '-').toLowerCase()}`}
    >
      <header>
        <h2 id={`utility-${title.replaceAll(/\W/g, '-').toLowerCase()}`}>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}
