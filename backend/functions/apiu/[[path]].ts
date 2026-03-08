import { createProxyHandler } from '../_proxy';

// Alias proxy: /apiu/* -> API_ORIGIN/api/*
// Useful when frontends are configured to use /apiu as the same-origin proxy prefix.
export const onRequest = createProxyHandler({ incomingPrefix: '/apiu', upstreamPrefix: '/api' });
