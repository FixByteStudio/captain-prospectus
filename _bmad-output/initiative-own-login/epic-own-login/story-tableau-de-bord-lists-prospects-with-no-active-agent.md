---
tracker_id: "308"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/308"
tracker_status: backlog
id: 11
type: story
title: "Tableau de bord lists prospects with no active agent"
parent: epic-own-login
covers: [CAP-1]
after: [7]
risk: low
---

# Tableau de bord lists prospects with no active agent

## Description

Adds the fourth À traiter row 'Prospects sans agent actif {n}' with its count on the dashboard endpoint, and a Prospects filter for inactive agents that its Réassigner button opens, per entry 1.

## Acceptance Criteria

Verify: On pnpm dev, after deactivating a seeded agent with prospects, the row shows their count and Réassigner opens Prospects listing exactly those prospects.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
