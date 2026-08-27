import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearIntakeSession, createIntakeSession } from '../../services/intakeSession';
import { clearProcessingActivity, setProcessingActivity } from '../../stores/processingActivity';
import { ServiceWorkerUpdate } from './ServiceWorkerUpdate';

const pwa = vi.hoisted(() => ({
  options: undefined as
    | {
        onNeedReload?: () => void;
        onRegisteredSW?: (
          scriptUrl: string,
          registration: ServiceWorkerRegistration | undefined
        ) => void;
      }
    | undefined,
  updateServiceWorker: vi.fn<() => Promise<void>>()
}));
let pendingSessionId: string | undefined;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: {
    onNeedReload?: () => void;
    onRegisteredSW?: (
      scriptUrl: string,
      registration: ServiceWorkerRegistration | undefined
    ) => void;
  }) => {
    pwa.options = options;
    return {
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: pwa.updateServiceWorker
    };
  }
}));

describe('ServiceWorkerUpdate', () => {
  beforeEach(() => {
    pwa.options = undefined;
    pwa.updateServiceWorker.mockReset().mockResolvedValue(undefined);
    clearProcessingActivity();
    pendingSessionId = undefined;
  });

  afterEach(() => {
    clearIntakeSession(pendingSessionId);
    clearProcessingActivity();
  });

  it('queues adoption until selected or processing work is cleared', async () => {
    const user = userEvent.setup();
    setProcessingActivity({ queued: 1, active: 0 });
    render(<ServiceWorkerUpdate reloadPage={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Update when finished' }));
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Update queued' })).toBeDisabled();
    expect(screen.getByText(/local work will finish/i)).toBeVisible();

    act(() => clearProcessingActivity());
    await waitFor(() => expect(pwa.updateServiceWorker).toHaveBeenCalledOnce());
  });

  it('defers a controller-change reload when work starts during activation', async () => {
    const user = userEvent.setup();
    const reloadPage = vi.fn();
    render(<ServiceWorkerUpdate reloadPage={reloadPage} />);

    await user.click(screen.getByRole('button', { name: 'Update Pixavelo' }));
    expect(pwa.updateServiceWorker).toHaveBeenCalledOnce();

    act(() => {
      setProcessingActivity({ queued: 0, active: 1, stage: 'processing' });
      pwa.options?.onNeedReload?.();
    });
    expect(reloadPage).not.toHaveBeenCalled();
    expect(screen.getByText(/local work will finish/i)).toBeVisible();

    act(() => clearProcessingActivity());
    await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce());
  });

  it('protects a pending intake handoff until the destination acknowledges it', async () => {
    const user = userEvent.setup();
    pendingSessionId = createIntakeSession([
      new File(['local image'], 'handoff.png', { type: 'image/png' })
    ]);
    render(<ServiceWorkerUpdate reloadPage={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Update when finished' }));
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Update queued' })).toBeDisabled();

    act(() => clearIntakeSession(pendingSessionId));
    await waitFor(() => expect(pwa.updateServiceWorker).toHaveBeenCalledOnce());
  });

  it('activates the exact waiting worker, including an update installed by another client', async () => {
    const user = userEvent.setup();
    const postMessage = vi.fn();
    render(<ServiceWorkerUpdate reloadPage={vi.fn()} />);

    act(() => {
      pwa.options?.onRegisteredSW?.('/sw.js', {
        waiting: { postMessage },
        update: vi.fn().mockResolvedValue(undefined)
      } as unknown as ServiceWorkerRegistration);
    });
    await user.click(screen.getByRole('button', { name: 'Update Pixavelo' }));

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
  });
});
