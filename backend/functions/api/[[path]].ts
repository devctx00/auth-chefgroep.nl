interface Env {
  API_ORIGIN?: string;
}

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

function buildUpstreamUrl(request: Request, apiOrigin: string): URL {
  const incoming = new URL(request.url);
  const upstream = new URL(apiOrigin);
  const proxiedPath = incoming.pathname.replace(/^\/api/, '');
  upstream.pathname = `/api${proxiedPath}`;
  upstream.search = incoming.search;

  return upstream;
}

function copyRequestHeaders(source: Headers, host: string): Headers {
  const headers = new Headers();

  source.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return;
    }

    headers.set(key, value);
  });

  headers.set('x-forwarded-host', host);

  return headers;
}

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();

  source.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return;
    }

    headers.set(key, value);
  });

  return headers;
}

export const onRequest: PagesFunction<Env> = async ({ env, request }) => {
  const apiOrigin = env.API_ORIGIN || 'https://api.chefgroep.nl';
  const upstreamUrl = buildUpstreamUrl(request, apiOrigin);
  const requestHeaders = copyRequestHeaders(request.headers, new URL(request.url).host);

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: requestHeaders,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const responseHeaders = copyResponseHeaders(upstreamResponse.headers);

  if (!responseHeaders.has('cache-control')) {
    responseHeaders.set('cache-control', 'no-store');
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
};
