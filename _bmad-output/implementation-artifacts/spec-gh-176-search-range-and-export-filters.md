---
title: 'Name search, the visits date range and the export filters (GH #176)'
type: 'feature'
created: '2026-09-27'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment', 'duplication-map']
review_loop_iteration: 0
baseline_commit: 'f7e6144f6fabb59f1867bb05e3e4f5c3029ab838'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/_bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three filters the rebuilt admin screens need do not exist on the API. `GET /api/admin/prospects` has no text filter, so Prospects cannot offer name search (server-gaps G4). The visits feed takes only `since`, so Visites cannot offer a date range (G5). And `prospects/export.csv` has its own narrower schema — a single `status` and no `dueBefore` — so once the screen can filter by several statuses or a due date, an export from that screen would silently return a different set of rows.

**Approach:** Add `q` to the prospects list, `from` and `to` to the visits feed over `received_at`, and bring the prospects export onto the same filter shape as the list so the two cannot diverge. All three are additive, read-only query params; nothing else about the API, the sync contract or the data model changes.

**Decision (2026-09-27):** `q` folds ASCII only, which is all SQLite's `LIKE` and `lower()` do. `?q=cafe` therefore does not match "Café", and `?q=CAFÉ` does not match "café" — an admin who types the accented name correctly finds it, and `docs/api.md` states the limit. Accent-insensitive search needs a stored folded column with its own index, a server-gaps row and a migration, all excluded by this epic's non-goals, so it is filed as its own story rather than hacked in here. Matching against `dedupe_key` was rejected: it is a composite of name, coordinates and address, so a needle could match address text, and it inherits GH #50, where a non-Latin name normalises to an empty string and would match every row.

## Boundaries & Constraints

**Always:** Every param is validated by a zod/mini schema in `src/shared/schemas.ts` — `.check(...)`, `z.optional(x)`, `z._default(x, v)`, never the classic chained API. Multi-value `status` uses the comma convention, not repeated keys. The feed filters and orders on `received_at`, never `visited_at`. `docs/api.md` changes in the same commit.

**Never:** No schema or migration, no new column, no index — the epic's non-goals allow only the listed server-gaps rows. Do not wire any of this into the client: `ProspectFilters`, `toQueryString` and `parseProspectFilters` gain `q` in #179, which builds the search box. Do not add `q` to the visits feed. Do not remove the 500-row export cap or change `x-truncated`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Name substring | `?q=bistro` with "Le Bistrot du Coin" | That prospect is returned | No error expected |
| Case | `?q=BISTRO` | Same match — folding is ASCII-only, see Open Questions | No error expected |
| `q` with other filters | `?q=bistro&status=new,assigned` | Both applied, and `total` counts the same filtered set | No error expected |
| `q` matches nothing | `?q=zzz` | Empty list, `total` 0 | No error expected |
| Merged prospect | `?q=` matching a merged row | Excluded, as the list already excludes merged | No error expected |
| Feed range | `?from=A&to=B` | Only visits whose `received_at` is within `[A, B]` | No error expected |
| Reversed feed range | `from > to` | 400 | Same message shape as the visits export |
| Feed range with `since` | both sent | All three bounds apply together | No error expected |
| Export matches the list | same query on list and `export.csv` | The same rows, up to the 500 cap | `x-truncated` unchanged |
| Export, several statuses | `?status=new,assigned` | Both statuses, as on the list | An empty item is 400, as on the list |

</frozen-after-approval>

## Code Map

- `src/worker/routes/admin.ts:554-583` — prospects list. Builds `filters[]` of ternaries then `const where = and(...filters)`, reused by the row select **and** the `count()` at `:578`. The `q` condition slots into that array. `like` is **not** imported at `:9-24`; add it.
- `src/worker/routes/admin.ts:1323-1356` — visits feed. Has no filters array: one inline `.where(since > 0 ? gt(...) : undefined)` at `:1351`. Converting it to the `filters[] + and(...)` shape is part of the work. Ordered `desc(receivedAt)`, and deliberately **not** filtered on `merged_into` (`:1329-1336`).
- `src/worker/routes/admin.ts:745-820` — prospects export. Uses push-style `filters` (`:754-757`) with `eq(status)`, and `.limit(EXPORT_ROWS + 1)` at `:765`.
- `src/worker/routes/admin.ts:1372-1426` — visits export. Already does `gte`/`lte` on `receivedAt` at `:1391`; it is the precedent for the feed's range and for the reversed-range 400.
- `src/shared/schemas.ts:253-296` — `statusListSchema`, `dueBeforeSchema`, `prospectsQuerySchema`. `:511-517` the feed's `visitsSinceQuerySchema`. `:728-732` `prospectsExportQuerySchema`, which is the divergence to close: singular `statusSchema`, no `dueBefore`. `:741-753` `visitsExportQuerySchema` — the pattern for a cross-field rule (`.check(z.refine(...))`) and for a now-relative default (`z._default(x, () => …)`).
- `schemas.ts:247-252` — the comment recording that a repeated query key yields only its last value, which is why `status` is comma-separated.
- `src/shared/constants.ts` — `EXPORT_ROWS` 500 (`:185`), `PROSPECTS_PAGE_SIZE` 200 (`:155`), `ADMIN_VISITS_PAGE_SIZE` 500 (`:99`), `D1_MAX_BOUND_PARAMS` 100 (`:236`). Every new filter adds 1–2 bound params; nothing is near the cap.
- `src/worker/export.test.ts:20-50` — the `call()` + `seedProspect()` house shape. `admin.test.ts:929-962` — `seedVisit(name, receivedAt, outcome)` and `feed(query)`, which exist precisely because `received_at` must be controlled. Existing names to keep green: `export.test.ts:129` "filters exactly as the list screen does" (passes `?status=converted`, which a one-item list still parses), `admin.test.ts:95`, `:120`, `:969`.
- `docs/api.md:26,30,36,40` and the limits prose at `:71-73` — the rows to update.
- **Do not change:** `src/client/**` (the client wiring is #179), the `prospects` table, any index, the export cap.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts` — add a `q` schema (trimmed, non-empty, length-capped) and put it on `prospectsQuerySchema`; add `from`/`to` to the feed's schema with the reversed-range refine, matching `visitsExportQuerySchema`'s idiom; rewrite `prospectsExportQuerySchema` to carry the list's `status` list, `dueBefore`, `assignedTo`, `source` and `q`
- [ ] `src/worker/routes/admin.ts` — add the `q` condition to the list's filters array; convert the feed to a filters array and apply `from`/`to` on `receivedAt` beside `since`; extend the export's filters to the list's full set
- [ ] `src/worker/admin.test.ts` — cover `q` as a substring, its case behaviour, `q` combined with `status`, `total` counting the filtered set, a merged row staying excluded, and the feed's range including the reversed-range 400 and range-plus-`since`
- [ ] `src/worker/export.test.ts` — cover the export returning the same rows as the list under each filter, several statuses, and `dueBefore`; keep the existing single-status case green
- [ ] `docs/api.md` — document all three, and state that the feed's range is on `received_at` (when the server took the visit), not when it happened

**Acceptance Criteria:**
- Given the same query string, when it is sent to the prospects list and to `prospects/export.csv`, then both return the same rows up to the export cap.
- Given a visits-feed request whose `from` is after its `to`, when it is validated, then the answer is 400 and no rows are read.
- Given `q` and `status` together, when the list answers, then `total` counts the set both filters select, not either alone.

## Implementation Notes

**Two rounds of defects before review, both found by probing the built route against real D1 rather than reading the report.**

Round one: the `q` predicate was `like(sql`lower(name)`, `%${q.toLowerCase()}%`)`, which folds the two sides by different rules — JavaScript's `toLowerCase()` is Unicode-aware, SQLite's `lower()` is ASCII-only. Seeding "Café du Port" and "CAFÉ DU MIDI" showed every accented needle reaching only the first, so a row's findability depended on how it happened to be cased, and `?q=CAFÉ` could not find its own exact name. Fixed by dropping both the wrapper and the JS lowercasing: SQLite's `LIKE` folds ASCII symmetrically by itself. The same probe showed `%` and `_` arriving as live wildcards — `?q=_` matched every row — so the needle is now escaped with an `ESCAPE` clause. The escape character escapes itself too, which is not optional: without it a name like "Chez Paul!" is unsearchable.

Round two, after review: `?to=` coerced to 0 and returned an empty feed that read as "no visits", because `from`/`to` used bare `z.coerce.number()` while `dueBefore` already had a strict decimal-digit pipe for exactly that reason. All three now share it; `since` deliberately keeps its looser coercion, being a deployed cursor that could not be tightened additively.

**Final behaviour, verified end to end after the refactor:**

| needle | matches |
|---|---|
| `café` | "Café du Port" |
| `CAFÉ` | "CAFÉ DU MIDI" |
| `cafe` | nothing — the documented ASCII-only limit |
| `Paul!` | "Chez Paul!" |
| `%`, `_` | only the rows containing those literals |

**A note on the escape character.** It is `!` rather than the conventional `\`. The implementer's first comment attributed that to D1's SQLite parsing `'\'` as an escaped quote, which is not a SQLite behaviour — the backslash was almost certainly being consumed at the JavaScript string-literal level in their own source. The comment was rewritten so a future reader is not told a false fact about the platform, and so nobody narrows the escaped character class on the strength of a claim that `!` needs no escaping of its own. It does.

**Review pass 1 outcome.** Five lenses, 27 findings, no `high` and no loopback. Ten patches applied and re-verified, eleven deferred to `deferred-work.md`, four rejected on their refutation. The two most valuable came with demonstrations: narrowing the escape class, and flipping the range to exclusive bounds, each left 102 worker tests passing. Two structural findings were also patched — the list and the export now share one predicate builder and one filter schema rather than maintaining parity by hand, and both order by `updated_at` with `id` as a tiebreaker, without which this story's own "same query string, same rows" criterion rested on undefined ordering.

Final: typecheck clean, 1664 tests green across 67 files, lint clean.

## Spec Change Log

## Review Triage Log

### Pass 1 (2026-09-27) — thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment, duplication-map

Verdicts: high 0 · medium 7 · low 14 · false 2 · maybe-false 0. Routed: patch 8, defer 11, rejected 4.

| Verdict | Finding | Evidence | Route |
|---|---|---|---|
| medium | `?to=` blank coerces to 0, so the feed returns an empty list that reads as "no visits" | `from`/`to` use bare `z.coerce.number()` (`schemas.ts:528-529`) while `dueBeforeSchema` insists on `/^\d+$/` precisely because "coercion alone would read `\"\"`, `\" \"`, `\"1e3\"` and `\"0x10\"` as numbers". `Number("")` is 0 and passes `nonnegative()`. One query string now carries two notions of a numeric param: `?dueBefore=1e3` is 400, `?from=1e3` is accepted. | patch |
| medium | List and export order by `desc(updated_at)` with no tiebreaker, so "the same rows on both" is not guaranteed at the cap | A batch import stamps one identical `now` on every row, so which 500 survive `EXPORT_ROWS` is undefined, and list paging is unstable for the same reason. Pre-existing, but this change's AC1 now depends on it. | patch |
| medium | The export silently drops `limit`/`offset`, so an export built from a paged list URL returns the first page | `prospectsExportQuerySchema` has no `limit`/`offset` and zod strips unknown keys. Exporting the whole filtered set is the right behaviour, but AC1's "same query string, same rows" reads as though offset were honoured, and #179 builds that button. | patch |
| medium | The escape character is escaped but nothing pins it | Pre-verified with a demonstration: narrowing the class to `/[%_]/` makes `?q=Paul!` search for a literal `%`, so "Chez Paul!" becomes unfindable in both routes — and 102 worker tests still passed. The helper's own comment says "Do not narrow that character class". | patch |
| medium | `from`/`to` are inclusive but no test touches either bound | Pre-verified with a demonstration: changing `gte`/`lte` to `gt`/`lt` kept 102 tests green. Both new range tests use strictly interior values. Day-boundary ranges are exactly where an off-by-one bites. | patch |
| medium | `searchQuerySchema`'s docstring describes a `lower()` fold the code does not do | Flagged independently by four lenses. `schemas.ts:279` says "folded with SQLite's `lower()`"; `nameSearchFilter` spends a paragraph explaining no `lower()` is used or wanted. The shared contract file is what a route author reads. | patch |
| medium | Parity between the list and the export is still hand-maintained, which is the one thing the intent said to make structural | The six-predicate filter list is written twice (`admin.ts:580-590` ternary array, `:776-781` if/push) and the five filter fields twice (`schemas.ts:286-291`, `:751-756`). This change created three of those copies. Only `q`'s matching semantics are shared. Adding a seventh filter still needs both sites remembered. | patch |
| low | `prospectsExportQuerySchema`'s docstring still says "the same three filters as the list screen" | It now carries five. The prose justifying the schema is the one thing the diff left stale. | patch |
| low | `docs/free-tier-budget.md` has no row for the new unindexed double scan | That file budgets unindexed filters with explicit row math (it does exactly this for the area search). `q` scans an unindexed `name` twice per search, once for rows and once for `count()`. INVARIANT 13's home is that file. | patch |
| low | The domain docs were not updated | `docs/domains/prospecting.md` still describes the export as "filtered exactly as the list screen filters it" with no name search, and `docs/domains/field-operations.md` documents only the visits export's range, not the feed's. CLAUDE.md's definition of done requires the domain doc in the same change. | patch |
| low | The `from`/`to` bounds and the reversed-range refine are written twice | `schemas.ts:528-529,535-540` re-spells what `visitsExportQuerySchema:768-779` already has, including `"from must not be after to"` and `path: ["from"]` verbatim. The new test already treats them as one rule ("the same message shape as the visits export"). The *defaults* legitimately differ and stay. | patch |
| medium→defer | A range holding more than 500 visits returns the newest 500 with no truncation signal | Real: the feed caps at `ADMIN_VISITS_PAGE_SIZE` and, unlike the exports, sets no `x-truncated`. With `since` paging that was invisible; with an explicit range an admin can believe they see the whole window. #178 builds Visites' pagination and must handle it. | defer |
| low | `from` is inclusive while `since` stays exclusive | Verified. A client paging with `from = lastSeenReceivedAt` re-reads that visit. Deliberate — `from`/`to` mirror the visits export's inclusive window — but undocumented. Folded into the docs patch as one sentence rather than changed. | defer |
| low | `q` is trimmed and capped only because it aliases `shortTextRequired`, and nothing asserts either | Pre-verified: a padded `q` matches today. The regression needs someone rewriting the alias. Two assertions would close it. | patch |
| low | "received_at, not visited_at" is now stated in five places | This change added one. CLAUDE.md: "a rule has one home". | defer |
| low | The worker test harness is copied per file | `call()` in 8 files plus 4 inlined bodies; `ADMIN`/`AGENT` in 8; the FK-order `beforeEach` in several. Pre-existing, and no `src/worker/test-utils.ts` exists to move them into — this one needs a home created. | defer |
| low | `seedVisit` and `seedProspect` each name several unrelated contracts | `seedVisit(name, receivedAt, outcome)` creates a prospect and a visit in `admin.test.ts`; `seedVisit(prospectId, over)` inserts only a visit in `export.test.ts`. Both new test blocks call a `seedVisit` — different ones. `seedProspect` has five signatures. Pre-existing. | defer |
| low | `sync.test.ts:19` sets `const AGENT = "admin@example.com"` | The same identifier is `agent@example.com` in seven other worker test files. Pre-existing, and actively misleading. | defer |
| low | `admin.ts:1672` validates a visit id with `prospectIdParamSchema` | Its sibling repair route uses `visitIdParamSchema`, which exists for exactly this subject. Identical shapes hide it. Pre-existing, no wrong behaviour. | defer |
| low | The CSV truncate-and-slice tail and the `Response` construction are written twice | Both exports predate this change. `src/shared/csv.ts` can own the cap but not the `Response` — it declares itself a pure module with no Worker APIs. | defer |
| low | The two import provider routes share ~60 near-identical lines | Untouched here, and documented as deliberate: "The other provider, deliberately the same route in every way it can be". Accepted, not a finding. | defer |
| low | Three of the eight new `q` tests overlap | `q=BISTRO` is subsumed by the accent test, and `q=zzz` by `q=cafe`. Harmless redundancy in a suite that is cheap to run. | defer |
| false | `SearchPalette` still claims search is not built | Accurate: the palette is inert by design (G9 ships the bell and ⌘K inert), and `q` is a filter-bar param. Nothing to correct. | rejected |
| false | `src/client/admin/queries.ts` gains no `q`, so the filter is unreachable | Excluded by the intent's Boundaries in terms: the client wiring is #179, which builds the search box. | rejected |
| low | The accent behaviour is narrower than the intent's rationale claimed | Correct, and the diff is the more honest of the two: the intent said an admin "who types the accented name correctly finds it", but the row's casing on the accented letters must match too. SQLite's `lower()` would behave identically, so no in-scope implementation supports the stronger claim. `docs/api.md` and a test state the real behaviour. | rejected |
| low | The `q=du` assertion depends on `desc(updated_at)` tie-breaking between two rows from one import | Real but fixed as a side effect of the ordering patch above, which makes the order deterministic. | rejected |


## Design Notes

`%q%` on `prospects.name` can use no index — there is none on `name`, and a leading wildcard would bypass one anyway — so it scans the merge-filtered set. The list evaluates its WHERE twice, once for the rows and once for `count()` at `admin.ts:578`, so a search costs that scan twice, and D1 bills scanned rows (`docs/free-tier-budget.md`). Accepted at this project's scale — two agents canvassing one city — but it is the reason not to add `q` to the 500-row visits feed as well.

The export's `status` goes from one value to a comma list. That is not a wire break: `statusListSchema` accepts a bare `?status=converted`, which is what `export.test.ts:129` sends.

## Verification

**Commands:**
- `pnpm typecheck` — expected: clean
- `pnpm test` — expected: all green, with the new worker cases passing and `export.test.ts:129` and `admin.test.ts:95,120,969` still green
- `pnpm lint` — expected: clean

**Manual checks (if no CLI):**
- `docs/api.md`'s four touched rows read consistently with the schemas, and the feed row says `received_at` explicitly.
