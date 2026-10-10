---
title: "Refactor sweep (Import A4–A6 epic)"
type: 'refactor'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'none'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
baseline_commit: '47229116718e7780d5d9964e81c93851f555c338'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Import A4–A6 epic (GH #365–#372, #390) left two stale comments, a duplicated progress-percent line, a duplicated filter class string and a pass-through wrapper (GH #373).

**Approach:** Cleanup only, no behaviour change, no test expectation changes. Check `docs/design.md` against the shipped screens and mark the settled `deferred-work.md` entry.

</frozen-after-approval>

## Implementation Notes

- Oneshot, worktree `../captain-prospectus-373`, cut from `origin/main` 4722911.
- `ImportProgressCard.tsx` exports `percentDone`; `MapStep` uses it instead of its own copy of the formula.
- `PreviewStep`: the two filter items share `FILTER_ITEM`.
- `ImportScreen`: `run` only forwarded to `importer.start`, so both call sites use `importer.start`; two `./csv` imports merged, the `shared/constants` import moved beside the other shared one.
- Comments: `ImportBottomBar` (Aperçu & validation already uses it) and `read-csv-file` (« later »).
- `docs/design.md` › The CSV import read against `ImportStepper`, `SourceStep`, `ColumnsStep`, `PreviewStep`, `ImportProgressCard`, `RecentImports`, `docs/api.md` and `domains/ingestion.md`: no drift found, no doc edit.
- `deferred-work.md`: `closed_by` added to the #231 progress-bar entry (closed by #370).
- Left alone: the fetch-stub helper repeated in three test files (rejected in #390, test-only); `MapStep`'s inline progress bar and `PreviewStep`'s card differ by design (Zone has no bottom bar).
- Not checked in a browser: the epic's light/dark/390px mockup comparison stays with the owner.
- Verification: typecheck, lint, test (2616) and build green; precache 25 entries, 951.54 KiB of 1,000.
