---
tracker_id: "107"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/107"
tracker_status: done
id: 3
type: story
title: "Tableau de bord at /admin"
parent: epic-dashboard
covers: [CAP-2, CAP-11]
after: [1, 1.4]
risk: medium
---

# Tableau de bord at /admin

## Description

Tracer bullet: adds GET /api/admin/dashboard?period=7|30|90 with its zod contract in src/shared and docs/api.md, on Europe/Brussels calendar days, computing Visites and Prospects ouverts with their deltas; makes Tableau de bord the /admin index with the header, the period selector (default 30), those two KPI cards, skeletons and the load-failed alert; shows copy.errors.notFound on unknown /admin paths (#90); invalidates the dashboard query on every admin mutation; and adds docs/design.md's dashboard section.

## Acceptance Criteria

Verify: A worker test asserts Visites and Prospects ouverts for 7, 30 and 90 days against its own rows, including '—' when the previous period is 0; in pnpm dev /admin shows both cards changing with the period and /admin/inconnu shows the not-found message.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md
- issue — https://github.com/FixbyteStudio/captain-prospectus/issues/90
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a1-dashboard.html

## Notes

- Open question: The Brussels day boundary is an assumption (epic Notes); every later entry reuses the one this entry defines.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
