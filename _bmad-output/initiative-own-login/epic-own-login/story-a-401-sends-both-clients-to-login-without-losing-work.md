---
tracker_id: "309"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/309"
tracker_status: backlog
id: 12
type: story
title: "A 401 sends both clients to /login without losing work"
parent: epic-own-login
covers: [CAP-12, CAP-5]
after: [7]
risk: high
---

# A 401 sends both clients to /login without losing work

## Description

Makes a 401 open /login in the field and admin apps with the outbox untouched and the cached round dropped as today, makes Se déconnecter call entry 2's logout and open /login, and removes the Access logout link, the ?reconnect=1 marker and the /cdn-cgi/ denylist entry with their tests, checking App.tsx, SyncIndicator, sync-view, leave-guard, theme.ts, AdminLayout and OfflineBanner; the sync payload and clientVersion do not change.

## Acceptance Criteria

Verify: On pnpm dev, with two visits queued offline, revoking the agent's session and reconnecting lands the phone on /login with both visits still in the outbox, and a grep finds no reconnect marker, access-logout or /cdn-cgi/ entry.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
