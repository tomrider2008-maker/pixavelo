import { CheckCircle, X } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import type { ConversionJob } from './types';

export function ConversionSummary({
  jobs,
  onDismiss
}: {
  readonly jobs: readonly ConversionJob[];
  readonly onDismiss: () => void;
}) {
  const completed = jobs.filter((j) => j.status === 'completed' && j.output);
  const failed = jobs.filter((j) => j.status === 'failed' || j.status === 'unsupported');
  if (completed.length === 0 && jobs.length === 0) return null;

  const sourceTotal = completed.reduce((sum, j) => sum + j.file.size, 0);
  const outputTotal = completed.reduce((sum, j) => sum + (j.output?.size ?? 0), 0);
  const savedBytes = sourceTotal - outputTotal;
  const savedPct = sourceTotal > 0 ? Math.round((Math.abs(savedBytes) / sourceTotal) * 100) : 0;
  const grew = savedBytes < 0;

  const formatCounts = new Map<string, number>();
  for (const job of completed) {
    const fmt = (job.formatOverride ?? 'jpeg').toUpperCase();
    formatCounts.set(fmt, (formatCounts.get(fmt) ?? 0) + 1);
  }
  const formatSummary = [...formatCounts.entries()]
    .map(([fmt, count]) => `${count} × ${fmt}`)
    .join(' · ');

  return (
    <div className="session-summary-card" role="status" aria-live="polite">
      <div className="session-summary-card__icon">
        <CheckCircle size={22} aria-hidden="true" />
      </div>
      <div className="session-summary-card__body">
        <strong>
          {completed.length} file{completed.length === 1 ? '' : 's'} converted
          {failed.length > 0 ? ` · ${failed.length} failed` : ''}
        </strong>
        <span>
          {grew ? '▲' : '▼'} {savedPct}% {grew ? 'growth' : 'saved'} ·{' '}
          {formatBytes(Math.abs(savedBytes))} · {formatSummary}
        </span>
      </div>
      <button
        type="button"
        className="icon-button icon-button--small session-summary-card__dismiss"
        aria-label="Dismiss summary"
        onClick={onDismiss}
      >
        <X size={16} />
      </button>
    </div>
  );
}
