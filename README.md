# `auth.chefgroep.nl`

Static Cloudflare Pages auth placeholder page for ChefGroep.

## Files

- `index.html`: current auth UI placeholder (static, inline CSS/JS)
- `_redirects`: Pages redirect rules
- `_headers`: security headers + CSP for current static page
- `wrangler.toml`: Pages project config

## Local sanity checks

```bash
npm run check:static
npm run check:headers
```

## Local preview (simple)

```bash
npm run serve
```

Then open `http://localhost:8788`.
