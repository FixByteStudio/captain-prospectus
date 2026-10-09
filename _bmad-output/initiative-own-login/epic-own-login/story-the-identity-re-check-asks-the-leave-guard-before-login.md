---
tracker_id: "356"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/356"
tracker_status: backlog
id: 21
type: story
title: "The identity re-check asks the leave guard before /login"
parent: epic-own-login
covers: [CAP-12]
after: [12]
risk: medium
---

# The identity re-check asks the leave guard before /login

## Description

Makes a Worker 401 on the identity re-check of a cache-started session go through the leave guard before it opens /login, as the sync strip's button does, so an open visit form is never dropped (deferred from #309, deferred-work.md); the outbox and the 401 cache clearing are unchanged.

## Acceptance Criteria

Verify: On pnpm dev, an agent who launched offline with a visit form open gets the leave-guard prompt when the re-check returns 401, and both choices behave as at the strip's button; the outbox is untouched either way.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
