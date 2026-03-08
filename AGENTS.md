# auth.chefgroep.nl — AGENTS.md

Dit document beschrijft hoe we `auth.chefgroep.nl` bouwen, testen en deployen.

## Overzicht

Auth portal voor ChefGroep control-plane apps (o.a. `mc`, `admin`, `flow`, `webmail`).

- **Frontend:** React + TypeScript + Vite
- **Hosting:** Cloudflare Pages
- **Same-origin proxy:** Cloudflare Pages Functions
  - `/api/*` (default)
  - `/apiu/*` (alias)
- **Upstream:** `API_ORIGIN` (default `https://api.chefgroep.nl`)
- **Auth cookie:** `mc_session` (browser calls met `credentials: 'include'`)

---

## Structuur

```text
auth-chefgroep.nl-main/
  frontend/
    src/
      App.tsx
      main.tsx
      lib/
        authApi.ts
        authContract.ts
      hooks/
    public/
      _headers
      _redirects
  backend/
    functions/
      _shared/apiProxy.ts
      api/[[path]].ts
      apiu/[[path]].ts
    vitest.config.ts
  wrangler.toml
  package.json
  AGENTS.md
```

---

## Return-to contract (open-redirect voorkomen)

De app accepteert:
- `return_to=<url>`: waarheen na succesvolle login
- `switch=1`: force account switch (geen auto-redirect)

**Regels (zie `frontend/src/lib/authContract.ts`):**
- Alleen `https://*.chefgroep.nl` (en `https://chefgroep.nl`) is toegestaan.
- Optionele dev uitzondering voor localhost alleen met `VITE_ALLOW_DEV_RETURN_TO=true`.
- Fallback target: `https://mc.chefgroep.nl/mission-control`.

**Guardrail:** verzwak deze validatie nooit; dit is een security boundary.

---

## API prefix (`/api` vs `/apiu`)

Frontend roept altijd same-origin aan via `authApi.ts`.

- Default prefix: `/api`
- Alternatief: `/apiu` door build env var:
  - `VITE_API_PREFIX=/apiu`

Backend heeft beide proxies beschikbaar (zelfde gedrag).

---

## Commands (package.json)

```bash
npm run dev
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run verify
npm run verify:full
npm run deploy
```

**Wat is wat:**
- `verify` = lint + unit/integration + build
- `verify:full` = `verify` + Playwright e2e
- `deploy` = `verify:full` + `wrangler pages deploy`

---

## Proxy gedrag (Pages Functions)

De proxy:
- proxyt naar `API_ORIGIN` + upstream prefix (default `/api`)
- heeft open route allowlist (`PUBLIC_API_PREFIXES`) voor routes die geen redirect mogen krijgen
- kan routes “anonymous” forceren (`ANON_API_PREFIXES`) om cookies/authorization te strippen

**Auth endpoints** zoals `/api/auth` mogen **Set-Cookie** behouden → zet die endpoints niet in `ANON_API_PREFIXES`.

---

## Deploy

Cloudflare Pages project: `auth-chefgroep`

```bash
npm run deploy
```

Checklist:
- [ ] `npm run verify:full` groen
- [ ] return_to contract tests groen
- [ ] proxy integration tests groen

---

## Troubleshooting

**Ik krijg 307 redirects in de browser**
- Endpoint staat niet in `PUBLIC_API_PREFIXES` of request mist auth context.

**Login werkt maar redirect niet**
- `return_to` wordt geweigerd door de allowlist (verwacht!) → check domein/https.

**Cookies lijken te verdwijnen**
- Controleer of endpoint per ongeluk in `ANON_API_PREFIXES` staat.

<!-- gitnexus:start -->
# GitNexus MCP

This project is indexed by GitNexus as **auth.chefgroep.nl** (124 symbols, 265 relationships, 11 execution flows).

## Always Start Here

1. **Read `gitnexus://repo/{name}/context`** — codebase overview + check index freshness
2. **Match your task to a skill below** and **read that skill file**
3. **Follow the skill's workflow and checklist**

> If step 1 warns the index is stale, run `npx gitnexus analyze` in the terminal first.

## Skills

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
