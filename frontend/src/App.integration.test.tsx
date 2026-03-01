import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import * as authContract from './lib/authContract';

describe('App integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.replaceState({}, '', '/');

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

  it('auto-redirects an already authenticated session to return_to', async () => {
    window.history.replaceState({}, '', '/?return_to=https%3A%2F%2Fadmin.chefgroep.nl%2Fmail');
    const redirectSpy = vi.spyOn(authContract, 'redirectTo').mockImplementation(() => {});

    render(<App />);
    await waitFor(
      () => {
        expect(redirectSpy).toHaveBeenCalledWith('https://admin.chefgroep.nl/mail', 'replace');
      },
      { timeout: 2500 },
    );
  });

  it('does not auto-redirect when switch account is requested', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/?switch=1&return_to=https%3A%2F%2Fadmin.chefgroep.nl%2Fmail');
    const redirectSpy = vi.spyOn(authContract, 'redirectTo').mockImplementation(() => {});

    render(<App />);
    await vi.advanceTimersByTimeAsync(1200);

    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('stops auto-redirect when recent redirect guard is present', async () => {
    window.history.replaceState({}, '', '/?return_to=https%3A%2F%2Fadmin.chefgroep.nl%2Fmail');
    window.sessionStorage.setItem(
      'auth:auto-redirect-guard',
      JSON.stringify({ target: 'https://admin.chefgroep.nl/mail', at: Date.now() }),
    );
    const redirectSpy = vi.spyOn(authContract, 'redirectTo').mockImplementation(() => {});

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/login-loop te voorkomen/i)).toBeInTheDocument();
    });
    expect(redirectSpy).not.toHaveBeenCalled();
  });
});
