import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateImageFile } from '../../engine/validation/validateFile';
import { clearProcessingActivity, hasProcessingActivity } from '../../stores/processingActivity';
import type { ImageValidationReport } from '../../types/images';
import { useImageTool } from './useImageTool';

vi.mock('../../engine/validation/validateFile', () => ({
  validateImageFile: vi.fn()
}));

const mockedValidate = vi.mocked(validateImageFile);

describe('useImageTool local-work lifecycle', () => {
  beforeEach(() => {
    mockedValidate.mockReset();
    clearProcessingActivity();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:local-source')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    });
  });

  afterEach(() => clearProcessingActivity());

  it('protects a selected image during validation and while it is ready', async () => {
    let finishValidation: ((report: ImageValidationReport) => void) | undefined;
    mockedValidate.mockImplementationOnce(
      () =>
        new Promise<ImageValidationReport>((resolve) => {
          finishValidation = resolve;
        })
    );
    const view = renderHook(() => useImageTool());

    act(() => {
      void view.result.current.chooseFile(
        new File(['local image'], 'handoff.png', { type: 'image/png' })
      );
    });

    await waitFor(() => expect(view.result.current.status).toBe('validating'));
    expect(hasProcessingActivity()).toBe(true);

    finishValidation?.(validationReport());
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    expect(hasProcessingActivity()).toBe(true);

    view.unmount();
    expect(hasProcessingActivity()).toBe(false);
  });
});

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
