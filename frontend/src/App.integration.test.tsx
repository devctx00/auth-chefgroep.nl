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
      JSON.stringify({ target: 'https://admin.chefgroep.nl/mail', at: Date.now(), count: 1 }),
    );
    const redirectSpy = vi.spyOn(authContract, 'redirectTo').mockImplementation(() => {});

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/login-loop te voorkomen/i)).toBeInTheDocument();
    });
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('shows login form after switch account (no auto-redirect)', async () => {
    window.history.replaceState({}, '', '/?switch=1&return_to=https%3A%2F%2Fadmin.chefgroep.nl%2Fmail');
    const redirectSpy = vi.spyOn(authContract, 'redirectTo').mockImplementation(() => {});

    render(<App />);

    // Met switch=1 in de URL: me() wordt niet aangeroepen, geen autoredirect
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Inloggen' })).toBeInTheDocument();
    });
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('shows network error message when login fetch fails', async () => {
    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/me')) {
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 401, headers: { 'Content-Type': 'application/json' } }),
        );
      }
      if (url.includes('/api/auth')) {
        return Promise.reject(new Error('Network failure'));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ detail: 'unexpected' }), { status: 500, headers: { 'Content-Type': 'application/json' } }),
      );
    });

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Gebruikersnaam'), 'jan');
    await user.type(screen.getByLabelText('Wachtwoord'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Inloggen' }));

    await waitFor(() => {
      expect(screen.getByText(/Netwerkfout tijdens authenticatie/i)).toBeInTheDocument();
    });
  });

  it('clears redirect loop guard after successful login for mc return_to', async () => {
    window.history.replaceState({}, '', '/?return_to=https%3A%2F%2Fmc.chefgroep.nl%2F');
    window.sessionStorage.setItem(
      'auth:auto-redirect-guard',
      JSON.stringify({ target: 'https://mc.chefgroep.nl/', at: Date.now(), count: 2 }),
    );

    vi.spyOn(window, 'fetch').mockImplementation((input) => {
      const url = String(input);

      if (url.includes('/api/me')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      if (url.includes('/api/auth')) {
        return Promise.resolve(
          new Response(JSON.stringify({ authenticated: true, user: 'joep' }), {
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

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Gebruikersnaam'), 'joep');
    await user.type(screen.getByLabelText('Wachtwoord'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Inloggen' }));

    await waitFor(() => {
      expect(screen.getByText(/Sessie actief\. Je wordt doorgestuurd/i)).toBeInTheDocument();
    });
    expect(window.sessionStorage.getItem('auth:auto-redirect-guard')).toBeNull();
  });
});
