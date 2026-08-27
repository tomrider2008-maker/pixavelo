import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ImageIntakeContext } from '../intake/IntakeContext';
import DashboardPage from './DashboardPage';

describe('DashboardPage', () => {
  it('presents the privacy promise and opens selected files in smart intake', async () => {
    const user = userEvent.setup();
    const openImageIntake = vi.fn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <ImageIntakeContext.Provider value={{ openImageIntake }}>
          <DashboardPage />
        </ImageIntakeContext.Provider>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: 'Powerful image tools. Completely private.' })
    ).toBeVisible();
    expect(screen.getByText('No uploads • No account • Local processing')).toBeVisible();

    const input = document.querySelector<HTMLInputElement>('[data-image-input]');
    if (!input) throw new Error('Dashboard image input was not rendered.');
    const image = new File(['image'], 'photo.png', { type: 'image/png' });
    await user.upload(input, image);
    expect(openImageIntake).toHaveBeenCalledWith([image]);
  });
});
