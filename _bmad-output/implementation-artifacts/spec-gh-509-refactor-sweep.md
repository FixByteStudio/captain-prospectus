---
title: 'Refactor sweep (numbered-tournée epic, story 1.13, #509)'
type: 'refactor'
created: '2026-10-16'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'duplication-map']
review_loop_iteration: 0
baseline_commit: '7bb9ce617ac1f5bb79d99b549d807484767a8ba5'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #496 left eleven deferred review findings in `deferred-work.md` (stories 1.1–1.11) and some R16 docs that may not match what shipped. The epic's done-when needs every deferred finding fixed or filed, the R16 docs true, and lint, typecheck, test, build and `check:precache` green (#509).

**Approach:** Cleanup only, no product behaviour change. Close what a sweep can close: re-measure the sync's Worker CPU with a tournée in the pull and in the request (`scripts/measure-sync-cpu.mjs`) and record it in `docs/free-tier-budget.md`; pin the counter line on a finished day in a test; correct the R16 docs that drifted from the code. Mark the findings later stories already settled, and file one `found-in-passing` issue for each of the rest: the swipe's ageing reading (deferred twice, so it becomes a story), a repaired orphan's `received_at` and the live feed, and the precache headroom. No source behaviour, schema, contract or `CLIENT_VERSION` change.

</frozen-after-approval>

## Implementation Notes

Oneshot: a measurement script mode, one test assertion and doc corrections, about 100 lines. Baseline is the merge-base with `origin/main`, which equals HEAD (`7bb9ce6`), stamped at branch time.

Triage of the eleven deferred findings (deferred-work.md, epic #496 entries):

| # | Source | Finding | Resolution |
|---|---|---|---|
| 1 | 1.2 (#498) | Sync CPU with a tournée unmeasured | Measured here: warm ≤ 8.0 ms in every mode; cold past 10 ms as before (#404) |
| 2 | 1.2 (#498) | Does `left` follow `merged_into`? | Settled: `isStopLeft` (`src/shared/tournee.ts:27`) marks a merged unvisited stop `left`, as field-operations.md:17 and :195 say. No change |
| 3 | 1.1 (#497) | Carnet « Rouvrir » on a reassigned prospect | Settled by 1.8 (#504): the row stays a link, the visit is quarantined `not_assigned` and the admin repairs it (ADR-0022). No change |
| 4 | 1.3 (#499) | Visit form open across midnight unmounts | Fixed by 1.9 (#505) |
| 5 | 1.3, 1.4 | Swipe numbers from an ageing reading | Deferred twice with the same reason: filed as its own story, #527 (CLAUDE.md, retro #59) |
| 6 | 1.4 (#500) | Precache 1.38 KiB left | Superseded by row 10 |
| 7 | 1.5 (#501) | No test pins the finished-day counter | Fixed here (`TodayScreen.test.tsx` all-done case) |
| 8 | 1.5 (#501) | Counter too low after a cache wipe | Fixed by 1.7 (#503): `sentVisits` is gone, `n` reads server visits plus outbox |
| 9 | 1.11 (#507) | Repaired orphan keeps `received_at`, live feed misses it | Behaviour change: filed as #528 |
| 10 | 1.11 (#507) | Precache ~10 bytes left | Filed as #529. Premise corrected: the admin schemas are already tree-shaken out (no admin-only key in the `schemas-*.js` chunk); that chunk is zod/mini itself |

CPU (one Sonnet subagent): `scripts/measure-sync-cpu.mjs` gains `TOURNEE=pull` (today's 200-stop tournée seeded, read by every pull) and `TOURNEE=swipe` (each request also sends the tournée and its 200 stops, checked as stored, then reset outside the timing). After review, `pull` takes its tournée from one untimed real swipe, so the Worker computes the Brussels day and the script holds no copy of `src/shared/period.ts`; a third run gave the same figures, with a swipe warm max of 8.6 ms. Results at 1 and 50 visits, two runs, are in free-tier-budget.md › Watch-outs: the swipe pass is the dearest (warm median 5.6 ms, warm max 8.0 ms at 50 visits), and a cold isolate's first request is past 10 ms in every mode, `none` included, which #404 already tracks. The same file's GH #113 query-plan note now names `agentsStartedOn` for « Agents en tournée ». Local setup for the run: `pnpm db:migrate:local`, `.dev.vars` from the example, `pnpm dev` on a spare port and `SEED_URL=… pnpm db:seed:local`.

R16 docs audit (one Sonnet read-only subagent, each finding checked against the code before editing):

- EXPERIENCE.md dashboard table: « Visites », « Activité par agent » and « Flyers remis » now say door-days; the two *Pending ADR-0036* notes are gone (story 1.10 shipped them).
- `round-placement.md`: the banner no longer says `buildTodayList` survives for the admin round view (deleted by 1.12). Only the five reconcile/lock-in lines ADR-0036 closed are struck through; the older retro items (prospecting.md, data-model, glossary, CAP-6) were not verified here and stay as they were.
- `useAgentPosition.ts` header (the R16 line) and its `maximumAge` comment: positions no longer order anything after the swipe.
- `schemas.ts` dashboard comments on `agents[].visits` and `flyersGiven`: door-days (comments only; the field build strips them).
- Epic drift outside the R16 list, fixed because the epic caused it: `docs/security.md` (the today list "orders the round by distance") and `docs/architecture.md` (the sync sequence and the Dexie row lacked tournées, stops, `tournee`, `visitedStops`).
- Left alone: the "Today list" heading and glossary term (the code still names it `TodayScreen` / `copy.today`); `docs/vision.md:10` persona framing; done backlog files. EXPERIENCE.md:32 (agent-position retention "undecided") predates the epic: filed as #530.

Epic done-when 6: CI deployed `main` at `7bb9ce6` (story 1.12, the last of entries 1–12) with "Deploy success" on 2026-10-16 07:35 UTC (`gh run list --branch main`). This sweep reaches production through the same CI once merged.

## Review Triage Log

Pass 1, two lenses on Sonnet (the owner's choice for this run): quick, duplication-map. Counts: high 0 · medium 2 · low 4 · false 4 · maybe-false 0. Routes: patch 4 · rejected 6.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| free-tier-budget.md:8 headline still says ~5 ms warm for a 50-visit batch | medium | patch | Adds ~6 ms with a tournée in the pull and ~9 ms on the swipe pass |
| Script hand-ports `brusselsMidnight` from `period.ts` (one home of the day boundary), same name with another signature, and breaks if a run crosses midnight | medium | patch | Port removed; `pull` seeds through a real swipe; tournée checks use the agent only |
| Query-plan note claims a plan without `EXPLAIN=1` and splices the old sentence | low | patch | Keeps the old plan, names `agentsStartedOn`, says it was read from the code |
| CI deploy done-when not evidenced | low | patch | Recorded above |
| deferred-work.md entries not marked | false | rejected | The file is append-only by the workflow; the triage lives in this spec and the PR |
| epic-496-context.md rewritten | false | rejected | step 1 regenerates it when planning artifacts are newer (story 1.12 edited EXPERIENCE.md) |
| `clearTournees` runs with `TOURNEE` unset | false | rejected | It runs on the script's temporary copy of D1 (`copyLocalD1`), and the seeds create no tournée |
| `none` rows not the old setup | false | rejected | Same rows as before (no seeded tournée); the warm medians reproduce the existing table |
| ADR-0028:17 still says the today list orders the round | low | rejected | An ADR is a dated record; ADR-0036 amends it |
| Swipe check brittle across midnight | low | patch | Folded into the port removal: the check counts the agent's tournées, not a computed day |

## Verification

**Commands:**
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` -- green
- `pnpm check:precache` -- at or under 1,000 KiB, unchanged from baseline (999.99 KiB)
- `TOURNEE=1 node scripts/measure-sync-cpu.mjs` (after `pnpm db:migrate:local` and `pnpm db:seed:local`) -- prints the table recorded in free-tier-budget.md
