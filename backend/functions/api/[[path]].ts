import { createProxyHandler } from '../_proxy';

// Backwards compatible primary proxy: /api/* -> API_ORIGIN/api/*
export const onRequest = createProxyHandler({ incomingPrefix: '/api', upstreamPrefix: '/api' });
