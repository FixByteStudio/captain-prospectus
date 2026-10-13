---
title: "The sync strip's one button opens /login"
type: 'refactor'
created: '2026-10-13'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'none'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/docs/domains/identity-access.md'
  - '{project-root}/docs/design.md'
baseline_commit: 'f11f3f2a079debd06817b13e10c639871b0a1f4a'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The sync strip still serves an Access that was never put in front of the app (ADR-0034, GH #470, entry 4 of epic-access-removed): a `reconnect` action that navigates to `?reconnect=1`, a `navigateFallbackDenylist` entry and a marker-strip effect to carry it, and an `auth` sync status for a 403 or an Access redirect.

**Approach:** A lost session offers one button, which opens `/login`. A 403 at sync is handled as a 401 (its only source is the cross-origin check), so `auth` folds into `unauthorized`. An opaque redirect is an ordinary failed sync (`error`). Delete the marker module and everything that only it needed.

## Boundaries & Constraints

**Always:** The outbox is untouched on every path, the 401 and 403 still call `clearAgentCache` (INVARIANT 5, GH #35). `redirect: "manual"` stays in `field/sync.ts`. The button keeps its copy `copy.sync.reconnect` ("Se reconnecter") and still goes through the leave guard. The PR quotes the precache total against the 1,000 KiB ceiling.

**Never:** New login behaviour; touching `api.ts`, `App.tsx`'s identity effects or the admin top bar (entries 2 and 3, done). Editing `identity-access.md`'s opening paragraph, `deployment.md`, `CLAUDE.md` or the agent rules (entry 6, GH #472).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Worker 401 | sync answers 401 | status `unauthorized`, cache cleared, strip shows "Se reconnecter" → `/login` | Outbox rows stay |
| Cross-origin 403 | sync answers 403 | same as 401 | Outbox rows stay |
| Opaque redirect | `response.type === "opaqueredirect"` | status `error`, the failed strip, no button, cache kept | Outbox rows stay |
| Offline reconnect | `unauthorized` strip, no network | button still opens `/login` (a router route) | — |

</frozen-after-approval>

## Code Map

- `src/client/field/sync.ts` -- `SyncStatus` drops `"auth"`; the 401/403 branch always reports `unauthorized`; the opaque-redirect test and the Access comment go.
- `src/client/field/sync-view.ts` -- `SyncAction` loses `"reconnect"`; `AUTH_STRIP`/`UNAUTHORIZED_STRIP` become one; `StripEffect` loses `navigate`; drop the `reconnectUrl` import.
- `src/client/field/SyncIndicator.tsx` -- delete the `navigate` case, its `navigator.onLine` guard and the `auth` preview (l.52); the button label is `copy.sync.reconnect` unless the action is `update`.
- `src/client/field/reconnect-marker.ts` + `.test.ts` -- delete.
- `src/client/App.tsx` -- delete the marker-strip effect (l.324-335) and its import; check `navigate`/`navigateRef` still have a user.
- `vite.config.ts`, `config.test.ts` -- drop the import, the denylist entry, its comment and the "exempts the reconnect marker" test; keep the `/api/` entry.
- `src/client/theme.ts`, `theme.test.ts` -- comments that cite the marker as an example: reword.
- Tests naming `auth`: `sync.test.ts`, `sync-view.test.ts`, `sync-schedule.test.ts`, `SyncIndicator.test.tsx`; also look in `useSync.test.tsx` and `App.test.tsx`.
- `docs/design.md` (l.2117, 2124-2136), `docs/domains/identity-access.md` (Offline and session expiry: 403/Access redirect, marker paragraph, logout paragraph's marker sentence, "A refused sync clears it too").

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/sync.ts`, `sync-view.ts`, `SyncIndicator.tsx` -- fold `auth` into `unauthorized`, drop `reconnect` and `navigate` -- one action for a lost session
- [ ] `reconnect-marker.ts` + test, `App.tsx`, `vite.config.ts`, `config.test.ts`, `theme.ts`, `theme.test.ts` -- delete the marker and its consumers -- nothing is left to reach Access
- [ ] the four test files above -- rewrite to the matrix: strip offers only `login`, 401 and 403 both keep the outbox, an opaque redirect is `error` -- the story's verify
- [ ] `docs/design.md`, `docs/domains/identity-access.md` -- rewrite the session-expired row, the "Se reconnecter" bullet and the paragraphs above -- docs match code

**Acceptance Criteria:**
- Given a lost session, when the strip shows, then its only button opens `/login` and no code path builds a `?reconnect=1` URL.
- Given two queued visits and a revoked session, when sync gets 401 or 403, then both rows are still in the outbox and the cached round is dropped.
- Given a grep of `src/client`, `vite.config.ts` and `config.test.ts`, then there is no `reconnect=1` or `reconnect-marker`.

## Implementation Notes

Implemented inline (no subagent: no explicit go-ahead to spawn). About 60 lines added, 234 removed across 12 files, plus two deleted.

- `stripEffect` lost its `href` parameter: only the `navigate` effect used it.
- `App.tsx` lost `useLocation`; the marker-strip effect was its only reader. The `navigate` ref comment stays true (`useNavigate` still changes with the location).
- The opaque-redirect test fake now sets `ok: false` like a real opaque response; with `ok: true` it fell into `response.json()`.
- Left for the sweep (#473): `useSync.tsx` comments (l.41, l.120) that still name the Access cookie.
- Open question from the story answered: `SyncIndicator` had the `navigate` case and the `auth` preview; `theme.ts` held only a comment.
- Precache: 954.10 KiB of 1,000 KiB.
- Not run: the story's manual `pnpm dev` check (revoked session, two queued visits).

## Spec Change Log

## Review Triage Log

No review lens ran: spawning subagents was never explicitly authorised, so the lenses were not launched. Own read of the diff instead, two points checked:

- `false` -- a 403 at sync might come from a role gate (a real 403 for an admin) and wrongly send the agent to `/login`. `routes/agent.ts` `POST /sync` has no `requireAdmin`; the only 403 on that path is `forbidden_origin` (`origin.ts`), so folding it into `unauthorized` is right.
- `false` -- an opaque redirect might be read as success. A real one has `ok: false`, so it reaches the `!response.ok` branch and returns `error`; the test fake now sets `ok: false` to match.

## Design Notes

`copy.sync.reconnect` stays ("Se reconnecter"): the label is still true, only its destination is now single.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: build passes, precache ≤ 1,000 KiB (quote the total)
- `grep -rnE 'reconnect=1|reconnect-marker|access_redirect' src/client vite.config.ts config.test.ts` -- expected: no output

**Manual checks (if no CLI):**
- `pnpm dev` with `DEV_USER_EMAIL` unset, two visits queued offline, session revoked, back online: the strip's button reaches `/login` and both visits are still queued.
