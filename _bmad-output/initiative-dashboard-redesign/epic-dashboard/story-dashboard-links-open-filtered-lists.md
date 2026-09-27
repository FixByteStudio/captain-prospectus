---
tracker_id: "114"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/114"
tracker_status: done
id: 10
type: story
title: "Dashboard links open filtered lists"
parent: epic-dashboard
covers: [CAP-2]
after: [9]
risk: medium
---

# Dashboard links open filtered lists

## Description

Adds G3's dueBefore and G10's multi-value status to GET /api/admin/prospects, makes Prospects read its filters from the URL, and wires the Prospects ouverts, Visites and Convertis cards and Relances dues' Voir to their filtered lists.

## Acceptance Criteria

Verify: Worker tests cover dueBefore and several statuses, each bound as a parameter; in pnpm dev each card and Voir lands on a list whose count equals the figure clicked.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md
- server — _bmad-output/specs/spec-dashboard-redesign/server-gaps.md

## Notes

- Epic-admin-screens rebuilds Prospects later and must keep the URL filters (its Notes).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
