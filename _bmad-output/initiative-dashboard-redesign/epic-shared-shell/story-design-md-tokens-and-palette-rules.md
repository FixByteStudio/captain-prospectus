---
tracker_id: "62"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/62"
tracker_status: done
id: 3
type: story
title: "DESIGN.md tokens and palette rules"
parent: epic-shared-shell
covers: [CAP-10, CAP-11]
risk: low
---

# DESIGN.md tokens and palette rules

## Description

Brings app.css @theme to the DESIGN.md token set (new band-accent, band-border, outcome-* colours, badge tints, overline type) in light and dark, extends palette.test.ts to assert the five Colors rules, and rewrites design.md's Grounding, Colour and Type sections.

## Acceptance Criteria

Verify: pnpm test fails if any of the five DESIGN.md Colors rules is broken in either theme, and every DESIGN.md colour token resolves in app.css.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-shared-shell/epic-shared-shell.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
