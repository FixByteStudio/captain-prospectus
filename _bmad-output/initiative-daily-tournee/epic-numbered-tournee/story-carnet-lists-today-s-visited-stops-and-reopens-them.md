---
tracker_id: "504"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/504"
tracker_status: done
id: 8
type: story
title: "Carnet lists today's visited stops and reopens them"
parent: epic-numbered-tournee
covers: [R9, R16]
after: [7]
risk: medium
---

# Carnet lists today's visited stops and reopens them

## Description

Built to entry 1's design, a Carnet tab lists today's visited stops with their number and latest outcome, closed prospects included, from entry 7's helper over the server's visited stops and the outbox. Tapping a row opens the visit form and saves a new visit. field-operations.md › Carnet follows, and the PR quotes the precache total.

## Acceptance Criteria

Verify: On a local build, a converted stop and a no-contact stop show in Carnet with their numbers. Reopening the no-contact stop saves a second visit, the counter does not move, and the admin sees both visits. A second browser profile signed in as the same agent shows the same Carnet after a sync.

## References

- parent — _bmad-output/initiative-daily-tournee/epic-numbered-tournee/epic-numbered-tournee.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
