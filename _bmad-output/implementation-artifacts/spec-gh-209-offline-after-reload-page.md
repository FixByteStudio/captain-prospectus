---
title: 'Admin route offline after a reload (GH #209, story 3 of 3)'
type: 'feature'
created: '2026-10-12'
status: 'done'
baseline_commit: '5faaa909a8ecb2ceed1e82d056fde00dfbbdca57'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md'
  - '{project-root}/docs/domains/identity-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An admin who reloads an `/admin/*` route with no network lands in the precached field shell on a cached identity, and reads « Vous n'avez pas accès à cette page. » under a lock icon. That is the permission-denied state, which EXPERIENCE.md § State Patterns (Offline, after a reload) says this page must not borrow: the admin has access, the page only needs the network (GH #209, the last of its three states).

**Approach:** While the identity is cache-sourced, `/admin/*` renders its own empty state in the field band: « Hors ligne. Cette page a besoin du réseau. Votre tournée reste accessible. » with « Retour à la tournée ». A live-confirmed agent keeps the forbidden state. The string lives in `copy/field` (owner decision, 2026-09-29), and the page gives way to the admin screens as soon as the existing identity re-check confirms an admin.

</frozen-after-approval>

## Implementation Notes

Oneshot: one route branch in `src/client/App.tsx`, one string, two DOM tests and a doc line; about 60 lines.

- Scope is the last unbuilt state of GH #209. The banner shipped in #234. The session-expired dialog is dropped by the owner's decision of 2026-10-12, recorded in docs PR #444, which was still open when this was written: until it merges, EXPERIENCE.md and `deferred-work.md` on `main` still list that dialog. The « Réessayer » variant for a network drop while the admin chunk loads stays in `deferred-work.md`: a failed chunk import is not always an offline one (a stale hash after a deploy fails the same way), so it needs its own decision.
- The condition is `identityFromCache`, whatever role the cache records. EXPERIENCE.md says the cached identity opens the field shell "no matter which role it records", and invariant 10 makes a cached "agent" no more proof than a cached "admin". A cached agent therefore reads the network page first, and the forbidden state once `/api/me` answers.
- `identityFromCache` is also true when the browser is online but `/api/me` failed (a Worker 5xx, a captive portal). The page says « Hors ligne. » there too: EXPERIENCE.md specifies one sentence, and its second half, « Cette page a besoin du réseau », holds either way. The sync strip names that case itself (`copy.sync.unconfirmed`). A sentence of its own for it is deferred (`deferred-work.md`).
- The string is `copy.adminRoute.offline` in `src/client/copy/field.ts`. `offline` is taken at the top level by `copy/admin.ts`'s banner, and `copy.ts` spreads both modules into one object.
- Icon: lucide `WifiOffIcon`, the one the admin offline banner uses.
- Files: `src/client/App.tsx`, `src/client/copy/field.ts`, `src/client/App.test.tsx`, `docs/domains/identity-access.md`, `_bmad-output/implementation-artifacts/deferred-work.md`.
- Verified at `5faaa909` + this change: typecheck, lint and 2672 tests pass; `pnpm check:precache` reads 25 entries, 982.26 KiB against the 1,000 KiB ceiling (ADR-0031's figure; Workbox's own line, 952.77 KiB, leaves out the manifest and its icons).

## Review Triage Log

Quick lens, one pass: 0 high, 1 medium, 2 low, 0 false, 0 maybe-false.

- medium, patch + defer — the page says « Hors ligne. » when the browser is online and `/api/me` failed, against the `identityFromCache` comment and the strip above it. Real: `resolveIdentity` falls back to the cache for every non-401 failure. Patched what was wrong in this change: the two `App.tsx` comments and `identity-access.md` now say so, the GH #209 case runs under `mockOffline()`, and a second case pins the online one. The wording for that case is deferred: it is the owner's copy to choose.
- low, patch — the notes quoted Workbox's 952.77 KiB, not `check:precache`'s 982.26 KiB, the figure ADR-0031 says PRs quote. Corrected above.
- low, patch — the notes called PR #444 the owner's decision as if it had merged; it is open. Reworded above.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all pass, including the two `/admin` deep-link cases in `src/client/App.test.tsx`
- `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: builds; precache total stays under the 1,000 KiB ceiling
