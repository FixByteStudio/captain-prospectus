---
tracker_id: "105"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/105"
tracker_status: done
id: 1
type: story
title: "Outcome tokens and admin-chunk guard"
parent: epic-dashboard
covers: [CAP-10, CAP-2]
after: [1.3]
risk: low
---

# Outcome tokens and admin-chunk guard

## Description

Brings app.css's outcome-* tokens to the values #91 settled in DESIGN.md, makes palette.test.ts assert every outcome-*, warn and success colour at 3:1 against the card of its own theme (#100), and makes check-precache.mjs fail when Recharts, cmdk, TanStack Query or another admin-only module appears in any precached chunk instead of only in AdminApp-* (#95).

## Acceptance Criteria

Verify: palette.test.ts fails when any outcome-*, warn or success value drops below 3:1 on its own theme's card; check-precache.test.mjs fails on a fixture whose precached chunk holds an admin-only module; pnpm build and pnpm check:precache pass on the branch.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md
- issue — https://github.com/FixbyteStudio/captain-prospectus/issues/100
- issue — https://github.com/FixbyteStudio/captain-prospectus/issues/95
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a1-outcome-chart.html

## Notes

- Open question: Minified chunks lose module ids, so how the guard tells which modules a chunk holds (Vite's build manifest, a small Rollup plugin writing a module map, or a marker string) is open.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
