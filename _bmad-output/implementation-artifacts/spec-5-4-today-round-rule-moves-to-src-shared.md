---
title: "Today's round rule moves to src/shared"
type: 'refactor'
created: '2026-10-06'
status: 'done'
baseline_commit: '8ee80bb51fa49baf2ec4099c1c483322af21a2b0'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-dashboard-redesign/epic-admin-round-view/story-today-s-round-rule-moves-to-src-shared.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The rule that decides which stops are on today's round, and in what order, lives in `src/client/field/today.ts`, so the admin round view (story 5.5) cannot build the same list as the agent's Tournée without a second copy. Story #267.

**Approach:** Move `buildTodayList`, its helpers and the types `TodayItem`, `TodayList`, `QueuedVisit` to `src/shared/today.ts` unchanged; move `hasWhenStep` to `src/shared/constants.ts` beside `Outcome`. Field importers (including type-only ones) import from the shared modules with no re-export left behind; `navigationUrl` and `visitPath` stay in `src/client/field/today.ts`. The `buildTodayList` tests move to `src/shared/today.test.ts` with assertions unchanged, plus one admin-shaped test (`outbox` `[]`, `queued` `[]`, a position or null, `now`). `docs/domains/field-operations.md` names the new home.

</frozen-after-approval>

## Implementation Notes

Oneshot: a mechanical move of existing code with its tests, plus one new test and a doc line; no behaviour changes.

- Moved with `git mv`: `src/client/field/today.ts` → `src/shared/today.ts`, its test → `src/shared/today.test.ts` (imports changed only). The field `today.ts` keeps `navigationUrl` and `visitPath`; the `navigationUrl` tests stay beside it in a new `src/client/field/today.test.ts`.
- `hasWhenStep` now lives in `src/shared/constants.ts`; `visit-draft.ts`, `VisitScreen.tsx` and `src/shared/today.ts` import it there. Every field importer of `TodayItem`, `TodayList`, `buildTodayList` points at `src/shared/today` (no re-export).
- New test `the admin round view's call` in `src/shared/today.test.ts`. Precache total **933.15 KiB of 1,000 KiB** (`pnpm check:precache`).

## Review Triage Log

Pass 1 (2026-10-06, quick): high 0, medium 0, low 3, false 0. One patch, two rejected.

- low, patch: `field-operations.md` and the `src/shared/today.ts` header described the admin call in the present tense before story 5.5 lands; reworded as what the sharing is for.
- low, reject: `_bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md:31` names the old path; it is a finished spec kept as history.
- low, reject: `src/client/field/TodayScreen.test.tsx:4` says `today.ts` reads a Dexie table (it never did; `useRound.ts` does). Wording only, from before this change.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:precache` -- expected: all green; quote the precache total against 1,000 KiB.
