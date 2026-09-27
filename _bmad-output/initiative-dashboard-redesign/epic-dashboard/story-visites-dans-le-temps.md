---
tracker_id: "110"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/110"
tracker_status: done
id: 6
type: story
title: "Visites dans le temps"
parent: epic-dashboard
covers: [CAP-2, CAP-11]
after: [5]
risk: medium
---

# Visites dans le temps

## Description

Vendors shadcn Chart (Recharts) into the admin chunk, adds visits per day by outcome to the endpoint, and draws the stacked chart with the fixed series order, the 1px card stroke between segments, counts in segments at least 22px tall, the all-series tooltip, no legend toggle and a visually hidden summary table.

## Acceptance Criteria

Verify: A worker test asserts the per-day counts by outcome for 7, 30 and 90 days; against the seed the chart matches key-a1-outcome-chart.html in light and dark; pnpm check:precache passes; the PR states Recharts' size, maintenance and why the platform can't do it.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a1-outcome-chart.html

## Notes

- Open question: Whether Recharts' stacked bar can draw the stroke only on shared edges, or needs a custom bar shape.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
