---
id: 016
status: ready
implements: _bmad-output/initiative-dashboard-redesign/epic-admin-screens/story-refactor-sweep.md (#186), _bmad-output/implementation-artifacts/deferred-work.md
depends_on: [014, 015]
---

# Sweep epic #174's admin screens (#186)

## Goal

Clean up the code epic #174 left behind, with no new scope, so the epic's
"Done when" checks pass.

## Acceptance criteria

- [ ] Every item is drawn from `_bmad-output/implementation-artifacts/deferred-work.md` entries for epic #174 or from review findings on its PRs (#187 to the 014 PR). The PR lists each item with its source.
- [ ] Nothing a test asserts changes, except to delete a duplicate.
- [ ] The addressed entries in `deferred-work.md` are marked done.
- [ ] Epic #174 Done when 1, 3 and 4 are checked in the PR body, each with evidence. Done when 2 is noted as waiting on the owner's #185 walk.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:precache` green; the PR quotes the precache total against 1,000 KiB.
- [ ] The PR body says `Closes #186`.

## Out of scope

- New behaviour, new copy, or new screens.
- `found-in-passing` issues not touched by epic #174's diffs.
- Anything on the field route.

## Notes

- Follow the earlier sweeps' pattern: #166 (field) and #168 (dashboard).
