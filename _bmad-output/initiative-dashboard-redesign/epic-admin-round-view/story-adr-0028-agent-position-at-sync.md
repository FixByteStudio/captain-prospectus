---
tracker_id: "264"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/264"
tracker_status: done
id: 1
type: story
title: "ADR-0028: agent position at sync"
parent: epic-admin-round-view
covers: [CAP-4]
hitl: true
risk: high
---

# ADR-0028: agent position at sync

## Description

Writes ADR-0028 deciding that the phone sends the last position reading it already took today with each sync (sync never requests GPS), that the server keeps one row per agent overwritten by a newer reading and deleted overnight when not from today, that `at` is clamped to received_at, that only admins see it in Terrain › Tournée du jour, and how this stays inside vision.md's no-continuous-tracking non-goal and invariants 2, 4 and 12; security-reviewer reviews it, the owner accepts it, and docs/domains/field-operations.md:199, docs/vision.md:30 ('captured at check-in only') and docs/glossary.md ('agent position') record the rule.

## Acceptance Criteria

Verify: ADR-0028 is listed as accepted in docs/adr, the security-reviewer verdict is linked in its PR, and field-operations.md no longer says agent-position retention is undecided.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- docs/adr/0023-retention-by-redaction.md
- docs/adr/0024-adrs-only-for-hard-to-reverse-decisions.md
- docs/vision.md, Non-goals
- _bmad-output/specs/spec-dashboard-redesign/server-gaps.md, G7

## Notes

- Open question: Whether the admin map shows the exact position dot (the mockup and DESIGN.md › Map already draw one) or only its age; the ADR settles it.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
