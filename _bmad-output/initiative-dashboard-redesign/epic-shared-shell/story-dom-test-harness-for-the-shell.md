---
tracker_id: "83"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/83"
tracker_status: done
id: 9
type: story
title: "DOM test harness for the shell"
parent: epic-shared-shell
covers: [CAP-1, CAP-5]
after: [2, 4, 5, 6, 7]
risk: low
---

# DOM test harness for the shell

## Description

Adds a DOM test environment to the unit project and component tests for the shell: which frame and redirect each route gets per role, the sync strip and update prompt wiring, the admin top bar's controls, and the field leave guard (useRegisterDirty and the tab bar's preventDefault).

## Acceptance Criteria

Verify: pnpm test runs the new DOM tests in CI, and each one fails when the behaviour it guards is removed: the non-admin forbidden route, the updatePrompt or sync strip wiring, a top-bar control's handler, useRegisterDirty in a form, or FieldTabs' preventDefault.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-shared-shell/epic-shared-shell.md
- deferred — _bmad-output/implementation-artifacts/deferred-work.md, the GH #61 entry "No automated test asserts which frame each route and role renders in"
- spec — _bmad-output/specs/spec-dashboard-redesign/SPEC.md, CAP-1 and CAP-5

## Notes

- New dependency (CLAUDE.md asks for size, maintenance, workerd compatibility, and why the platform can't do it). The PR restates these figures as measured:
  - Size: devDependencies only, so nothing enters the client bundle or the 1,000 KiB precache (ADR-0026). Unpacked on npm (2026-09-25): happy-dom 20.14 is 8.2 MB with 7 dependencies; @testing-library/react 16.3 is 332 KB, with its peer @testing-library/dom 10.4 at 2.4 MB; @testing-library/user-event 14.6 is 427 KB and optional.
  - Maintenance: the builder checks each package's latest release date and the tests' support for React 19 and vitest 4, and states both in the PR.
  - workerd: not applicable. They run only in the vitest `unit` project, never in the `worker` project or the Worker bundle.
  - Why the platform can't do it: the unit project runs in node with no DOM, and `react-dom/server` rendering runs no effects. The identity fetch, `Navigate`, the leave guard and the palette's key handler all live in effects or events. Today these rows are checked only by hand in `pnpm dev`, and CI passes when they break (the GH #61 review).
- Open question: which DOM environment. happy-dom is the default (7 dependencies, fast). jsdom has 20 dependencies and is closer to browsers. Choosing one is part of this story's work.
- Assumption: DOM tests are `*.test.tsx` files run by a DOM-environment project or a per-file environment in `vitest.config.ts`. The existing node tests stay as they are.
- Decision (2026-09-25): added before the refactor sweep, which now waits on it (user's request).

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
