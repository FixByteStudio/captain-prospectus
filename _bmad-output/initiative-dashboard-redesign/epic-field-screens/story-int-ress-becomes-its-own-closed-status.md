---
tracker_id: "238"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/238"
tracker_status: done
id: 13
type: story
title: "Intéressé becomes its own closed status"
parent: epic-field-screens
covers: [CAP-8]
after: [3.1, 3.2]
risk: medium
---

# Intéressé becomes its own closed status

## Description

Adds the closed status `interested` per ADR-0027, flipped to accepted in the same PR: OUTCOME_TO_STATUS, STATUSES and STATUS_LABELS, the faded-green `--color-status-interested` token with STATUS_EDGE, STATUS_TEXT, STATUS_BADGE and dashboard/status-fill.ts, the Prospects filter, dashboard pipeline, CSV export, manual-status PATCH and dev-seed-history.ts; the new Intéressé and Converti hints in copy/shared.ts; docs/glossary.md (interested, Waitlist, Channel), docs/domains/prospecting.md (mapping, lifecycle, Open vs closed) and docs/data-model.md's status enum. Entry 14 relies on `interested` no longer mapping to follow_up; 3.5 rebuilds Prospects on top of it.

## Acceptance Criteria

Verify: Worker tests show an Intéressé visit sets `interested` and the sync pull omits the prospect, a visit after an admin reopen derives as usual, and the conversion rate counts only converted; admin DOM tests show the Intéressé label and faded-green edge in Prospects, its filter, the pipeline and the export; the PR quotes the precache total against 1,000 KiB, since copy/shared.ts reaches the field bundle.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-field-screens/epic-field-screens.md
- _bmad-output/specs/spec-done-stop-leaves-the-round/SPEC.md, CAP-3 and CAP-4
- docs/adr/0027-interested-is-its-own-closed-status.md

## Notes

- Open question: None known; the colour is settled as converted's green at partial strength.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
