---
title: 'The Prospects source filter offers « Carte (Google) »'
type: 'bugfix'
created: '2026-10-11'
status: 'done'
baseline_commit: 'f524960d5d0e657ef378cdefc501cb72bad51f2d'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Toolbar.tsx:14` keeps its own `SOURCES` list of `csv`, `osm` and `field`, written in #179 before Google Places existed (ADR-0020). An admin cannot pick Google in the Prospects source filter, though the shared `SOURCES`, the URL parser (`queries.ts:142`), the list route and `SOURCE_LABELS` (« Carte (Google) ») all accept it. A `?source=google` deep link already works; only the select omits it.

**Approach:** Delete the local list and build the options from the shared `SOURCES` in `src/shared/constants.ts`, so a future source shows up in the filter without a second edit. No copy change: `SOURCE_LABELS.google` exists.

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [x] `src/client/admin/prospects/Toolbar.tsx` -- drop the local `SOURCES`, import the shared one -- one home for the source list (#419)
- [x] `src/client/admin/ProspectsScreen.test.tsx` -- add a URL-filters case: open the source filter, see one option per shared source, pick « Carte (Google) » -- pins the gap

**Acceptance Criteria:**
- Given the Prospects screen, when the admin opens the source filter, then it offers « Toutes les sources » plus « CSV », « Carte (OSM) », « Carte (Google) » and « Terrain », in the shared `SOURCES` order.
- Given the filter open, when the admin picks « Carte (Google) », then the URL becomes `?source=google` and the list request carries `source=google`.

## Implementation Notes

Oneshot: a two-line source change and one test. The server and URL parsing already accept `google`; nothing outside the client select changes, so no doc or API update.
Mutation check: with the old local list restored in `Toolbar.tsx`, the new case fails and the other 52 pass.

## Review Triage Log

Quick review, pass 1: no findings to act on.

- low, rejected -- the option-list assertion is built from the same shared `SOURCES` the toolbar uses, so it cannot catch a source dropped from that list. Not worth a literal copy: the click on « Carte (Google) » names the source directly and fails against the old three-item list.

## Verification

**Commands:**
- `pnpm vitest run src/client/admin/ProspectsScreen.test.tsx` -- expected: all pass; the new case fails with the old local list
- `pnpm typecheck && pnpm lint` -- expected: clean
