---
tracker_id: "120"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/120"
tracker_status: done
id: 3
type: story
title: "Swipe actions on stop rows"
parent: epic-field-screens
covers: [CAP-6]
after: [1]
risk: medium
---

# Swipe actions on stop rows

## Description

Adds a pointer handler with no library to StopRow: swiping left opens Visiter and swiping right opens Y aller, the panel reveal is instant under prefers-reduced-motion, and vertical scrolling is never taken over.

## Acceptance Criteria

Verify: A DOM test drives each direction and asserts the action started, and on a real phone a vertical scroll over the list never triggers a swipe.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-field-screens/epic-field-screens.md

## Notes

- Open question: How to tell a horizontal swipe from a vertical scroll on iOS Safari without a library; touch-action pan-y is assumed.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
