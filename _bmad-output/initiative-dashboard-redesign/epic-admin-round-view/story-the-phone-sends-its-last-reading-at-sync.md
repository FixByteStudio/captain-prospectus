---
tracker_id: "266"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/266"
tracker_status: backlog
id: 3
type: story
title: "The phone sends its last reading at sync"
parent: epic-admin-round-view
covers: [CAP-4]
after: [2]
risk: medium
refined: true
---

# The phone sends its last reading at sync

## Description

The phone side of ADR-0028. useAgentPosition keeps its latest successful reading in module memory, not in React state, Dexie or localStorage, as {lat, lng, accuracy, capturedAt}. `capturedAt` is the fix's `GeolocationPosition.timestamp`, not the time the hook resolved; `accuracy` is `coords.accuracy` in metres. The reading is stamped with the identity active when it was taken. runSync adds it as the sync request's optional `position` only when all three hold: the stamp is the confirmed identity it syncs as, never a cache-sourced one; the reading was taken today in Brussels time; and it passes agentPositionSchema. Otherwise the request carries no `position` field. An identity change or clearAgentCache drops the reading. Sync never calls geolocation and never asks for permission. Updates the useAgentPosition header comment, which still says position is captured at check-in only, and docs/design.md's Carte note that the hook has no shared state.

## Acceptance Criteria

Verify: Unit tests show runSync's body carries today's reading for the confirmed identity, and carries no `position` for a reading from yesterday, no reading, a reading stamped with another identity, one taken under a cache-sourced identity, one that fails agentPositionSchema, or one dropped by clearAgentCache. A hook test shows `capturedAt` is the fix's timestamp. A sync triggers no geolocation call. The PR quotes the precache total against 1,000 KiB and links an approved security-reviewer verdict on the diff.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- adr — docs/adr/0028-agent-position-at-sync.md, Decision › On the phone
- src/shared/schemas.ts, agentPositionSchema and syncRequestSchema
- src/client/field/useAgentPosition.ts
- src/client/field/sync.ts, runSync; src/client/field/useSync.tsx
- src/client/field/db.ts, clearAgentCache
- docs/design.md, Carte (the "no shared state" note)

## Notes

- Decision (2026-10-05, refinement): docs/domains/field-operations.md and docs/security.md already describe the phone side (story 1); this story changes them only if the code departs from what they say.
- Shipping this changes what the phone sends: the owner tells both agents before that release (ADR-0028 Consequences; the release-checklist carries the check). It is a release step, not this story's work, so `hitl` stays false.
- `brusselsPeriod` in src/shared/period.ts already gives today's Brussels bounds; reuse it.
- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
