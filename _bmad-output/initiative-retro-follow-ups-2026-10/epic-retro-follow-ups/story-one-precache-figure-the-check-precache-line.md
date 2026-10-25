---
tracker_id: "637"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/637"
tracker_status: backlog
id: 5
type: story
title: "One precache figure: the check:precache line"
parent: epic-retro-follow-ups
covers: [CAP-17]
risk: low
---

# One precache figure: the check:precache line

## Description

S5, CAP-17 (580/8, 579/9, P-3), the two-deferral enabler: the only precache number a PR author sees is the check:precache line against the 1,000 KiB ceiling (ADR-0031), by making a clean pnpm build end with that line or by adding it to the CI job summary (the story picks unless the owner prefers one), and .github/pull_request_template.md tells authors to paste it, and the UI line of CLAUDE.md that says every PR quotes the precache total names that line; entries 7 and 8 quote it.

## Acceptance Criteria

Verify: A clean pnpm build, or the CI job summary of the story's own PR, ends with the check:precache line against 1,000 KiB, and the PR template and CLAUDE.md ask for that line and no other precache figure.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Which of the two places the line lands in; the spec leaves it to the story unless the owner prefers one.
- S4 and S5 are the two-deferral enablers.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
