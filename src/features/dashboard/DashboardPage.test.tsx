import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import DashboardPage from './DashboardPage';

describe('DashboardPage', () => {
  it('presents the privacy promise and routes selected files into the converter', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/convert" element={<h1>Converter workspace</h1>} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: 'Powerful image tools. Completely private.' })
    ).toBeVisible();
    expect(screen.getByText('No uploads • No account • Local processing')).toBeVisible();

    const input = document.querySelector<HTMLInputElement>('[data-image-input]');
    if (!input) throw new Error('Dashboard image input was not rendered.');
    await user.upload(input, new File(['image'], 'photo.png', { type: 'image/png' }));
    expect(await screen.findByRole('heading', { name: 'Converter workspace' })).toBeVisible();
  });
});
