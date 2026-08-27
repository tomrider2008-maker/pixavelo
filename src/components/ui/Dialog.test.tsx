import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('announces itself, focuses content and closes with Escape', () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Find a tool" description="Search available tools" onClose={onClose}>
        <button type="button">First action</button>
      </Dialog>
    );

    expect(screen.getByRole('dialog', { name: 'Find a tool' })).toHaveAttribute(
      'aria-modal',
      'true'
    );
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('restores focus after closing without pulling focus out of a replacement dialog', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const first = render(
      <Dialog open title="First dialog" onClose={() => undefined} returnFocus={trigger}>
        <button type="button">First action</button>
      </Dialog>
    );
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();

    first.unmount();
    const replacement = render(
      <Dialog open title="Replacement dialog" onClose={() => undefined} returnFocus={trigger}>
        <button type="button">Replacement action</button>
      </Dialog>
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Replacement action' })).toHaveFocus()
    );
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    expect(screen.getByRole('button', { name: 'Replacement action' })).toHaveFocus();

    replacement.unmount();
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });
});
