---
tracker_id: "176"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/176"
tracker_status: done
id: 2
type: story
title: "Name search, the visits date range and the export filters"
parent: epic-admin-screens
covers: [CAP-3]
risk: low
---

# Name search, the visits date range and the export filters

## Description

Add this epic's additive read-only params to the admin API: q= matching prospect names case-insensitively (G4), from and to on the visits feed over received_at (G5), and q, dueBefore and multi-value status on the prospects CSV export so an export always matches the filtered list on screen.

## Acceptance Criteria

Verify: Worker tests cover q= matching case-insensitively and binding as a parameter, from/to filtering on received_at, from > to answering 400, and the export returning the same rows as the list under every filter; docs/api.md documents all of them.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md
- _bmad-output/specs/spec-dashboard-redesign/server-gaps.md
- docs/api.md

## Notes

- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
