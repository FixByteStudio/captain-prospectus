---
title: 'GH #539: the release checklist waits for the review bot'
type: 'chore'
created: '2026-10-17'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: '9bb55d1fa6836134523d8c68d9e41251ef2392d5'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #496's retro (action 8) found PRs merged before CodeRabbit had finished, and the release checklist has no line for it. ADR-0028 (Consequences, lines 139–140) and `docs/security.md` line 43 still promise that the owner *will* tell both agents before the position-at-sync release, though the owner confirmed on 2026-10-13 that both were told and the phone side has shipped (`src/client/field/sync.ts` sends `position`).

**Approach:** Add "CodeRabbit finished; each actionable comment answered or filed" to the Before merge list of `.claude/skills/release-checklist/SKILL.md`. Reword the ADR-0028 consequence and the `security.md` sentence to the past tense: the phone side shipped and the owner told both agents before that release. Keep the checklist's existing location line ("The owner has told the agents first"), which guards a future change to what the phone sends (ticket Notes: the builder keeps it unless the owner says otherwise).

</frozen-after-approval>

## Implementation Notes

Oneshot because the change is three sentences in three docs, with no code.

Acceptance (ticket #539): the checklist's Before merge list has the review-bot line, and a grep of `docs/adr/0028-agent-position-at-sync.md` and `docs/security.md` finds no promise that the owner will tell the agents.

Evidence that the agents were told: `_bmad-output/implementation-artifacts/epic-296-297-retro-2026-10-13.md:239` ("The owner confirmed on 2026-10-13 that both agents were told").

Implemented (2026-10-17):
- `.claude/skills/release-checklist/SKILL.md`: the CodeRabbit line, second in Before merge, right after CI green. The location line is kept as written.
- `docs/adr/0028-agent-position-at-sync.md`: the consequence now says the phone side shipped and the owner told both agents (confirmed 2026-10-13), and that the checklist keeps the check for a later change to what the phone sends.
- `docs/security.md`: the same sentence, in the same tense.
- Deviation from the Approach wording, after review: the docs do not say "before that release". The evidence dates only the confirmation (2026-10-13), and the 2026-10-06 retro records the owner's decision not to tell the agents yet, so "before" is unproven. The docs say what the ticket asks: the owner told both agents.
- The body edit to an accepted ADR goes against `docs/adr/README.md:3`. Ticket #539 and epic #538 R2 ask for it, as ADR-0036's 2026-10-15 amendment did, and the PR description says so.

## Review Triage Log

Quick review, pass 1 (high 0 / medium 1 / low 1 / false 1 / maybe-false 0):
- medium, patch: "told both agents before that release (2026-10-13)" claimed an order the evidence does not show (`epic-263-retro-2026-10-06.md:87`, `epic-296-297-retro-2026-10-13.md:239`). Reworded both docs to "told both agents (confirmed 2026-10-13)".
- low, patch (PR description): the ADR-0028 body edit breaks `docs/adr/README.md:3` ("never edited after acceptance"). It is the ticket's requirement (R2) and has a precedent, so the exception is stated in the PR rather than undone.
- false: `docs/domains/field-operations.md:23` ("With epic 5, the latest reading … goes with each sync") was left out. It promises nothing about telling the agents and reads as a present fact; the epic's Notes already checked this ("`field-operations.md`, which carries no such promise").

## Verification

**Commands:**
- `grep -nE "tells (both|the) agents|will tell" docs/adr/0028-agent-position-at-sync.md docs/security.md` -- expected: no match
- `grep -n "CodeRabbit" .claude/skills/release-checklist/SKILL.md` -- expected: one line under Before merge
- `pnpm lint` -- expected: passes (Prettier covers Markdown)
