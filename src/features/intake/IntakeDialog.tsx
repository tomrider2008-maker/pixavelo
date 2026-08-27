import {
  AlertTriangle,
  ArrowRight,
  Check,
  Gauge,
  Globe2,
  ImageDown,
  Layers3,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import {
  MAX_COLLECTION_FILES,
  MAX_COLLECTION_SOURCE_BYTES
} from '../../engine/memory/browserBudgets';
import { formatBytes } from '../../utils/format';
import {
  recommendIntakeActions,
  type IntakeActionRoute,
  type IntakeRecommendation
} from './recommendIntakeActions';
import { analyzeIntakeSelection } from './analyzeIntakeSelection';

interface IntakeDialogProps {
  readonly files: readonly File[];
  readonly onClose: () => void;
  readonly onSelect: (route: IntakeActionRoute, files: readonly File[]) => void;
  readonly returnFocus?: HTMLElement | null;
}

const actionIcons: Readonly<Record<IntakeActionRoute, LucideIcon>> = {
  '/batch': Layers3,
  '/convert': Sparkles,
  '/optimize': Gauge,
  '/resize': ImageDown,
  '/edit': Pencil,
  '/web-assets': Globe2
};

export function IntakeDialog({ files, onClose, onSelect, returnFocus }: IntakeDialogProps) {
  const [analysis, setAnalysis] = useState<{
    readonly files: readonly File[];
    readonly recommendation: IntakeRecommendation | undefined;
    readonly excludedCount: number;
  }>(() => ({ files, recommendation: undefined, excludedCount: 0 }));
  const currentAnalysis = analysis.files === files ? analysis : undefined;
  const recommendation = currentAnalysis?.recommendation;
  const excludedCount = currentAnalysis?.excludedCount ?? 0;
  const statusMessage = recommendation
    ? recommendation.recommendation
      ? `Analysis complete. ${recommendation.recommendation.label} is recommended. ${recommendation.facts.validCount} file${recommendation.facts.validCount === 1 ? '' : 's'} validated.${excludedStatus(excludedCount)}`
      : `Analysis complete. No supported image could be verified.${excludedStatus(excludedCount)}`
    : `Checking ${files.length === 1 ? files[0]?.name : `${files.length} images`}.`;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    void analyzeIntakeSelection(files, { signal: controller.signal }).then((result) => {
      if (!active) return;
      setAnalysis({
        files,
        recommendation: recommendIntakeActions(result.items),
        excludedCount: result.excludedCount
      });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [files]);

  return (
    <Dialog
      open
      title="Choose the right studio"
      description="Pixavelo checks measurable file characteristics locally and suggests a workflow."
      onClose={onClose}
      className="intake-dialog premium-dialog-panel"
      backdropClassName="intake-backdrop premium-dialog-backdrop"
      returnFocus={returnFocus}
    >
      <header className="intake-header premium-dialog-header">
        <div>
          <span className="intake-kicker">Smart intake</span>
          <h2>Start with the right workflow.</h2>
          <p>Measured locally from your files. Your intended task is always your choice.</p>
        </div>
        <button
          type="button"
          className="icon-button intake-close"
          aria-label="Close smart intake"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>

      {recommendation ? (
        <IntakeResults
          recommendation={recommendation}
          excludedCount={excludedCount}
          onSelect={onSelect}
        />
      ) : (
        <div className="intake-analyzing">
          <LoaderCircle size={25} className="spin" aria-hidden="true" />
          <strong>
            Checking {files.length === 1 ? files[0]?.name : `${files.length} images`}…
          </strong>
          <span>Reading signatures, dimensions and file sizes on this device.</span>
        </div>
      )}

      <footer className="intake-trust premium-dialog-trust">
        <ShieldCheck size={16} aria-hidden="true" />
        Files remain in temporary browser memory and are never uploaded.
      </footer>
    </Dialog>
  );
}

function IntakeResults({
  recommendation,
  excludedCount,
  onSelect
}: {
  readonly recommendation: IntakeRecommendation;
  readonly excludedCount: number;
  readonly onSelect: IntakeDialogProps['onSelect'];
}) {
  const dimensions = recommendation.facts.maximumDimensions;
  const primary = recommendation.recommendation;

  return (
    <div className="intake-results">
      <div className="intake-facts" aria-label="Measured file facts">
        <span>{recommendation.facts.validCount} validated</span>
        <span>{formatBytes(recommendation.facts.totalBytes)}</span>
        {recommendation.facts.formats.length > 0 ? (
          <span>
            {recommendation.facts.formats.map((format) => format.toUpperCase()).join(' · ')}
          </span>
        ) : null}
        {dimensions.edge > 0 ? <span>Max edge {dimensions.edge}px</span> : null}
      </div>

      {primary ? (
        <section className="intake-recommendation" aria-labelledby="intake-recommendation-title">
          <span className="intake-recommendation__mark" aria-hidden="true">
            <Check size={18} />
          </span>
          <div>
            <span>Recommended from measured facts</span>
            <h3 id="intake-recommendation-title">{primary.label}</h3>
            <p>{recommendation.reason}</p>
            <small>{recommendation.evidence[0]}</small>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => onSelect(primary.route, recommendation.validFiles)}
          >
            Continue
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
      ) : (
        <div className="intake-empty" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>No supported image could be verified.</strong>
            <span>Close this review and choose another image.</span>
          </div>
        </div>
      )}

      {recommendation.choices.length > 1 ? (
        <section className="intake-alternatives" aria-labelledby="intake-alternatives-title">
          <div className="intake-section-heading">
            <h3 id="intake-alternatives-title">Or choose another studio</h3>
            <span>File traits cannot determine your intent.</span>
          </div>
          <div className="intake-actions studio-grid">
            {recommendation.choices.slice(1).map((choice) => {
              const Icon = actionIcons[choice.route];
              return (
                <button
                  key={choice.route}
                  type="button"
                  className="studio-card"
                  onClick={() => onSelect(choice.route, recommendation.validFiles)}
                >
                  <span className="studio-card__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.7} />
                  </span>
                  <span className="studio-card__copy">
                    <strong>{choice.label.replace('Open ', '')}</strong>
                    <small className="studio-card__description">{choice.reason}</small>
                  </span>
                  <ArrowRight className="studio-card__arrow" size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {excludedCount > 0 ? (
        <details className="intake-errors" role="alert" open>
          <summary>
            <AlertTriangle size={15} aria-hidden="true" />
            <strong>
              {excludedCount} selected file{excludedCount === 1 ? ' was' : 's were'} excluded before
              analysis.
            </strong>
          </summary>
          <p>
            Local safety limits allow up to {MAX_COLLECTION_FILES} files within a{' '}
            {formatBytes(MAX_COLLECTION_SOURCE_BYTES)} source budget. Only files that completed
            validation can continue.
          </p>
        </details>
      ) : null}

      {recommendation.errors.length > 0 ? (
        <details className="intake-errors">
          <summary>
            <AlertTriangle size={15} aria-hidden="true" />
            {recommendation.errors.length} file
            {recommendation.errors.length === 1 ? '' : 's'} could not be included
          </summary>
          <ul>
            {recommendation.errors.map(({ file, message }) => (
              <li key={`${file.name}-${file.size}`}>
                <strong>{file.name}</strong>: {message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function excludedStatus(excludedCount: number) {
  if (excludedCount === 0) return '';
  return ` ${excludedCount} selected file${excludedCount === 1 ? ' was' : 's were'} excluded by local safety limits.`;
}
