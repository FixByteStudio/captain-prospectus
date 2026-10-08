---
type: initiative
title: "Admin and field run on the new dashboard design"
parent: none
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11]
after: []
assignee: ""
risk: high
status: done
---

# Admin and field run on the new dashboard design

## Description

Every admin and field screen is replaced by the design in the spec's companions (DESIGN.md, EXPERIENCE.md) before the app goes live. The spec owns the capabilities, constraints and non-goals, and `server-gaps.md` lists the only server changes allowed.

## Outcome

The owner and the agents use one coherent app, a dashboard for the admin and a tabbed field app, and the spec's success signal holds: Flows 1, 2 and 4 run end to end on phone and tablet, light and dark, with the precache at or under 1,000 KiB.

## Done when

1. EXPERIENCE.md Flows 1, 2 and 4 run end to end on a seeded local build, on phone, tablet and desktop, in light and dark, Flow 1 in airplane mode.
2. No screen from before the redesign remains: every route in `screen-map.md` renders its new design.
3. `pnpm lint`, `typecheck`, `test` and `build` are green on `main`, and the build's precache line reads at or under 1,000 KiB.
4. `docs/design.md` matches the shipped screens.
5. Every server change made is one of `server-gaps.md` G1–G8, each approved on its own.

## Boundaries

The client UI (admin and field) and the server additions named in `server-gaps.md`. Not new product features beyond the spec, not deployment (roadmap M6); see the spec's Non-goals. Tracer path: E1's shells wrap today's screens unchanged, and each later epic swaps content inside a working frame.

- Touch point: Worker admin routes (`src/worker/routes/admin.ts`) — G1–G5 and G10 read-only additions; owner: epic-dashboard (G1, G2, G3, G10), epic-admin-screens (G4, G5)
- Touch point: Dexie field store — a local log of today's sent visits for daily progress (G8); owner: epic-field-screens
- Touch point: sync contract and D1 schema — agent position at sync (G7); owner: epic-admin-round-view

## References

- spec — _bmad-output/specs/spec-dashboard-redesign/SPEC.md, section Capabilities
- constraint — the same spec, sections Constraints and Non-goals
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md and EXPERIENCE.md
- server — _bmad-output/specs/spec-dashboard-redesign/server-gaps.md
- screens — _bmad-output/specs/spec-dashboard-redesign/screen-map.md

## Notes

- Decision (2026-09-24): no platform-baseline epic; scaffold, CI and environments exist since M0.
- Decision (2026-09-24): an epic is done when merged to `main` with CI green; deployment happens in roadmap M6, not per epic.
- Decision (2026-09-24): order is shared shell, dashboard, admin screens, field screens, admin round view; one screen per story in the screen epics (user's split).
- Decision (2026-09-24): CAP-4 is its own last epic, gated on the position-at-sync ADR and security review (user's choice).
- Decision (2026-09-24): CAP-11 is shared; each epic rewrites the `docs/design.md` sections for what it ships.
- Decision (2026-09-26): G6 settled in the spec: "Agents en tournée" is agents with a visit received today, no server change.
- Decision (2026-09-26): G8 settled in the spec: a local Dexie log of today's sent visits, no sync change.
- Decision (2026-09-26): G3 moves from epic-admin-screens to epic-dashboard, whose links need it first, and G10 (a multi-value `status` filter) is added to server-gaps for the Prospects ouverts link.
- Decision (2026-09-26): epic-dashboard and epic-field-screens incepted; epic-field-screens' first entries wait on 2.1 so nothing touches `app.css` while 2.1 and the G2 migration (2.2) run.
- Open question: what the notifications bell announces (spec, G9); nothing waits on it, and the bell ships inert.
- Waits on nothing external except ADR-0026 acceptance (PR #57), which epic-shared-shell's first entry records.
- Decision (2026-10-06): the initiative is closed. All six epics are done and retro'd (#59, #104, #117, #174, #246, #263; retros in `implementation-artifacts/`). The epic and story ticket files, and the build records no code or doc cites, are archived: they are in git history before this commit. Open items carry over as GH issues (#284, #287) and the deferred agents' notice before the next production deploy (epic #263 retro, action 3).
