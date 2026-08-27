import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PixelEditInspector } from './PixelEditInspector';
import {
  createEditorCutoutToolState,
  createEditorRemoveToolState,
  type EditorCutoutToolState,
  type EditorRemoveToolState
} from './pixelToolState';

describe('PixelEditInspector', () => {
  it('offers a local heal/clone workflow and applies pending removal strokes', () => {
    const onRemove = vi.fn<(state: EditorRemoveToolState) => void>();
    const onApply = vi.fn();
    render(
      <PixelEditInspector
        activeTool="remove"
        remove={createEditorRemoveToolState()}
        cutout={createEditorCutoutToolState(600)}
        pendingCount={2}
        dirty={false}
        supported
        showApply
        onRemove={onRemove}
        onCutout={vi.fn()}
        onUndoPending={vi.fn()}
        onClearPending={vi.fn()}
        onApplyPending={onApply}
      />
    );

    expect(screen.getByText('No upload, account, model, or paid API.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Clone/ }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ mode: 'clone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply removal' }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it('configures cutout refinement and blocks unsafe full-resolution work', () => {
    const onCutout = vi.fn<(state: EditorCutoutToolState) => void>();
    render(
      <PixelEditInspector
        activeTool="cutout"
        remove={createEditorRemoveToolState()}
        cutout={createEditorCutoutToolState(600)}
        pendingCount={0}
        dirty={false}
        supported={false}
        showApply
        onRemove={vi.fn()}
        onCutout={onCutout}
        onUndoPending={vi.fn()}
        onClearPending={vi.fn()}
        onApplyPending={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('13 MP local retouch limit');
    expect(screen.getByRole('button', { name: 'Apply cutout' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Color' }));
    expect(onCutout.mock.calls[0]?.[0].settings.background).toBe('color');
  });
});
