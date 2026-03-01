import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from './[[path]]';

describe('worker api proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves auth request headers and session cookies on auth routes', async () => {
    const upstream = new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=abc; Secure; HttpOnly',
      },
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream);

    const request = new Request('https://auth.chefgroep.nl/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'session=old',
        Authorization: 'Bearer token',
      },
      body: JSON.stringify({ username: 'jan', password: 'pw' }),
    });

    const response = await onRequest({
      env: { API_ORIGIN: 'https://api.chefgroep.nl' },
      request,
    } as Parameters<typeof onRequest>[0]);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://api.chefgroep.nl/api/auth'),
      expect.objectContaining({ method: 'POST' }),
    );
    const forwardedHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers as HeadersInit);
    expect(forwardedHeaders.get('cookie')).toBe('session=old');
    expect(forwardedHeaders.get('authorization')).toBe('Bearer token');
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBe('session=abc; Secure; HttpOnly');
    await expect(response.json()).resolves.toEqual({ authenticated: true });
  });

  it('strips sensitive headers on public non-auth routes', async () => {
    const upstream = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'should_not_leak=1; Secure; HttpOnly',
      },
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream);

    const request = new Request('https://auth.chefgroep.nl/api/public/health', {
      method: 'GET',
      headers: {
        Cookie: 'session=old',
        Authorization: 'Bearer token',
      },
    });

    const response = await onRequest({
      env: { API_ORIGIN: 'https://api.chefgroep.nl' },
      request,
    } as Parameters<typeof onRequest>[0]);

    const forwardedHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers as HeadersInit);
    expect(forwardedHeaders.get('cookie')).toBeNull();
    expect(forwardedHeaders.get('authorization')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('redirects non-public unauthenticated paths to auth origin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const request = new Request('https://auth.chefgroep.nl/api/agents');

    const response = await onRequest({
      env: { API_ORIGIN: 'https://api.chefgroep.nl' },
      request,
    } as Parameters<typeof onRequest>[0]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('https://auth.chefgroep.nl');
    expect(response.headers.get('location')).toContain('return_to=https%3A%2F%2Fauth.chefgroep.nl%2Fapi%2Fagents');
  });
});
