---
title: 'Visites shows and filters refusal reasons'
type: 'feature'
created: '2026-09-30'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'e0dc774f03d50a3b0ac5b9ce0ef882004dcc17e1'
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/specs/spec-not-interested-skips-script/refusal-reasons.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Refusal reasons are stored since #247 and asked on the field since #248, but the admin can't see or filter them: the Visites ledger, its feed and its CSV export ignore `visits.refusal_reason` (GH #249, epic #246 CAP-4, CAP-5).

**Approach** (superseded where it mentions `none`; see the Auto Run Result)**:** Return `refusalReason` on admin visit rows and show its French label beside Pas intéressé in the ledger. Add one `reason=` query param, shared by `GET /api/admin/visits` and `export.csv` (a reason value, or `none` = Sans raison), a "Raison du refus" select on Visites held in the URL, and a `refusal_reason` CSV column.

## Boundaries & Constraints

**Always** (superseded where it mentions `none`; see the Auto Run Result)**:** Additive API change only (docs/api.md Conventions); `reason` absent = today's behaviour. Query schema in `zod/mini` (INVARIANT 6), one shared piece for both routes, as `reversedRangeRefine` is shared. `none` = `outcome = 'not_interested' AND refusal_reason IS NULL` (epic assumption). A reason value = `refusal_reason = <value>`. `reason` combines with `since`, `from`, `to` (AND). Labels come from `REFUSAL_REASON_LABELS`; new French strings live in `copy/admin.ts` (INVARIANT 15). The select is the existing `prospects/Filter.tsx` (shadcn Select). CSV writes the English value, empty when null, like `status` on the prospect export.

**Never:** No change to `RecentVisits` on Tableau de bord (it stays unscoped and shows no reason). No DB migration or index. No sync-contract change. No dashboard chart of reasons, no Hors cible filter (story 4). No field-route change.

## I/O & Edge-Case Matrix

> **Superseded** by the owner decision in the Auto Run Result (2026-09-30): the `none` / Sans raison bucket was dropped, the filter offers the 7 reasons only, and `reason=none` is a 400. The text below is the original plan, kept as the build record (epic #246 retro, F3).

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| One reason | `reason=too_many_devices` | Only visits with that reason, in list and CSV alike | none |
| ~~Sans raison~~ (superseded: now the Unknown value row) | `reason=none` | Only `not_interested` visits with a null reason; not `converted`/`follow_up`/etc. | none |
| Combined | `reason=no_need&from=&to=&since=` | Intersection of all bounds | none |
| No param | none | Unchanged: every visit | none |
| Unknown value | `reason=bogus` or `reason=` | 400 `validation`, both routes | Same shape as a bad `from` |
| Old visit | `not_interested`, `refusalReason: null` | Row shows Pas intéressé and no reason label; CSV field empty | none |
| Bad URL on screen | `/visites?reason=bogus` | Treated as "Toutes les raisons"; feed asks without `reason` | none |
| Filter change | select a reason | URL `?reason=` replaced (no history push), feed reseeds from `since=0` with no arrival announcement, page 1; poll and export both carry `reason=` | none |

</intent-contract>

## Code Map

> **Superseded** by the owner decision in the Auto Run Result (2026-09-30): the `none` / Sans raison bucket was dropped, the filter offers the 7 reasons only, and `reason=none` is a 400. The text below is the original plan, kept as the build record (epic #246 retro, F3).

- `src/shared/constants.ts:67` -- `REFUSAL_REASONS`, `RefusalReason`. Add a sentinel for Sans raison (e.g. `NO_REFUSAL_REASON = "none"`) only if it keeps the wire value in one home.
- `src/shared/schemas.ts:527` -- `adminVisitSchema`: add `refusalReason: z.nullable(z.enum(REFUSAL_REASONS))`. `:569` `visitsSinceQuerySchema` and `:818` `visitsExportQuerySchema`: add `reason: z.optional(z.enum([...REFUSAL_REASONS, "none"]))` via one shared schema const. Doc comments on both.
- `src/worker/routes/admin.ts:1423` -- feed: add `refusalReason: visits.refusalReason` to the select and the reason filter to `filters`. `:1478` export: same filter ANDed with the range, `refusal_reason` header right after `outcome` and value `v.refusalReason` (null → empty via `csvFile`). Write the reason→SQL condition once (small helper next to the routes) and use it in both.
- `src/client/admin/queries.ts:326` -- `useVisitsFeed(period?)`: add an optional `reason` arg; set `params.set("reason", …)` when present and append it to the scoped query key. `RecentVisits` keeps calling it with no args.
- `src/client/admin/VisitsScreen.tsx` -- parse `?reason=` like `parsePeriod` (safeParse against the shared schema; bad → undefined), a setter that replaces the URL (delete the param on `ANY`), `key` = period + reason on `VisitsScreenBody`, a `Filter` in the header actions beside `PeriodToggle`, and `&reason=` on the export URL.
- `src/client/admin/prospects/Filter.tsx` -- reuse as is (`ANY` sentinel, `label`, `anyLabel`, `options`). Do not move it in this change.
- `src/client/admin/visits/VisitsLedger.tsx:121` `VisitRow` -- after the outcome label, when `visit.refusalReason` is set show `REFUSAL_REASON_LABELS[visit.refusalReason]` in a muted span (import from `../../copy`, which `export *`s `copy/shared`).
- `src/client/copy/admin.ts:445` `visits` -- add `reasonFilter: { label: "Raison du refus", any: "Toutes les raisons", none: "Sans raison" }`.
- Fixtures typed `AdminVisit` must gain `refusalReason: null`: `src/client/admin/VisitsScreen.test.tsx:37`, `visits/feed.test.ts`, dashboard `RecentVisits` tests, `queries.test.tsx` — let `pnpm typecheck` find them all.
- Tests: `src/worker/admin.test.ts:~1150–1240` (feed describe, `seedVisit`/`feed` helpers), `src/worker/export.test.ts:260–320` (visits export describe, `seedVisit(id, over)`), `src/client/admin/VisitsScreen.test.tsx` (`stubFetch` records URLs in `asked`; `renderScreen(initialPath)`; `bounds()` helper; `Location` renders the URL).
- Docs: `docs/api.md:36,40` (the two rows) and its feed section near `:98`/`:273`; `docs/design.md:917` "The live feed" (sketch line + a bullet for the filter and the reason label).

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/constants.ts`, `src/shared/schemas.ts` -- response field and the shared `reason` query piece on both query schemas.
- [ ] `src/worker/routes/admin.ts` -- one reason condition helper; feed and export apply it; feed returns `refusalReason`; CSV gains `refusal_reason` after `outcome`; update both routes' doc comments in one line each.
- [ ] `src/worker/admin.test.ts` -- feed: a reason filters; `none` returns only null-reason `not_interested` (seed a `converted` and a `follow_up` with null and a `not_interested` with a reason to prove exclusion); combined with `from`/`to`/`since`; `bogus` and empty → 400; `refusalReason` returned.
- [ ] `src/worker/export.test.ts` -- header contains `refusal_reason` after `outcome`; value written, empty when null; `reason=` and `reason=none` select the same visit ids/names as the feed with the same params (one test calling both routes); bad value 400.
- [ ] `src/client/copy/admin.ts` -- the three strings.
- [ ] `src/client/admin/queries.ts`, `src/client/admin/VisitsScreen.tsx`, `src/client/admin/visits/VisitsLedger.tsx` -- per Code Map.
- [ ] `src/client/admin/VisitsScreen.test.tsx` -- the label beside Pas intéressé; nothing extra on a null-reason visit; choosing a reason puts `reason=` in the URL, narrows the ledger (stub answers by `reason` param), reseeds with `since=0`; later polls carry `reason=`; export URL carries the same `reason=` and bounds; `?reason=bogus` → feed request has no `reason`.
- [ ] `docs/api.md`, `docs/design.md` -- the param, `none`, the response field, the CSV column; the Visites filter and label.

**Acceptance Criteria:**
- Given the same `reason`, `from`, `to`, when the feed and the export are called, then they list the same visits.
- Given the Visites screen with `?period=7&reason=no_need`, when it loads, then the select reads that reason's label and the period stays 7.
- Given the change, when `pnpm typecheck && pnpm lint && pnpm test && pnpm build` run, then all pass.

## Implementation Notes

- Work only in the worktree `/home/m0/PROJECTs/captain-prospectus-249` (branch `feat/249-visites-refusal-reasons`); never touch `/home/m0/PROJECTs/captain-prospectus`. Do not commit; the orchestrator commits.

## Spec Change Log

## Review Triage Log

### 2026-09-30 — Review pass
- verdicts: 18 findings — high 0, medium 0, low 11, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` (verification-gap) No test proves the unfiltered export sends no `reason=` — added the null assertion to the existing unfiltered export test.
  - `[false]` `[reject]` (edge) `reason=none` omits `no_reason_given` refusals — the intent and the epic assumption define Sans raison as a null reason; `no_reason_given` is its own option, as asked ("the 7 reasons plus 'Sans raison'").
  - `[false]` `[reject]` (edge) A stored value outside `REFUSAL_REASONS` renders an empty span — every write goes through the zod enum (sync, orphan repair copies it), and the values are permanent (refusal-reasons.md), so no such row exists.
  - `[false]` `[reject]` (blind) "Refus sans raison" and "Sans raison" read alike — both labels are fixed by the intent; renaming either contradicts it.
  - `[false]` `[reject]` (blind) `none` / Sans raison missing from the glossary — a query value, not a stored domain term; docs/api.md owns wire values (one home for a rule).
  - `[low]` `[patch]` (blind) Filtered empty ledger says "Aucune visite reçue", which is untrue when visits arrived but none match — added `reasonFilter.empty` and an empty-copy prop passed only when a reason is chosen.
  - `[low]` `[patch]` (blind) The KPI strip ignores the filter and nothing says so — design.md bullet now says the strip stays on the whole period.
  - `[low]` `[reject]` (blind) Exported filename doesn't name the reason — server-side filename change adds parameters to `csvResponse`; the admin chose the filter seconds before saving.
  - `[low]` `[reject]` (blind) `Filter` builds `id="filter-Raison du refus"` with spaces — pre-existing component behaviour; `label[for]` and `getElementById` still match an id with spaces in browsers, and the combobox test resolves its name through it.
  - `[false]` `[reject]` (blind) Long reason labels squeeze the prospect name — the row container is `flex-wrap`, so a `shrink-0` label wraps to the next line; the Select trigger already truncates its value.
  - `[low]` `[patch]` (blind) design.md sketch abbreviates the header to `[7|30|90 j] [CSV]` and hides the filter label — sketch restored to the real wording with the filter.
  - `[low]` `[reject]` (blind) Export 400 not tested for `reason=NONE` — the export uses the same `visitsReasonQuerySchema` object, whose case sensitivity the feed test pins; a copy of the test adds nothing.
  - `[false]` `[reject]` (blind) No test that `reason=<value>` excludes a non-`not_interested` visit carrying a reason — that row cannot exist: sync stores null on every other outcome (#247) and nothing else writes the column.
  - `[low]` `[reject]` (blind) `onReasonChange` typed `string` — `Filter`'s own `onChange` is `string`; `parseReason` is the guard, and narrowing needs a cast at the call site for no caught bug.
  - `[low]` `[reject]` (blind) Truncation toast suggests only a shorter period — still a correct remedy; a filtered export is already narrower, and the cap is rarely hit per reason.
  - `[low]` `[patch]` (intent) Header filter doesn't narrow the KPI strip (reading A2) — grouped with the strip row above; documented, intent's AC names the ledger only.
  - `[low]` `[reject]` (intent) Filter/label collision noted descriptively — same as the label row: fixed by the intent.
  - `[false]` `[reject]` (intent) DOM narrowing is proven only through a stubbed server — the SQL narrowing is proven by the Worker tests against real D1; the DOM test proves the request carries `reason=`, which is the client's whole job.

## Design Notes

> **Superseded** by the owner decision in the Auto Run Result (2026-09-30): the `none` / Sans raison bucket was dropped, the filter offers the 7 reasons only, and `reason=none` is a 400. The text below is the original plan, kept as the build record (epic #246 retro, F3).

`none` rather than an empty value: an empty `reason=` must stay a 400 like any bad param, and "Sans raison" is a real filter the URL must carry. It means refusals without a reason, not every visit without one — a `converted` visit has no reason by construction, and listing it under "Sans raison" would answer a question nobody asked.

The filter lives in the URL and is part of the remount key for the same reason the period is: the feed's cursor is a ref, and a fresh mount is the only clean reseed from `since=0` (VisitsLedger's own comment).

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint` -- expected: green
- `pnpm test` -- expected: green, new worker and DOM tests included
- `pnpm build` -- expected: green; precache line quoted (admin-only change, should not move the field precache)

## Auto Run Result

Status: done

**Summary:** Admin visit rows carry `refusalReason`; the Visites ledger shows its label after Pas intéressé. One shared `reason=` param (a `REFUSAL_REASONS` value or `none` = a `not_interested` visit with a null reason) filters `GET /api/admin/visits` and `export.csv` through one schema and one SQL helper; the CSV gains `refusal_reason` after `outcome`. Visites gets a "Raison du refus" select held in `?reason=`, which reseeds the feed and rides on every poll and the export.

**Files changed:**
- `src/shared/constants.ts` -- `NO_REFUSAL_REASON = "none"`.
- `src/shared/schemas.ts` -- `refusalReason` on `adminVisitSchema`; shared `visitsReasonQuerySchema` on both query schemas.
- `src/worker/routes/admin.ts` -- `refusalReasonFilter()`; feed and export filter on it; feed returns the reason; CSV column.
- `src/client/admin/queries.ts` -- `useVisitsFeed(period?, reason?)`.
- `src/client/admin/VisitsScreen.tsx` -- URL-held reason select, remount key, export param, filtered empty copy.
- `src/client/admin/visits/VisitsLedger.tsx` -- reason label; optional `empty` copy.
- `src/client/copy/admin.ts` -- `visits.reasonFilter` strings.
- Tests: `src/worker/admin.test.ts`, `src/worker/export.test.ts`, `src/client/admin/VisitsScreen.test.tsx`; fixture fields in `DashboardScreen.test.tsx`, `visits/feed.test.ts`.
- Docs: `docs/api.md` (two rows, live-feed bullet), `docs/design.md` (sketch, filter bullet).

**Review:** 18 findings (thorough). Patched 4 low: unfiltered-export assertion, filtered empty copy, strip-scope note, sketch wording (KPI-strip entry grouped with its intent-lens twin). Deferred none. Rejected 14 — reasons in the triage log (label pair and `none` meaning fixed by the intent; unreachable DB states; pre-existing `Filter` id; cosmetic/low-value items).

**Follow-up review recommended:** false — patched high 0, medium 0, low 4.

**Verification:** `pnpm typecheck` green; `pnpm lint` green; `pnpm test` 83 files / 2067 tests green; `pnpm build` green, precache 25 entries (932.45 KiB) / 1,000 KiB.

**Residual risks:** none. Owner decision (2026-09-30): there is no pre-#247 data, so the null bucket (`reason=none`, first labelled "Sans raison", then "Raison non saisie") was dropped. The filter offers only the 7 reasons, `reason=none` is now a 400, and Refus sans raison (`no_reason_given`) is the one way to say no reason. This overrides the ticket's "plus 'Sans raison'" and the I/O matrix's Sans raison row.
