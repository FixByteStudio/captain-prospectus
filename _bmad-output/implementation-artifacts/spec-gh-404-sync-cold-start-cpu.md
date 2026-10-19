---
title: 'GH #404 — the sync''s cold first request, measured fairly'
type: 'chore'
created: '2026-10-18'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'a73469fd24573945997e92ae09df4c2caf21643a'
context:
  - '{project-root}/docs/free-tier-budget.md'
  - '{project-root}/docs/adr/0005-d1-with-drizzle.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** #404's last open part is the cold first `POST /api/agent/sync`, recorded locally at 9.2–16.0 ms for one visit and 12.9–14.7 ms for 50. No production figure exists yet: the owner has none to paste. The local figure also mixes in Node's own first-use cost, which a Cloudflare isolate does not have.

**Approach:** Make the local cold figure measure the Worker bundle alone, re-measure, and record what the cold excess actually is. This GH #341 also looked for: no app-wide fixed cost turned up this time.

## Boundaries & Constraints

**Always:** alternate builds when comparing (as GH #341 did); keep the existing warm figures comparable (same seed, 200 assigned prospects, same flags); every number in the doc names its command and sample count.

**Never:** change any file under `src/` (decision 1); change the sync contract; fold #565 (the visit insert) or the dashboard script's same round-0 inflation into this change; close #404 (decision 2).

**Decisions (owner, 2026-10-19):**
1. Ship measurement and record only: fix round 0 of `measure-sync-cpu.mjs`, re-measure, record the findings. The raw pull read (needs an ADR-0005 amendment) and the 14-column select are recorded as measured options, not shipped.
2. #404 stays open until the owner pastes Cloudflare's p50/p99/max for `POST /api/agent/sync`. The PR says "Refs #404", not "Closes".

</frozen-after-approval>

## Code Map

- `scripts/measure-sync-cpu.mjs:283-297` -- each round's cold sample is a fresh `import()` of the same bundle; round 0 is also the process's first `Request` body read, first WebCrypto HMAC and first call into the shim. That inflates the worst cold figure by 6–8 ms. `TOURNEE=pull` already does one untimed `?seed` import: generalise it.
- `scripts/worker-cpu-shim.mjs` -- `timeRequest`, `d1Shim`; shared with `measure-dashboard-cpu.mjs` (whose cold sample has the same round-0 inflation; out of scope, note only).
- `docs/free-tier-budget.md:8, 62-74, 137-150, 151-214` -- the cold figures and the "#404 stays open" sentences to rewrite.
- `src/worker/round.ts:11` `openAssignedProspects` -- `select()` of all 23 prospect columns. The sync maps every row through Drizzle's `mapResultRow` and then keeps 14 (`routes/wire.ts toWireProspect`). Also used by `routes/admin.ts:182`.
- `src/worker/routes/agent.ts:241-248` -- the visit insert through Drizzle's builder: the 50-visit cold cost. Already tracked as #565.

## Design Notes

Findings (investigation, 2026-10-18, local seed 303 prospects / 1,689 visits + 200 measurement prospects)

One fresh Node process per sample. An untimed import plus 3 requests warms Node and the shim, then a second import is the cold isolate. 8 samples per cell, builds alternated:

| build | cold 1 visit | cold 50 visits | warm median 1 / 50 |
|---|---|---|---|
| main | 11.7 ms (10.6–12.5) | 15.8 ms (14.6–16.6) | 1.6 / 3.3 |
| pull selects the 14 wire columns | 11.2 (10.7–12.1) | 14.6 (12.8–16.0) | 1.5 / 3.3 |
| pull read raw (toSQL + `D1.raw()`) | 9.3 (8.3–10.3) | 15.1 (14.5–16.3) | 1.3 / 3.1 |

- A truly fresh process measures 18.6 ms for one visit. About 6 ms of that is Node compiling its own JS `Request`, streams and WebCrypto, which workerd implements natively.
- Re-importing the same source does not reuse compiled code: same-source and distinct-source re-imports give equal figures.
- There is no #341-style cost here. Hono's router, `getDb`, the session HMAC key and zod's JIT are each under 0.3 ms or absent: zod/mini objects never JIT. The excess over warm is the sync's own code running once in V8's interpreter. Profiled, that is Drizzle's SQL builder and `is()` checks (~40%, mostly the 50-row visit insert, #565), row mapping for the pull (~1.9 ms at 272 rows), then zod and Hono.
- Cloudflare's limits page: "Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit." A cold first request is once per isolate.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/measure-sync-cpu.mjs` -- before the rounds loop, import the bundle once under `?warmup` and run 3 untimed `once(worker, SIZES[0])` (after the `TOURNEE=pull` seed, so the flags' assertions hold). Update the header comment: this first import pays the process's own first use (Node's JS `Request`, streams, WebCrypto, the shim), which workerd does not have, so every timed cold round is a fresh import in a warm process. -- Round 0 currently inflates the worst cold by 6–8 ms.
- [x] `docs/free-tier-budget.md` -- add a dated entry « The cold first request, measured fairly » (GH #404, 2026-10-19) to Watch-outs. It holds the script fix, the re-measured `SIZES=1,25,50 ROUNDS=5` cold and warm figures, and the Findings above: the Node share, no #341-style fixed cost, interpreter-time attribution, the two measured pull options with ADR-0005's constraint, and Cloudflare's per-isolate flexibility quoted. Rewrite row 8's summary and status to match. Leave earlier dated entries' numbers as they are, and add one line under the first of them saying their worst cold rounds include round-0 inflation. Say #404 waits on a production figure. -- One home for the rule.
- [x] GitHub -- open a `found-in-passing` issue: `scripts/measure-dashboard-cpu.mjs:89-96` gates on a cold sample that is the process's first request (same inflation). Search for duplicates first. -- Out of scope here.

**Acceptance Criteria:**
- Given the fixed script, when `SIZES=1,50 ROUNDS=5 node scripts/measure-sync-cpu.mjs` runs, then no cold round is more than ~3 ms above the size's cold median, and every cold round is still a fresh import's first request.
- Given `TOURNEE=pull`, `TOURNEE=swipe`, `SLIDE=1`, `PAYLOAD=full` and `PROSPECTS=100`, when each runs with `SIZES=1 ROUNDS=1 RUNS=2 WARMUP=1`, then each completes without an assertion error.
- Given the doc, when a reader looks for the sync's cold figure, then row 8 and the new entry agree, name the command, and say #404 is open for a production figure.

## Implementation Notes

- Implemented by a sonnet subagent. Only `scripts/measure-sync-cpu.mjs` and `docs/free-tier-budget.md` changed, and nothing under `src/`. Found-in-passing issue: #568 (`scripts/measure-dashboard-cpu.mjs:89-96`).
- All five acceptance flag runs exit 0. Verification after the review patches: typecheck, lint, 3,017 tests and the build pass; precache 938.43 KiB.
- Baseline re-stamped at hand-over: still `a73469fd24573945997e92ae09df4c2caf21643a` (the merge-base with `origin/main`).

## Spec Change Log

## Review Triage Log

**Pass 1 (2026-10-19), lenses run on sonnet at the owner's request:** 5 medium/low patched, 0 high, 9 false or rejected.

| # | lens | finding | verdict | route | evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge, intent | "6–8 ms round-0 inflation" and "every earlier entry's worst cold rounds" overclaim; only SIZES[0]'s round 0 was the process's first request | medium | patch | Old script: rounds loop sizes in order in one process, so only the first size's round 0 is process-first (`TOURNEE=pull` is already warmed by its seed); the doc's own table moves only at one visit (16.7 → 11.8). Reworded. |
| 2 | blind, edge | Row 8 understates: 50-visit max 16.5, one visit also over 10 ms | medium | patch | The table shows 9.2–11.8 and 13.0–16.5. Range and wording fixed. |
| 3 | blind | Option savings are point deltas inside overlapping 8-sample ranges | low | patch | Only raw at one visit (8.3–10.3 vs 10.6–12.5) separates. Doc says so. |
| 4 | blind | The Cloudflare quote has no URL or date, and the cold frequency is unestimated | low | patch | The doc tells readers to re-verify vendor pages. Source and retrieval date added; "not measured" stated. |
| 5 | blind | Node version not recorded; fresh Node import ≠ workerd | low | patch | Version added, plus the proxy caveat. |
| 6 | verif-gap, blind, intent | Investigation figures come from an uncommitted harness, so they can't be reproduced, against the Always "names its command" rule | low | reject | The doc labels them as from a throwaway harness and states its method and sample counts. Committing it adds a maintained script for a one-off finding. Raised in the PR description instead. |
| 7 | edge, blind, intent | Warm-up runs only SIZES[0]; other sizes get no size-specific warm-up | false | reject | Node's `Request`, streams, WebCrypto and the shim are the same code at any size. The 25 and 50 cold ranges are unchanged before/after, which shows no residual size-specific first use. |
| 8 | blind | Hard-coded 3 untimed requests vs the `WARMUP` knob | low | reject | The header comment says what the warm-up pays. Cosmetic. |
| 9 | edge | A warm-up failure is indistinguishable from a timed-round failure | low | reject | The stack trace names the line. Adding a wrapper is more surface for a rare case. |
| 10 | edge | The header implies the import, not the requests, pays first use | false | reject | The comment says "one import … and three untimed requests pay". |
| 11 | blind | Swipe-mode warm-up may leave state behind | false | reject | `once()` resets tournées in swipe mode. The implementer ran `TOURNEE=swipe` and every acceptance flag with exit 0. |
| 12 | blind | The spec looks unfinished (tasks unticked, logs empty) | false | reject | It is mid-workflow. This log and the notes are written at this step. |
| 13 | blind | Earlier entries still say "#404 stays open" / "past 10 ms" | false | reject | Both are still true. Dated entries are records, kept as the spec says. |
| 14 | intent | The fix corrects an outlier rather than shifting the cold level | low | patch (with #1) | Accurate. The reworded entry now says so. |

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: pass
- `node scripts/measure-sync-cpu.mjs` and `SIZES=1,50 ROUNDS=5 node scripts/measure-sync-cpu.mjs` -- expected: no cold round inflated by the process's first request; figures recorded in the doc
