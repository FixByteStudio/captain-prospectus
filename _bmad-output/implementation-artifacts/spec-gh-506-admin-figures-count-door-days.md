---
title: 'Admin figures count door-days (story 1.10, #506)'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'acbae51db6bcd04bb68b0721a328684f6f2f6cf0'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tableau de bord and the recap card count raw visit rows. An agent who calls back on one door the same day counts twice, and a correction (Personne sur place at 10:00, Converti at 16:00) shows both outcomes. ADR-0036 › Admin and stats count door-days asks for one unit everywhere.

**Approach:** Widen entry 2's door-day rule into one SQL fragment in `src/worker/door-days.ts`: door-days of every agent over a range of Brussels days, one row each, with the latest visit's outcome and refusal reason, a flyer if any visit gave one, and the visit count. Visites, the visits-by-day chart, Activité par agent (visits and converted), Flyers remis, Convertis, the KPI series and the recap card's visit count read through it. The response shapes do not change, and `docs/api.md` › The dashboard and › The recap card follow.

## Boundaries & Constraints

**Always:** One latest-visit ordering (`visited_at desc, received_at desc, id desc`), shared by `doorDaysOn` and the new fragment. A door-day is (agent, the visit's own `prospect_id`, Brussels day of the clamped `visited_at`). The figures that already key prospects by `coalesce(merged_into, id)` keep that key on top of door-days. A conversion event from a visit is a door-day whose latest outcome is `converted`. Manual conversions are unchanged. Day keys come from `periodOffsets`, which assumes at most one DST change per period, so a statement that spans both periods builds a key per period. Every statement stays at ≤100 bound parameters (invariant 7). Re-run `scripts/measure-dashboard-cpu.mjs` and record the result in `docs/free-tier-budget.md` (invariant 13).

**Decisions (owner, 2026-10-15):** (1) No dashboard figure counts refusal reasons yet: the fragment carries the latest visit's `refusal_reason`, a worker test pins that rule on the fragment, and entry 11's ledger `reason=` filter is its first reader. (2) The recap's `visitsToday` is today's door-days by `visited_at`, equal to the dashboard's Visites for one day; a visit made offline yesterday and synced today no longer counts today.

**Never:** Any change to response schemas, the client, the Visites feed or ledger (`/api/admin/visits`, entry 11), the CSV export, « Agents en tournée », the recap's `activeAgents` or `lastReceivedAt` (entry 12), the sync route, or the schema/migrations.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Correction | one agent, one prospect: `no_answer` 10:00, `converted` 16:00 today | Visites 1; chart today: `converted` 1, others 0; Convertis 1; agent row visits 1, converted 1; recap visitsToday 1 |
| Reverse correction | `converted` 10:00, `no_answer` 16:00 | Visites 1, Convertis 0, chart `no_answer` 1 |
| Flyer on first visit | flyer at 10:00, none at 16:00 | flyersGiven 1 |
| Refusal reason | `not_interested`+`no_need` 10:00, `converted` 16:00 | the door-day's refusal reason is null; reversed order: `no_need` |
| Two days | same door, visits on D and D+1 | 2 door-days, one per day in the chart |
| Two agents | two agents, same door, same day | 2 door-days; Convertis still counts the place once |
| Previous period | door-day in the previous period | counted in `previous` only |
| DST night in range | 90-day period spanning a clock change | each visit on its Brussels day |

</frozen-after-approval>

## Code Map

- `src/worker/door-days.ts` -- add `LATEST_VISIT_FIRST` (the ordering, used by `doorDaysOn`'s `row_number` too) and `doorDaysBetween({ from, to, dayKey })`: an SQL subquery with columns `agent_email, prospect_id, day, outcome, visited_at, refusal_reason, flyer_given (any), visit_count`, built from a range read of `visits` on `visits_visited_idx`, with a `row_number() over (partition by agent_email, prospect_id, day order by LATEST_VISIT_FIRST)` and `rank = 1`. Compute `day` in an inner subquery if SQLite will not partition by the alias.
- `src/worker/routes/admin.ts:198-244` (recap) -- `n` becomes per-agent door-days of today: `count(distinct case when visited_at >= dayStart then prospect_id end)` on the same received-today rows (`visited_at ≤ received_at`, so today's door-days are among them). `activeAgents` and `lastReceivedAt` stay as they are.
- `src/worker/routes/admin.ts:254-430` (dashboard) -- `visitCounts` (value, previous, flyersGiven), the `agentVisits` grouped read, `visitsByDay`, `convertedByDay`, `conversionCounts` (the visit branch of the union; `visited` stays distinct prospects with a door-day), `agentConversions`: read through `doorDaysBetween` instead of `visits`. `periodDays.dayOf` (:510) is the current-period key. For `[previousFrom, to)` use `case when visited_at >= from then cur.dayOf(t) else prev.dayOf(t) - period end` with `prev = periodOffsets`-based keys for `[previousFrom, from)`.
- `src/worker/dashboard.test.ts`, `src/worker/recap.test.ts` -- harness: `seedProspect`, `seedVisits(prospectId, visitedAts, outcome, agent)` (:74), `brusselsPeriod` instants. Existing cases that seed several same-day visits on one prospect now expect door-days, so update their numbers and say why in the case name. Add a `describe("door-days (ADR-0036)")` for the matrix. Test the refusal-reason rule against the fragment directly, through `getDb(env.DB).all(sql\`select … from (${doorDaysBetween(…)})\`)`.
- `docs/api.md:160-303` -- each figure's definition says door-days: Visites, Visites dans le temps, KPI series, Activité par agent, Convertis/Taux (the visit events), Flyers remis, Cost (statement count, largest bind count), and the recap's `visitsToday` plus its Cost line.
- `docs/design.md:254-262` (recap card) -- the visits line counts door-days. `:989` -- entry 10's part shipped.
- `docs/domains/field-operations.md:123` -- "later stories of #496" becomes: the admin figures count door-days (api.md › The dashboard).
- `docs/free-tier-budget.md:127-150` -- the measured dashboard CPU after this change.

## Tasks & Acceptance

**Execution:**
- [ ] `src/worker/door-days.ts` -- shared ordering and `doorDaysBetween` -- R12, one home for the rule.
- [ ] `src/worker/routes/admin.ts` -- dashboard figures and the recap count via the fragment -- R12.
- [ ] `src/worker/dashboard.test.ts`, `src/worker/recap.test.ts` -- the matrix, plus existing cases moved to door-days -- story verify.
- [ ] `docs/api.md`, `docs/design.md`, `docs/domains/field-operations.md`, `docs/free-tier-budget.md` -- R16.

**Acceptance Criteria:**
- Given any period, when the dashboard answers, then `visitsByDay` still sums to `visits.value`, `visits.byDay` to `visits.value`, and `converted.byDay` to `converted.value`.
- Given the largest statement, then it binds ≤100 parameters, and `measure-dashboard-cpu.mjs` stays under 10 ms on the seed or the budget doc names the gap.

## Implementation Notes

- A Sonnet `api-engineer` subagent implemented this from the spec, and the same agent applied the review patches. The spec's matrix says `no_answer`, but the real outcome value is `no_contact`, which the tests use.
- `doorDaysBetween` returns a subquery body. Its inner range read is aliased `"visits"`, so the shared `LATEST_VISIT_FIRST` resolves in it, and it computes `day` first so the windows partition by a column. `dayIndexer` is extracted from `periodDays`. `twoPeriodsDayKey` numbers the current period's days `0…` and the previous period's `−period…−1`.
- The largest statement binds 20 parameters. `measure-dashboard-cpu.mjs` ran on a local seed of 303 prospects and 1,689 visits. Worker CPU medians were 0.62, 0.64 and 0.75 ms at 7, 30 and 90 days, and the cold first request was 7.62 ms. D1 time, which is not billed, rose to medians of about 2.4, 6.8 and 14.9 ms (free-tier-budget.md).
- Verification by the implementer: typecheck, lint, build and 2968 tests are green.
- Review pass 1 patches came from the same subagent. After them, the main session ran typecheck, lint, test (2969/2969) and build, all green. `check:precache` reads 25 entries and 999.91 KiB of 1,000 KiB, unchanged, since no client code moved. At PR time the baseline re-stamped from the merge-base with `origin/main` is still `acbae51db6bcd04bb68b0721a328684f6f2f6cf0`.

## Spec Change Log

## Review Triage Log

### Pass 1

Lenses: blind-hunter, edge-case-hunter, verification-gap and intent-alignment, all on Sonnet (the owner asked for Sonnet on this run). duplication-map was skipped, since this is not a refactor sweep.

Counts: high 0 · medium 1 · low 10 · false 3 · maybe-false 0. Routes: patch 3 · defer 0 · rejected 11 · noted 2.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| The tie-break test uses random ids, so it neither tests `id desc` nor reliably protects `received_at desc` (verification-gap, blind, edge) | medium | patch | `insertVisit` takes an `id`. Two deterministic cases: arrival beats id order, and on a full tie the larger id wins |
| The recap comment says "a visit made today was received today", the converse of the clamp, and api.md's "equals the dashboard's Visites" is too strong (blind, verification-gap other) | low | patch | Reworded: the figure is today's door-days received so far. A visit made before midnight and synced after it counts in no recap (decision 2) |
| The "reopened" test title describes a same-day case it does not seed (blind) | low | patch | Clause dropped |
| The recap re-implements the door-day rule instead of reading the fragment (blind, intent) | low | rejected | For one agent and one day, distinct prospects is the door-day count by definition, with no latest-visit ordering involved. A window on a 15-s poll would cost more for the same number, as the Code Map planned |
| The card can read « 1 / 2 agents actifs » with « Aucune visite » after an offline sync (blind, edge) | low | rejected | Decision 2's accepted consequence, pinned by a recap test. Entry 12 moves `activeAgents` to tournées |
| The `dd.visited_at` and `"visits"."day"` aliases are coupled by hand (blind) | low | rejected | A broken alias is an SQL error that every dashboard test hits at once, not a silent miscount |
| `refusal_reason` and `visit_count` have no figure that reads them (blind, intent) | low | rejected | Owner decision 1 and the intent ask the fragment to carry them for entry 11. Their window is in the measured CPU |
| The CPU was measured on the local seed only, with no scaling estimate (blind, edge) | low | rejected | Worker CPU stays under 1 ms warm at 90 days, and the window runs in unbilled D1 time. The rows read are the same range reads as before |
| The "20 bound parameters" claim is not asserted by a test (blind) | low | rejected | 20 of 100. The script's `EXPLAIN=1` prints it, and a bind-count test is new machinery for a wide margin |
| The glossary says the ledger counts door-days, but it will not until entry 11 (blind) | low | rejected | The glossary states the epic's target; entry 11 delivers the ledger, and api.md says "not door-days yet" meanwhile |
| The refusal-reason test uses a stand-in UTC `dayKey` (intent) | low | rejected | The rule under test is the latest-visit ordering, which does not depend on the key. The real keys are pinned by the DST and two-day cases |
| The recap has no upper bound on `visited_at` (edge) | false | rejected | Rows are filtered on `received_at < tomorrow`, and the clamp gives `visited_at ≤ received_at` |
| `activeAgents = 1` with `visitsToday = 0` is untested (edge) | false | rejected | The recap test "Received today still makes the agent active (entry 12 changes that)" pins it |
| The "reopened" test's `+ DAY_MS` can land on the wrong day on a DST first day (blind) | false | rejected | The test clock is frozen, and `from + DAY_MS + 1` is still inside the period whichever day it lands on |
| The Visites ledger, CSV export and Agents en tournée stay on raw visits (intent) | — | noted | Excluded by the spec, and owned by entries 11 and 12 |
| No client test renders the new numbers (intent) | — | noted | The response shapes are unchanged and the client is untouched |

## Design Notes

Door-days are partitioned by the visit's own `prospect_id`, as in `doorDaysOn`. Merged prospects fold to their survivor only where a figure already used `PROSPECT_KEY` (Convertis, Taux, the agent's converted). So the rule stays in one place, and a merge changes no figure that did not already depend on it.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test` -- expected: green, with the new door-day describe.
- `pnpm lint && pnpm build` -- expected: green.
- `node scripts/measure-dashboard-cpu.mjs` (needs `pnpm dev` with the seed) -- expected: CPU recorded in free-tier-budget.md.
