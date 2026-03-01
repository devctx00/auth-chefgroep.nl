import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);

      if (url.includes('/api/me')) {
        return Promise.resolve(
          new Response(JSON.stringify({ user: 'jan' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      if (url.includes('/api/auth')) {
        return Promise.resolve(
          new Response(JSON.stringify({ authenticated: true, user: 'jan' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ detail: 'unexpected' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });

  it('submits login to same-origin /api contract', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText('Gebruikersnaam'), 'jan');
    await user.type(screen.getByLabelText('Wachtwoord'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Inloggen' }));

    expect(window.fetch).toHaveBeenCalledWith(
      '/api/auth',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Succesvol ingelogd/)).toBeInTheDocument();
    });

  });
});
