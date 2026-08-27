import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeDialog } from './WelcomeDialog';
import { hasSeenWelcome, markWelcomeSeen, resetWelcome } from './welcomePreference';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <WelcomeDialog open={open} onClose={onClose} />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// welcomePreference unit tests
// ---------------------------------------------------------------------------

describe('welcomePreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false for hasSeenWelcome on first visit', () => {
    expect(hasSeenWelcome()).toBe(false);
  });

  it('returns true after markWelcomeSeen', () => {
    markWelcomeSeen();
    expect(hasSeenWelcome()).toBe(true);
  });

  it('returns false after resetWelcome clears the record', () => {
    markWelcomeSeen();
    resetWelcome();
    expect(hasSeenWelcome()).toBe(false);
  });

  it('returns true (fail-safe) when localStorage throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(hasSeenWelcome()).toBe(true);
    vi.restoreAllMocks();
  });

  it('does not throw when localStorage throws on markWelcomeSeen', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() => markWelcomeSeen()).not.toThrow();
    vi.restoreAllMocks();
  });

  it('does not throw when localStorage throws on resetWelcome', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() => resetWelcome()).not.toThrow();
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// WelcomeDialog rendering
// ---------------------------------------------------------------------------

describe('WelcomeDialog', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('renders nothing when open is false', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog when open is true', () => {
    renderDialog(true);
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('displays the headline', () => {
    renderDialog(true);
    expect(screen.getByRole('heading', { name: 'Your private image studio.' })).toBeVisible();
  });

  it('shows all four privacy proof badges', () => {
    renderDialog(true);
    expect(screen.getByText('Local processing')).toBeVisible();
    expect(screen.getByText('No image uploads')).toBeVisible();
    expect(screen.getByText('No account required')).toBeVisible();
    expect(screen.getByText('No tracking')).toBeVisible();
  });

  it('shows all six studio cards', () => {
    renderDialog(true);
    expect(screen.getByText('Image Editor')).toBeVisible();
    expect(screen.getByText('Convert & Optimize')).toBeVisible();
    expect(screen.getByText('Resize & Transform')).toBeVisible();
    expect(screen.getByText('Batch Processing')).toBeVisible();
    expect(screen.getByText('Web Assets')).toBeVisible();
    expect(screen.getByText('Developer Tools')).toBeVisible();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(true, onClose);
    await user.click(screen.getByRole('button', { name: 'Close welcome guide' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed inside the dialog', () => {
    const onClose = vi.fn();
    renderDialog(true, onClose);
    const dialog = screen.getByRole('dialog');
    // Simulate keydown on the dialog element directly
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when a studio card is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(true, onClose);
    await user.click(screen.getByText('Image Editor'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when "Start creating" is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(true, onClose);
    await user.click(screen.getByRole('button', { name: /start creating/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has the correct ARIA attributes for dialog accessibility', () => {
    renderDialog(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'welcome-title');
    expect(screen.getByRole('heading', { name: 'Your private image studio.' })).toHaveAttribute(
      'id',
      'welcome-title'
    );
  });

  it('studio cards have correct navigation links', () => {
    renderDialog(true);
    const editorLink = screen.getByRole('link', { name: /image editor/i });
    expect(editorLink).toHaveAttribute('href', '/edit');
    const batchLink = screen.getByRole('link', { name: /batch processing/i });
    expect(batchLink).toHaveAttribute('href', '/batch');
  });
});
