---
id: 015
status: done
implements: _bmad-output/initiative-dashboard-redesign/epic-admin-screens/story-the-six-screens-at-1280-820-and-390-light-and-dark.md (#185, prep only), EXPERIENCE.md § Component Patterns, § State Patterns, § Responsive & Platform
depends_on: [014]
---

# Prepare the six-screen check at 1280, 820 and 390, light and dark (#185)

## Goal

The owner can walk the six rebuilt admin screens against a ready checklist and
sign off epic #174's "Done when 2". Every pattern row that happy-dom *can*
check is already pinned by a test. This task prepares #185; it does not close it.

## Acceptance criteria

- [ ] `_bmad-output/initiative-dashboard-redesign/epic-admin-screens/screens-check-185.md` exists. For each screen (Prospects, Import, Doublons, À rattacher, Visites, Scripts), it lists every applicable row of EXPERIENCE.md § Component Patterns and § State Patterns as an unticked box, once per width (1280, 820, 390) and theme (light, dark). Each row cites its EXPERIENCE.md line.
- [ ] Rows that happy-dom can verify (structure, text, ARIA, state switches) and that no existing test covers get a DOM test. The checklist marks those rows "pinned by <test name>".
- [ ] Rows that need media queries or computed colour stay open, marked "owner, on device".
- [ ] No screen code changes, unless a new test finds a real miss. Then the miss goes under "Found in passing" and gets a `found-in-passing` issue, and the code is left alone.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- [ ] The PR is opened as a **draft**. Its body says `Refs #185`, never `Closes`.

## Out of scope

- Ticking any "owner, on device" row, or signing off Done when 2. That is the owner's job.
- Visual regression tooling or a new test dependency.

## Notes

- The DOM harness is happy-dom, which evaluates neither media queries nor computed colour. That is why #185 is `hitl`: see retro F6 in epic-shared-shell.
- Stitch references are in `_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/` (light only; the spines correct them).
