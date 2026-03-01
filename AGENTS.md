# auth.chefgroep.nl — Agent Guidelines

## Site Overview

Auth portal for ChefGroep control-plane apps (`mc`, `admin`, `flow`, `webmail`).
Frontend and backend proxy are split in one repo and deployed together on Cloudflare Pages.

| Property | Value |
|---|---|
| Stack | React 19 + TypeScript + Vite + Framer Motion |
| Deploy | Cloudflare Pages (`auth-chefgroep`) |
| Backend | Cloudflare Pages Functions proxy (`backend/functions/api/[[path]].ts`) |
| API upstream | `https://api.chefgroep.nl` via `API_ORIGIN` |
| Auth cookie | `mc_session` (same-origin `/api/*` calls with `credentials: 'include'`) |

---

## Project Structure

```text
frontend/
├── src/
│   ├── main.tsx                  # React entry
│   ├── App.tsx                   # Auth UI + active-session handling + return_to redirect
│   ├── index.css                 # Full UI styling
│   ├── hooks/useDensity.ts       # Adaptive density helper
│   └── lib/
│       ├── authApi.ts            # Same-origin auth calls (/api/auth|register|me|logout)
│       ├── authContract.ts       # return_to validation + redirect helper + form validation
│       └── authContract.test.ts  # Contract tests
backend/
└── functions/
    └── api/[[path]].ts           # Proxy to API_ORIGIN with auth/public path rules
```

---

## Routing and Redirect Rules

- App route: `/`
- Query support:
  - `return_to=<https URL>`: target app redirect after auth/session check
  - `switch=1`: force account-switch flow, disable auto redirect
- Active session behavior:
  - `me()` success shows current user and auto-redirects to `return_to` (or default target)
  - `Wissel account` logs out and keeps user on auth app

`return_to` is strictly validated in `authContract.ts`:
- allow only `https://*.chefgroep.nl` (and `https://chefgroep.nl`)
- optional dev exception for localhost only with `VITE_ALLOW_DEV_RETURN_TO=true`
- fallback target: `https://mc.chefgroep.nl/mission-control`

---

## API Endpoints (Same Origin)

All browser requests must go to same-origin `/api/*`:

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth` | POST | Login |
| `/api/register` | POST | Register user |
| `/api/me` | GET | Session probe |
| `/api/logout` | POST | Logout |
| `/api/public/*` | GET | Public passthrough routes |

Private routes without auth context are redirected with `307` to auth origin with `return_to`.

---

## Commands

```bash
npm run dev
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run verify         # lint + unit/integration tests + build
npm run verify:full    # verify + e2e
npm run deploy:pages   # deploy frontend + functions bundle
npm run deploy         # verify:full + deploy:pages
```

---

## Guardrails

- Never bypass same-origin auth contract from frontend; do not call `api.chefgroep.nl` directly.
- Keep `return_to` validation strict; no open-redirect regressions.
- Preserve `credentials: 'include'` for auth/session endpoints.
- Keep proxy header filtering behavior intact (strip sensitive headers on public routes, preserve session headers on auth routes).
- Verify with both frontend and backend integration tests after auth/proxy changes.
