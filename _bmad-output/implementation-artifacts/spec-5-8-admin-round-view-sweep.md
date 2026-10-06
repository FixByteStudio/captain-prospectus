---
title: 'Refactor sweep: admin round view (GH #271)'
type: 'refactor'
created: '2026-10-06'
status: 'done'
baseline_commit: 'e9c290239180af7b9b4c122105064a0873e0697e' # merge-base of refactor/271-admin-round-view-sweep and origin/main (epic #59 retro F2)
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'duplication-map']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-dashboard-redesign/epic-admin-round-view/story-refactor-sweep.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #263 (an admin sees any agent's round) is merged through stories 1 to 6, and its build records left a few small debts. `TodayScreen.test.tsx:4` says the test runs against the Dexie table `today.ts` reads, but `useRound.ts` is the reader (#277). `docs/glossary.md` uses "admin round view" in the Agent position row, and design.md, field-operations.md and the code (`RoundScreen`, `copy.round`) use it too, but it has no row of its own (5.5 deferral). `round-placement.md:31` still names `src/client/field/today.ts` as the home of `buildTodayList` (#278).

**Approach:** Fix each one without changing a route, a stored value, a wire shape or an assertion in any test. Change the test comment to name `useRound.ts`. Add an "Admin round view" row to the glossary, after Today list, in the table's existing columns. Leave `round-placement.md` as written: finished specs are build records (the #251 sweep set the precedent), so #278 is closed as not taken. Mark both `deferred-work.md` entries from epic 5: the glossary one gets `closed_by`, and the CLAUDE.md invariant 2 one is not taken because the owner decided on 2026-10-06 to leave CLAUDE.md alone. The PR lists every deferred or rejected finding of stories 1 to 6 as taken, already closed or not taken, with its reason. Story 5.7 (#270) is open and checked by hand, so the owner waived it as a gate for this sweep, and its screenshots are not part of this change. Not taken: any behaviour change, any code refactor. A read of the epic's production diff (`d25cd14..ec20cdc`) found no duplication worth one.

</frozen-after-approval>

## Implementation Notes

Oneshot: under 10 lines across three files. Every item comes from the six stories' Review Triage Logs, the `deferred-work.md` tail, or the found-in-passing issues filed during the epic (#277, #278). No design choice is left open.

- `TodayScreen.test.tsx:4`: the comment names `useRound.ts` (it reads `fieldDb.prospects` with `useLiveQuery`). Closes #277.
- `docs/glossary.md`: an Admin round view row after Today list, with the same French label as the screen title (`copy.round.title`, "Tournée du jour"). It links the design.md section and says "tracking screen" is the wrong name, in line with ADR-0028.
- `deferred-work.md`: `closed_by` on the 5.1 entry (not taken, owner's decision) and the 5.5 entry (glossary row).
- #278: not taken. `round-placement.md` is a finished spec and stays as written, as #251 did with old specs. 5.4's review already rejected the same line on that reasoning.
- Verification: `pnpm lint`, `typecheck`, `test` (88 files, 2,185 tests, no assertion edited), `build` and `check:precache` all pass. The precache is 25 entries, 933.67 KiB, against the 1,000 KiB ceiling. It is unchanged, because no shipped code changed.
- Review ran inline in this session, not in subagents (the session does not spawn agents unasked). The diff is 5 lines, and both lenses were applied by reading the touched files in full.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: quick, duplication-map, inline). Counts: high 0 · medium 0 · low 1 (1 patched) · false 1.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | quick | The glossary row said the view is ordered from the stored position, but with none the round is sorted by name (`round-list.ts` `roundStops`) | low | patch: the row adds "or by name when there is none" |
| 2 | dup | "Tournée du jour" is now the French label of two glossary rows | false | accepted: design.md and `copy.round.title` give the admin screen the same title as the agent's round; the English terms tell them apart |

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:precache` -- expected: all green, no test edited except the comment, and the same precache total as on `main`.
