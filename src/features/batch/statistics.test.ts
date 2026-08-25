import { describe, expect, it } from 'vitest';
import type { BatchJob } from './types';
import { calculateBatchStatistics } from './statistics';

function job(overrides: Partial<BatchJob> & Pick<BatchJob, 'id' | 'status'>): BatchJob {
  return {
    file: new File([new Uint8Array(1000)], `${overrides.id}.png`, { type: 'image/png' }),
    selected: true,
    attempt: 0,
    addedAt: 0,
    ...overrides
  };
}

describe('Batch statistics', () => {
  it('uses measured file/output bytes and elapsed time', () => {
    const jobs = [
      job({
        id: 'done',
        status: 'completed',
        output: {
          blob: new Blob([new Uint8Array(400)]),
          url: 'blob:done',
          filename: 'done.webp',
          mime: 'image/webp',
          size: 400,
          width: 10,
          height: 10,
          durationMs: 100,
          metadataRemovedVerified: true
        }
      }),
      job({ id: 'failed', status: 'failed' }),
      job({ id: 'waiting', status: 'waiting' })
    ];

    expect(calculateBatchStatistics(jobs, 1000, 61_000)).toEqual({
      selected: 3,
      completed: 1,
      failed: 1,
      remaining: 1,
      sourceBytes: 3000,
      outputBytes: 400,
      savedBytes: 2600,
      reductionPercent: (2600 / 3000) * 100,
      durationMs: 60_000,
      throughputPerMinute: 1
    });
  });

  it('does not invent throughput before a batch starts', () => {
    expect(calculateBatchStatistics([], undefined, undefined)).toMatchObject({
      durationMs: 0,
      throughputPerMinute: 0,
      reductionPercent: 0
    });
  });
});
