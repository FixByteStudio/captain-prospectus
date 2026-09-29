---
title: 'Intéressé becomes its own closed status'
type: 'feature'
created: '2026-09-30'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '16662e7ede0e88b3d3ce2ae5e38fcdc703b730b3'
context:
  - '{project-root}/docs/adr/0027-interested-is-its-own-closed-status.md'
  - '{project-root}/_bmad-output/specs/spec-done-stop-leaves-the-round/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An Intéressé visit maps to the open `follow_up` status, so the prospect returns to the agent's round after the sync as if never visited, and `follow_up` means two different things (GH #238, epic #117 retro F3).

**Approach:** Implement ADR-0027 (and flip it to accepted): a sixth, closed status `interested` ("Intéressé"), `OUTCOME_TO_STATUS.interested → interested`, shown, filtered, exported, pipelined and manually settable on the admin side, with a faded-green colour; plus the CAP-4 definitions (glossary, prospecting doc, Intéressé/Converti hints).

## Boundaries & Constraints

**Always:** `interested` is not in `OPEN_STATUSES` and never maps to `follow_up` (#239 depends on it). Status stays server-derived (invariant 3). The conversion rate counts only `converted`. Colour: `--color-status-interested` = `converted`'s green at partial strength, correct in light and dark, via tokens only. French strings live in `copy/`. Hints read exactly: Intéressé "Ouvert à la discussion, pas encore inscrit sur la liste d'attente."; Converti "Déjà inscrit sur la liste d'attente.". ADR-0027 and its `docs/adr/README.md` row say accepted. The PR quotes the precache total against 1,000 KiB.

**Never:** No migration or backfill (text enum, nothing deployed). No sync-contract change. No phone-side status logic, and no change to the À relancer hint or the when step (#239). No reworking of Prospects beyond what a new status needs (3.5 rebuilds it).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Intéressé visit | sync pushes `outcome: interested` on an assigned prospect | status `interested`; next sync pull omits the prospect | none |
| Reopen then visit | admin PATCHes `interested → assigned`, later visit `converted` | status `converted` (ADR-0025 ordering unchanged) | none |
| Manual set | `PATCH` status `interested` | 200, stored | unknown status still 400 |
| Dashboard | prospects in `interested` and `converted` | pipeline has an `interested` key; conversion rate and `converted` count ignore `interested` | none |
| Filter/export | `?status=interested` on list and `export.csv` | only those rows; CSV `status` column `interested` | none |

</frozen-after-approval>

## Code Map

- `src/shared/constants.ts:9,62-71` -- `STATUSES`, `OUTCOME_TO_STATUS`, `OPEN_STATUSES`; everything else (`statusSchema`, Drizzle enum, pipeline, filter options, RowMenu) reads `STATUSES`.
- `src/worker/routes/status.ts` -- derivation, data-driven: no change.
- `src/worker/routes/admin.ts:370,844-901` -- pipeline from `STATUSES`, export writes raw `p.status`: covered by tests only.
- `src/client/copy/shared.ts:120-134` -- `OUTCOME_HINTS`, `STATUS_LABELS` (reaches the field bundle).
- `src/client/admin/status.ts` -- `STATUS_EDGE`/`STATUS_TEXT`/`STATUS_BADGE` (imported by field StopRow).
- `src/client/admin/dashboard/status-fill.ts` -- `STATUS_FILL`.
- `src/client/styles/app.css:133-138,241-290` -- `@theme inline` status tokens; `:root` recipes like `--status-assigned`/`--tint-assigned` (color-mix on a var, so dark follows `--success` automatically).
- `src/client/styles/palette.test.ts` -- `DESIGN_COLOURS` list and rule-5 `BADGES`.
- `src/worker/dev-seed-history.ts:97-149` -- fixed stories and walk treat `interested` as a follow-up outcome; its test pins 10–15 visits/day and 3–7 % converted.
- Tests to extend: `src/shared/constants.test.ts`, `src/worker/sync.test.ts`, `src/worker/admin.test.ts`, `src/worker/dashboard.test.ts`, `src/client/admin/ProspectsScreen.test.tsx:139-160`, `src/client/admin/dashboard/DashboardScreen.test.tsx`, `src/client/field/VisitScreen.test.tsx:239` (hints never contain a status label — must still pass).
- Docs: `docs/glossary.md:17,50`, `docs/domains/prospecting.md:8-44,72`, `docs/data-model.md:23`, `docs/design.md:95-101,168-174`, `docs/adr/0027-…md`, `docs/adr/README.md:35`.

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/constants.ts` -- add `interested` to `STATUSES` after `follow_up`; map `interested → interested`; `OPEN_STATUSES` unchanged -- ADR-0027.
- [x] `src/client/copy/shared.ts` -- `STATUS_LABELS.interested = "Intéressé"`; new Intéressé and Converti hints -- CAP-3/CAP-4.
- [x] `src/client/styles/app.css` -- `--status-interested` (success, partial strength, transparent) and `--tint-interested` (12 % of it, opaque on card) in `:root`; `--color-status-interested`, `--color-tint-interested` in `@theme inline` -- faded green, both themes.
- [x] `src/client/admin/status.ts`, `src/client/admin/dashboard/status-fill.ts` -- `interested` entries using the new tokens, text in `success` -- every `Record<Status,…>` must be total.
- [x] `src/client/styles/palette.test.ts` -- new colours in `DESIGN_COLOURS`; rule-5 badge row for status interested -- contrast pinned in CI.
- [x] `src/worker/dev-seed-history.ts` (+ test) -- `interested` ends a walk like `converted`; retune weights so the pinned averages still hold; fixed stories no longer visit after an Intéressé, and one story ends on `interested` -- seed stays realistic.
- [x] Tests -- sync (Intéressé → `interested`, pull omits it; reopen then visit derives), admin (PATCH, `?status=interested`, export), dashboard (pipeline key, rate ignores it), constants, Prospects DOM (label, faded-green edge, filter option), Dashboard DOM (pipeline row).
- [x] Docs -- glossary (status, Waitlist, Channel), prospecting (mapping, lifecycle, open vs closed, assignment line), data-model enum, design.md tables, api.md where statuses are listed, ADR-0027 + README row accepted.

**Acceptance Criteria:**
- Given the change, when `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` run, then all pass and the build's precache line is at or under 1,000 KiB.
- Given `pnpm db:generate`, then no migration is produced.

## Implementation Notes

- Also touched, outside the Code Map: `src/shared/schemas.ts` (dashboard `pipeline` gains `interested`, admin-only and additive), `src/client/admin/dashboard/PipelinePanel.tsx` (`COUNT_INK`), and the Intéressé/Converti hints in the planning `EXPERIENCE.md` so it matches the app.
- Seed retune (review patch): weights 42/6/47/1/4, gap 1–3 days, no-history 5 %: ~11.4 visits/day, ~4.8 % converted, ~5.5 % interested. The Intéressé fixed story is last so the no-visit story keeps index 7.
- Verification: typecheck, lint, 1988/1988 tests, build green; precache 25 entries, 927.50 KiB of 1,000 KiB; `pnpm db:generate` produced no migration.

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Verdicts: high 0 · medium 1 · low 4 · false 5 · maybe-false 0 · rejected-low 3. Verification-gap filed no gaps.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | prospecting.md diagram/prose: only an admin reopen leaves `interested` | medium | patch | `status.ts` derives from the latest visit, so a newer (e.g. queued) visit also moves it; doc must say so. |
| 2 | design.md Visites feed edge examples omit Intéressé | low | patch | `STATUS_EDGE[OUTCOME_TO_STATUS[outcome]]` now gives an Intéressé visit the faded green; one-phrase doc fix. |
| 3 | design.md "converted is always green" has no counterpart for Intéressé | low | patch | The rule's home is design.md; the reasoning lived only in a code comment. |
| 4 | New seed story shifts the empty story to index 8 | low | patch | `routes/dev.ts:145-151` hands stories out in index order; reorder is a direct fix. |
| 5 | Seed weights put `interested` (2 %) below `converted` (5 %) | low | patch | Demo funnel inverted; weights-only fix. |
| 6 | Re-seeding an old local DB keeps old visits (ids hash dedupeKey:index) | low | reject | Pre-existing seed design; dev-only; a fix would change id derivation. |
| 7 | Agent `followUp`/`openProspects` silently drop Intéressé leads | false | reject | Intended by ADR-0027 (closed status); api.md defines them as live `follow_up`/open, still accurate. |
| 8 | RowMenu manual set to Intéressé untested in DOM | low | reject | RowMenu maps `STATUSES`; PATCH covered in `admin.test.ts`; adding a UI test is more than a direct fix for a negligible risk. |
| 9 | Glossary Channel/Waitlist wording circular/unused | false | reject | Wording is CAP-4's verbatim contract; changing it would edit the spec. |
| 10 | Spec checkboxes/log empty, Code Map lines shift | false | reject | Workflow fills the log at review; line refs are planning aids. |
| 11 | `export.test.ts` length 3 / naive split | false | reject | Follows the file's existing `records` pattern; seeded fields hold no commas. |
| 12 | No visibility check on the 55 % edge | low | reject | Edges are decorative per design.md, as for `status-assigned`; label carries the status. |
| 13 | Planning DESIGN.md lacks the Intéressé status row/tokens | low | reject | Planning artifact, not the implementation contract; docs/design.md is updated. |
| 14 | Intent auditor: field round covered only via Worker pull + client full replace | false | reject | `sync.ts:214-215` replaces the cache from the pull; before-sync placement is #239 by the spec's Never list. |

## Design Notes

Tokens follow the `assigned` precedent: an edge mixed toward transparent, and a badge fill of 12 % of that edge mixed onto the card, so dark mode needs no new hex:

```css
--status-interested: color-mix(in oklab, var(--success) 55%, transparent);
--tint-interested: color-mix(in oklab, var(--success) 7%, var(--card));
```

`STATUS_TEXT.interested = "text-success"` without `font-medium`, so it reads one step quieter than Converti; the label always sits beside the colour, so the two greens never carry the difference alone.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all green
- `pnpm build` -- expected: precache line ≤ 1,000 KiB; quote it in the PR
- `pnpm db:generate` -- expected: no new migration file
