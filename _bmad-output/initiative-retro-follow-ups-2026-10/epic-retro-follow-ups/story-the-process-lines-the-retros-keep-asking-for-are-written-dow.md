---
tracker_id: "641"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/641"
tracker_status: done
status: done
id: 10
type: story
title: "The process lines the retros keep asking for are written down once"
parent: epic-retro-follow-ups
covers: [CAP-19]
after: [9]
risk: low
---

# The process lines the retros keep asking for are written down once

## Description

S10, CAP-19 (579/6, 579/7, 580/9, 580/10, 538/10): CLAUDE.md or the bmad-build skill says a hitl PR says Refs #n unless it is the owner's acceptance, and that branches push with git push -u origin HEAD; the release-checklist review-bot line (line 11) is reworded or backed so a PR can meet it; the build skill lists the review bot's actionable comments before "ready to merge"; the d1-migration skill and docs/deployment.md say what a failed unique-index migration on an unconstrained table means and that a fresh redeploy is the remedy; and a spec that says "whatever the phone's clock" includes a midnight-crossing skew (bmad-spec or the build skill); it does not touch the PR template entry 5 owns.

## Acceptance Criteria

Verify: A grep finds each of the five lines in CLAUDE.md or the named skill, and docs/deployment.md names the fresh redeploy for a failed unique-index migration.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Whether CodeRabbit reviews every PR here: the repo has no .coderabbit config, yet 538/3 names three CodeRabbit comments; the builder checks recent PRs before choosing between rewording release-checklist line 11 and making the bot review the repo.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
