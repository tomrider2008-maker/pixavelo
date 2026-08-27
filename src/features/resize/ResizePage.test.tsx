import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsProvider } from '../../components/feedback/Notifications';
import type { ImageValidationReport } from '../../types/images';
import { useIncomingImageTool } from '../tools/useIncomingImageTool';
import ResizePage from './ResizePage';

vi.mock('../tools/useIncomingImageTool', () => ({
  useIncomingImageTool: vi.fn()
}));

vi.mock('../../utils/imageAnalysis', () => ({
  getDominantAmbientColor: vi.fn(() => Promise.resolve('transparent'))
}));

const mockedUseIncomingImageTool = vi.mocked(useIncomingImageTool);

describe('ResizePage intake initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/resize');
  });

  it('initializes each validated source once while preserving manual edits and reset', async () => {
    let currentTool = imageTool('first.png', 'blob:first', 3200, 1800);
    mockedUseIncomingImageTool.mockImplementation(() => currentTool);

    const view = render(
      <NotificationsProvider>
        <ResizePage />
      </NotificationsProvider>
    );
    const width = screen.getByRole('spinbutton', { name: /^Width/ });
    await waitFor(() => expect(width).toHaveValue(3200));

    fireEvent.change(width, { target: { value: '1000' } });
    expect(width).toHaveValue(1000);

    view.rerender(
      <NotificationsProvider>
        <ResizePage />
      </NotificationsProvider>
    );
    expect(width).toHaveValue(1000);

    currentTool = imageTool('second.png', 'blob:second', 640, 480);
    view.rerender(
      <NotificationsProvider>
        <ResizePage />
      </NotificationsProvider>
    );
    await waitFor(() => expect(width).toHaveValue(640));

    fireEvent.change(width, { target: { value: '300' } });
    const resetButton = screen.getAllByRole('button', { name: 'Reset' })[0];
    if (!resetButton) throw new Error('Resize reset control was not rendered.');
    fireEvent.click(resetButton);
    expect(width).toHaveValue(640);
  });
});

function imageTool(name: string, sourceUrl: string, width: number, height: number) {
  const file = new File(['image'], name, { type: 'image/png' });
  const validation: ImageValidationReport = {
    format: 'png',
    mime: 'image/png',
    dimensions: {
      width,
      height,
      pixels: width * height,
      megapixels: (width * height) / 1_000_000
    },
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

  return {
    file,
    validation,
    sourceUrl,
    output: undefined,
    status: 'ready',
    stage: undefined,
    error: undefined,
    chooseFile: vi.fn(),
    removeFile: vi.fn(),
    discardOutput: vi.fn(),
    process: vi.fn(),
    cancel: vi.fn()
  } as unknown as ReturnType<typeof useIncomingImageTool>;
}
