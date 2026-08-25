import { fireEvent, render, screen } from '@testing-library/react';
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
});
