---
tracker_id: "500"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/500"
tracker_status: backlog
id: 4
type: story
title: "A location dialog holds the start screen until a fix is precise"
parent: epic-numbered-tournee
covers: [R3, R16]
after: [3]
hitl: true
risk: high
---

# A location dialog holds the start screen until a fix is precise

## Description

While the start screen shows stops (entry 3) and no reading passes the accuracy threshold, an alert dialog sits over the start screen, built to entry 1's design. It has « Activer » (the same refresh() as « Réessayer ») and a Réglages › Localisation line, and it repeats one-off getCurrentPosition readings until the threshold is met. The owner's pavement test sets the threshold, target 100–200 m, as a named constant. The comment at useAgentPosition.ts:10 and field-operations.md follow.

## Acceptance Criteria

Verify: Tests drive refused, too coarse and accepted readings through the dialog. Outdoors on a phone, the owner sees the dialog close and records the chosen threshold in the PR.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Notes

- Open question: What accuracy a mid-range Android and an iPhone reach on a Brussels pavement with enableHighAccuracy off, and whether it must be turned on.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
