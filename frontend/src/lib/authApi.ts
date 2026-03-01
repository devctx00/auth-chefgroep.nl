export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

type JsonValue = Record<string, unknown>;

async function apiRequest<T extends JsonValue>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const response = await fetch(path, {
    credentials: 'include',
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
  return apiRequest<{ detail?: string; authenticated?: boolean; user?: string }>('/api/auth', {
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
  return apiRequest<{ detail?: string }>('/api/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function me() {
  return apiRequest<{ user?: string; detail?: string }>('/api/me', { method: 'GET' });
}

export function logout() {
  return apiRequest<{ detail?: string }>('/api/logout', { method: 'POST' });
}
