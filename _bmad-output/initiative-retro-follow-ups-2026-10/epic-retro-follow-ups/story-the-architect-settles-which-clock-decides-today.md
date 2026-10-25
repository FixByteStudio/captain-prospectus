---
tracker_id: "642"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/642"
tracker_status: backlog
id: 11
type: story
title: "The architect settles which clock decides \"today\""
parent: epic-retro-follow-ups
covers: [CAP-20]
risk: medium
---

# The architect settles which clock decides "today"

## Description

S11, CAP-20 (538/5, N1; owner: architect first): the architect writes one decision, an ADR through the new-adr skill or a recorded "no ADR" note, that says which clock decides "today" when the phone and the server disagree on the Brussels date, including #496's far-behind-clock case; it changes no code, and the implementation stories are cut from it afterwards, not in this epic.

## Acceptance Criteria

Verify: An ADR in docs/adr, or a dated "no ADR" note in this epic's Notes and docs/domains/field-operations.md, answers N1 for a phone ahead of and far behind the server across midnight Brussels.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md

## Notes

- Open question: Whether the answer is hard to reverse (ADR-0024) or fits a line in field-operations.md.
- S11 (day rule) is architect-only; no implementation story after it until its ADR lands.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
