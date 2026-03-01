import { describe, expect, it, vi } from 'vitest';
import { onRequest } from './[[path]]';

describe('worker api proxy', () => {
  it('proxies to configured API origin and preserves status/body', async () => {
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
      headers: { 'Content-Type': 'application/json', Cookie: 'session=old' },
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
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('session=abc');
    await expect(response.json()).resolves.toEqual({ authenticated: true });
  });
});
