---
title: 'Neither client knows an Access redirect'
type: 'refactor'
created: '2026-10-13'
status: 'done'
baseline_commit: 'a0e3ca0deea262fdc61bf4ecefc14560f741b759'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/docs/domains/identity-access.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Both clients still tell the Worker's 401 apart from an Access redirect (`ApiError` code `access_redirect`), and branch on it in the identity gate, the admin query client, the CSV export and their tests. No Access application exists, so that branch is dead (GH #469, CAP-12, CAP-14, ADR-0034).

**Approach:** Drop `access_redirect` and every branch on it. Keep `redirect: "manual"` in `apiFetch` and `downloadCsv` as a guard, so an opaque redirect becomes an ordinary failure (`ApiError` status 0, code `error`, the caller's failure message) and never reads as a lost session. Every 401 at `/api/me` takes the path a Worker 401 takes today, through the leave guard to `/login`. Update the 401 paragraphs of `identity-access.md`.

**Decision (2026-10-13, owner):** The identity-error frame loses its "Se reconnecter" button. No outcome reaches that frame with a revoked session any more, so the button was unreachable. The frame keeps only the errors with no way back, and App.test.tsx proves that a 401 at launch opens `/login`. This replaces the ticket's "the button opens /login" check.

## Boundaries & Constraints

**Always:** The outbox is never touched on any of these paths (INVARIANT 5). A 401 at launch still runs `releaseUnconfirmed`, then `clearAgentCache`, before it opens `/login`. French strings come from `copy/field`.

**Never:** Change `field/sync.ts`, `sync-view.ts`, `SyncIndicator`, the `reconnect` sync action, `reconnect-marker.ts`, App.tsx's marker-strip effect, or `navigateFallbackDenylist`. Those belong to #470. Do not touch `design.md`'s session-expired rows (also #470) or the Worker.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Opaque redirect, `apiFetch` | `response.type === "opaqueredirect"` | throws `ApiError(0, "error", copy.errors.generic)` | not 401: no `/login`, no cache drop |
| Opaque redirect, CSV export | same, in `downloadCsv` | throws `ApiError(0, "error", failed)` | the screen shows its export-failed message |
| 401 at `/api/me`, launch | Worker 401 | release unconfirmed rows, clear the cache, `/login` (replace) | outbox kept |
| 401 on a cache-started re-check | dirty form open | leave guard asks; "Quitter" goes to `/login`, "Annuler" keeps the form | outbox kept |
| `/api/me` unreachable, no cache | network error | identity-error frame, offline-first-run message | no button |

</frozen-after-approval>

## Code Map

- `src/client/api.ts` -- `authError` returns only the 401. The opaque-redirect check moves into the failure path, shared by `apiFetch` and `downloadCsv`. The header comment is rewritten. `isWorkerUnauthorized` stays and now means any 401.
- `src/client/field/identity.ts` -- remove `toLogin`. A 401 outcome means `/login` (`revoked: true`), and the 401 comment loses its Access wording.
- `src/client/App.tsx` -- the `outcome.toLogin` branch becomes `outcome.revoked`. Remove the Access-redirect branch after it (`releaseUnconfirmed` and `clearAgentCache`, then `setError`, both revoked). `error` state drops `revoked`. Remove the identity-error frame's `reconnect` callback and its `reconnectUrl` import. Update the `FieldEmptyState` comment. Keep the marker-strip effect (#470).
- `src/client/admin/query-client.ts`, `src/client/admin/queries.ts` (`downloadCsv` comment), `src/client/auth/LoginScreen.tsx` (header) -- remove the Access wording from the comments.
- Tests: `api.test.ts` (an opaque redirect becomes status 0, code `error`), `field/identity.test.ts` (no `toLogin`), `App.test.tsx`, `admin/query-client.test.ts`, `admin/queries.test.tsx`, `admin/VisitsScreen.test.tsx`, `admin/ProspectsScreen.test.tsx` (an opaque export redirect shows the export-failed message, not `sessionExpired`), and `auth/LoginScreen.test.tsx`, whose "an Access redirect" row becomes "an opaque redirect" and still leaves the form.
- In `App.test.tsx`, the three tests at :428, :597 and :662 use `identityRevoked`, which stubs `access_redirect`. Move them to the Worker 401 (`identityUnauthorized`) and keep what each one asserts about the cache and the outbox. Delete `identityRevoked`, and delete the "sends a session revoked at startup through Access" and "stays put when reconnecting with no network" tests.
- `docs/domains/identity-access.md` -- rewrite lines 77–81 and 94–96 to describe one 401. Lines 77 and 110 keep the sync strip's wording for #470. The opening paragraph belongs to #472.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/api.ts` -- one 401 signal, and an opaque redirect becomes an ordinary failure -- the guard stays, the Access meaning goes.
- [ ] `src/client/field/identity.ts`, `src/client/App.tsx` -- one 401 path to `/login`, and the identity-error frame's revoked action removed -- per the I/O matrix.
- [ ] `src/client/admin/query-client.ts`, `src/client/admin/queries.ts`, `src/client/auth/LoginScreen.tsx` -- comments only.
- [ ] The tests listed in the Code Map -- rewrite or delete them as described there.
- [ ] `docs/domains/identity-access.md` -- the 401 section.

**Acceptance Criteria:**
- Given `apiFetch` gets an opaque redirect, when it settles, then it rejects with an `ApiError` of status 0 and code `error` (`api.test.ts`).
- Given the repository, when `src/client` is searched, then it finds no `access_redirect` and no `toLogin`.
- Given an agent whose session the Worker refuses at launch, when the app opens, then it lands on `/login` with the cached round gone and every outbox row kept (`App.test.tsx`).

## Implementation Notes

- `redirectError` (api.ts) is the one shared helper for an opaque redirect; `apiFetch` and `downloadCsv` both call it after `authError`.
- `toast.dismiss()` was added to the `afterEach` of `VisitsScreen.test.tsx` and `ProspectsScreen.test.tsx`: the new export-failed toast now outlives its test and doubled the next match. Needed to verify this change.
- Verified: `pnpm typecheck && pnpm test && pnpm lint && pnpm build` pass; precache 954.85 KiB against the 1,000 KiB ceiling; `grep -rn "access_redirect\|toLogin" src/client` prints nothing.
- Left for #470: `field/sync.ts:152-162` and `useSync.tsx` still read an opaque redirect as `auth`; the marker-strip effect comment at `App.tsx:333` still names the identity-error frame; `design.md:2117` and `identity-access.md` lines 77 and 110.

## Spec Change Log

## Review Triage Log

| Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| blind, edge | `identity.test.ts` header says "Access session" | low | patch | Wording left in an edited file; reworded. |
| blind | `FieldEmptyState` `onClick` variant has no caller | low | patch | The only `onClick` caller was the removed frame; type narrowed to `{label, to}`. |
| gap | nothing pins `redirect: "manual"` in `apiFetch` / `downloadCsv` | medium | patch | Stubs ignore `init`; two `toHaveBeenCalledWith` checks added in `api.test.ts`. |
| edge, blind, intent | `identity-access.md:95` says a redirect is never a lost session, but sync still reads one so | low | patch | Carve-out "until #470" added. |
| edge | `App.tsx:333` marker-strip comment names the identity-error frame | low | defer | The effect is #470's per the frozen Never list; #470 rewrites the comment. |
| blind, edge, intent | `field/sync.ts` reads an opaque redirect as `auth`; `design.md:2117`, `identity-access.md` 77/110 | medium | defer | Excluded by the frozen Never list; scheduled as #470, no new issue. |
| edge | `isWorkerUnauthorized` widened to any 401 | false | rejected | The spec's Code Map says it "now means any 401"; `authError` is the only 401 source. |
| edge | `authError` and `redirectError` are separate calls, so a caller can forget one | false | rejected | Spec asks for one shared helper; a real opaque redirect has status 0, so order does not matter. |
| edge | `apiFetch` gives `copy.errors.generic`, not a screen message | false | rejected | That is the spec's I/O row 1. |
| blind | a redirect at launch falls to the cache instead of the frame | false | rejected | An ordinary failure by intent; same branch as a 500, already tested in `identity.test.ts`. |
| blind | `cancelled` guards dropped from the revoked path | false | rejected | They belonged to the removed non-`toLogin` branch; the surviving branch is unchanged. |
| blind | `toast.dismiss()` is out of scope | false | rejected | Needed to verify this change (see Implementation Notes). |
| blind | `api.ts` header claim "Worker never redirects `/api`" | low | rejected | Unlikely to bite and the fix is a rewording with no named harm. |
| blind | `identity.ts` comment leaves an orphan short line | low | rejected | Cosmetic. |
| blind | spec file has empty sections / unchecked boxes | low | rejected | Filled in at this step. |
| gap | `queries.test.tsx` redirect test asserts only `error` non-null | low | rejected | `api.test.ts` pins status 0, code and message; the path check pins "no `/login`". |
| intent | `App.test.tsx` stubs `apiFetch`, so the wire half is covered piecewise | low | rejected | The pre-existing test pattern; `api.test.ts` covers the wire half. |
| blind, gap | no `App` test for "a 401 never reaches the frame" | false | rejected | The first moved test asserts `pathname === "/login"`. |

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass; quote the precache total against 1,000 KiB
- `grep -rn "access_redirect\|toLogin" src/client` -- expected: no output
