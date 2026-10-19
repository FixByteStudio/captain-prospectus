---
title: 'Security headers on the app shell and the API (GH #454)'
type: 'bugfix'
created: '2026-10-18'
status: 'done'
baseline_commit: 'a605114f34e3b94754fca2ec253bfe81d80dd94e'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'security-reviewer']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Production responses carry no `Strict-Transport-Security`, CSP / `frame-ancestors`, `X-Content-Type-Options` or `Referrer-Policy`. Since ADR-0029 `/login` takes credentials on a public host and can be framed by any site (clickjacking), and nothing pins HTTPS.

**Approach:** Static assets get their headers from a `public/_headers` file, which Workers Static Assets applies without invoking the Worker, so `run_worker_first` stays `["/api/*"]` (invariant 14). `/api/*` gets them from Hono's built-in `secureHeaders` middleware, registered first. A CSP for the shell is decided against what the client actually loads (OSM tiles, self-hosted font, one inline theme script). `docs/security.md` gains the row.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 100 lines over five files, no new dependency (`hono/secure-headers` ships with Hono).

Shell CSP, from a survey of `src/client` and `index.html`:
- `script-src 'self' 'sha256-…'`: the only inline script is the theme pin in `index.html`; a hash keeps it synchronous with no extra request. A test recomputes the hash from `index.html` so an edit to the script cannot silently break the pin.
- `style-src 'self' 'unsafe-inline'`: sonner, Radix scroll-lock and `ui/chart.tsx` inject `<style>` elements at runtime.
- `img-src 'self' data: https://tile.openstreetmap.org` (the only tile URL, `src/client/leaflet-setup.ts:28`; Leaflet CSS images inline as `data:`).
- `connect-src 'self'`, `font-src 'self'`, `worker-src 'self'`, `manifest-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `Referrer-Policy: strict-origin-when-cross-origin`, not `no-referrer`: the OSM tile usage policy requires a Referer.
- `Permissions-Policy`: `geolocation=(self)` (agent position), everything else used off.
- HSTS `max-age=31536000; includeSubDomains`, no `preload` (preload is hard to reverse).

`/api/*`: `secureHeaders` with `default-src 'none'; frame-ancestors 'none'` and the same HSTS; registered before the body cap so a 413 also carries them.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: pass, including new header tests.
- `pnpm build && pnpm check:precache` -- expected: pass; `dist/client/_headers` exists; precache total unchanged.

**Manual checks:**
- Serve the build locally (`vite preview` / `wrangler dev`), load `/`, `/login` and the admin map: response carries the headers, no CSP violations in the console, tiles render, theme pin works.

Verified on `pnpm preview` of the build (local D1, dev admin): `/login` and `/api/me` carry the headers, the built `index.html` hash matches `_headers`, OSM tiles render on the admin import map, the dashboard chart renders, a pinned light theme survives a reload, and the console shows no CSP violation. The browser tool's own `evaluate` was refused by the CSP (no `'unsafe-eval'`), which confirms enforcement.

## Review Triage Log

Lenses: quick (general reviewer) and security-reviewer, both Sonnet. Counts: 0 high, 0 medium, 6 low patched or recorded, 2 rejected.

- low, patch: `Referrer-Policy` and `Permissions-Policy` in `_headers` were untested; `config.test.ts` now asserts both.
- low, patch: `docs/security.md` row said "every response" with no caveat while edge application and the `onError` 500 are untested; the row now names what each test covers and that the edge was checked on a local build only, and `docs/deployment.md` step 8 gains the `curl -sI /login` check.
- low, patch: `docs/security.md` "The body cap" still called it the first middleware; now "first after the security headers".
- low, rejected: hash test reads source `index.html`, not the build. The built output matched; guarding the build needs a build in the unit suite, a bigger change than the risk.
- low, rejected: optional `frame-src 'none'`, `upgrade-insecure-requests`, `style-src-attr` hardening. No iframes exist and `default-src 'self'` already bounds `frame-src`; HSTS covers upgrades.
- low, rejected: index.ts comment wording "first after the headers above". It reads correctly.
- pre-existing, issue #557: `ui/chart.tsx:87` uses `dangerouslySetInnerHTML` while `docs/security.md:21` says none is used.
