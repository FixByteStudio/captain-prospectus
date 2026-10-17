---
tracker_id: "539"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/539"
tracker_status: backlog
id: 1
type: story
title: "The release checklist waits for the review bot"
parent: epic-tournee-holds
covers: [R1, R2]
risk: low
---

# The release checklist waits for the review bot

## Description

Retro action 8: adds "CodeRabbit finished; each actionable comment answered or filed" to the Before merge list of .claude/skills/release-checklist/SKILL.md, and rewords ADR-0028's consequence at lines 139-140 and docs/security.md line 43 to say the owner told both agents, not that the owner will tell them before the release.

## Acceptance Criteria

Verify: The checklist's Before merge list has the review-bot line, and a grep of docs/adr/0028-agent-position-at-sync.md and docs/security.md finds no promise that the owner will tell the agents.

## References

- parent — _bmad-output/initiative-tournee-hardening/epic-tournee-holds/epic-tournee-holds.md

## Notes

- Open question: Whether the checklist's existing location line ("The owner has told the agents first") stays as written; it guards a future change to what the phone sends, so the builder keeps it unless the owner says otherwise.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
