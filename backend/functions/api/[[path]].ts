interface Env {
  API_ORIGIN?: string;
  AUTH_ORIGIN?: string;
  AUTH_RETURN_TO?: string;
  PUBLIC_API_PREFIXES?: string;
}
const DEFAULT_RETURN_TO = 'https://mc.chefgroep.nl/mission-control';
const AUTH_HOST = 'auth.chefgroep.nl';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const SENSITIVE_REQUEST_HEADERS = new Set(['cookie', 'authorization']);
const SENSITIVE_RESPONSE_HEADERS = new Set(['set-cookie']);
const DEFAULT_PUBLIC_API_PREFIXES = ['/api/public/*', '/api/auth', '/api/register', '/api/me', '/api/logout'];
const AUTH_REQUEST_PASSTHROUGH_PATHS = ['/api/auth', '/api/me', '/api/logout', '/api/register'];
const AUTH_SESSION_RESPONSE_PATHS = ['/api/auth', '/api/logout', '/api/register'];

function buildUpstreamUrl(request: Request, apiOrigin: string): URL {
  const incoming = new URL(request.url);
  const upstream = new URL(apiOrigin);
  const proxiedPath = incoming.pathname.replace(/^\/api/, '');
  upstream.pathname = `/api${proxiedPath}`;
  upstream.search = incoming.search;
  return upstream;
}

function copyRequestHeaders(source: Headers, host: string, stripSensitive: boolean): Headers {
  const headers = new Headers();

  source.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalized)) return;
    if (stripSensitive && SENSITIVE_REQUEST_HEADERS.has(normalized)) return;
    headers.set(key, value);
  });

  headers.set('x-forwarded-host', host);
  return headers;
}

function copyResponseHeaders(source: Headers, stripSensitive: boolean): Headers {
  const headers = new Headers();

  source.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalized)) return;
    if (stripSensitive && SENSITIVE_RESPONSE_HEADERS.has(normalized)) return;
    headers.set(key, value);
  });

  return headers;
}

function getPublicMatchers(env: Env): string[] {
  const configured = env.PUBLIC_API_PREFIXES
    ? env.PUBLIC_API_PREFIXES.split(',').map((x) => x.trim()).filter(Boolean)
    : [];
  return configured.length ? configured : DEFAULT_PUBLIC_API_PREFIXES;
}

function matchesPublicPath(pathname: string, matcher: string): boolean {
  if (matcher.endsWith('*')) {
    const base = matcher.slice(0, -1);
    return pathname === base.slice(0, -1) || pathname.startsWith(base);
  }
  return pathname === matcher;
}

function isPublicApiPath(pathname: string, matchers: string[]): boolean {
  return matchers.some((matcher) => matchesPublicPath(pathname, matcher));
}

function matchesPathOrChild(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function isAuthRequestPath(pathname: string): boolean {
  return AUTH_REQUEST_PASSTHROUGH_PATHS.some((path) => matchesPathOrChild(pathname, path));
}

function isSessionResponsePath(pathname: string): boolean {
  return AUTH_SESSION_RESPONSE_PATHS.some((path) => matchesPathOrChild(pathname, path));
}

function hasAuthContext(request: Request): boolean {
  return Boolean(request.headers.get('cookie') || request.headers.get('authorization'));
}

function isTrustedReturnTo(candidate: URL): boolean {
  const host = candidate.hostname;
  const trustedHost = host === 'chefgroep.nl' || host.endsWith('.chefgroep.nl');
  return candidate.protocol === 'https:' && trustedHost && host !== AUTH_HOST;
}

function parseReturnCandidate(rawValue: string | null): URL | null {
  if (!rawValue) return null;
  try {
    return new URL(rawValue);
  } catch {
    return null;
  }
}

function unwrapAuthNestedReturnTo(candidate: URL, depth = 0): URL {
  if (candidate.hostname !== AUTH_HOST || depth > 2) return candidate;
  const nested = candidate.searchParams.get('return_to') || candidate.searchParams.get('redirect');
  const nestedUrl = parseReturnCandidate(nested);
  if (!nestedUrl) return candidate;
  return unwrapAuthNestedReturnTo(nestedUrl, depth + 1);
}

function getRefererReturnTo(request: Request, expectedHost: string): string | null {
  const referer = request.headers.get('referer');
  if (!referer) return null;
  try {
    const parsed = new URL(referer);
    if (parsed.host !== expectedHost) return null;

    const nested = parseReturnCandidate(parsed.searchParams.get('return_to') || parsed.searchParams.get('redirect'));
    if (!nested) return null;
    const unwrapped = unwrapAuthNestedReturnTo(nested);
    if (!isTrustedReturnTo(unwrapped)) return null;
    return unwrapped.toString();
  } catch {
    return null;
  }
}

function buildAuthRedirect(request: Request, env: Env): string {
  const incoming = new URL(request.url);
  const authUrl = new URL(env.AUTH_ORIGIN || 'https://auth.chefgroep.nl');
  const configuredCandidate = parseReturnCandidate(env.AUTH_RETURN_TO?.trim() || null);
  const configuredReturnTo = configuredCandidate
    ? unwrapAuthNestedReturnTo(configuredCandidate)
    : null;
  const inferredReturnTo = getRefererReturnTo(request, incoming.host);
  const returnTo = configuredReturnTo && isTrustedReturnTo(configuredReturnTo)
    ? configuredReturnTo.toString()
    : inferredReturnTo || DEFAULT_RETURN_TO;
  authUrl.searchParams.set('return_to', returnTo);
  return authUrl.toString();
}

export const onRequest: PagesFunction<Env> = async ({ env, request }) => {
  const incomingUrl = new URL(request.url);
  const isPublicRoute = isPublicApiPath(incomingUrl.pathname, getPublicMatchers(env));
  const preserveAuthRequestHeaders = isAuthRequestPath(incomingUrl.pathname);
  const preserveSessionResponseHeaders = isSessionResponsePath(incomingUrl.pathname);

  if (!isPublicRoute && !hasAuthContext(request)) {
    return new Response(null, {
      status: 307,
      headers: {
        location: buildAuthRedirect(request, env),
        'cache-control': 'no-store',
      },
    });
  }

  const apiOrigin = env.API_ORIGIN || 'https://api.chefgroep.nl';
  const upstreamUrl = buildUpstreamUrl(request, apiOrigin);
  const requestHeaders = copyRequestHeaders(request.headers, incomingUrl.host, isPublicRoute && !preserveAuthRequestHeaders);

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: requestHeaders,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const responseHeaders = copyResponseHeaders(upstreamResponse.headers, isPublicRoute && !preserveSessionResponseHeaders);
  if (!responseHeaders.has('cache-control')) {
    responseHeaders.set('cache-control', 'no-store');
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
};
