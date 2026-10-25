# Slices, detail lists and source trace

Pull-request grouping for `SPEC.md`. Order: decisions and enablers first, pins next, docs last so they describe the final code.

## Slices

| # | PR | CAPs | Owner | Notes |
|---|---|---|---|---|
| S1 | Break-glass refuses an agent row | 7 | api-engineer | Tests only for the refusal; docs line goes to S9 |
| S2 | Pin what the removal loosened | 2, 3, 4, 5, 6 | api-engineer + pwa-engineer | One story: 579/3 + 580/5 |
| S3 | Pin the prospect drain | 1 | pwa-engineer | Separate: other retro, other file |
| S4 | Feed cursor in stamp order | 16 | api-engineer | Enabler; closes the #540 and #528 deferrals |
| S5 | One precache figure | 17 | pwa-engineer | Enabler; touches `package.json`/CI/PR template |
| S6 | Finish R15 | 18 | api-engineer | |
| S7 | Admin offline polish (= #562) | 13 | pwa-engineer | `hitl`; wording reviewed by the owner |
| S8 | Code dialog day and 400 copy | 14, 15 | pwa-engineer | `hitl` wording; 15 is a tracker line or test |
| S9 | Docs pass | 8, 9, 10, 11, 12 | docs-keeper | Closes #619 and #621 |
| S10 | Process chore | 19 | owner or docs-keeper | Edits `CLAUDE.md`, build skill, `release-checklist`, `d1-migration` |
| S11 | Day rule decision | 20 | architect | Implementation cut after it |

## CAP-9 list (docs pass)

*579/4* — ADR-0037: "import" clause (S-1), tabs wording (S-2), a line recording the skipped release step (S-4). ADR-0019 and ADR-0028 bodies and their rows at `docs/adr/README.md:27, 36` (S-5). ADR-0029 "Agents page" at `:51, 73, 94, 114`. `identity-access.md:76` and `src/client/field/sync.ts:43` on the two sources of a 403 (F-C). `docs/data-model.md:121`: role is fixed. Glossary: « Administrateurs », "an admin does no tournée". Comments and names of C-6: `tabs.ts:28-29`, `field-clock.ts:74`, `auth.ts:100`, `routes/auth.ts:98`, `identity.ts:39`, `schemas.ts:565`, `admin/nav.ts:42`, copy key `copy.nav.agents`. Story 6's title, description and `verify`. Optional copy (C-7): the `emailTaken` hint, a « le rôle ne change plus » line in the Add dialog. The `AdminOfflineScreen` raw `<button>` comment (A4) is optional.

*580/6* — Fold ADR-0029's passphrase wording into the same `docs/adr` pass; optional one line each in `security.md` and `deployment.md:94` that an admin's code lasts 1 hour.

*538/2* — `docs/data-model.md:280-282`: unique `tournee_stops(tournee_id, number)` row. `docs/glossary.md:30`: a tournée is no longer "at most one per agent per day". ADR-0036:140: add "and number". `docs/api.md:28`: the choice is on the phone's `startedAt` as sent (`clientStartedAt` in the response). Optional `src/shared/constants.ts:172`.

*CAP-19 (S10), for reference* — the `d1-migration` skill line, and `docs/deployment.md`, say what a failed unique-index migration means and that a fresh redeploy is the remedy (538/10, M-1).

## CAP-18 list (R15 and residue)

Plan from the code, not hand-typed binds: `todayTournee` reads, the `owned`/`known` lookups in `writeTournees`, `doorDaysOn`, `doorDayCounts`, the feed's tie query and seed path (`admin.test.ts:2201`, `:2227` still hand-type binds). Parity test's day key from `twoPeriodsDayKey` / `days.dayOf`; a visit within an hour of each clock switch; a `doorDayCounts` DST case. Fake the clock in the position tests (`sync.test.ts:1454`, `:1461`, `:1487`, `:1532`). Stop-number lower bound on the wire (V8). Admin-round test with both clocks ahead (V6). `runSync` « Nouveau » test with the phone ahead of `serverTime` (V5). A failure in the *stops* insert beside R3's tournée insert. Measure `doorDayCounts` (N8) and add a `docs/free-tier-budget.md` row (invariant 13).

## Source trace

| Retro action | Lands in |
|---|---|
| 538/1 | CAP-1 |
| 538/2 | CAP-9 |
| 538/3 | left out (owner) |
| 538/4 | CAP-16 |
| 538/5 | CAP-20 |
| 538/6 | CAP-18 |
| 538/7 | left out; open question |
| 538/8, 538/9 | left out (owner) |
| 538/10 | CAP-19 |
| 538/11 | left out; open question |
| 579/1 | left out (#627) |
| 579/2 | CAP-7 (F-A), CAP-8 (F-G) |
| 579/3 | CAP-2 to CAP-5 |
| 579/4 | CAP-9, CAP-11 |
| 579/5 | CAP-13 |
| 579/6, 579/7 | CAP-19 |
| 579/8 | left out (owner) |
| 579/9 | CAP-17 |
| 580/1 | CAP-8 |
| 580/2 | CAP-7 |
| 580/3 | CAP-14 |
| 580/4 | left out (owner) |
| 580/5 | CAP-2 to CAP-6 |
| 580/6 | CAP-9, CAP-10, CAP-12 |
| 580/7 | CAP-15 |
| 580/8 | CAP-17 |
| 580/9, 580/10 | CAP-19 |
| 580/11 | carried items: #627 out, 579/3 in CAP-2 to CAP-6, 579/5 in CAP-13 |
