---
tracker_id: "112"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/112"
tracker_status: done
id: 8
type: story
title: "Pipeline par statut and Activité par agent"
parent: epic-dashboard
covers: [CAP-2, CAP-11]
after: [7]
risk: low
---

# Pipeline par statut and Activité par agent

## Description

Adds the pipeline (count and share of live prospects per status) and the per-agent activity (visits and conversions in the period, follow_up and open prospects assigned now) to the endpoint, and renders the pipeline bars and the agent table.

## Acceptance Criteria

Verify: Worker tests assert both for 7, 30 and 90 days, including an agent with no visits in the period; in pnpm dev, assigning prospects in Prospects moves Prospects ouverts and that agent's row on return to Tableau de bord (Flow 2's climax).

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md

## Notes

- Open question: Which agents the table lists: every configured agent from GET /api/admin/agents, or only those with activity.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
