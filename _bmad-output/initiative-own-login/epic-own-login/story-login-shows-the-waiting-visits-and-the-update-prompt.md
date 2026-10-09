---
tracker_id: "339"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/339"
tracker_status: backlog
id: 19
type: story
title: "/login shows the waiting visits and the update prompt"
parent: epic-own-login
covers: [CAP-12]
after: [12]
risk: low
---

# /login shows the waiting visits and the update prompt

## Description

Adds design.md's two /login rules that entries 8 and 12 left out: the meta line under the lede counting the visits waiting in this device's outbox (read only, absent while reading or on failure), and the band's update prompt when a login gets a 426.

## Acceptance Criteria

Verify: On pnpm dev, a phone with two visits in the outbox reads '2 visites non envoyées sont gardées sur ce téléphone. Elles partiront après la connexion.' on /login, the outbox is unchanged after reading it, and a stubbed 426 on login shows the update prompt instead of an error Alert.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
