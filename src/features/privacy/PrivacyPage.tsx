import {
  AlertTriangle,
  Check,
  Download,
  FileCheck2,
  FileImage,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from '../../components/feedback/Notifications';
import { toAppError } from '../../engine/errors/AppError';
import { clearProcessingActivity, setProcessingActivity } from '../../stores/processingActivity';
import type { CoreImageFormat, ImageValidationReport, ProcessingStage } from '../../types/images';
import { formatBytes } from '../../utils/format';
import { ImageToolInput } from '../tools/ImageToolInput';
import { canPreviewOriginal } from '../tools/previewCapabilities';
import { resolveOutputFormat, useImageTool } from '../tools/useImageTool';
import { MetadataTable } from './MetadataTable';
import { cleanImageMetadata } from './metadataCleaner';
import { inspectImageMetadata } from './metadataInspector';
import { metadataCategories, policyForPreset, removedCategories } from './metadataPresets';
import { PrivacySignals } from './PrivacySignals';
import type {
  MetadataCategory,
  MetadataCleanResult,
  MetadataInspection,
  MetadataRemovalPolicy,
  MetadataSection,
  PrivacyPreset
} from './types';

type OutputChoice = CoreImageFormat | 'keep';
type PolicyChoice = PrivacyPreset | 'custom';

const presetOptions: readonly {
  id: PrivacyPreset;
  label: string;
  description: string;
}[] = [
  {
    id: 'preserve-all',
    label: 'Preserve all',
    description: 'Verify a byte-identical copy when possible.'
  },
  {
    id: 'location-only',
    label: 'Remove location only',
    description: 'Remove GPS and location-bearing metadata.'
  },
  {
    id: 'privacy-clean',
    label: 'Privacy Clean',
    description: 'Remove private identity and history fields.'
  },
  {
    id: 'remove-all',
    label: 'Remove all metadata',
    description: 'Re-encode and verify a clean container.'
  }
];

const categoryLabels: Readonly<Record<MetadataCategory, { label: string; description: string }>> = {
  location: { label: 'Location & GPS', description: 'Coordinates, altitude and location names' },
  camera: { label: 'Camera & lens', description: 'Make, model, lens and device identifiers' },
  dates: { label: 'Capture dates', description: 'Capture, edit and GPS timestamps' },
  software: { label: 'Software', description: 'Editing and device software names' },
  author: { label: 'Author & copyright', description: 'Creator, artist and rights fields' },
  exif: {
    label: 'Entire EXIF block',
    description: 'Also removes technical exposure and orientation data'
  },
  xmp: { label: 'XMP', description: 'Adobe extensible metadata blocks' },
  iptc: { label: 'IPTC', description: 'Publishing, byline and caption blocks' },
  thumbnail: { label: 'Embedded thumbnail', description: 'Hidden preview image inside EXIF' },
  icc: { label: 'ICC color profile', description: 'May change color appearance in managed apps' }
};

const stageLabels: Readonly<Record<ProcessingStage, string>> = {
  preparing: 'Preparing policy',
  decoding: 'Decoding image locally',
  processing: 'Cleaning metadata',
  encoding: 'Encoding clean pixels',
  finalizing: 'Re-inspecting output bytes'
};

export default function PrivacyPage() {
  const tool = useImageTool();
  const { notify } = useNotifications();
  const [inspection, setInspection] = useState<MetadataInspection>();
  const [inspectionError, setInspectionError] = useState<string>();
  const [activeSection, setActiveSection] = useState<MetadataSection>('general');
  const requestedPreset = readRequestedPreset();
  const [preset, setPreset] = useState<PolicyChoice>(requestedPreset);
  const [policy, setPolicy] = useState<MetadataRemovalPolicy>(() =>
    policyForPreset(requestedPreset)
  );
  const [format, setFormat] = useState<OutputChoice>('keep');
  const [quality, setQuality] = useState(92);
  const [result, setResult] = useState<MetadataCleanResult>();
  const [outputUrl, setOutputUrl] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>();
  const outputUrlRef = useRef<string | undefined>(undefined);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  const outputFormat = resolveOutputFormat(format, tool.validation);
  const selectedCategories = useMemo(() => removedCategories(policy), [policy]);
  const selectedPresent = inspection
    ? selectedCategories.filter((category) => inspection.categoriesPresent[category]).length
    : 0;
  const status = processing ? 'processing' : tool.status;

  const releaseOutput = () => {
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = undefined;
    setOutputUrl(undefined);
    setResult(undefined);
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    controllerRef.current?.abort();
    releaseOutput();
    setInspection(undefined);
    setInspectionError(undefined);
    setActiveSection('general');
    const validation = await tool.chooseFile(file);
    if (!validation) return;
    try {
      setInspection(await inspectImageMetadata(file, validation, file.name));
    } catch (cause: unknown) {
      setInspectionError(toAppError(cause, 'INVALID_FILE').userMessage);
    }
  };

  const removeFile = () => {
    controllerRef.current?.abort();
    releaseOutput();
    setInspection(undefined);
    setInspectionError(undefined);
    tool.removeFile();
  };

  const reset = () => {
    setPreset(requestedPreset);
    setPolicy(policyForPreset(requestedPreset));
    setFormat('keep');
    setQuality(92);
    removeFile();
  };

  const applyPreset = (nextPreset: PrivacyPreset) => {
    releaseOutput();
    setPreset(nextPreset);
    setPolicy(policyForPreset(nextPreset));
  };

  const toggleCategory = (category: MetadataCategory, checked: boolean) => {
    releaseOutput();
    setPreset('custom');
    setPolicy((current) => ({ ...current, [category]: checked }));
  };

  const clean = async () => {
    if (!tool.file || !tool.validation || !inspection || processing) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    releaseOutput();
    setProcessing(true);
    setStage('preparing');
    setInspectionError(undefined);
    setProcessingActivity({ queued: 0, active: 1, stage: 'preparing' });

    try {
      const next = await cleanImageMetadata({
        file: tool.file,
        validation: tool.validation,
        sourceInspection: inspection,
        policy,
        preset,
        outputFormat,
        quality: quality / 100,
        signal: controller.signal,
        onProgress: (nextStage) => {
          setStage(nextStage);
          setProcessingActivity({ queued: 0, active: 1, stage: nextStage });
        }
      });
      const url = URL.createObjectURL(next.blob);
      outputUrlRef.current = url;
      setOutputUrl(url);
      setResult(next);
      notify({
        tone: 'success',
        title:
          next.verification.removed.length > 0 ? 'Metadata removal verified' : 'Output verified',
        message: next.verification.message
      });
    } catch (cause: unknown) {
      const error = toAppError(cause, 'METADATA_FAILED');
      if (error.code !== 'CANCELLED') {
        setInspectionError(error.userMessage);
        notify({ tone: 'error', title: 'Output was not approved', message: error.userMessage });
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
      setProcessing(false);
      setStage(undefined);
      clearProcessingActivity();
    }
  };

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      clearProcessingActivity();
    },
    []
  );

  return (
    <section className="converter-page tool-page privacy-workspace">
      <div className="tool-page__heading privacy-workspace__heading">
        <div>
          <div className="tool-page__eyebrow">
            <ShieldCheck size={16} aria-hidden="true" /> Phase 8 · Local privacy tools
          </div>
          <h1>Metadata &amp; Privacy</h1>
          <p>
            Inspect hidden image data, choose an exact policy, then export only after Pixavelo
            verifies the output bytes.
          </p>
        </div>
        <div className="privacy-heading-actions">
          <button className="button button--secondary" type="button" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" /> Reset
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!inspection || processing}
            onClick={() => void clean()}
          >
            {processing ? (
              <LoaderCircle className="spin" size={16} aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}
            {actionLabel(preset)}
          </button>
        </div>
      </div>

      <ImageToolInput
        file={tool.file}
        validation={tool.validation}
        sourceUrl={tool.sourceUrl}
        status={status}
        error={tool.error ?? inspectionError}
        actionLabel="Choose an image to inspect"
        onChoose={(file) => void chooseFile(file)}
        onRemove={removeFile}
      />

      {!tool.file ? <PrivacyEmptyState /> : null}

      {tool.file && tool.validation && inspection ? (
        <div className="privacy-layout">
          <div className="privacy-preview-column">
            <section className="privacy-preview" aria-labelledby="source-preview-title">
              <div className="privacy-section-heading">
                <div>
                  <span>{result ? 'Verified output' : 'Local source'}</span>
                  <h2 id="source-preview-title">{result ? result.filename : tool.file.name}</h2>
                </div>
                <strong>
                  {result ? formatBytes(result.blob.size) : formatBytes(tool.file.size)}
                </strong>
              </div>
              <div className="privacy-preview__canvas">
                {outputUrl || (tool.sourceUrl && canPreviewOriginal(tool.validation.format)) ? (
                  <img
                    src={outputUrl ?? tool.sourceUrl}
                    alt={result ? 'Cleaned output preview' : 'Source image preview'}
                  />
                ) : (
                  <div className="privacy-preview__unavailable">
                    <FileImage size={28} aria-hidden="true" />
                    <strong>Preview unavailable</strong>
                    <span>The metadata inspector still works without rendering the pixels.</span>
                  </div>
                )}
                <span className="privacy-preview__badge">
                  {result ? 'Output' : 'Source'} · {tool.validation.format.toUpperCase()}
                </span>
              </div>
              <dl className="privacy-preview__facts">
                <div>
                  <dt>Dimensions</dt>
                  <dd>{formatDimensions(tool.validation)}</dd>
                </div>
                <div>
                  <dt>Metadata</dt>
                  <dd>
                    {(result?.inspection.metadataBytes ?? inspection.metadataBytes) > 0
                      ? formatBytes(result?.inspection.metadataBytes ?? inspection.metadataBytes)
                      : 'No blocks detected'}
                  </dd>
                </div>
                <div>
                  <dt>Processing</dt>
                  <dd>On this device</dd>
                </div>
              </dl>
            </section>
            {inspection.warnings.length > 0 ? (
              <div className="privacy-inline-warning" role="status">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{inspection.warnings.join(' ')}</span>
              </div>
            ) : null}
          </div>

          <div className="privacy-inspector-column">
            <PrivacySignals signals={inspection.signals} />
            <MetadataTable
              inspection={inspection}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </div>

          <aside className="privacy-policy" aria-labelledby="privacy-policy-title">
            <div className="privacy-section-heading">
              <div>
                <span>Export policy</span>
                <h2 id="privacy-policy-title">Privacy controls</h2>
              </div>
              <strong>{preset === 'custom' ? 'Custom' : `${selectedPresent} found`}</strong>
            </div>

            <fieldset className="privacy-presets">
              <legend>Preset</legend>
              {presetOptions.map((option) => (
                <label key={option.id} className={preset === option.id ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="privacy-preset"
                    value={option.id}
                    checked={preset === option.id}
                    disabled={processing}
                    onChange={() => applyPreset(option.id)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="metadata-removal-options">
              <legend>Metadata to remove</legend>
              {metadataCategories.map((category) => {
                const copy = categoryLabels[category];
                return (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={policy[category]}
                      disabled={processing}
                      onChange={(event) => toggleCategory(category, event.currentTarget.checked)}
                    />
                    <span>
                      <strong>{copy.label}</strong>
                      <small>{copy.description}</small>
                    </span>
                    {inspection.categoriesPresent[category] ? <em>Found</em> : null}
                  </label>
                );
              })}
            </fieldset>

            {policy.icc ? (
              <div className="icc-warning" role="note">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  <strong>Color profile removal selected</strong>Colors can look different in
                  color-managed software.
                </span>
              </div>
            ) : null}

            <div className="privacy-output-controls">
              <label>
                <span>Output format</span>
                <select
                  value={format}
                  disabled={processing}
                  onChange={(event) => {
                    releaseOutput();
                    setFormat(event.currentTarget.value as OutputChoice);
                  }}
                >
                  <option value="keep">Keep source format</option>
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>
              <label className="privacy-quality">
                <span>
                  Quality <output>{quality}</output>
                </span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={quality}
                  disabled={outputFormat === 'png' || processing}
                  onChange={(event) => {
                    releaseOutput();
                    setQuality(event.currentTarget.valueAsNumber);
                  }}
                />
              </label>
            </div>

            {format !== 'keep' ||
            !['jpeg', 'png', 'webp'].includes(tool.validation.format) ||
            preset === 'remove-all' ? (
              <p className="privacy-reencode-note">
                Pixels will be decoded with orientation applied, then re-encoded without source
                metadata.
              </p>
            ) : (
              <p className="privacy-reencode-note">
                Eligible metadata blocks are rewritten without decoding image pixels.
              </p>
            )}

            {processing ? (
              <div className="privacy-processing" role="status" aria-live="polite">
                <LoaderCircle className="spin" size={17} aria-hidden="true" />{' '}
                {stage ? stageLabels[stage] : 'Working locally'}
                <button type="button" onClick={() => controllerRef.current?.abort()}>
                  <X size={15} aria-hidden="true" /> Cancel
                </button>
              </div>
            ) : null}

            {result ? (
              <VerificationSummary result={result} />
            ) : (
              <div className="verification-pending">
                <FileCheck2 size={19} aria-hidden="true" />
                <span>
                  <strong>Output verification required</strong>No removal claim is made until the
                  exported container is inspected again.
                </span>
              </div>
            )}

            {result && outputUrl ? (
              <a
                className="button button--primary privacy-export"
                href={outputUrl}
                download={result.filename}
              >
                <Download size={17} aria-hidden="true" /> Download verified image
              </a>
            ) : (
              <button
                className="button button--primary privacy-export"
                type="button"
                disabled={processing}
                onClick={() => void clean()}
              >
                <ShieldCheck size={17} aria-hidden="true" /> {actionLabel(preset)}
              </button>
            )}
            <p className="privacy-local-note">
              <ShieldCheck size={15} aria-hidden="true" /> Image bytes remain in this browser.
            </p>
          </aside>
        </div>
      ) : tool.file && !inspectionError ? (
        <div className="privacy-loading" role="status">
          <LoaderCircle className="spin" size={20} aria-hidden="true" /> Inspecting bounded metadata
          blocks…
        </div>
      ) : null}

      {tool.file && inspection ? (
        result && outputUrl ? (
          <a
            className="button button--primary privacy-mobile-action"
            href={outputUrl}
            download={result.filename}
          >
            <Download size={17} aria-hidden="true" /> Download verified image
          </a>
        ) : (
          <button
            className="button button--primary privacy-mobile-action"
            type="button"
            disabled={processing}
            onClick={() => void clean()}
          >
            {processing ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <ShieldCheck size={17} aria-hidden="true" />
            )}
            {actionLabel(preset)}
          </button>
        )
      ) : null}
    </section>
  );
}

function VerificationSummary({ result }: { readonly result: MetadataCleanResult }) {
  const removed = result.verification.removed.map((category) => categoryLabels[category].label);
  return (
    <section className="verification-result" aria-labelledby="verification-result-title">
      <div className="verification-result__title">
        <span>
          <Check size={16} aria-hidden="true" />
        </span>
        <div>
          <h3 id="verification-result-title">Output verified</h3>
          <small>{result.verification.message}</small>
        </div>
      </div>
      <dl>
        <div>
          <dt>Method</dt>
          <dd>{result.pixelPreserving ? 'Pixel-preserving rewrite' : 'Local re-encode'}</dd>
        </div>
        <div>
          <dt>Removed</dt>
          <dd>{removed.length > 0 ? removed.join(', ') : 'No selected source fields present'}</dd>
        </div>
        <div>
          <dt>Checked in</dt>
          <dd>{Math.max(1, Math.round(result.durationMs))} ms</dd>
        </div>
      </dl>
      {result.verification.additionalRemovals.length > 0 ? (
        <p>
          Additional metadata removed by {result.pixelPreserving ? 'this policy' : 're-encoding'}:{' '}
          {result.verification.additionalRemovals
            .map((category) => categoryLabels[category].label)
            .join(', ')}
          .
        </p>
      ) : null}
    </section>
  );
}

function PrivacyEmptyState() {
  return (
    <div className="privacy-empty-overview">
      <div>
        <ShieldCheck size={19} aria-hidden="true" />
        <span>
          <strong>Inspect first</strong>See readable EXIF, GPS, XMP, IPTC, ICC and text metadata.
        </span>
      </div>
      <div>
        <Sparkles size={19} aria-hidden="true" />
        <span>
          <strong>Choose precisely</strong>Use a privacy preset or select individual metadata
          categories.
        </span>
      </div>
      <div>
        <FileCheck2 size={19} aria-hidden="true" />
        <span>
          <strong>Trust verified output</strong>The result is scanned again before download is
          enabled.
        </span>
      </div>
    </div>
  );
}

function actionLabel(preset: PolicyChoice) {
  if (preset === 'location-only') return 'Remove location metadata';
  if (preset === 'remove-all') return 'Remove all metadata';
  if (preset === 'preserve-all') return 'Create verified copy';
  if (preset === 'custom') return 'Clean selected metadata';
  return 'Clean private information';
}

function readRequestedPreset(): PrivacyPreset {
  return new URLSearchParams(window.location.search).get('action') === 'remove-gps'
    ? 'location-only'
    : 'privacy-clean';
}

function formatDimensions(validation: ImageValidationReport) {
  return validation.dimensions
    ? `${validation.dimensions.width} × ${validation.dimensions.height}`
    : 'Verified on decode';
}
