import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeDialog } from './WelcomeDialog';
import { hasSeenWelcome, markWelcomeSeen, resetWelcome } from './welcomePreference';

function renderDialog(
  open: boolean,
  onClose = vi.fn(),
  onChooseFiles = vi.fn<(files: readonly File[]) => void>()
) {
  return {
    onChooseFiles,
    ...render(
      <MemoryRouter>
        <WelcomeDialog open={open} onClose={onClose} onChooseFiles={onChooseFiles} />
      </MemoryRouter>
    )
  };
}

describe('welcomePreference', () => {
  beforeEach(() => localStorage.clear());

  it('tracks first visit, dismissal, and reset locally', () => {
    expect(hasSeenWelcome()).toBe(false);
    markWelcomeSeen();
    expect(hasSeenWelcome()).toBe(true);
    resetWelcome();
    expect(hasSeenWelcome()).toBe(false);
  });

  it('rejects malformed and incomplete records', () => {
    localStorage.setItem('pixavelo:welcome:v1', '{bad json');
    expect(hasSeenWelcome()).toBe(false);
    localStorage.setItem('pixavelo:welcome:v1', JSON.stringify({ dismissed: 'yes' }));
    expect(hasSeenWelcome()).toBe(false);
  });

  it('fails safe when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(hasSeenWelcome()).toBe(true);
    vi.restoreAllMocks();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() => markWelcomeSeen()).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('WelcomeDialog', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('presents the premium welcome hierarchy and privacy proof', () => {
    renderDialog(true);
    expect(screen.getByRole('dialog', { name: 'Welcome to Pixavelo' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Your private image studio.' })).toBeVisible();
    expect(screen.getByText('Local processing')).toBeVisible();
    expect(screen.getByText('No uploads')).toBeVisible();
    expect(screen.getByText('No account')).toBeVisible();
    expect(screen.getByText('No tracking')).toBeVisible();
    expect(screen.getByText('No server receives or processes your image files.')).toBeVisible();
  });

  it('shows the six distinct studio destinations', () => {
    renderDialog(true);
    for (const name of ['Edit', 'Convert', 'Optimize', 'Resize', 'Batch Studio', 'Web Assets']) {
      expect(screen.getByRole('link', { name: new RegExp(name, 'i') })).toBeVisible();
    }
    expect(screen.getByRole('link', { name: /optimize/i })).toHaveAttribute('href', '/optimize');
    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/edit');
  });

  it('focuses the close control when opened', async () => {
    renderDialog(true);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Close welcome guide' })).toHaveFocus()
    );
  });

  it('requests dismissal from the continue action', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(true, onClose);
    await user.click(screen.getByRole('button', { name: 'Continue to dashboard' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requests dismissal from Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(true, onClose);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requests dismissal from a studio link', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(true, onClose);
    await user.click(screen.getByRole('link', { name: /edit/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requests dismissal from the close control', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(true, onClose);
    await user.click(screen.getByRole('button', { name: 'Close welcome guide' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('passes selected files to the local intake flow', async () => {
    const user = userEvent.setup();
    const { onChooseFiles } = renderDialog(true);
    const image = new File(['png'], 'portrait.png', { type: 'image/png' });

    await user.upload(screen.getByLabelText('Choose image files'), image);
    expect(onChooseFiles).toHaveBeenCalledWith([image]);
  });
});
