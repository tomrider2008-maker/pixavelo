import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useImageIntake } from '../../features/intake/IntakeContext';
import { clearIntakeSession, getIntakeSession } from '../../services/intakeSession';
import { hasLocalWorkGuard, setLocalWorkGuard } from '../../stores/localWorkGuard';
import { AppShell } from './AppShell';

const welcomeState = vi.hoisted(() => ({ seen: true }));

vi.mock('../../features/welcome/welcomePreference', () => ({
  hasSeenWelcome: () => welcomeState.seen,
  markWelcomeSeen: vi.fn()
}));

vi.mock('../../features/welcome/WelcomeDialog', () => ({
  WelcomeDialog: ({ onChooseFiles }: { onChooseFiles: (files: readonly File[]) => void }) => (
    <div role="dialog" aria-label="Welcome test double">
      <button type="button" onClick={() => onChooseFiles([testFile])}>
        Choose from welcome
      </button>
    </div>
  )
}));

vi.mock('./AppHeader', () => ({ AppHeader: () => null }));
vi.mock('./CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('./MobileNavigation', () => ({ MobileNavigation: () => null }));
vi.mock('./Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./StatusBar', () => ({ StatusBar: () => null }));

const testFile = pngFile('intake.png');

afterEach(() => {
  setLocalWorkGuard('smart-intake', false);
  welcomeState.seen = true;
});

describe('AppShell Smart Intake lifecycle', () => {
  it('protects files while intake is open and through acknowledged handoff', async () => {
    const view = render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<IntakeTrigger />} />
            <Route path="edit" element={<SessionConsumer />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(hasLocalWorkGuard()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Open intake' }));
    await screen.findByRole('dialog', { name: 'Choose the right studio' }, { timeout: 10_000 });
    expect(hasLocalWorkGuard()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Close smart intake' }));
    await waitFor(() => expect(hasLocalWorkGuard()).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: 'Open intake' }));
    await screen.findByRole('heading', { name: 'Open Image Editor' }, { timeout: 10_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Editor route');
    const sessionId =
      screen.getByTestId('session-consumer').getAttribute('data-session-id') ?? undefined;
    expect(sessionId).toBeDefined();
    expect(getIntakeSession(sessionId)).toEqual([testFile]);
    expect(hasLocalWorkGuard()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge intake session' }));
    await waitFor(() => expect(hasLocalWorkGuard()).toBe(false));

    view.unmount();
    expect(hasLocalWorkGuard()).toBe(false);
  }, 20_000);

  it('returns first-run Welcome intake cancellation to the persistent main workspace', async () => {
    welcomeState.seen = false;
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<p>Dashboard route</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Choose from welcome' }));
    await screen.findByRole('dialog', { name: 'Choose the right studio' }, { timeout: 10_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Close smart intake' }));

    await waitFor(() => expect(document.getElementById('main-content')).toHaveFocus());
  }, 20_000);
});

function IntakeTrigger() {
  const { openImageIntake } = useImageIntake();
  return (
    <button type="button" onClick={() => openImageIntake([testFile])}>
      Open intake
    </button>
  );
}

function SessionConsumer() {
  const location = useLocation();
  const sessionId = (location.state as { sessionId?: string } | null)?.sessionId;
  return (
    <div data-testid="session-consumer" data-session-id={sessionId}>
      <p>Editor route</p>
      <button type="button" onClick={() => clearIntakeSession(sessionId)}>
        Acknowledge intake session
      </button>
    </div>
  );
}

function pngFile(name: string) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 16);
  view.setUint32(20, 12);
  return new File([bytes], name, { type: 'image/png' });
}
