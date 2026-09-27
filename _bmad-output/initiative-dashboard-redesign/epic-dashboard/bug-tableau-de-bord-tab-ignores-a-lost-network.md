---
tracker_id: "115"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/115"
tracker_status: done
id: 11
type: bug
title: "Tableau de bord tab ignores a lost network"
parent: epic-dashboard
covers: [CAP-5]
after: [3]
refined: true
risk: medium
severity: P2
---

# Tableau de bord tab ignores a lost network

## Description

An admin in the field keeps the Tableau de bord tab after their phone loses the network, and tapping it opens an admin screen that cannot load. The reverse also fails: an admin who opened the app offline never gets the tab or the admin screens back when the network returns, until they reload. The tab should show exactly while the user is a verified admin with a network, and it and the admin's landing page should open Tableau de bord at `/admin`, the admin's home since #107.

## Reproduction

1. `pnpm dev`, signed in as an admin, network on. Open `/tournee`. The tabs show Tournée, Ajouter and Tableau de bord.
2. Turn the network off (devtools Offline, or airplane mode).
3. Actual: the Tableau de bord tab stays. Tapping it mounts the admin routes, whose chunk is not precached (ADR-0019), so the screen fails to load. Expected: the tab disappears while offline and comes back when the network returns.
4. Reload with the network off, so the identity comes from the cache, then turn the network on.
5. Actual: no Tableau de bord tab, and `/admin` shows "forbidden" until a reload. Expected: once the server confirms the admin, the tab and the admin screens return without a reload.
6. Actual, online: the tab and `/` both lead to `/admin/prospects`. Expected: `/admin`.

Not run here: it needs the dev identity from `.dev.vars` and a browser. The reading of the code on `main` at acfb094 supports every step.

## Cause Hypothesis

The shell decides "admin with a network" once, when the identity first resolves: a cached identity means offline for the whole session, a live one means online for the whole session. Nothing listens for the network changing afterwards, and nothing asks the server again when it comes back, so the tab and the admin routes follow the network state at load. The `/admin/prospects` target predates the `/admin` index route #107 added.

## Acceptance Criteria

1. **The tab follows the network for a verified admin**
   **Given** an admin whose identity the server confirmed in this session
   **When** the device goes offline, then online again
   **Then** the Tableau de bord tab disappears while offline and returns once online, with no reload
2. **A session that started offline recovers when the network returns**
   **Given** an admin whose identity came from the cache because the app opened offline
   **When** the network returns
   **Then** the app asks the server for the identity again, and only once the server confirms an admin do the tab and the admin screens become available, with no reload; the cached identity alone never unlocks them (invariant 10)
3. **A failed re-check changes nothing**
   **Given** the same offline-started session
   **When** the network returns but the identity check fails or the server answers with a non-admin role
   **Then** the user stays on the field side with no tab and `/admin` still shows "forbidden", and a revoked identity follows the existing error path (identity-access.md)
4. **Going offline never takes an admin off their screen**
   **Given** an admin already on an `/admin` screen
   **When** the device goes offline
   **Then** they stay on that screen; only the field tab changes
5. **Tableau de bord is the admin's home**
   **Given** a verified admin with a network
   **When** they tap the Tableau de bord tab, or open `/`
   **Then** they land on `/admin`; a user who is not a verified admin with a network still lands on `/tournee`
6. **Tests cover the conditions found and fixed**
   **Given** the `dom` test project
   **When** it runs
   **Then** tests that fail on today's code and pass on the fix cover criteria 1, 2 and 5, one covers criterion 3, and together they pin #85's offline-admin branch; the PR quotes the precache total and the entry chunk (ADR-0026)
7. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the expected behaviour already holds, with the evidence recorded in Notes — this supersedes 1 to 6

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-dashboard/epic-dashboard.md
- spec — _bmad-output/specs/spec-dashboard-redesign/SPEC.md, CAP-5 ("The Tableau de bord tab shows only for an admin with a network")
- domain — docs/domains/identity-access.md
- adr — docs/adr/0019-admin-chunk-out-of-the-precache.md
- issue — https://github.com/FixbyteStudio/captain-prospectus/issues/93
- issue — https://github.com/FixbyteStudio/captain-prospectus/issues/85

## Notes

- Decision (2026-09-26): when the network returns in a session that started offline, the app re-checks the identity with the server; a confirmed admin gets the tab and the admin screens back without a reload (user).
- Decision (2026-09-26): losing the network hides only the tab; an admin already on an `/admin` screen keeps it, since admin offline states are #97's to design (user).
- Decision (2026-09-26): the tab and the `/` redirect both land an admin on `/admin` (user).
- Decision (2026-09-26): #85's offline-admin half is covered by criterion 6; its identity-error-screen half stays open on #85.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
