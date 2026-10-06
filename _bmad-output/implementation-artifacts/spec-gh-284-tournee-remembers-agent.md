---
title: 'Tournée du jour remembers the chosen agent'
type: 'feature'
created: '2026-10-06'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
context: []
baseline_commit: f49d89db6be94b44058a50a8445e7e51f7bafbf5
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The agent chosen in Terrain › Tournée du jour lives only in `?agent=`. The sidebar link goes to plain `/admin/tournee`, so leaving the page and coming back shows the "choose an agent" prompt again (GH #284).

**Approach:** Keep the last chosen agent in `localStorage` (a per-viewer convenience, no server state), and use it when the URL has no `?agent=`. The URL is not rewritten on restore.

## Decisions

- Storage is `localStorage`, like the theme pin (`cap-theme`), so the choice survives closing the tab.
- A restored agent leaves the URL plain; only picking in the `Select` writes `?agent=`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Restore | No `?agent=`, remembered agent in the roster | That agent selected, their round loads | — |
| URL wins | `?agent=b`, remembered `a` | `b` selected; `a` stays remembered | — |
| Gone from roster | Remembered agent not in roster | Choose prompt, no round fetch | — |
| Storage blocked | `localStorage` throws on read or write | Works as today: URL only | Swallowed, no alert |

</frozen-after-approval>

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/admin/round/remembered-agent.ts` -- `readRememberedAgent()` / `rememberAgent(email)`, each in try/catch -- storage failure must not break the screen (mirrors `theme.ts`)
- [ ] `src/client/admin/round/RoundScreen.tsx` -- `asked = params.get("agent") ?? remembered`; the `Select` writes storage and the URL -- restore without a URL rewrite
- [ ] `src/client/admin/round/RoundScreen.test.tsx` -- one test per matrix row; clear `localStorage` in `beforeEach`
- [ ] `docs/design.md` -- "The admin round view": replace "nothing preselected" wording with the remembered agent

**Acceptance Criteria:**
- Given I chose an agent and visited another admin page, when I return to `/admin/tournee`, then that agent is selected and their round loads.

## Implementation Notes

Oneshot: about 40 lines across one new module and one screen. Decisions above were answered by the owner at the checkpoint (localStorage; no URL rewrite). Storage is read per render, not once on mount (review finding 1).

## Verification

**Commands:**
- `pnpm typecheck && pnpm test src/client/admin/round && pnpm lint` -- expected: all pass

## Review Triage Log

- medium, patched: the remembered agent was read once on mount, so a sidebar click after a pick (same mounted screen, no `?agent=`) restored the stale agent. Now read per render; same-mount test added.
- low, rejected: an empty `?agent=` blocks the restore. Same as before this change, only reachable by hand-editing the URL.
