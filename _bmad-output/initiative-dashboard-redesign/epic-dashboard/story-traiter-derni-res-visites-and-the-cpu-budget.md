---
tracker_id: "113"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/113"
tracker_status: done
id: 9
type: story
title: "À traiter, Dernières visites and the CPU budget"
parent: epic-dashboard
covers: [CAP-2, CAP-11]
after: [8, 2]
risk: medium
---

# À traiter, Dernières visites and the CPU budget

## Description

Adds Relances dues to the endpoint, renders À traiter with it and the À rattacher and Doublons counts the sidebar already queries (buttons disabled at 0), renders Dernières visites from the existing feed (5 rows, 15 s poll, outcome badges, a wash on new rows, one polite announcement per poll), and shows the finished dashboard query stays within Workers Free's 10 ms CPU.

## Acceptance Criteria

Verify: A worker test asserts Relances dues around the Brussels day boundary; in pnpm dev a visit synced from the field shows in Dernières visites within one 15 s poll; the PR records the query's CPU on the seeded data and the plan using the visited_at index.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md

## Notes

- Open question: Worker CPU excludes D1 time and wrangler dev enforces no CPU limit, so how the budget is measured locally is open.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
