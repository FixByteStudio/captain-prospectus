---
tracker_id: "270"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/270"
tracker_status: done
id: 7
type: story
title: "Flow 3 at 1280, 820 and 390, light and dark"
parent: epic-admin-round-view
covers: [CAP-4, CAP-11]
after: [3, 6]
hitl: true
risk: low
refined: true
---

# Flow 3 at 1280, 820 and 390, light and dark

## Description

Runs EXPERIENCE.md Flow 3 and its no-position failure end to end on a freshly seeded local build. A real field sync carries the position, then the admin's Tournée du jour is checked at 1280, 820 and 390 in light and dark. This story changes no code.

The run, in order:

1. Fresh state: delete `.wrangler/state`, then `pnpm db:migrate:local` and `pnpm db:seed:local:full`, so the seeded dates are today's.
2. The phone part: with `DEV_USER_EMAIL="agent@example.com"` in `.dev.vars`, open the field app at 390 with the browser's location set near the agent's stops, around the Marolles. Let it take a reading and sync. The server stores a position only for an agent in `AGENT_EMAILS`, which is why the run switches users.
3. The admin part: set `DEV_USER_EMAIL` back to `admin@example.com`, restart `pnpm dev`, and open Terrain › Tournée du jour.
4. With a position: pick `agent@example.com`. Without one: pick `admin@example.com`, who is offered in the list but never stores a position. No reset is needed between the two states.

At each width and theme, the run checks the screen against Flow 3, the "No agent position" row of EXPERIENCE.md and the admin round view in docs/design.md:
- With a position: the list follows nearest-next from the position, "Position du {date heure}" shows its age, the pins are numbered like the list, pin 1 is gold with the dashed path and the position marker, and the OSM attribution is visible.
- Without one: the list is in name order with the "Aucune position reçue aujourd'hui…" notice, and the pins are numbered and card-coloured with no path and no marker.
- At 390: the header and the agent Select come first, then the map at a fixed height, then the list.
- At 820 and 1280: the list is on the left and the map on the right, and the map stays in view as the list scrolls.

The run also takes one reading a few kilometres from the stops. It confirms or dismisses the fit weak point story 5.6 left for this run.

The person's part (hitl): the owner checks the screens against `mockups/key-admin-round.html`. They confirm that Flow 3's climax holds: the admin sees where the round stands without calling the agent.

## Acceptance Criteria

Verify: The owner has run the check by hand at 1280, 820 and 390, light and dark, with a position and without one, and confirmed Flow 3 holds. No screenshots are produced or committed. The diff holds only this ticket.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, Flow 3 and No agent position
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-admin-round.html
- design — docs/design.md, The admin round view
- decision — docs/adr/0028-agent-position-at-sync.md
- forge — _bmad-output/forge/story-5-6-map-pane-decisions/forged-idea.md, weak points accepted
- setup — README.md, local seed; .dev.vars.example

## Notes

- Decision (2026-10-06, refinement): the story changes no code. Each defect the run finds becomes a found-in-passing issue linked in the PR. A defect that stops Flow 3 from running is filed as a bug that this story waits on (`after`), and the run resumes once it is fixed.
- Decision (2026-10-06, owner): the owner checked Flow 3 by hand and it holds; no screenshots are taken or committed. This replaces the 12-screenshot rule.
- Decision (2026-10-06, refinement): the agent runs the whole flow, including a faked browser location. The owner's part is the check itself.
- Assumption: after a fresh full seed, `agent@example.com` has stops due today. The seed assigns them about a third of the places. If none are due, the admin assigns a few in Prospects before the phone part. That path is real, and the PR says it was taken.
- Open question: None known.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
