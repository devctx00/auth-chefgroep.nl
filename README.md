# auth.chefgroep.nl

Frontend/backend split for auth portal on Cloudflare Pages with a same-origin API proxy.

## Architecture

- Frontend (React + Vite): `frontend/`
- Backend proxy (Cloudflare Pages Functions): `backend/functions/api/[[path]].ts`
- Upstream API target: `API_ORIGIN` in `wrangler.toml` (default `https://api.chefgroep.nl`)
- Frontend auth calls always use same-origin `/api/*`.

Frontend never calls the upstream API directly. All auth requests go via `/api`.

## Scripts

- `npm run dev` - local frontend dev server
- `npm run test` - unit + integration tests (frontend + backend)
- `npm run test:e2e` - Playwright e2e
- `npm run build` - typecheck + frontend production build
- `npm run verify` - lint + test + build
- `npm run deploy` - verify + e2e + Cloudflare Pages deploy (`auth-chefgroep`)

## Deploy

```bash
npm run deploy
```

Cloudflare Pages project target remains `auth-chefgroep` and deploy includes `backend/functions`.
The deploy command runs Wrangler with `--cwd backend` so `functions/` is bundled from the backend folder.
