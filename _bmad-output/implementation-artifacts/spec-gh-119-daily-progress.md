---
title: 'Daily progress on Tournée du jour (GH #119)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 1
baseline_commit: 'cc1295cfa4b93bc2a39cd715433fd319490866ba' # re-stamped at PR time; was acfb094d994fb732bd5eee45325e8f6c011a0eb3 until origin/main moved 5 commits ahead and was merged in
context:
  - '{project-root}/.claude/skills/sync-contract-change/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tournée du jour cannot say how much of the round is done. The outbox
deletes a visit as soon as the server accepts it (invariant 5) and each pull replaces
`prospects` wholesale, so the phone forgets every visit it recorded today — server-gap
G8. EXPERIENCE.md asks for "{n} visites sur {total} aujourd'hui" with a bar.

**Approach:** A client-only Dexie log of the visit ids queued today, written on the same
write path as the outbox row and read back for the count. `n` is that log unioned with
the pending outbox rows, deduplicated by visit id; `total` is `n` plus the stops still on
today's list. No sync-contract change and no server change (G8 is settled: Dexie only).

**Decision — the log is Dexie version 4, not 3.** The story text says version 3, but
backlog #005 (`writtenBy` outbox stamps, merged as `acfb094`) already took version 3.
Version 3 is on `main` and must not be re-cut; the log is a new version on top of it.
The upgrade path to prove therefore spans v2 → v4 as well as v3 → v4.

**Decision (2026-09-26, user) — "today" is a Europe/Brussels calendar day**, from
`brusselsPeriod(now, 1).from` in `src/shared/period.ts`, not the device's local midnight
the story assumed. `period.ts` calls itself the one home of the day boundary and the admin
dashboard counts "Visites aujourd'hui" with it, so the agent's count and the admin's can
never disagree. It costs ~2 KB in the field entry chunk; its `Intl` machinery is already
there through `format.ts`.

**Decision (2026-09-26, user) — `n` counts only the signed-in identity's rows.** The
outbox side of the union is filtered with the existing `sendableBy(identity)`, so on a
shared phone the line is the signed-in agent's own progress, the way the band already
splits pending from held-back. An unstamped row from before v3 still counts, as
`sendableBy` says: it belongs to whoever syncs it first.

## Boundaries & Constraints

**Always:**
- **Invariant 5.** A `version(4)` upgrade adds a store and touches no existing one, so
  Dexie carries every row across and no upgrade function runs near the outbox — the same
  shape v2 used, for the reason its comment gives. `sync-contract-change` step 3.
- **Invariant 2 and 3.** The log is read-only knowledge for rendering. It never deletes
  an outbox row, never hides or reorders a stop, and never implies a status.
- The log write and the `outboxVisits.add` are one function and one Dexie transaction: if
  the row is not queued, nothing is logged, and the caller still learns the write failed.
- **Invariant 15.** Every French string in `copy.ts`.
- **ADR-0026.** Quote the precache total and the entry chunk. Baseline: precache
  680.61 KiB, entry `index-*.js` 514.87 kB / 165.22 kB gzip (spec-gh-118).
- **ADR-0014.** The bar is the vendored `src/client/ui/progress.tsx`, not hand-rolled.

**Never:**
- No sync-contract change: no `clientVersion` bump, no payload or response field, nothing
  new on the wire. The log is device-local and never sent.
- Never let the log gate outbox deletion, and never write the log from `runSync`.
- No percentage, no ETA, no "restants" on screen (EXPERIENCE.md).
- Not the save sheet (story 117.8) — this story only *exposes* the queueing function it
  will call. `VisitScreen` is repointed at that function and otherwise untouched.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Two queued, one accepted | 2 visits queued today; a sync accepts 1, deleting its outbox row | n = 2. The log still holds both ids | No error expected |
| Next day | Log holds yesterday's ids; today none | n = 0; yesterday's rows are pruned, not counted | No error expected |
| Other agent's row | A pending outbox visit stamped `writtenBy: b@…`, signed in as `a@…` | Not counted (`sendableBy`) | No error expected |
| Clock change | A log row at 00:30 CEST the day the clocks go back | Still today: the boundary is `brusselsPeriod(now, 1).from`, not `now − 24 h` | No error expected |
| Union, not sum | A visit is in the log *and* in the outbox | Counted once (dedupe by visit id) | No error expected |
| Pre-v4 outbox row | Outbox row from an older build, no log entry | Counted from the outbox alone | No error expected |
| v2 → v4 upgrade | v2 database holding outbox visits and prospects | Every row intact; `writtenBy` stamped from the cached identity; log store empty | Upgrade must not clear the outbox |
| v3 → v4 upgrade | v3 database holding stamped outbox rows | Every row and every stamp intact; log store empty | As above |
| Empty round | No stops, no log | The line and the bar are absent | No error expected |
| Queue write fails | `outboxVisits.add` throws (quota) | Nothing logged, nothing queued, the caller is told | Rejects; `VisitScreen` keeps its `setSaveFailed` path |

</frozen-after-approval>

## Code Map

**Read `### Pass 2 — shipped

- Re-derived from the amended spec by a fresh pwa-engineer subagent, then patched for the eleven
  pass-2 review findings by the same agent (`## Review Triage Log`, pass 2). No second loopback: pass
  2 produced no intent_gap and no bad_spec.
- `SentVisit = { id, prospectId, sentAt, writtenBy }` at Dexie `version(4)`, add-only. `queueVisit`
  holds the outbox `add` and the log `put` in one transaction with the multi-row prune outside it.
  `todaysSentVisits` reads `between(from, to)`.
- `total` is the size of the **union** of counted prospect ids and the stop ids still listed — not
  `n` plus the uncounted stops. That one change closed both the repeat-visit case and the
  stop-that-left-the-list case, and is simpler than the formula it replaced; I had wrongly recorded
  the repeat-visit case as an unavoidable residual in pass 1.
- The outbox half of `n` is bounded by each visit's `visitedAt` against the same Brussels day the log
  is bounded by. Without it an agent offline overnight read yesterday's unsent visits as today's.
- `clearAgentCache` now clears `sentVisits`. Pass 1's spec said not to touch it; that reasoning was
  about the count, and it left another agent's visit ids, prospect ids and email on a revoked device.
- Deliberately not asserted: `aria-valuenow` on the bar. The vendored `Progress` never forwards
  `value` to the Radix root — pre-existing on `main`, shared with the admin import screens, filed as
  issue #147 — so the indicator's inline transform is where the percentage lands, and that is what
  `DailyProgress.test.tsx` checks, with a comment saying why.
- Documented residuals: a visit whose stop has left today's list still holds its place in `total`
  (correct — it is the day's round); and `runSync`'s `idMap` rewrite reaches the outbox's
  `prospectId` but not the log's, so a deduped field prospect visited the same day loses its
  exclusion. The frozen block's "never write the log from `runSync`" rules out fixing the latter here.
- Files: `db.ts`, `db.test.ts`, `progress.ts`, `progress.test.ts`, `DailyProgress.tsx`,
  `DailyProgress.test.tsx`, `TodayScreen.tsx`, `TodayScreen.test.tsx`, `VisitScreen.tsx`, `copy.ts`,
  `docs/domains/field-operations.md`, `docs/design.md`.
- **Verified in this session, after the patches:** `pnpm lint`, `pnpm typecheck`, **1,175 tests /
  55 files**, `pnpm build`, `pnpm check:precache` — all green. Precache **690.74 KiB**, 14 entries
  (baseline 680.61 KiB, **+10.13**) against the 1,000 KiB ceiling. Entry `index-*.js` **521.84 kB /
  167.65 kB gzip** (baseline 514.87 / 165.22, **+6.97 / +2.43**). The growth is `period.ts` plus
  `radix-ui/progress`, which the field entry chunk did not previously carry.

### Post-merge (2026-09-26)

- `baseline_commit` re-stamped per team policy: `origin/main` had moved five commits ahead (#139, #141,
  #144, #143, #145) and was merged into the branch, so the merge-base moved from `acfb094` to
  `cc1295c`. The old value is kept in the frontmatter comment.
- The merge touched `VisitScreen.tsx` heavily (#145) and brought a new `VisitScreen.test.tsx`. Git
  merged cleanly and kept the `queueVisit` call site, verified by hand. Two follow-ups this made
  necessary, committed separately: that suite's `afterEach` now clears `sentVisits` (its save tests
  write there through `queueVisit`, so rows leaked between tests), and it now asserts the log row
  beside the outbox row — the end-to-end coverage triage row 4 had to settle for a source-text pin
  for. Mutation-checked: reverting the save to a bare `outboxVisits.add` fails that test and the pin,
  and nothing else in either file. This closes deferred triage row 17 behaviourally.
- **Verified on the merged tree:** `pnpm lint`, `pnpm typecheck`, **1,244 tests / 57 files**,
  `pnpm build`, `pnpm check:precache` — all green. Precache **699.80 KiB**, 16 entries, against the
  1,000 KiB ceiling. Entry `index-*.js` **386.07 kB / 123.02 kB gzip** — lower than before the merge,
  because #141/#144 moved the Visite steps into lazy chunks. This change's own measured cost, taken
  against its own baseline before the merge, was **+10.13 KiB** precache and **+6.97 kB / +2.43 kB
  gzip** on the entry chunk (`period.ts` plus `radix-ui/progress`).

## Spec Change Log` before starting.** This is pass 2: pass 1's code was reverted after
review, and its KEEP list names what must survive unchanged.

- `src/client/field/db.ts` -- add `version(4).stores({ sentVisits: "id, sentAt" })`, add-only with no
  upgrade function; say why, deriving it from the `version(2)` comment at :69. The row is
  `SentVisit = { id: string; prospectId: string; sentAt: number; writtenBy: string }` — `id` is the
  visit id and the primary key (so the union with the outbox dedupes for free), `prospectId` is the
  stop (so the denominator can exclude a stop already counted), `writtenBy` is the identity (so the
  log side is filtered exactly like the outbox side). `prospectId` and `writtenBy` need no index: the
  store holds one day of one agent's visits, read whole.
  Private `dayStart(now)` = `brusselsPeriod(now, 1).from`.
  `queueVisit(db, visit, identity)` — the one queueing function. Transaction over `outboxVisits` and
  `sentVisits` holds exactly two writes, the `add` and the log `put`, per the frozen block's "one
  function and one Dexie transaction". **The prune does not belong in it**: a multi-row delete in the
  visit's critical path is the one part that could roll a queued visit back for bookkeeping's sake
  (invariant 5). Prune after the transaction commits, and let that failure pass silently — the read
  is bounded, so an unpruned row is invisible either way.
  `todaysSentVisits(db, now)` returns the `SentVisit` rows in `between(dayStart(now), brusselsPeriod(now, 1).to)`
  — **bounded at both ends**, so a row stamped by a phone whose clock runs ahead cannot count today
  and again tomorrow. Do not touch `clearAgentCache`: stamped rows already keep agent A's count away
  from agent B, and keeping them means A's count is still there when A signs back in, which is how
  `writtenBy` already works for the outbox.
- `src/client/field/progress.ts` (new) -- `dailyProgress({ logged, outboxVisits, identity, stops })`
  → `{ n, total, percent }`. Both sides filtered with `sendableBy(identity)` from `db.ts`, one
  definition of "mine". Build two sets while walking them: visit ids (→ `n`) and the prospect ids
  those visits belong to. `total = n + stops.filter((s) => !countedProspectIds.has(s.id)).length`, so
  a stop whose visit is already in `n` is never added again and the denominator holds still as the
  agent works. `percent` rounded; 0 when `total` is 0. `stops` is `readonly { id: string }[]`.
- `src/client/field/DailyProgress.tsx` (new) -- the line and the bar. `<Progress>` from
  `../ui/progress` with `className="bg-secondary"` (the mock's track is `--secondary`; the component
  defaults to `bg-primary/20`) and an `aria-label` from `copy.ts`, since the bar carries the
  information and Radix gives the root no name of its own. Text `tnum text-base font-semibold`.
  Renders `null` when `total` is 0. Take one `progress` object as a prop rather than three numbers.
- `src/client/field/TodayScreen.tsx` -- already live-queries `outboxVisits` (:79) and derives
  `queuedVisitProspectIds`. Add `useLiveQuery(() => todaysSentVisits(fieldDb, Date.now()), [now], [])`
  — **`Date.now()` inside, not the screen's `now`**: `now` is `lastSyncAt ?? openedAt` (:75) and is
  days stale offline, which would put yesterday's rows inside today's window. `[now]` stays as the
  refresh trigger. Call `dailyProgress` with `stops: list.now`, and render `<DailyProgress>` between
  the `<header>` and the notices — the mock's order.
- `src/client/field/VisitScreen.tsx:244` -- replace the bare `outboxVisits.add` with `queueVisit`.
  Keep the surrounding try/catch and its comment verbatim: it is the invariant-5 explanation for why
  a failed write must not navigate.
- `src/client/copy.ts` -- `today.progress(n, total)` → `"{n} visites sur {total} aujourd'hui"`,
  **singularising like its neighbour `today.remaining` two lines up**: `1 visite`, `2 visites`. Add
  `today.progressLabel` for the bar's `aria-label`.
- `src/shared/period.ts` -- `brusselsPeriod` gives both ends of the day. Worker-only until now, so
  importing it adds ~2 KB to the field entry chunk. Do not edit it.
- `src/client/field/db.test.ts` -- pass 1's upgrade harness is in the KEEP list: `openV2`/`openV3` at
  module scope, both upgrade tests, the DST test and the "reads nothing back the next morning" test.
  Reinstate them as they were and add to them.
- `src/client/field/TodayScreen.test.tsx` -- mock `useSyncState` must also return `identity`, and
  `afterEach` must clear `sentVisits`.
- `docs/domains/field-operations.md:56` -- the "Local store (Dexie)" table gains a `sentVisits` row;
  the paragraph below gains the "counted, never deleted" rule, the Brussels boundary and the
  identity rule. Only claim what the code does.
- `docs/design.md:775` -- the Tournée sketch and the Next-stop card section gain the line and bar
  above the card. Keep the box interior at 34 columns and **make the sketch's own arithmetic
  consistent**: with "5 arrêts" in the header the line reads "2 visites sur 5", and the bar is filled
  to that fraction. `design.md:135` already documents `progress.tsx`'s gold indicator — do not
  restate it.

**Do not change:** `src/client/field/sync.ts`, `today.ts`, `StopRow.tsx`, `NextStopCard.tsx`,
`src/client/ui/progress.tsx` (its unforwarded `value` is a pre-existing bug, deferred),
`src/shared/schemas.ts`, `src/shared/constants.ts`, anything under `src/worker`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/db.ts` -- version 4 store, `SentVisit` with `prospectId` + `writtenBy`, `queueVisit` (prune outside the critical transaction), `todaysSentVisits` bounded both ends -- G8, invariant 5, triage rows 2, 4, 7
- [ ] `src/client/field/db.test.ts` -- reinstate the KEEP'd tests, then add: `queueVisit` writes both rows and stamps both; a log row survives a failed outbox write being absent (row 10); a future-stamped row is outside today's window (row 7); the prune failing does not lose the queued visit (row 4)
- [ ] `src/client/field/progress.ts` + `progress.test.ts` -- the count, the stop-exclusion denominator and its edge cases -- matrix rows 1, 2, 3, 5, 6, 9 **plus** the overlap case: a visit logged today whose `prospectId` is a stop still in `stops` must leave `total` unchanged (triage row 1); and a log row written by another identity must not count (triage row 2)
- [ ] `src/client/field/DailyProgress.tsx` -- the line, the bar, the `aria-label` -- CAP-6, triage row 8
- [ ] `src/client/copy.ts` -- `today.progress` with singular/plural, `today.progressLabel` -- invariant 15, triage row 5
- [ ] `src/client/field/TodayScreen.tsx` -- wire the log on a live clock, pass `stops`, render the component -- CAP-6, triage row 3
- [ ] `src/client/field/VisitScreen.tsx` -- queue through `queueVisit` -- one write path (epic Notes, 2026-09-26)
- [ ] `src/client/field/TodayScreen.test.tsx` -- DOM: on a 5-stop round with 2 visits logged today for two of those very stops, the line reads "2 visites sur 5" and stays there when a sync empties the outbox. **The second assertion must observe a real re-render** — pass 1's was vacuous because `findByText` was already satisfied by the first assertion's DOM, so seed a third outbox row absent from the log (n = 3), then clear the outbox and assert the line changes to n = 2. Also: "1 visite" singular; no line on an empty round; a finished round reads "n visites sur n" -- triage rows 1, 5, 6
- [ ] `docs/domains/field-operations.md`, `docs/design.md` -- the store table and the Tournée section, sketch arithmetic consistent -- definition of done

**Acceptance Criteria:**
- Given a 5-stop round and no network, when the agent records a visit on each of three stops in turn, then the line reads "1 visite sur 5", then "2 visites sur 5", then "3 visites sur 5" — the denominator never moves and the bar advances.
- Given a v2 database holding three unsynced visits and an unsynced field prospect, when the new build opens it, then all four rows survive with their `writtenBy` stamps and `sentVisits` exists and is empty.
- Given two visits logged today by `a@example.com` and the phone now signed in as `b@example.com`, when Tournée du jour renders, then the line counts none of them.
- Given the app offline at 390 px and 820 px, light and dark, when Tournée du jour opens on a seeded round with a log, then the line and the gold bar sit above the next-stop card as in `key-f1-tournee.html`, with no percentage and no "restants".
- Given the branch, when `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm check:precache` run, then all pass and the PR quotes the precache total and the entry chunk against 680.61 KiB / 514.87 kB.

## Implementation Notes

### Pass 1 — reverted after review (kept as history)

Pass 1's code was reverted on the bad_spec loopback; see `## Spec Change Log` entry 1. Recoverable
from git stash `8a9fdc664552a650d8778f21e7dbf5099892bddb` (tag `gh119-pass1-review-revert`). The
figures below were measured against pass 1 and are re-measured in pass 2.

- Implemented by a pwa-engineer subagent from this spec. `sentVisits: "id, sentAt"` at Dexie
  `version(4)`, add-only with no upgrade function — the v2 shape, for the reason v2's comment
  gives. `queueVisit` is one `rw` transaction over `outboxVisits` + `sentVisits` (add the
  stamped row, prune below `dayStart`, put the log row), so a rejected write rolls both back
  and `VisitScreen`'s invariant-5 try/catch keeps its meaning. `dayStart` is private and wraps
  `brusselsPeriod(now, 1).from`.
- **Audit patch (this session, 2 changes).** Matrix row 2 was half covered: the prune-on-write
  test proved `queueVisit` drops yesterday's rows, but nothing asserted the *read* boundary —
  an agent opening the app next morning before recording anything, which is the half that
  actually shows 0. Added `db.test.ts` "reads nothing back the next morning, before the prune
  has run". Verified it is a real guard by mutation: replacing the read's
  `.where("sentAt").aboveOrEqual(dayStart(now))` with `.toArray()` fails that test and only
  that test (17 others in the file still passed). Also redrew the `design.md` sketch's bar to
  12/31 filled, since 8/31 read as 26 % beside its own "2 visites sur 5"; box interior stays
  34 columns.
- `progress.ts` imports `sendableBy` from `db.ts`, so its "pure, tested without Dexie" claim is
  weaker than the spec's wording: `db.ts` constructs `fieldDb` at module scope. Harmless (no
  `open()`, and the suite is green) but noted for review rather than fixed, since moving
  `sendableBy` is outside this story.
- `key-f1-tournee.html` does exist, at
  `_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/`; the
  implementer reported it missing because `_bmad-output` is a gitignored symlink in this
  worktree. Checked against it here: the mock puts the bold `tnum` line and an 8 px
  `--secondary`-track / `--primary`-fill bar between the header and the next-stop card, which
  is what shipped. The device check itself stays story 117.12.
- Files: `db.ts`, `db.test.ts`, `progress.ts`, `progress.test.ts`, `DailyProgress.tsx`,
  `TodayScreen.tsx`, `TodayScreen.test.tsx`, `VisitScreen.tsx`, `copy.ts`,
  `docs/domains/field-operations.md`, `docs/design.md`.
- Size, verified in this session: precache **690.33 KiB**, 14 entries (baseline 680.61 KiB,
  **+9.72**), ceiling 1,000 KiB. Entry `index-D8opRVBj.js` **521.40 kB / 167.51 kB gzip**
  (baseline 514.87 kB / 165.22 kB, **+6.53 / +2.29**). `pnpm lint`, `pnpm typecheck`,
  **1,163 tests**, `pnpm build` and `pnpm check:precache` all green.

## Spec Change Log

**Entry 1 — pass 1 review, triage rows 1–8 (2026-09-26).**

*Triggering findings.* Row 1 (high): `total = n + list.now.length` double-counts a stop the moment
its visit is logged, because the round deliberately keeps a queued stop on the list; a live probe
read "1 visites sur 6" on a 5-stop round, and `interested`/`no_contact` → `follow_up` (an OPEN
status) means the stop persists after the pull too, so the inflation is permanent, not transient.
Row 2 (high): `SentVisit = { id, sentAt }` carries no writer and `clearAgentCache` does not clear the
store, so agent B inherits agent A's count on the shared phone the story exists for — contradicting
the frozen intent and the change's own new doc line.

*What was amended.* Code Map, Tasks & Acceptance, Design Notes and Verification only; the frozen
block is untouched. `SentVisit` gains `prospectId` and `writtenBy`; `dailyProgress` takes the logged
rows and the stops themselves instead of a bare count, and excludes an already-counted stop from the
denominator; the read is bounded at both ends and uses a live clock; the prune leaves the visit's
critical transaction; and rows 5–8 (plural, vacuous assertion, unclamped `sentAt`, missing
accessible name) are folded in as named tasks.

*Interpretation, confirmed with the owner.* The frozen Intent's "`total` is `n` plus the stops still
on today's list" is EXPERIENCE.md:146's own wording and admits two readings. The mock resolves it:
`key-f1-tournee.html` shows "5 visites sur 17" beside a header of "17 arrêts", which `n + list
length` cannot produce, and EXPERIENCE.md:284 reads the same way. The owner confirmed the stable
round-size reading on 2026-09-26. The frozen sentence therefore stands; only the mechanism the Code
Map prescribed for it was wrong.

*Known-bad state this avoids.* A progress bar that cannot advance while the agent is offline — the
one condition the app is built for — and a shared-phone count that silently attributes one agent's
round to the other.

*KEEP — these survived review and must survive re-derivation.*
1. Dexie `version(4)` add-only with no upgrade function, and its comment deriving that from the
   `version(2)` precedent. Both upgrade tests (v2 → v4, v3 → v4) asserting every outbox row and
   every `writtenBy` survives and `sentVisits` opens empty — triage found nothing wrong with them.
2. `openV3` as a hand-copied snapshot of the real v3 upgrade rather than an import, with the comment
   saying why. Verified to match `db.ts` as it stands.
3. `queueVisit` as the single queueing function, with `VisitScreen`'s try/catch and its invariant-5
   comment preserved verbatim at the one repointed call site.
4. `dayStart` wrapping `brusselsPeriod(now, 1).from`, private to `db.ts`, with its comment on why the
   admin dashboard's boundary is reused.
5. The DST test (a row logged 00:30 CEST on the fall-back day) and the read-boundary test added
   during the step-3 audit ("reads nothing back the next morning") — both are real guards, each
   proved by mutation.
6. `docs/design.md`'s and `field-operations.md`'s placement in the sections the Code Map names, and
   the 34-column ASCII box. The sketch's own arithmetic must match whatever formula ships.
7. Rendering nothing when there is nothing to count, and no percentage or "restants" as text.


## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map
skipped — its gate is refactor/cleanup sweeps and this story adds one behaviour). Counts: high 2 ·
medium 3 · low 4 · false 1 · maybe-false 0 · rejected-low 2 · deferred 3. Two bad_spec entries, so
this pass ends in a loopback.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | BH, ECH, VG, IA | `total = n + list.now.length` counts a stop twice once its visit is logged: the round's own screen keeps a queued stop on the list (`today.ts` sets `visitQueued`, never removes), so n and stopsRemaining both include it | high | bad_spec | Verified two ways: VG probed a live render and got "1 visites sur 6" on a 5-stop round after one `queueVisit`; and `interested`/`no_contact` → `follow_up`, an OPEN status (`constants.ts:63-71`), so the stop persists after the pull too — the inflation is not even transient. `design.md`'s own new sketch ("5 arrêts" / "2 visites sur 5") is unproducible by this code |
| 2 | BH, ECH, VG, IA | `sentVisits` carries no writer and `clearAgentCache` does not clear it, so agent B inherits agent A's count on the shared phone the story is built for | high | bad_spec | VG probed it: after `clearAgentCache` and an identity switch the screen settles on "2 visites sur 3", and `sentVisits.count()` is still 2. Contradicts this change's own new line in `field-operations.md` ("only this identity's rows count") and the frozen intent |
| 3 | BH, ECH, IA | The read boundary comes from `now = lastSyncAt ?? openedAt`, which is days stale offline, so after midnight yesterday's un-pruned rows fall inside "today" | medium | bad_spec | Real: `TodayScreen.tsx:77` feeds that value to `todaysSentVisitIds`. The new row-2 test passes a correct `now` directly, so it proves the `where` clause, never the argument the component supplies. Folded into the same amendment |
| 4 | BH, ECH | `queueVisit` runs the log write and prune in the same transaction as `outboxVisits.add`, so a `sentVisits` quota failure rolls the visit back and `VisitScreen` reports it unsaved — a visit lost to bookkeeping (INVARIANT 5) | medium | bad_spec | Real and untested in that direction. The frozen block requires the `add` and the log write to share one transaction, so splitting them is not available; instead the amendment moves the multi-row **prune** out of that transaction, which is the part that could plausibly fail after a successful `add`. Residual risk recorded in Design Notes |
| 5 | BH, ECH, VG, IA | `copy.today.progress` has no singular: the day's first visit reads "1 visites sur 5" | low | bad_spec | Real; its neighbour `copy.today.remaining` exists to singularise. Direct correction, folded into the re-derivation |
| 6 | VG | The second assertion in the new `TodayScreen` test is vacuous — `findByText` is satisfied by the DOM the first assertion left, so "a sync emptying the outbox leaves it there" is never observed | medium | bad_spec | VG proved it by mutation: dropping `loggedIds` when the outbox is empty left all 11 TodayScreen tests passing. Folded in |
| 7 | BH, ECH | `sentAt` is unclamped, so a phone whose clock runs ahead logs a future row that counts on every day until a prune removes it | low | bad_spec | Real; the read is a half-open `aboveOrEqual` with no upper bound. Fix is to bound it with `between(from, to)`. Folded in |
| 8 | BH, ECH, IA | The new bar has no accessible name | low | bad_spec | Real: `<Progress value={percent} />` with no label. Folded in |
| 9 | VG, IA | Vendored `Progress` destructures `value` and never forwards it to the Radix root, so the bar is `data-state="indeterminate"` with no `aria-valuenow` | medium | defer | Confirmed at `ui/progress.tsx:7` — `value` never reaches `ProgressPrimitive.Root`. Pre-existing and shared with the admin import screens, so not this story's to fix. Side effect: it is why IA's "aria-valuenow leaks the percentage" reading does not hold |
| 10 | BH, IA | No test runs `VisitScreen` → `queueVisit` → `TodayScreen`; the repointed call site is covered only by typecheck | low | defer | True, and `VisitScreen` has no test file at all — a pre-existing gap this story did not create |
| 11 | BH | `progress.ts` imports `sendableBy` from `db.ts`, which constructs `fieldDb` at module scope, so its "pure, no Dexie" claim is weaker than stated; also `DailyProgress` names both a type and a component | low | defer | Real but harmless (no `open()`, suite green). Moving `sendableBy` to a pure module is a tidy-up outside this story |
| 12 | ECH | Prune runs only on a queue write, so stale rows sit in IndexedDB on an idle device | low | reject | The read already excludes them and the rows are two fields wide; the fix puts a write on a read path. Not met in everyday use |
| 13 | ECH | `identity` may be `""` before `/api/me` settles, so `sendableBy("")` transiently drops stamped rows | false | reject | `App.tsx:312` renders `<SyncProvider identity={me.email}>` only once `me` has resolved; `""` is unreachable there |
| 14 | ECH | Claim in Implementation Notes overstated: the DST test exercises the read, not the prune, across the clock change | low | patch | Accurate — the test calls only `todaysSentVisitIds`. Corrected the note's wording rather than the code |
| 15 | BH, VG | Process: a field-route PR must quote the precache total against the 1,000 KiB ceiling, and the diff carries no figure | low | reject | Not a code defect. The figures are measured and recorded in Implementation Notes, and the PR body carries them |


**Pass 2** (same four lenses; duplication-map skipped again on its gate). Counts: high 0 · medium 4 ·
low 8 · false 0 · maybe-false 0 · rejected-low 5 · deferred 3. No intent_gap and no bad_spec, so no
second loopback — patches only. Pass 1's two high findings are both gone: the denominator now excludes
an already-counted stop, and the log is stamped and filtered.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | VG, ECH, IA | The outbox half of `n` has no day bound while the log half does, so an agent offline overnight reads yesterday's unsent visits as today's | medium | patch | Verified: `progress.ts`'s outbox loop filters on identity only, and outbox rows survive until `accepted`. Contradicts the change's own claim that the agent's and admin's "today" can never disagree. Bounded by `visitedAt` against the same Brussels day |
| 2 | IA, ECH, BH | `n` dedupes by visit id but `total` excludes by prospect id, so two visits to one stop — or a counted visit whose stop left the round — grow the denominator again | medium | patch | Real, and it reintroduces exactly what pass 1 fixed. I had recorded the repeat-visit case in Design Notes as an accepted residual; the lenses are right that it is avoidable. `total` is now the size of the union of counted prospect ids and stop ids, one expression that fixes both cases |
| 3 | BH, ECH, VG, IA | `clearAgentCache` does not clear `sentVisits`, so a revoked or replaced identity's visit ids, prospect ids and email stay on the device | medium | patch | Confirmed at `db.ts`. Contradicts the function's own doc comment and docs/security.md's "stolen phone". Pass 1's spec told the implementer not to touch it; that was for counting, and hygiene outranks keeping a counter warm. Now cleared |
| 4 | VG, IA | Nothing verifies `VisitScreen`'s call to `queueVisit`, the only production site that writes a log row | medium | patch | Demonstrated: reverting that line leaves the suite green and the feature inert. Covered the repo's own way — a source-text assertion in the `leave-guard.test.tsx:80` idiom, with its "not behavioural coverage" caveat |
| 5 | BH | `copy.today.progress` renders "0 visites"; French takes the singular at zero, and `n = 0` is the first thing shown each morning | low | patch | Real. `n <= 1` |
| 6 | BH, VG | No test asserts the prune deletes anything — removing the whole block leaves every test passing | low | patch | Verified by the lens's own mutation. Test added |
| 7 | BH, VG, IA | The bar's rendered value is asserted nowhere, and `DailyProgress` has no component test | low | patch | Real: passing `n` instead of `percent` breaks nothing. Component test added, asserting the indicator transform rather than `aria-valuenow` — see row 9 for why |
| 8 | ECH, BH, mine | The `db.verno` assertion was deleted from the v1 → v2 test rather than updated to 4 | low | patch | Confirmed in the diff. Restored, with `sentVisits` empty alongside |
| 9 | VG, IA | Vendored `Progress` never forwards `value` to the Radix root, so the bar is `data-state="indeterminate"` with no `aria-valuenow` | medium | defer | Confirmed at `ui/progress.tsx:7` — carried over from pass 1. Pre-existing on `main` and shared with the admin import screens, so fixing it changes admin behaviour too. Raised as found-in-passing issue #147 |
| 10 | BH | Comments cite `EXPERIENCE.md` and "frozen Intent", neither in the repository | low | patch | True — EXPERIENCE.md lives only in the gitignored planning folder. Re-pointed at GH #119 and the two docs |
| 11 | BH, IA, mine | Docs overstate: "`total` holds still" without its residual, "absent entirely on an empty round" when it renders whenever `total > 0`, and the sketch line dropped "aujourd'hui" | low | patch | All three confirmed against the code and the 34-column box. Docs corrected to match behaviour |
| 12 | BH | `queueVisit`'s single transaction lets a failing log write roll back the outbox row | low | reject | The frozen block requires the two writes to share one transaction, so the proposed fix needs the human to renegotiate intent, not a patch. And the failure is surfaced, not silent: `VisitScreen`'s catch leaves the form standing and tells the agent, so no visit is lost unannounced. Quota exhaustion striking between a visit-sized `add` and a four-field `put` in one transaction is not an everyday path. Pass 1 already moved the multi-row prune out of it, which was the reachable part. Flagged to the owner |
| 13 | BH, ECH, IA | A phone left open across Brussels midnight keeps yesterday's window until the next sync or write | low | reject | Real but needs the app open, offline and untouched across midnight; any sync or queued visit re-runs the query. The fix is a timer and a new dep — complexity beyond a direct correction |
| 14 | ECH | The prune runs only on a queue write, so rows linger on an idle device | low | reject | The read is bounded at both ends, so a lingering row is invisible; the fix puts a write on a read path |
| 15 | BH, ECH | `openV3`'s hand-copied snapshot is guarded only by a comment; nothing fails if `db.ts` drifts | low | reject | The snapshot is deliberate and on the KEEP list — importing `FieldDb` would test v4 against today's code rather than the shape actually sitting on a phone, which is the whole point |
| 16 | mine | `runSync`'s `idMap` rewrite reaches `outboxVisits.prospectId` but not the log's, so a deduped field prospect visited the same day loses its denominator exclusion | low | reject | Real but narrow, and the frozen block's "Never" list forbids the fix outright: "never write the log from `runSync`". Recorded as a documented residual in the docs instead |
| 17 | IA, VG | The record → accept → pull timeline is asserted only in its pre-v4 shape; no end-to-end test crosses `VisitScreen` → `queueVisit` → `TodayScreen` | low | defer | Row 4 covers that the call site exists. A true integration test needs the lazy, form-heavy `VisitScreen` mounted, which the repo declined for the same reason at `leave-guard.test.tsx:74-79`; `VisitScreen` has no test file at all today |
| 18 | BH | `progress.ts` imports `sendableBy` from `db.ts`, which builds `fieldDb` at module scope | low | defer | Carried from pass 1. Harmless — never opened, suite green — and moving `sendableBy` to a pure module is a tidy-up beyond this story |
| 19 | BH, VG | Process: the PR must quote the precache total against the 1,000 KiB ceiling | low | reject | Not a code defect. Measured and quoted in Implementation Notes and in the PR body |

## Design Notes

- **Why the denominator excludes an already-counted stop.** The round deliberately keeps a stop after
  its visit is queued — hiding it would mean deriving status on the client (invariant 3), and
  spec-gh-118 froze that as a "Never". So `list.now` and the log overlap, and adding the two counts
  double-counts every visit the agent records. Excluding stops whose prospect is already in `n` makes
  `total` the size of the day's round and holds it still, which is what the mock's "5 visites sur 17"
  beside "17 arrêts" shows. This is why the log row needs `prospectId`: the visit id alone cannot be
  traced back to a stop.
- **Residual, accepted:** two visits to the same stop on one day raise both `n` and `total` by one, so
  a 17-stop round can read "2 visites sur 18". Inherent to counting visits against a stop-based
  denominator, and rare enough to leave — the alternative is counting stops, which loses the second
  visit entirely.
- **Why the prune leaves the critical transaction.** The frozen block requires the outbox write and
  the log write to be one transaction, and that is right: a logged visit that was never queued would
  overcount for ever. But a prune is a multi-row delete, and a transaction that also prunes gives a
  bookkeeping delete the power to roll back a queued visit (invariant 5). Pruning after the commit,
  failing silently, costs nothing: the read is bounded at both ends, so an unpruned row is already
  invisible.
- **Why the read takes `Date.now()` and not the screen's `now`.** `now` is `lastSyncAt ?? openedAt`,
  which is deliberately stale — it exists to decide which follow-ups are due, where a 60 s lag is
  irrelevant. A day boundary is not that: offline overnight, `lastSyncAt` is yesterday and yesterday's
  rows fall inside "today". The app left open across midnight still waits for the next sync to
  re-run the query; that is acceptable, and a visit queued in the meantime re-runs it anyway.

- **Why a store and not a `meta` key.** `meta` holds singletons. A per-id log with a
  `sentAt` index prunes and counts with a range query, and a visit id is already the
  natural primary key — the same key the outbox uses, which is what makes the union by id
  free.
- **Prune and filter both, but the filter is what protects correctness.** Pruning alone would leave
  yesterday's count on screen all morning until the first visit; filtering alone would grow the log
  for ever. So both — but the read's `between(dayStart, dayEnd)` is the guard, and the prune is only
  housekeeping, which is what lets it run after the commit and fail silently.
- **`n` counts queue events, not sends.** "Sent" in G8's wording is the agent's mental
  model; the log is written at queue time, which is what makes the count survive a sync.
  The union with the outbox is not redundant: it catches a row queued by an older build,
  which has no log entry.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green, with the new upgrade and progress tests among them
- `pnpm build && pnpm check:precache` -- expected: pass. Record the precache total and `index-*.js` against 680.61 KiB / 514.87 kB (165.22 kB gzip)

**Manual checks:**
- Open Tournée du jour at 390×844 and 820×1180, light and dark, network off after first load. Compare the progress block with `key-f1-tournee.html`. Record a visit and watch `n` rise while the denominator holds still and the bar advances.
