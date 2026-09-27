---
title: 'The Visites strip figures in the dashboard aggregate (GH #177)'
type: 'feature'
created: '2026-09-27'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '7de4e4f0f11d36e81c2ac2be5feff9d8833b9e69'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Visites KPI strip (story 174.4) shows Taux de conversion, Flyers remis, Relances dues sous 7 jours and Agents en tournée for the 7/30/90 period. `GET /api/admin/dashboard` (G1) serves only the first; the feed is capped at 500 rows so the client cannot count the rest, and `followUpsDue` is today-or-earlier, not seven days.

**Approach:** Extend G1 additively with three fields, record them as a new server-gaps.md row the owner signs, document them in `docs/api.md › The dashboard`, and prove with `scripts/measure-dashboard-cpu.mjs` that the endpoint still stays under 10 ms of Worker CPU.

## Boundaries & Constraints

**Always:** Additive only — every existing field keeps its name, type and value. Brussels day boundaries come from `src/shared/period.ts` only. Each bound parameter count stays ≤ 100 (INVARIANT 7). Snapshots (today, next 7 days) ignore `period`; flyers follow `period` and the same rows as `visits.value`.

**Never:** No new endpoint, migration, index, sync change or client screen (174.4 owns the screen). No `clientVersion` bump. No sync timestamp for Agents en tournée (G6 settled). If the measured worst request is ≥ 10 ms, stop and report — the story splits into its own endpoint instead.

## Decisions (owner, 2026-09-27)

- **G11 approved** as proposed: Need — the Visites strip's Flyers remis, Relances dues sous 7 jours and Agents en tournée for the selected period (CAP-3). Falls short — G1 returns none; the feed caps at 500 rows; `followUpsDue` is today-or-earlier. Smallest change — three additive fields on G1 (`flyersGiven`, `agentsActiveToday`, `followUpsDueSoon {value, dueBefore}`), one extra statement, CPU measured. Kind — API (additive fields).
- **"Sous 7 jours"** = live `follow_up` with `next_visit_at <` the Brussels midnight 7 days after today's (today + 6 following days), overdue included, so `dueBefore` links to exactly those rows.
- **`_bmad-output/` is tracked from now on:** this change removes it from `.gitignore` and commits the folder (copied from the main checkout, which holds the current files); server-gaps.md stays at `_bmad-output/specs/spec-dashboard-redesign/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Flyers in period | visits in `[from, to)`, some `flyer_given` | `flyersGiven` counts those rows, merged prospects' included, quarantined out; previous period and earlier excluded | No error expected |
| Agents today | visits by A and B received today (one of them `visited_at` yesterday), by C received yesterday | `agentsActiveToday` = 2; same for any `period` | No error expected |
| Agent visits twice today | A has 3 visits received today | counts A once | No error expected |
| Due within 7 days | live follow_up prospects due overdue, today, day +6, day +7, null; a merged one; another status | counts overdue, today and day +6 only | No error expected |
| Link total matches | `GET /api/admin/prospects?status=follow_up&dueBefore=<followUpsDueSoon.dueBefore>` | `total` equals `followUpsDueSoon.value` | No error expected |
| Clock change inside the next 7 days | now just before a DST switch | `dueBefore` is a Brussels midnight | No error expected |

</frozen-after-approval>

## Code Map

- `src/worker/routes/admin.ts:205-332` -- the G1 handler: 10 statements in one `Promise.all`. Fold `flyersGiven` into the `visitCounts` statement (one extra `sum(case …)`); fold the 7-day count into the `due` statement (second `sum(case …)` with its own boundary); add one statement for `agentsActiveToday`: `count(distinct agent_email)` over `visits` with `received_at` in `[todayStart, to)`, served by `visits_received_idx`.
- `src/shared/period.ts` -- add one exported pure helper giving the Brussels midnight N days after today's (reuses private `brusselsMidnight`/`wallClock`); `today` start and the 7-day boundary both come from it. Do not compute `now + n × DAY_MS` (wrong across a clock change).
- `src/shared/schemas.ts:584-679` -- `dashboardResponseSchema`: add `flyersGiven: countSchema`, `agentsActiveToday: countSchema`, `followUpsDueSoon: z.object({ value: countSchema, dueBefore: epochMsSchema })`, each with a one-line doc comment pointing at docs/api.md.
- `src/worker/dashboard.test.ts` -- existing helpers `dashboard(query)`, seeding and the GH #114 "filtered totals match" block (line 851) to extend for `followUpsDueSoon`.
- `src/shared/period.test.ts` (if present) -- unit tests for the new helper, clock-change case included.
- `docs/api.md:24` (endpoint table row) and `docs/api.md:138+` (The dashboard) -- add the three definitions.
- `scripts/measure-dashboard-cpu.mjs` -- run unchanged before and after; needs `pnpm db:migrate:local`, `pnpm dev` + `pnpm db:seed:local` in this worktree.
- `_bmad-output/specs/spec-dashboard-redesign/server-gaps.md` -- gitignored; the current copy is in the main checkout (`../captain-prospectus/_bmad-output/…`). Copy the whole folder into this worktree, add the G11 row, and commit it with `_bmad-output` dropped from `.gitignore`.

## Tasks & Acceptance

**Execution:**
- [ ] measure baseline -- run the CPU script on the unchanged branch and record the table -- a before/after pair for the PR
- [ ] `src/shared/period.ts` (+ its test) -- add the midnight-N-days-ahead helper -- one home for the day boundary
- [ ] `src/shared/schemas.ts` -- add the three fields -- the wire contract
- [ ] `src/worker/routes/admin.ts` -- compute them as mapped above -- one new statement only
- [ ] `src/worker/dashboard.test.ts` -- cover every I/O matrix row -- AC of #177
- [ ] `docs/api.md` -- table row + three definitions -- docs in the same change
- [ ] `_bmad-output/specs/spec-dashboard-redesign/server-gaps.md` -- add the approved G11 row; drop `_bmad-output` from `.gitignore` and commit the folder -- owner sign-off (hitl)
- [ ] measure after -- worst request < 10 ms, quote both tables in the PR

**Acceptance Criteria:**
- Given the seeded local D1, when `node scripts/measure-dashboard-cpu.mjs` runs after the change, then it exits 0 and the worst request is quoted in the PR beside the baseline.
- Given an existing dashboard client, when it reads the new response, then every pre-existing field is unchanged and all current dashboard tests pass untouched.

## Implementation Notes

- Environment (orchestrator): `.dev.vars` copied from `.dev.vars.example`; local D1 migrated and seeded (303 prospects, 1,981 visits); a dev server runs on port 5177 (not 5173 — other worktrees). The CPU script needs no server, only the seeded D1; do not re-seed.
- Baseline on `7de4e4f` (unchanged code), `node scripts/measure-dashboard-cpu.mjs`: worst request is always the cold first one. Eight cold samples: 9.85, 8.27, 7.98, 8.07, 8.16, 8.01, 7.90, 7.77 ms (median 8.04). Warm: median 0.44–0.52 ms, p95 0.73–1.31 ms, max 1.10–2.53 ms. Compare the after-run the same way (≥ 8 cold samples), since one sample is noisy.
- Implemented by the api-engineer subagent; files: `src/shared/period.ts` (+test, `brusselsMidnightDaysFromNow`), `src/shared/schemas.ts`, `src/worker/routes/admin.ts`, `src/worker/dashboard.test.ts`, two client test fixtures (new required fields), `docs/api.md`, `docs/free-tier-budget.md`, server-gaps.md (G11), `.gitignore` (drops `_bmad-output`), `.prettierignore` (adds it: planning prose is not reformatted).
- Orchestrator fixes after reading the diff: one `Date.now()` read per request so all boundaries agree; tests seed day boundaries with `brusselsMidnightDaysFromNow` instead of `± n × DAY_MS` (flaky across a clock change); the flyers test now seeds a quarantined flyer visit it claimed to exclude.
- CPU: the subagent saw 2 of 17 cold samples ≥ 10 ms and flagged the gate. An A/B run (baseline build extracted with `git archive`, same D1, alternating, 14 cold samples each) gave median 8.15 ms before vs 8.14 ms after, max 9.54 vs 8.62; the baseline alone also reaches 9.85. So no measurable regression; the excursions are machine noise both builds share. Full after-run: worst 8.11 ms (cold), warm median 0.48–0.61 ms. Gate passed; headroom under 2 ms noted in free-tier-budget.md.

## Spec Change Log

## Review Triage Log

Pass 1 (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Counts: high 0, medium 0, low 8, false 5, maybe-false 0. Routes: 5 patch entries, 0 defer, 0 loopback.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, intent | `_bmad-output` un-ignored and ~200 planning files tracked, unrelated to #177 | false | Owner decision in this session ("the whole folder gonna be tracked from now on"); recorded in Decisions; called out in the PR. |
| 2 | blind, intent | server-gaps G6 row and "No server change" bullet still say the feed carries Agents en tournée | low | patch: point both at G11 `agentsActiveToday`. |
| 3 | blind, intent | G11 says "for the selected period" but two figures are snapshots; overdue inclusion not stated in the row | low | patch: clarify in the Smallest-change cell; Need cell left as approved. |
| 4 | blind | free-tier-budget.md:76 still says "Ten statements" | low | patch: verified at line 76. |
| 5 | blind | worker DST tests for `dueBefore` never cross a clock change | false | At 2026-03-29T21:30Z today's midnight is 2026-03-28T23:00Z (CET), before the switch; naive +7×DAY_MS lands at 01:00 CEST, not midnight, so the test catches it; same for autumn. |
| 6 | blind, edge, vgap | spring `not.toBe` in period.test.ts is vacuous; no test checks 7 not 6/8 days | low | patch: assert the calendar date. |
| 7 | blind | list-total test seeds one row, not the edge set | low | patch: seed the bounds test's edge set. |
| 8 | blind | no test for an orphaned-only agent in `agentsActiveToday` | low | rejected: the statement reads `visits` only; quarantined rows live in `visits_orphaned` by construction; unlikely, adds only test surface. |
| 9 | blind | upper bound `to` vs `brusselsMidnightDaysFromNow(now, 1)` | false | Same instant from the same `now` (both `brusselsMidnight(y,m,d+1)`); both live in period.ts. |
| 10 | blind | `seedDue` / `wall` helper copies in tests | low | rejected: test-only duplication, no caller diverges; not worth reshaping existing GH #113 block here. |
| 11 | blind | api.md prospects row does not name the `followUpsDueSoon.dueBefore` link | low | patch (doc correction). |
| 12 | edge | tests read `Date.now()` then the route reads it again; flake across Brussels midnight | false | Pre-existing pattern across the whole file (every block does this); the window is milliseconds at midnight; not caused by this change. |
| 13 | edge | AC "dashboard tests pass untouched" vs client fixtures edited | false | Fixtures gained the three required fields; no assertion changed. Fix would be editing the spec (rejected by rule); stated in the PR. |
| 14 | intent | EXPERIENCE.md "within the next 7 days" vs owner decision 2a (overdue included); SPEC.md CAP-3 still says "from the visits feed" | false | Owner decision 2a is recorded; the UX spine is owned by the UX run and the epic leaves folding G11 back into SPEC.md open (epic-174 context, "Open"); both named in the PR. |

## Design Notes

Folding two figures into existing statements keeps G1 at 11 statements; per-statement overhead (drizzle, row mapping) dominates Worker CPU, not the extra `sum`. `followUpsDueSoon` carries its `dueBefore` so 174.4's card links to `/admin/prospects?status=follow_up&dueBefore=…` without the client recomputing a Brussels boundary — the same way `followUpsDue` links with `to`.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green
- `node scripts/measure-dashboard-cpu.mjs` -- expected: exit 0, worst < 10 ms
- `EXPLAIN=1 node scripts/measure-dashboard-cpu.mjs` -- expected: the new statement uses `visits_received_idx`, every statement ≤ 100 params
