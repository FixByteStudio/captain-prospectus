---
id: 1
tracker_id: 562
remote: https://github.com/FixbyteStudio/captain-prospectus/issues/562
type: story
title: "A failed admin chunk load shows a recoverable state instead of throwing"
parent: none
covers: []
after: []
assignee: ""
refined: true
hitl: true
risk: low
---

# A failed admin chunk load shows a recoverable state instead of throwing

## Description

When the admin chunk fails to load, a live-identity admin sees the Hors ligne screen (`src/client/auth/AdminOfflineScreen.tsx`, ADR-0037) instead of an uncaught error or a blank page, and its « Réessayer » retries the chunk. `hitl`: the owner decided that a stale build after a deploy and being offline get the same state (Decision in Notes); the owner reviews the wording at review.

## Acceptance Criteria

Verify: a test rejects the lazy admin import and asserts that the recovery state renders with its text from `copy.ts`, then resolves the import on « Réessayer » and asserts the admin screens render.

1. **A failed load shows the recovery state**
   **Given** an admin on `/admin/*` whose admin chunk request fails
   **When** the load fails
   **Then** no error is thrown past the page, and the Hors ligne screen shows (its band, `copy.adminOffline` title and body, and « Réessayer »)
2. **« Réessayer » loads the admin screens**
   **Given** the recovery state is shown and the network is back
   **When** the admin presses « Réessayer »
   **Then** the admin chunk is requested again (React's `lazy` caches a rejected import, so the retry needs a fresh import), the admin screens load without a full page reload, and the recovery state is gone
3. **« Réessayer » fails again without losing the state**
   **Given** the recovery state is shown and the network is still down
   **When** the admin presses « Réessayer »
   **Then** the recovery state stays and the button can be pressed again
4. **The browser's online signal does not decide it**
   **Given** `navigator.onLine` is true but the uplink is dead, or a captive portal answers every request
   **When** the admin opens the dashboard and the chunk fails
   **Then** the recovery state shows, the same as when the browser reports offline
5. **All text comes from `copy.ts`**
   **Given** the recovery state is shown
   **When** it is read
   **Then** every string in it comes from `copy.ts`, none is written in the component

## Boundaries

- Must not change: the admin offline banner, the Hors ligne screen a cache-sourced admin sees (its `recheckIdentity` retry stays), and the field screens' own loading and error states.
- Must not change: the screen stays free of any link to the field side (ADR-0037).
- Must not change: the admin chunk stays out of the service worker precache, and the service worker caches no `/api/*` response.

## References

- decision — docs/adr/0037-admins-leave-the-field-side.md, Decision (the Hors ligne screen, entry chunk only)
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, § State Patterns, row « Offline · Admin », last sentence
- decision — docs/adr/0019-admin-chunk-out-of-the-precache.md, Consequences (the known gap, named as its own change)
- design — docs/design.md, the admin shell's network and access states
- source — _bmad-output/implementation-artifacts/deferred-work.md, the spec-gh-115 entry (a rejected lazy import throws past `Suspense`) and the spec-gh-209 entry (the offline sentence with « Réessayer » while the chunk loads)

## Notes

- Decision: the strings go in `copy/field`, because the fallback renders from the entry chunk (owner, 2026-09-29, per the spec-gh-209 entry).
- Assumption: the recovery state sits around the `/admin/*` route's `Suspense` in `src/client/App.tsx` only; the field's own lazy screens are not part of this ticket. Confirm or widen.
- Decision: the recovery state reuses `AdminOfflineScreen` and its `copy.adminOffline` strings, with no new layout; only its retry differs (re-import the chunk, not re-check `/api/me`). Rewritten after ADR-0037 removed the field frame from the admin path (triage 2026-10-22).
- Decision: a stale chunk hash after a deploy and being offline get the same recovery state: the offline sentence with « Réessayer » for both. No probe, no `navigator.onLine` check, no reload offer (owner, 2026-10-18). Criteria 1–5 cover it.
