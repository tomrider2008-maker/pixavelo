import { describe, expect, it, vi } from 'vitest';
import {
  INTAKE_CONCURRENCY,
  MAX_COLLECTION_FILES,
  MAX_COLLECTION_SOURCE_BYTES
} from '../../engine/memory/browserBudgets';
import type { ImageValidationReport } from '../../types/images';
import { analyzeIntakeSelection } from './analyzeIntakeSelection';

describe('analyzeIntakeSelection', () => {
  it('caps the analyzed selection at the established collection file limit', async () => {
    const files = Array.from({ length: MAX_COLLECTION_FILES + 2 }, (_, index) =>
      fileWithSize(`image-${index}.png`, 1)
    );
    const validate = vi.fn(() => Promise.resolve(validationReport()));

    const result = await analyzeIntakeSelection(files, validate);

    expect(validate).toHaveBeenCalledTimes(MAX_COLLECTION_FILES);
    expect(result.items).toHaveLength(MAX_COLLECTION_FILES);
    expect(result.excludedCount).toBe(2);
  });

  it('excludes files that would cross the established collection byte limit', async () => {
    const files = [
      fileWithSize('first.png', MAX_COLLECTION_SOURCE_BYTES - 1),
      fileWithSize('second.png', 2)
    ];
    const validate = vi.fn(() => Promise.resolve(validationReport()));

    const result = await analyzeIntakeSelection(files, validate);

    expect(validate).toHaveBeenCalledOnce();
    expect(result.items.map((item) => item.file.name)).toEqual(['first.png']);
    expect(result.excludedCount).toBe(1);
  });

  it('uses the shared intake concurrency limit and preserves selection order', async () => {
    const files = Array.from({ length: 12 }, (_, index) => fileWithSize(`${index}.png`, 1));
    let active = 0;
    let maximumActive = 0;
    const validate = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
      return validationReport();
    });

    const result = await analyzeIntakeSelection(files, validate);

    expect(maximumActive).toBe(INTAKE_CONCURRENCY);
    expect(result.items.map((item) => item.file.name)).toEqual(files.map((file) => file.name));
  });

  it('does not start validation when the selection is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const validate = vi.fn(() => Promise.resolve(validationReport()));

    const result = await analyzeIntakeSelection(
      [fileWithSize('first.png', 1), fileWithSize('second.png', 1)],
      { signal: controller.signal, validate }
    );

    expect(validate).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.excludedCount).toBe(0);
  });

  it('settles in-flight validation without starting queued work after abort', async () => {
    const files = Array.from({ length: INTAKE_CONCURRENCY + 3 }, (_, index) =>
      fileWithSize(`${index}.png`, 1)
    );
    const controller = new AbortController();
    const pending = Array.from({ length: INTAKE_CONCURRENCY }, () =>
      deferred<ImageValidationReport>()
    );
    let nextValidation = 0;
    const validate = vi.fn(() => {
      const validation = pending[nextValidation];
      nextValidation += 1;
      if (!validation) throw new Error('A queued validation started after cancellation.');
      return validation.promise;
    });

    const analysis = analyzeIntakeSelection(files, { signal: controller.signal, validate });
    await vi.waitFor(() => expect(validate).toHaveBeenCalledTimes(INTAKE_CONCURRENCY));

    controller.abort();
    pending[0]?.reject(new Error('The in-flight decoder stopped.'));
    pending.slice(1).forEach((item) => item.resolve(validationReport()));

    const result = await analysis;

    expect(validate).toHaveBeenCalledTimes(INTAKE_CONCURRENCY);
    expect(result.items.map((item) => item.file.name)).toEqual(
      files.slice(0, INTAKE_CONCURRENCY).map((file) => file.name)
    );
    expect(result.items[0]).toHaveProperty('error');
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function fileWithSize(name: string, size: number): File {
  return { name, size, type: 'image/png' } as File;
}

function validationReport(): ImageValidationReport {
  return {
    format: 'png',
    mime: 'image/png',
    dimensions: { width: 16, height: 12, pixels: 192, megapixels: 0.000192 },
    supportedByCoreCodec: true,
    supportedByConverter: true,
    decoder: {
      id: 'test-png',
      label: 'PNG test decoder',
      route: 'core-native',
      loadedOnDemand: false
    },
    warnings: []
  };
}
