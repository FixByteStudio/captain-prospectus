---
title: 'Seed 180 days of dashboard data (GH #108)'
type: 'chore'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
baseline_commit: 'acfb094d994fb732bd5eee45325e8f6c011a0eb3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `pnpm db:seed:local` seeds 30 prospects and no visits, so on Tableau de bord Visites is 0, every delta shows "—", and stories 5 to 10 have nothing to show or measure. The story 3 browser check needed a faked response for this reason.

**Approach:** `POST /api/dev/seed` generates each seeded prospect's visit history over the last 180 days. The history is deterministic, covers both agents and all five outcomes, and includes flyers and follow-ups. The route then applies what `scripts/seed.mjs` declares: one manual status change, one merged prospect, a live duplicate pair, and quarantined visits of both reasons. Every generated id is derived from stable input, so a second run inserts nothing.

**Decisions (2026-09-26, user):** The quarantined visits are inserted straight into `visits_orphaned` by the dev route, one `not_assigned` and one `unknown_prospect`, with the row shape sync writes. In dev, sync always runs as `DEV_USER_EMAIL`, so it could not post the other agent's visits anyway. The volume is about 300 places: the 30 current ones stay unchanged, and about 270 generated ones sit on a ≥ 100 m grid about 3 km away, where no two pair as duplicates. That targets roughly 10–15 visits a day, close to the mockup. The spec is kept whole despite running past 1,600 tokens.

## Boundaries & Constraints

**Always:** Visits are generated only for a prospect's own assignee, so they match what sync would accept. Status and `next_visit_at` come from `deriveProspectStatus` (invariant 3). `visited_at ≤ now` (invariant 12), and days are Brussels calendar days via `brusselsPeriod`. Every insert uses `onConflictDoNothing` and `chunk()` with `boundParamsPerRow` (invariants 4 and 7). The manual status and the merge are written only when not already set (`status_set_at IS NULL`, `merged_into IS NULL`). New body fields are optional and zod/mini, and a `mergeInto` naming no prospect in the body answers 400. `docs/api.md` is updated in the same change.

**Never:** Nothing touches `--remote` or a deployed database, and the dev gate (`devOnly`) is unchanged. No new dashboard figures, endpoints or UI (stories 5–10). No schema change, migration or npm dependency. `Math.random()` and `crypto.randomUUID()` are not used for seeded rows, because they would break idempotency. No French UI string is added; place names in `seed.mjs` are data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh seed | empty local D1, `pnpm db:seed:local` | for 7, 30 and 90: Visites `value` and `previous` > 0; Convertis > 0 in each period and its previous; each agent has visits and a conversion in 7 days; every status has ≥ 1 live prospect; Relances dues (≤ today) > 0 and due within 7 days > 0; ≥ 1 orphan of each reason; ≥ 1 duplicate pair; 1 merged; 1 manual status | — |
| Second run | same body again, any time later | row counts of `prospects`, `visits`, `visits_orphaned` and `scripts` unchanged; response `inserted` all 0 | — |
| Unknown merge target | `mergeInto: "Nulle part"` | 400 `validation`, nothing written | shared `validate` |
| Early morning | seed at 06:00 Brussels | no `visited_at` > now; today's visits clamped to now | — |
| Repaired orphan | an orphan was repaired into `visits`, then seed re-runs | not re-quarantined | skip ids already in `visits` |
| Admin reopened the manual prospect | `status_set_at` already set | left as the admin set it | — |
| Off localhost | any host but localhost | 404 as today | `devOnly` |

</frozen-after-approval>

## Code Map

- `scripts/seed.mjs` -- builds the body and posts it. Split the prospects into batches of ≤ `IMPORT_ROWS_PER_REQUEST` (250), with the special places in the first batch, and print `inserted`. Add the places: "Chez Léa et Paul" about 11 m from "Chez Léa" (the duplicate pair), "Pizzeria Roma" about 10 m from "Pizza Roma" with `mergeInto: "Pizza Roma"`, and one prospect with `manualStatus: "converted"`. Keep the existing 30 rows byte-identical so their dedupe keys hold.
- `src/shared/schemas.ts:719` `devSeedSchema` -- each prospect gains `z.optional` `manualStatus` (`statusSchema`) and `mergeInto` (`shortTextRequired`). A body-level `.check` rejects a `mergeInto` that names no prospect in the body or names the prospect itself. Follow `questionSchema`'s `.check((ctx) => …)` at `:103`. Add `devSeedResultSchema` `{ seeded, inserted: { prospects, visits, orphans } }`, the way `assignResultSchema` does.
- `src/worker/dev-seed-history.ts` (new, pure) -- `seedHistory(prospect, now) → NewVisitRow[]` plus `seedId(label) → uuid`. `seedId` hashes the label to 128 bits (cyrb128) and formats it as a version-8 UUID, which `z.uuid()` accepts (checked). A PRNG (mulberry32) is seeded from the prospect's dedupe key. Day k's start is `brusselsPeriod(todayStart + 12 h − k·24 h, 1).from`, the noon anchor that keeps DST from crossing midnight. Visits fall between 08:00 and 19:00, clamped to `now`. `receivedAt` is ≤ now, `clientVersion` is `CLIENT_VERSION`, lat and lng are the prospect's, and about 40 % have `flyerGiven`. `followUpAt` is set on `no_contact`, `interested` and `follow_up`. The visit id is `seedId(`${dedupeKey}:${n}`)`.
  - **Fixed stories** for each agent's first 8 prospects in the request, so coverage never depends on luck:
    - converted at k=2 (after visits at k=20 and k=12)
    - converted at k=9
    - converted at k=40
    - converted at k=120
    - `follow_up` at k=3, due today
    - `interested` at k=1, due in +5 days
    - `not_interested` at k=4
    - no visits, so it stays assigned
  - **Everyone else:** 15 % no visits. The rest start on a random day in [0, 179] and walk weighted outcomes: `converted` and `not_interested` end the walk, and the other outcomes lead to a revisit a few days later. After a non-terminal visit there is a small chance to drop out, which leaves an overdue Relance. Tune the weights, the gap and the drop-out so that about 300 places average **10–15 visits a day over the 180 days** (the frozen decision), with `converted` about 5 % of visits, the mockup's rate. A starting point: terminal outcomes about 10 % combined, a gap of 3–9 days, and a drop-out of about 3 %. A pure test pins the average for 270 synthetic prospects. Manual-status prospects get no visits.
- `src/worker/routes/dev.ts:54` -- the route order:
  1. Insert the prospects and count them with `.returning`.
  2. Resolve ids by `dedupe_key`, chunked.
  3. Insert the script, as today.
  4. Insert the histories. Seeded visits carry `scriptId: null` and `answers: {}`, because no panel reads answers.
  5. Run `deriveProspectStatus` on every prospect with a history.
  6. Apply the manual status (`status_set_at` = yesterday 14:00) and the merge, each guarded.
  7. Insert 2 orphans with constant `seedId` ids, skipping ids already in `visits`.
  8. Return `devSeedResultSchema`.
- `src/worker/routes/status.ts` `deriveProspectStatus` -- reuse it as is.
- `src/shared/period.ts` `brusselsPeriod` -- reuse it as is.
- `src/worker/dev.test.ts` -- keep the gate tests. Extend `beforeEach` to clear `visits_orphaned`.
- `docs/api.md:13` -- the dev seed row: the new fields, the 180-day history, and the idempotency guarantee.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts` -- the optional fields, the merge-target check, and the result schema
- [ ] `src/worker/dev-seed-history.ts`, `dev-seed-history.test.ts` (worker project) -- the generator. Tests check that it is deterministic (same key gives the same rows and ids), that `visited_at ≤ now` holds at 06:00, that the fixed stories land in the right Brussels day including in DST weeks, and that visits only go to the assignee.
- [ ] `src/worker/routes/dev.ts` -- the route steps in the order above
- [ ] `src/worker/dev.test.ts` -- a seed body with 2 agents × 10 prospects, 2 unassigned, the duplicate pair, the merge and the manual status. Assert every Fresh seed matrix row: through `GET /api/admin/dashboard?period=7|30|90` for Visites and Prospects ouverts, and through SQL for the rest, following the EXPERIENCE.md definitions. Assert the second run, the unknown merge target, and the repaired orphan.
- [ ] `scripts/seed.mjs` -- the places, the flags, batching and the summary line
- [ ] `docs/api.md`, `README.md` -- the seed row, plus one README line saying the seed holds 180 days of history

**Acceptance Criteria:**
- Given a fresh local D1 and `pnpm dev`, when `pnpm db:seed:local` runs twice, then the second run prints 0 inserted, and `SELECT COUNT(*)` on the four tables matches between the two runs (`wrangler d1 execute --local`).
- Given the seeded D1, when `/admin` opens at 7, 30 and 90 jours, then Visites shows a non-zero figure and a numeric delta, and Prospects ouverts is non-zero.

## Implementation Notes

- **Open choices (first pass, 2026-09-26).**
  - Seeded prospect ids are `seedId('prospect:' + dedupeKey)`, not `crypto.randomUUID()`, which follows the Never rule. Rows seeded before this change are still found by dedupe key in step 2.
  - Fixed stories skip prospects with `manualStatus` or `mergeInto`, so neither can undo one.
  - Histories use the assignee stored in the database, not the one in the body, so a reassigned prospect stays consistent with what sync would accept.
  - The `not_assigned` orphan goes on the first live assigned prospect and is sent by another agent: one in the body, or else `DEV_USER_EMAIL`.
  - The existing dev.test case "seeds prospects and one active script" now expects `converted`, because its one prospect takes fixed story 0.
- **Walk retune (after the first pass measured about 3 visits a day).** The frozen target is 10–15 visits a day. The walk now uses weights no_contact 36, interested 26, follow_up 31, not_interested 2 and converted 5, a revisit gap of 2–4 days, and a 1 % drop-out. The spec's starting point (3–9 days, 3 %) measured about 7.6 a day. 2–5 days at 1 % gave only 10.6 a day for the real seed, so the gap was narrowed for margin.
  - A pure test pins 270 synthetic prospects inside [10, 15] a day (about 12.6 measured) and 3–7 % converted.
  - The real seed, run twice on a fresh local D1, holds 303 prospects, 1981 visits (11.0 a day), 2 orphans and 1 script. 6.0 % of visits are converted, fixed stories included.
- **Review pass 1.** The same implementer applied 6 patches:
  - Status is derived only for the prospects this call inserted visits for.
  - A test covers the rule that the stored row wins over the body.
  - The tests parse the result schema instead of casting it.
  - The seeded orphans get a follow-up.
  - Comments and docs are corrected, with a reset line added.
  
  The orchestrator re-ran Verification: 54 files and 1159 tests pass, typecheck and lint are clean, the build succeeds, and `check:precache` reports 686.84 KiB of 1,000. The field bundle is untouched, since this is dev-only worker code.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: 0 high, 1 medium, 12 low, 2 false, 0 maybe-false. 6 patched, 1 deferred, 11 rejected.

- `medium` / **patch**: blind-hunter. Step 5 re-derives every prospect with a history on every call, so a re-seed that inserts nothing rewrites `updated_at` on about 250 rows and reshuffles the admin list, which orders by it. Fix: derive only the prospects whose visits this call inserted, as sync does, and have the test pin `updated_at`.
- `low` / **patch**: verification-gap (pre-verified). The rule that the stored row wins over the body (`dev.ts` step 2) is untested: every test starts empty, so the stored row and the body always agree. Fix: a test with a pre-existing row under the same key, a different id and a different assignee.
- `low` / **patch**: verification-gap and blind-hunter. `devSeedResultSchema` is never parsed; the tests cast. Fix: parse it in `seed()`.
- `low` / **patch**: blind-hunter. The `not_assigned` orphan is `interested` with no `followUpAt`, against the generator's own rule, so a repair leaves `next_visit_at` null. Fix: give it a follow-up.
- `low` / **patch**: blind-hunter, edge-case-hunter and intent-alignment. Two comments and the docs overclaim:
  - An unmerge is undone by a re-seed.
  - Fixed stories are handed out per request, so the two-request seed gives 16 per agent.
  - "Inserts nothing" does not hold once an admin assigns or reassigns a seeded prospect.
  - The seeded dates slide out of the 7-day window with no reset step documented.
  
  Fix: reword the step 4 and step 6 comments, README and api.md, and add a reset line.
- `low` / **defer**: verification-gap and blind-hunter. Nothing exercises the body `scripts/seed.mjs` builds: the specials must share a batch with their merge target, and `ROWS_PER_REQUEST` is a hand copy of `IMPORT_ROWS_PER_REQUEST`. Covering it means extracting the body builder from a script with top-level side effects. Logged in deferred-work.md.
- **rejected** (`low`, unlikely; the fix adds guards): blind-hunter and edge-case-hunter. `mergeInto` can form cycles or chains, or merge a row into itself when two names share a dedupe key. `seed.mjs` builds none of these.
- **rejected** (`low`, unlikely; the fix adds a branch): blind-hunter. `mergeInto` is ambiguous when two body rows share a name.
- **rejected** (`low`; fixing it needs state the seed doesn't keep): blind-hunter and edge-case-hunter. A discarded orphan is quarantined again on the next seed. The docs promise only that a repaired one is not.
- **rejected** (`low`; the documentation patch above covers it): edge-case-hunter. The story index shifts after an admin reassigns or merges one of an agent's first 8 prospects, which can add visits on a re-seed.
- **rejected** (`low`, cosmetic; stable allocation needs cross-request state): blind-hunter and edge-case-hunter. The doubled fixed stories add a small bump at k = 2, 9, 40 and 120. The comment is corrected by the patch above.
- **rejected** (`low`; the decision is met): intent-alignment C1/C2. The walk is denser near today: 11.0 visits a day over 180 days, 13.3 over 90, 17.5 over 30 and 19.0 over 7. The frozen decision says "roughly 10–15", and the 180- and 90-day figures fall inside it. Raised with the user in the summary.
- **rejected** (`low`; dev-only, and the local run takes seconds): blind-hunter. A seed request runs about 800 sequential D1 statements.
- **rejected** (`false`): blind-hunter. The `manualStatus` comment says the status is set after the visits are derived, and the route applies it in step 6, after step 5. A manual `follow_up` leaving `next_visit_at` null is also what admin PATCH does.
- **rejected** (`false`): intent-alignment. "Every figure on Tableau de bord has data" holds for every figure the screen shows today.
- descriptive, no action: intent-alignment A1, B1, D2, E2 and F2. The diff implements the readings the Decisions line settles; the real script and the browser were exercised in the implementer's manual check.

## Design Notes

**Fixed stories plus a seeded walk.** Random data alone would make the story's AC a matter of luck, and the fixed stories alone would draw a flat chart. The fixed stories guarantee every AC figure, and the walk gives the chart its shape. Both are pure functions of the dedupe key and a day offset, so a batched or repeated run lands on the same ids.

**Why ids come from hashes.** A second run happens at a different `now`, and time-derived rows would be new rows. With hash-derived ids the first run's rows stay put, and the dashboard's windows slide over them as days pass, which is acceptable for dev data.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass
- `pnpm typecheck` -- expected: clean
- `pnpm lint` -- expected: clean
- `pnpm build` -- expected: exit 0 (the field precache is untouched: dev-only worker code)

**Manual checks:**
- In `pnpm dev`, seed twice against a fresh `.wrangler` state and compare the four `COUNT(*)` values with `pnpm exec wrangler d1 execute captain-prospectus --local --command "…"` (never `--remote`). `/admin` shows non-zero Visites and deltas for 7, 30 and 90.
