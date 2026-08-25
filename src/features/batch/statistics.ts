import type { BatchJob, BatchStatistics } from './types';

export function calculateBatchStatistics(
  jobs: readonly BatchJob[],
  startedAt: number | undefined,
  endedAt: number | undefined,
  now = Date.now()
): BatchStatistics {
  let completed = 0;
  let failed = 0;
  let outputBytes = 0;
  let sourceBytes = 0;
  for (const job of jobs) {
    sourceBytes += job.file.size;
    if (job.status === 'completed' && job.output) {
      completed += 1;
      outputBytes += job.output.size;
    } else if (job.status === 'failed') {
      failed += 1;
    }
  }

  const durationMs = startedAt ? Math.max(0, (endedAt ?? now) - startedAt) : 0;
  const savedBytes = sourceBytes - outputBytes;
  const reductionPercent = sourceBytes === 0 ? 0 : (savedBytes / sourceBytes) * 100;
  const remaining = jobs.filter(
    (job) => !['completed', 'failed', 'cancelled'].includes(job.status)
  ).length;

  return {
    selected: jobs.length,
    completed,
    failed,
    remaining,
    sourceBytes,
    outputBytes,
    savedBytes,
    reductionPercent,
    durationMs,
    throughputPerMinute: durationMs === 0 ? 0 : completed / (durationMs / 60_000)
  };
}
