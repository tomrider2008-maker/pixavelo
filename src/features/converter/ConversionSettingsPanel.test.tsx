import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConversionSettingsPanel } from './ConversionSettingsPanel';

const balancedSettings = {
  outputFormat: 'jpeg' as const,
  quality: 88,
  background: '#ffffff',
  namingPattern: '{name}-converted'
};

describe('ConversionSettingsPanel', () => {
  it('applies a complete reusable preset', async () => {
    const user = userEvent.setup();
    const onSetSettings = vi.fn();
    render(
      <ConversionSettingsPanel
        settings={balancedSettings}
        disabled={false}
        onSetSettings={onSetSettings}
        onUpdateSettings={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText('Preset'), 'web-delivery');
    expect(onSetSettings).toHaveBeenCalledWith({
      outputFormat: 'webp',
      quality: 82,
      background: '#ffffff',
      namingPattern: '{name}-web'
    });
  });

  it('updates the naming pattern without invalidating encoded bytes', () => {
    const onUpdateSettings = vi.fn();
    render(
      <ConversionSettingsPanel
        settings={balancedSettings}
        disabled={false}
        onSetSettings={vi.fn()}
        onUpdateSettings={onUpdateSettings}
      />
    );

    const naming = screen.getByLabelText(/Naming pattern/);
    fireEvent.change(naming, { target: { value: '{name}-{index}' } });
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ namingPattern: '{name}-{index}' }, false);
  });
});
