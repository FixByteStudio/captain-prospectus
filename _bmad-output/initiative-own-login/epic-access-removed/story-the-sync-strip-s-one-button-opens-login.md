---
tracker_id: "470"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/470"
tracker_status: done
id: 4
type: story
title: "The sync strip's one button opens /login"
parent: epic-access-removed
covers: [CAP-12, CAP-14]
after: [3]
risk: high
---

# The sync strip's one button opens /login

## Description

Removes the reconnect sync action and the navigate strip effect so a lost session offers the login action alone, handles a 403 at sync as a 401, keeps redirect: "manual" in field/sync.ts with an opaque redirect counted as a failed sync, deletes reconnect-marker.ts with its test, App.tsx's marker-strip effect and the marker's entry in navigateFallbackDenylist, and updates the session-expired rows of design.md; the outbox and the 401 cache clearing do not change, and the PR quotes the precache total.

## Acceptance Criteria

Verify: sync-view.test.ts shows the session-expired strip offers only the login action, sync.test.ts shows a 401 and a 403 both leave the outbox untouched, and on pnpm dev with DEV_USER_EMAIL unset and two visits queued offline, revoking the session and reconnecting reaches /login from the strip's button with both visits still queued; a grep of src/client, vite.config.ts and config.test.ts finds no reconnect=1 or reconnect-marker.

## References

- parent — _bmad-output/initiative-own-login/epic-access-removed/epic-access-removed.md

## Notes

- Open question: Which lines of SyncIndicator and theme.ts exist only for the reconnect action; the builder lists them in the plan.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
