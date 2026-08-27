import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MAX_COLLECTION_FILES } from '../../engine/memory/browserBudgets';
import { IntakeDialog } from './IntakeDialog';

describe('IntakeDialog', () => {
  it('recommends a neutral editor start and routes only after confirmation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const file = pngFile('portrait.png', 1200, 800);
    render(<IntakeDialog files={[file]} onClose={vi.fn()} onSelect={onSelect} />);

    expect(screen.getByRole('status')).toHaveTextContent('Checking portrait.png');
    expect(await screen.findByRole('heading', { name: 'Open Image Editor' })).toBeVisible();
    expect(screen.getByText(/do not reveal the intended task/i)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Analysis complete. Open Image Editor is recommended. 1 file validated.'
    );
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onSelect).toHaveBeenCalledWith('/edit', [file]);
  });

  it('recommends Batch Studio for multiple valid files', async () => {
    const onSelect = vi.fn();
    const files = [pngFile('one.png'), pngFile('two.png')];
    render(<IntakeDialog files={files} onClose={vi.fn()} onSelect={onSelect} />);

    expect(await screen.findByRole('heading', { name: 'Open Batch Studio' })).toBeVisible();
    expect(screen.getByRole('button', { name: /convert/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /optimize/i })).toBeNull();
  });

  it('reports truthful aggregate dimension wording', async () => {
    render(
      <IntakeDialog
        files={[pngFile('wide.png', 2400, 1200), pngFile('tall.png', 800, 2500)]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(await screen.findByText('Max edge 2500px')).toBeVisible();
    expect(screen.queryByText('2400×2500')).toBeNull();
  });

  it('discloses files excluded by the local collection budget', async () => {
    const files = Array.from({ length: MAX_COLLECTION_FILES + 1 }, (_, index) =>
      pngFile(`image-${index}.png`)
    );
    render(<IntakeDialog files={files} onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText(/1 selected file was excluded before analysis/i)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 selected file was excluded by local safety limits.'
    );
    expect(screen.getByText(/up to 500 files within a 512.0 MB source budget/i)).toBeVisible();
  });

  it('explains invalid files and exposes no workflow action', async () => {
    render(
      <IntakeDialog
        files={[new File(['not an image'], 'notes.txt', { type: 'text/plain' })]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No supported image could be verified.'
    );
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByText(/1 file could not be included/i)).toBeVisible();
  });
});

function pngFile(name: string, width = 16, height = 12) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], name, { type: 'image/png' });
}
