---
title: "Refactor sweep (own-login epic)"
type: 'refactor'
created: '2026-10-09'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
baseline_commit: 'a382d75c4c30a9d9505cee9827e3ca3dc58eaa28'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The own-login epic (GH #298–#313) left two stale comments, one unverified dialog worry, some duplicated helpers, and `deferred-work.md` entries that are settled but not marked (GH #314).

**Approach:** Cleanup only, no behaviour change, no test expectation changes. Fix the `useAgents` and `scheduled` comments, check the Agents row-menu dialog on a running page, merge each duplicate that merges without changing behaviour (anything larger goes to `deferred-work.md`), and append `closed_by` lines to the settled entries. Not here: per-account login limit, seed scripts' Origin check, migration-backfill harness, cold-start CPU (GH #341), the `sessions.id` contract step.

</frozen-after-approval>

## Implementation Notes

- Oneshot: small mechanical edits across Worker auth modules, the Agents page and two comments. Worktree `../captain-prospectus-314`, cut from `origin/main` a382d75 (entries 20 and 21, #355 and #356, are merged).
- Row-menu dialog: checked on `pnpm dev` in headless Chromium (CDP). Désactiver then Annuler: `body` is `pointer-events: none` while the dialog is open and `auto` after it closes, and the row's menu button opens the menu again on a click. The page is not frozen, so no prop changed.
- Duplication map (Worker session/login/throttle/Origin/auth-sweep modules, identity routes, `/login`, Agents page). Merged, no behaviour change:
  - `session.ts`: bytes-to-hex in `hmacHex` and `newSessionId` -> `toHex`; `clearedSessionCookie` is `sessionCookie("", 0)`.
  - `auth.ts`: `identityFromDevUser` repeated `activeRosterMember`'s query -> calls it.
  - `routes/auth.ts`: token + HMAC pair built three times -> `newToken`.
  - `routes/identity.ts`: the "does this user exist" read after a refused write, twice -> `userExists`.
  - `agents/`: clipboard-then-toast in `CodeDialog` and `PassphraseDialog` -> `copy-to-clipboard.ts`; the `last_admin` failure toast in `AgentsScreen` and `DeactivateDialog` -> `failure-toast.ts`.
- Left alone, accepted: the `internal` 500 body in `index.ts` `onError` and `routes/identity.ts` (the route cannot import `index.ts`, and a shared home is a new module for one line); the three guarded `INSERT ... SELECT` session writes in `routes/auth.ts` (each carries a different guard, merging would change the SQL); `login-throttle.ts` and `auth-sweep.ts` share no code (different tables, different rules); `origin.ts` and `LoginScreen.tsx` have no repeated block.
- `deferred-work.md`: `closed_by` added to four entries (#299 fallback, #303 `useAgents` comment, #303 Prospects filter, #304 row-menu dialog).
- Verification: lint, typecheck, test (2554) and build green; precache 24 entries, 941.95 KiB of 1,000. One full test run had one failing test that was not captured; three reruns passed.

## Spec Change Log

## Review Triage Log

Quick review done inline, no subagent lens. Each merge was read against its callers: `clearedSessionCookie()` yields the same string as before (`Max-Age=0`, empty token); `identityFromDevUser` trims then `activeRosterMember` lowercases, the old code did both; `newToken` keeps the hash-after-token order. No findings.
