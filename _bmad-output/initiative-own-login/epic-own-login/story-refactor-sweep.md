---
tracker_id: "314"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/314"
tracker_status: backlog
id: 17
type: story
title: "Refactor sweep"
parent: epic-own-login
after: [11, 12, 13, 14, 15, 16, 19, 20, 21]
risk: low
refined: true
---

# Refactor sweep

## Description

Cleanup only, with no behaviour change, over the code this epic added. The scope was set at refinement from the epic's build records (spec-gh-298 to spec-gh-313) and its entries in deferred-work.md:
- **The `useAgents` comment** in the admin queries says the roster is a Worker variable that cannot change. Since #303 the roster is the `users` rows, kept fresh by the invalidation on user changes. The comment says that, and `staleTime` stays as it is.
- **The `scheduled` handler's comment** in the Worker entry names only the visit redaction and map-cache eviction. It also names the position sweep and the auth-row sweep (deferred from #310).
- **The Agents row menu's dialog** (deferred from #304): on `pnpm dev`, open Désactiver from a row menu, cancel, then click the page. If clicks are dead, the row menu stops being modal. Either way, the PR says what was seen.
- **A duplication map** over the epic's new code: the session, login, throttle, Origin and auth-sweep modules on the Worker, the identity routes, `/login`, and the Agents page. Each duplicate it finds is merged when doing so changes no behaviour. Anything larger goes to deferred-work.md.
- **deferred-work.md** gains a `closed_by` line for each entry from this epic that is now settled:
  - the Access fallback that let a deactivated user in (#299; the fallback refuses an inactive row since #302);
  - the Prospects filter for a deactivated assignee (#303; closed by #308);
  - the `useAgents` comment (#303; this sweep);
  - and the row-menu dialog (#304), once checked.

  The file is append-only, so only `closed_by` lines are added.

Not here: the items that stay deferred with an owner decision or an enabler still to come. These are the per-account login limit (#301), the seed scripts' Origin check (#301), the migration-backfill harness (#307), and the cold-start CPU (GH #341). Entries 20 and 21 and epic-access-removed's contract step are separate tickets.

## Acceptance Criteria

Verify:
- `pnpm lint`, `typecheck`, `test` and `build` are green, and no test changes its expectation.
- The precache stays at or under 1,000 KiB, quoted in the PR.
- The PR lists each duplicate found and what was done with it.
- Each `closed_by` line names the commit or PR that settled the entry.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- deferred — _bmad-output/implementation-artifacts/deferred-work.md, the entries whose source_spec is spec-gh-299 to spec-gh-309
- records — _bmad-output/implementation-artifacts/spec-gh-298-design-login-agents-a-traiter.md to spec-gh-313-deployment-and-budget-docs.md, review tables

## Notes

- Decision (2026-10-09): scope set at refinement, not at pull, from the build records of entries 1–16.
- Decision (2026-10-09): items that change behaviour became their own tickets. The guarded-insert test enabler is entry 20, the identity re-check's leave guard is entry 21, and the `sessions.id` contract step goes to epic-access-removed. The sweep waits on entries 20 and 21.
- Decision (2026-10-09): the row-menu dialog fix is allowed here although it touches behaviour. It changes one prop, and only when the check shows the page frozen.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
