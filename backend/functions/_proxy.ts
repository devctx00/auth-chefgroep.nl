interface Env {
  API_ORIGIN?: string;
  AUTH_ORIGIN?: string;
  AUTH_RETURN_TO?: string;
  PUBLIC_API_PREFIXES?: string;
}

type ProxyOptions = {
  /**
   * Incoming prefix handled by this Pages Function (e.g. "/api" or "/apiu").
   */
  incomingPrefix: string;
  /**
   * Upstream prefix expected by the API service (defaults to "/api").
   */
  upstreamPrefix?: string;
};

const DEFAULT_RETURN_TO = 'https://mc.chefgroep.nl/mission-control';
const AUTH_HOST = 'auth.chefgroep.nl';
const CANONICAL_API_PREFIX = '/api';
const MAX_AUTH_BODY_BYTES = 8 * 1024;

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

function isPathSegmentPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function stripPathPrefix(pathname: string, prefix: string): string {
  if (pathname === prefix) return '';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

function rewritePrefix(matchers: string[], incomingPrefix: string): string[] {
  if (incomingPrefix === CANONICAL_API_PREFIX) return matchers;

  return matchers.map((matcher) => {
    if (isPathSegmentPrefix(matcher, CANONICAL_API_PREFIX)) {
      return `${incomingPrefix}${matcher.slice(CANONICAL_API_PREFIX.length)}`;
    }
    return matcher;
  });
}

function buildUpstreamUrl(
  request: Request,
  apiOrigin: string,
  incomingPrefix: string,
  upstreamPrefix: string,
): URL {
  const incoming = new URL(request.url);
  const upstream = new URL(apiOrigin);

  const proxiedPath = stripPathPrefix(incoming.pathname, incomingPrefix);
  upstream.pathname = `${upstreamPrefix}${proxiedPath}`;
  upstream.search = incoming.search;
  return upstream;
}

function copyRequestHeaders(source: Headers, incomingUrl: URL, stripSensitive: boolean): Headers {
  const headers = new Headers();

  source.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalized)) return;
    if (stripSensitive && SENSITIVE_REQUEST_HEADERS.has(normalized)) return;
    headers.set(key, value);
  });

  const host = incomingUrl.host;
  const proto = incomingUrl.protocol.replace(':', '');
  headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', proto);
  const connectingIp = source.get('cf-connecting-ip');
  if (connectingIp) {
    if (!headers.has('x-forwarded-for')) {
      headers.set('x-forwarded-for', connectingIp);
    }
    if (!headers.has('x-real-ip')) {
      headers.set('x-real-ip', connectingIp);
    }
  }

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

function getPublicMatchers(env: Env, incomingPrefix: string): string[] {
  const configured = env.PUBLIC_API_PREFIXES
    ? env.PUBLIC_API_PREFIXES
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  const raw = configured.length ? configured : DEFAULT_PUBLIC_API_PREFIXES;
  return rewritePrefix(raw, incomingPrefix);
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

function isAuthRequestPath(pathname: string, passthroughPaths: string[]): boolean {
  return passthroughPaths.some((path) => matchesPathOrChild(pathname, path));
}

function isSessionResponsePath(pathname: string, sessionPaths: string[]): boolean {
  return sessionPaths.some((path) => matchesPathOrChild(pathname, path));
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
  const configuredReturnTo = configuredCandidate ? unwrapAuthNestedReturnTo(configuredCandidate) : null;
  const inferredReturnTo = getRefererReturnTo(request, incoming.host);
  const returnTo =
    configuredReturnTo && isTrustedReturnTo(configuredReturnTo)
      ? configuredReturnTo.toString()
      : inferredReturnTo || DEFAULT_RETURN_TO;
  authUrl.searchParams.set('return_to', returnTo);
  return authUrl.toString();
}

function jsonError(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

function isJsonContentType(contentType: string | null): boolean {
  return Boolean(contentType && contentType.toLowerCase().startsWith('application/json'));
}

async function getBodySizeBytes(request: Request): Promise<number> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  const payload = await request.clone().text();
  return new TextEncoder().encode(payload).byteLength;
}

export function createProxyHandler(options: ProxyOptions): PagesFunction<Env> {
  const incomingPrefix = options.incomingPrefix;
  const upstreamPrefix = options.upstreamPrefix || CANONICAL_API_PREFIX;

  return async ({ env, request }) => {
    const incomingUrl = new URL(request.url);
    const publicMatchers = getPublicMatchers(env, incomingPrefix);
    const isPublicRoute = isPublicApiPath(incomingUrl.pathname, publicMatchers);

    const passthroughPaths = rewritePrefix(AUTH_REQUEST_PASSTHROUGH_PATHS, incomingPrefix);
    const sessionPaths = rewritePrefix(AUTH_SESSION_RESPONSE_PATHS, incomingPrefix);
    const authPostPaths = rewritePrefix(['/api/auth'], incomingPrefix);
    const preserveAuthRequestHeaders = isAuthRequestPath(incomingUrl.pathname, passthroughPaths);
    const preserveSessionResponseHeaders = isSessionResponsePath(incomingUrl.pathname, sessionPaths);

    if (!isPublicRoute && !hasAuthContext(request)) {
      return new Response(null, {
        status: 307,
        headers: {
          location: buildAuthRedirect(request, env),
          'cache-control': 'no-store',
        },
      });
    }

    const isAuthPostRequest =
      request.method.toUpperCase() === 'POST' &&
      authPostPaths.some((path) => matchesPathOrChild(incomingUrl.pathname, path));
    if (isAuthPostRequest) {
      if (!isJsonContentType(request.headers.get('content-type'))) {
        return jsonError(415, 'Content-Type must be application/json.');
      }
      const bodySize = await getBodySizeBytes(request);
      if (bodySize > MAX_AUTH_BODY_BYTES) {
        return jsonError(413, 'Request body too large.');
      }
    }

    const apiOrigin = env.API_ORIGIN || 'https://api.chefgroep.nl';
    const upstreamUrl = buildUpstreamUrl(request, apiOrigin, incomingPrefix, upstreamPrefix);
    const requestHeaders = copyRequestHeaders(
      request.headers,
      incomingUrl,
      isPublicRoute && !preserveAuthRequestHeaders,
    );

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers: requestHeaders,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
      });
    } catch {
      return jsonError(502, 'Upstream unreachable.');
    }

    const responseHeaders = copyResponseHeaders(
      upstreamResponse.headers,
      isPublicRoute && !preserveSessionResponseHeaders,
    );
    if (!responseHeaders.has('cache-control')) {
      responseHeaders.set('cache-control', 'no-store');
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  };
}
