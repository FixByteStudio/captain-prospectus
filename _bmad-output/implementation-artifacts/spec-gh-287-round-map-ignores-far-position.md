---
title: 'The admin round map fits the stops only'
type: 'bugfix'
created: '2026-10-06'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
baseline_commit: 'f49d89db6be94b44058a50a8445e7e51f7bafbf5'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `RoundMap` fits the pins and the agent position together, so on the admin Tournée du jour a reading far from the stops zooms the map out until the stops are small (#287; weak point accepted in story 5.6, `_bmad-output/forge/story-5-6-map-pane-decisions/forged-idea.md:19`).

**Approach:** An optional `RoundMap` prop turns the position out of the auto-fit; `RoundScreen` sets it. The position marker is still drawn, even off-screen. With zero pins the map still centres on the position. The Carte (the agent's own phone) keeps fitting pins and position.

**Decision (owner, 2026-10-06):** pins only, no distance threshold. The question about a 2 km threshold was answered "ignore if you chose pins only" and the owner chose pins only.

</frozen-after-approval>

## Tasks & Acceptance

- `src/client/field/RoundMap.tsx` -- `fitPosition?: boolean` (default true); the auto-fit leaves the position out when false and there is at least one pin
- `src/client/admin/round/RoundScreen.tsx` -- pass `fitPosition={false}`
- `src/client/field/RoundMap.test.tsx`, `src/client/admin/round/RoundScreen.test.tsx` -- cover both
- `docs/design.md` -- "The admin round view": the map fits the stops, not the position

## Implementation Notes

Oneshot: about 30 lines, one prop, one caller. Worked in a worktree (`../captain-prospectus-287`) because another session holds the shared checkout's sibling worktree (#284).

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm typecheck`, `pnpm test`, `pnpm lint` -- expected: pass
- `pnpm build` and `pnpm check:precache` -- expected: pass; quote the precache total
