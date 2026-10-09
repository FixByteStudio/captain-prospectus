---
tracker_id: "355"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/355"
tracker_status: backlog
id: 20
type: story
title: "Tests reach the guarded-insert re-check"
parent: epic-own-login
covers: [CAP-2, CAP-3]
after: [9]
risk: low
---

# Tests reach the guarded-insert re-check

## Description

Gives Worker tests a way to change a users row between the read and the guarded INSERT … SELECT of the code generate route and the passphrase login, and adds a test for each that fails if the guarded insert is replaced by a plain one; an enabler for the gap #305 and #306 both deferred (deferred-work.md).

## Acceptance Criteria

Verify: Replacing either guarded insert with a plain insert makes a test fail, and pnpm test is green with the guards in place.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
