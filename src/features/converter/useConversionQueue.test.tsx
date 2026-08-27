import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateImageFile } from '../../engine/validation/validateFile';
import { clearProcessingActivity, hasProcessingActivity } from '../../stores/processingActivity';
import type { ImageValidationReport } from '../../types/images';
import { useConversionQueue } from './useConversionQueue';

vi.mock('../../engine/validation/validateFile', () => ({
  validateImageFile: vi.fn()
}));

const mockedValidate = vi.mocked(validateImageFile);

describe('useConversionQueue local-work lifecycle', () => {
  beforeEach(() => {
    mockedValidate.mockReset();
    clearProcessingActivity();
  });

  afterEach(() => clearProcessingActivity());

  it('protects newly handed-off files throughout asynchronous validation', async () => {
    let finishValidation: ((report: ImageValidationReport) => void) | undefined;
    mockedValidate.mockImplementationOnce(
      () =>
        new Promise<ImageValidationReport>((resolve) => {
          finishValidation = resolve;
        })
    );
    const view = renderHook(() => useConversionQueue([]));

    act(() => {
      view.result.current.addFiles([
        new File(['local image'], 'handoff.tiff', { type: 'image/tiff' })
      ]);
    });

    await waitFor(() => expect(view.result.current.jobs[0]?.status).toBe('validating'));
    expect(hasProcessingActivity()).toBe(true);

    finishValidation?.(validationReport());
    await waitFor(() => expect(view.result.current.jobs[0]?.status).toBe('ready'));
    expect(hasProcessingActivity()).toBe(true);

    view.unmount();
    expect(hasProcessingActivity()).toBe(false);
  });
});

function validationReport(): ImageValidationReport {
  return {
    format: 'tiff',
    mime: 'image/tiff',
    dimensions: { width: 16, height: 12, pixels: 192, megapixels: 0.000192 },
    supportedByCoreCodec: false,
    supportedByConverter: true,
    decoder: {
      id: 'test-tiff',
      label: 'TIFF test decoder',
      route: 'lazy-wasm',
      loadedOnDemand: true
    },
    warnings: []
  };
}
