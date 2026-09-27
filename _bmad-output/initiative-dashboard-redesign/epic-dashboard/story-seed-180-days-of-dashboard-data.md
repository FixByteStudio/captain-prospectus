---
tracker_id: "108"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/108"
tracker_status: done
id: 4
type: story
title: "Seed 180 days of dashboard data"
parent: epic-dashboard
covers: [CAP-2]
after: [3]
risk: low
---

# Seed 180 days of dashboard data

## Description

Extends /api/dev/seed and scripts/seed.mjs with visits over the last 180 days for both agents and every outcome, flyers, follow-ups due today and within 7 days, one manual status change, one merged prospect, orphaned visits and a duplicate pair, so every dashboard panel shows data in pnpm dev.

## Acceptance Criteria

Verify: After pnpm db:seed:local on a fresh local D1, every KPI, the pipeline, the per-agent rows and the three À traiter counts are non-zero for 7, 30 and 90 days, and a second run adds no rows.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md

## Notes

- Open question: Orphaned visits only arise through the sync path, so the seed may have to post them to /api/agent/sync rather than insert them.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
