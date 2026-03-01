export const AUTH_HOST_SUFFIX = '.chefgroep.nl';
export const DEFAULT_RETURN_TO = 'https://mc.chefgroep.nl/mission-control';
export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export type AuthMode = 'login' | 'register';

export type RegistrationPayload = {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
};

type ReturnTargetOptions = {
  allowDevHosts?: boolean;
};

function isDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function resolveReturnTo(
  rawValue: string | null,
  origin: string,
  options: ReturnTargetOptions = {},
): {
  returnTo: string;
  returnHost: string;
} {
  const fallback = new URL(DEFAULT_RETURN_TO);
  const allowDevHosts = Boolean(options.allowDevHosts);

  if (!rawValue) {
    return { returnTo: fallback.toString(), returnHost: fallback.hostname };
  }

  try {
    const parsed = new URL(rawValue, origin);
    const hostAllowed =
      parsed.hostname === 'chefgroep.nl' || parsed.hostname.endsWith(AUTH_HOST_SUFFIX);
    const devHostAllowed =
      allowDevHosts && parsed.protocol === 'http:' && isDevHost(parsed.hostname);

    if ((parsed.protocol === 'https:' && hostAllowed) || devHostAllowed) {
      return { returnTo: parsed.toString(), returnHost: parsed.hostname };
    }
  } catch {
    // Ignore invalid user-provided URLs and fallback to trusted default.
  }

  return { returnTo: fallback.toString(), returnHost: fallback.hostname };
}

export function getReturnTarget(
  search: string,
  origin: string,
  options: ReturnTargetOptions = {},
): {
  returnTo: string;
  returnHost: string;
  switchRequested: boolean;
} {
  const params = new URLSearchParams(search);
  const raw = params.get('return_to') || params.get('redirect');
  const target = resolveReturnTo(raw, origin, options);

  return {
    ...target,
    switchRequested: params.get('switch') === '1',
  };
}

export function validateRegistration(form: RegistrationPayload): string | null {
  if (!form.name || !form.email || !form.username || !form.password) {
    return 'Vul alle verplichte velden in.';
  }

  if (!USERNAME_REGEX.test(form.username)) {
    return 'Gebruikersnaam mag alleen letters, cijfers, - en _ bevatten (3-20 tekens).';
  }

  if (form.password.length < 8) {
    return 'Wachtwoord moet minimaal 8 tekens bevatten.';
  }

  if (form.password !== form.confirmPassword) {
    return 'Wachtwoorden komen niet overeen.';
  }

  return null;
}
