---
tracker_id: "474"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/474"
tracker_status: done
id: 8
type: story
title: "The owner runs the success signal on production"
parent: epic-access-removed
covers: [CAP-13]
after: [7]
hitl: true
risk: medium
---

# The owner runs the success signal on production

## Description

The owner (hitl), once entries 1 to 7 are merged and the Deploy workflow has shipped them, runs the spec's success signal on production and checks the zone's rate-limiting rule on /api/auth/* (deployment.md, step 7).

## Acceptance Criteria

Verify: On production, an admin creates an agent and a code, the agent enrols the installed PWA, appears in the assign menu and has a position stored at the next sync with no deploy in between; deactivating them gets the phone a 401, /login and every unsent visit still in the outbox; and a burst over the rule's limit on /api/auth/* is blocked by Cloudflare before the Worker.

## References

- parent — _bmad-output/initiative-own-login/epic-access-removed/epic-access-removed.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
