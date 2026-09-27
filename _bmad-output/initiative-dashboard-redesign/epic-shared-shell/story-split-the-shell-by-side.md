---
tracker_id: "61"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/61"
tracker_status: done
id: 2
type: story
title: "Split the shell by side"
parent: epic-shared-shell
covers: [CAP-1, CAP-5]
risk: medium
---

# Split the shell by side

## Description

Tracer bullet: the admin chunk owns an admin layout (a plain nav of today's links and an empty top-bar slot) and the App.tsx header becomes the field-only band, with every existing screen rendering unchanged inside its frame.

## Acceptance Criteria

Verify: In pnpm dev every route in screen-map.md's 'Today' column opens in its side's frame, the / redirect still works for admin and agent, and pnpm test passes.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-shared-shell/epic-shared-shell.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
