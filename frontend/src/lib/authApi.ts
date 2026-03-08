export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

type JsonValue = Record<string, unknown>;

const DEFAULT_API_PREFIX = '/api';

function normalizePrefix(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return DEFAULT_API_PREFIX;
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.replace(/\/+$/, '') || DEFAULT_API_PREFIX;
}

// Allow deployments to switch the same-origin proxy prefix (e.g. /apiu) without touching code.
// - Default stays /api for backwards compatibility.
// - Set VITE_API_PREFIX=/apiu to have the frontend call /apiu/*.
const API_PREFIX = normalizePrefix(import.meta.env.VITE_API_PREFIX);

async function apiRequest<T extends JsonValue>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const response = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T;

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export function login(username: string, password: string) {
  return apiRequest<{ detail?: string; authenticated?: boolean; user?: string }>(`${API_PREFIX}/auth`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function register(payload: {
  username: string;
  password: string;
  name: string;
  email: string;
}) {
  return apiRequest<{ detail?: string }>(`${API_PREFIX}/register`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function me() {
  return apiRequest<{ user?: string; detail?: string }>(`${API_PREFIX}/me`, { method: 'GET' });
}

export function logout() {
  return apiRequest<{ detail?: string }>(`${API_PREFIX}/logout`, { method: 'POST' });
}
