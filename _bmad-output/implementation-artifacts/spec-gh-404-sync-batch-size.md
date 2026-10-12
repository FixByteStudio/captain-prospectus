---
title: 'Phones sync in batches of 50 visits; the server still accepts 200'
type: 'refactor'
created: '2026-10-12'
status: 'done'
baseline_commit: 'fe2cdc4e2e3bda3af5559b68aaf4d925d8cfbf57'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/.claude/skills/sync-contract-change/SKILL.md', '{project-root}/docs/domains/field-operations.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A full `POST /api/agent/sync` of 200 visits to 200 distinct prospects costs more Worker CPU than Workers Free's 10 ms (GH #404, INVARIANT 13). One constant, `SYNC_VISITS_PER_REQUEST`, is both what the phone sends and what the server accepts, so lowering it would refuse the outbox of a phone still running an old build.

**Approach:** Split it. The phone sends at most a new `SYNC_VISITS_PER_BATCH = 50` visits per pass. The server keeps accepting `SYNC_VISITS_PER_REQUEST = 200`, so old installed PWAs still sync with no `clientVersion` bump (INVARIANT 9). `MAX_DRAIN_PASSES` is derived from the batch so one drain still clears 1,200 visits (24 passes). The 50 comes from re-running #404's measurement at 25/50/100/200 (see Design Notes); the script that does it is committed.

## Boundaries & Constraints

**Always:** the server's zod cap stays `SYNC_VISITS_PER_REQUEST` (200); a test proves a 200-visit request is still accepted; `SYNC_VISITS_PER_BATCH ≤ SYNC_VISITS_PER_REQUEST`; `MAX_DRAIN_PASSES × SYNC_VISITS_PER_BATCH ≥ 1,200`; the byte trim (`serializeWithinCap`) and the per-identity filter still run before the limit as they do now; outbox rows are still deleted only once listed in `accepted` (INVARIANT 5).

**Never:** change the wire shape, `CLIENT_VERSION` or `MIN_CLIENT_VERSION`; lower the server's accept limit; touch `SYNC_PROSPECTS_PER_REQUEST` or the Dexie schema; change the server route.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New phone, big outbox | 120 of this identity's visits queued | Pass sends 50, then 50, then 20 | No error expected |
| Old build | Request with 200 visits | Server answers 200 and accepts all 200 | No error expected |
| Over the server cap | Request with 201 visits | 400, as today | Outbox kept |
| Long offline drain | 1,200 visits queued, every pass accepted | 24 passes clear it in one trigger | Rest waits for the next trigger |

</frozen-after-approval>

## Code Map

- `src/shared/constants.ts:148-150` -- payload caps. `SYNC_VISITS_PER_REQUEST` stays the server's ceiling; add `SYNC_VISITS_PER_BATCH` beside it with a *why* comment (CPU, old builds).
- `src/shared/schemas.ts:657` -- `z.maxLength(SYNC_VISITS_PER_REQUEST)`. Do not change.
- `src/client/field/sync.ts:135` -- `.limit(SYNC_VISITS_PER_REQUEST)` → `SYNC_VISITS_PER_BATCH`. The comment at :79 ("a batch of 200 visits…19.7 MB") describes the byte trim; adjust only if it now misleads.
- `src/client/field/sync-schedule.ts:9-15` -- `MAX_DRAIN_PASSES = 6` with a "six passes of 200" comment. Derive it from the batch and a named 1,200 target.
- `src/worker/routes/agent.ts:168`, `src/worker/routes/status.ts:39` -- already speak of the server's ceiling. Leave.
- `src/worker/sync.test.ts:441-460` -- the 200-visit "full batch" server test. Keep it; its comment should say it is also the old-build guarantee.
- `src/client/field/sync.test.ts:390-399, 496` -- use `SYNC_VISITS_PER_REQUEST` for client-side slices; move to the batch constant.
- `src/client/field/sync-schedule.test.ts:61-64` -- pass-cap test; uses the constant, so it keeps working.
- `src/shared/constants.test.ts:115-150` -- body-budget test at the server's 200 cap. Keep (an old build can still send it).
- `scripts/measure-dashboard-cpu.mjs` -- holds the CPU shim inline. Already moved to `scripts/worker-cpu-shim.mjs` during planning, and `scripts/measure-sync-cpu.mjs` written on it; the dashboard script must be switched to import the shim.
- `docs/domains/field-operations.md:164`, `docs/api.md:76-80`, `docs/free-tier-budget.md:84-94` -- name the two limits and record the measurement.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/constants.ts` -- add `SYNC_VISITS_PER_BATCH = 50`; reword the cap comment so the two limits and why they differ are clear.
- [ ] `src/client/field/sync.ts` -- send at most `SYNC_VISITS_PER_BATCH` visits per pass.
- [ ] `src/client/field/sync-schedule.ts` -- `MAX_DRAIN_PASSES = Math.ceil(DRAIN_VISITS / SYNC_VISITS_PER_BATCH)` with `DRAIN_VISITS = 1_200`; rewrite the comment.
- [ ] `src/client/field/sync.test.ts` -- move the client-slice tests to the batch constant; add one that a pass over a larger outbox sends exactly `SYNC_VISITS_PER_BATCH`.
- [ ] `src/client/field/sync-schedule.test.ts` -- assert `MAX_DRAIN_PASSES × SYNC_VISITS_PER_BATCH ≥ 1,200`.
- [ ] `src/shared/constants.test.ts` -- assert `SYNC_VISITS_PER_BATCH ≤ SYNC_VISITS_PER_REQUEST`.
- [ ] `src/worker/sync.test.ts` -- keep the 200-visit test, its comment naming the old-build case; add a 201-visit request answered 400.
- [ ] `scripts/measure-dashboard-cpu.mjs` -- import the shared shim; behaviour unchanged.
- [ ] `docs/domains/field-operations.md`, `docs/api.md`, `docs/free-tier-budget.md` -- two limits, the measurement table, the script path (replacing "not committed").

**Acceptance Criteria:**
- Given an outbox of more than 50 sendable visits, when `runSync` runs, then the request carries exactly 50.
- Given the server, when it receives a 200-visit sync from an old build, then it answers 200 and lists all 200 in `accepted`.
- Given `node scripts/measure-dashboard-cpu.mjs`, when run after the refactor, then it prints the same table as before.

## Implementation Notes

- Constants, client slice, derived `MAX_DRAIN_PASSES` (24, from `DRAIN_VISITS = 1_200`), tests and docs as the task list says. The shim moved to `scripts/worker-cpu-shim.mjs`; `copyLocalD1` also applies `drizzle/` migrations the dev database lacks, so both scripts work when the local D1 is behind (it was: 0014 unapplied).
- After review, `measure-sync-cpu.mjs` always seeds 200 prospects (the pull list no longer varies with `SIZES`), defaults to `SIZES=1,25,50,100,200`, and checks every request stored its visits. The fixed seed raised the 1-visit warm median from 0.89 to ~1.2 ms; 50 stayed at ~2.5 ms median, ~4.5–5.1 ms worst warm. `docs/free-tier-budget.md` carries those two re-runs, which supersede the Design Notes table above.
- Verification: typecheck, 2,676 tests, lint and build pass; precache 952.77 KiB of 1,000.

## Spec Change Log

## Review Triage Log

**Pass 1** (blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 3, low 14, false 2, maybe-false 0. Verification-gap: no gaps (155 tests in the four changed files pass). Intent-alignment: descriptive; R1 implemented in full, the problem's outcome only partly, as the docs say.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge | Field prospects never measured; "~4 ms" read as a pass's cost | medium | defer + patch | `agent.ts:112` one dedupe select per prospect; pre-existing → GH #449. Docs reworded to "bare visits only". |
| 2 | blind | Measured payload is bare visits, not worst case | medium | defer + patch | Byte cap unchanged by this story → GH #450. Script header reworded. |
| 3 | blind | Per-phase split (#404's first step) skipped | false | reject | The intent picks the batch-size lever by re-running the total measurement. |
| 4 | blind | Cold case loses its tracker if the PR closes #404 | low | patch (PR) | PR refers to #404 without closing it. |
| 5 | blind | No plan to lower the server's 200 | medium | defer | Intent keeps 200 and forbids the bump; nothing can detect old builds → GH #451. |
| 6 | blind | Docs omit what happens to an old build's over-budget request | low | patch | One sentence in free-tier-budget. |
| 7 | blind | Drain test is a tautology | false | reject | Fails if `MAX_DRAIN_PASSES` reverts to a literal 6 (6 × 50 < 1,200), per verification-gap. |
| 7b | blind | "Still drains 1,200" false under byte-halving | low | patch | field-operations says "up to DRAIN_VISITS". |
| 8 | blind | Client test hard-codes 50/70/120 | low | patch | Derived from `SYNC_VISITS_PER_BATCH`. |
| 9 | blind | 6 → 24 passes unmentioned | low | reject | Passes stop on no progress; only a backlog reaches 24; noted in the PR. |
| 10a | blind, edge | `copyLocalD1` now applies migrations, unmentioned | low | patch | One line in the dashboard script's header. |
| 10b | blind, edge | No transaction; opaque error without `d1_migrations` | low | reject | A dev DB never migrated by wrangler is not a case the script supports; it fails loudly. |
| 10c | blind | 1-visit row not reproducible from default SIZES | low | patch | Default SIZES `1,25,50,100,200`; table re-measured. |
| 10d | blind | 50/200 and the why repeated across docs | low | patch | field-operations names the constants, links free-tier-budget. |
| E1 | edge | Script times the quarantine path if visits are not inserted | low | patch | Asserts `size` visits stored before reset. |
| E2 | edge | SIZES not validated | low | reject | Dev tool; a bad size fails loudly with the Worker's 400. |
| E3 | edge | Seed count varies with SIZES, so pull cost varies | low | patch | Always seeds 200. |
| E7 | edge | Query re-import is not a real cold isolate | low | patch | Header says it stands in for one. |

## Design Notes

`node scripts/measure-sync-cpu.mjs`, Ryzen 9 7900, local seed, 3 alternating rounds, 50 warm runs each (2 runs; the second in brackets):

| visits | warm median | warm max | cold (3 rounds) |
|---|---|---|---|
| 1 | 0.89 | 4.12 | 7.4 / 8.6 / 13.9 |
| 25 | 1.91 (1.89) | 3.37 (4.86) | 9.9–18.4 |
| 50 | 2.59 (2.47) | 4.03 (4.32) | 10.9–13.4 |
| 100 | 4.03 (3.86) | 7.42 (9.88) | 14.6–19.8 |
| 200 | 6.62 (6.71) | 12.68 (11.63) | 19.8–26.5 |

50 keeps the warm worst near 4 ms; 100's worst reaches 9.9 ms. Going to 25 buys little and doubles the passes. A cold isolate's first request is over 10 ms at **any** size, one visit included: that is compile cost, the same thin case the dashboard documents, and the batch size cannot fix it. Record it; do not claim #404's cold case closed.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass.
- `node scripts/measure-sync-cpu.mjs` and `node scripts/measure-dashboard-cpu.mjs` (with `D1_SQLITE` pointing at the main checkout's local D1) -- expected: both run; figures in line with Design Notes.
