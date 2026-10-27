---
tracker_id: "562"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/562"
tracker_status: done
status: done
id: 7
type: story
title: "A failed admin chunk load shows a recoverable state instead of throwing"
parent: epic-retro-follow-ups
covers: [CAP-13]
after: [2, 5]
assignee: ""
refined: false
hitl: true
risk: low
---

# A failed admin chunk load shows a recoverable state instead of throwing

## Description

When the admin chunk fails to load, a live-identity admin sees the Hors ligne screen (`src/client/auth/AdminOfflineScreen.tsx`, ADR-0037) instead of an uncaught error or a blank page, and its « Réessayer » retries the chunk. `hitl`: the owner decided that a stale build after a deploy and being offline get the same state (Decision in Notes); the owner reviews the wording at review.

Widened on 2026-10-25 to the whole admin offline polish, S7 of the retro follow-ups (CAP-13; 579/5, C-2, C-3). Besides the failed chunk (C-2): a failed « Réessayer » says the admin is still offline instead of looking as if nothing happened (C-3); the `deferred-work.md:376` wording is fixed; a timeout on the gate's `/api/me` is considered. Entry 9 mirrors the final wording into EXPERIENCE.md and `docs/design.md`. The PR says `Refs #562`, quotes the `check:precache` line (entry 5), and the owner closes the issue.

## Acceptance Criteria

Verify: a test rejects the lazy admin import and asserts that the recovery state renders with its text from `copy.ts`, then resolves the import on « Réessayer » and asserts the admin screens render; a second test fails « Réessayer » and asserts the still-offline line; the PR quotes the `check:precache` line.

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
   **Then** the recovery state stays, a line from `copy.ts` says the admin is still offline, and the button can be pressed again. The same holds for the `recheckIdentity` retry of the Hors ligne screen a cache-sourced admin sees
4. **The browser's online signal does not decide it**
   **Given** `navigator.onLine` is true but the uplink is dead, or a captive portal answers every request
   **When** the admin opens the dashboard and the chunk fails
   **Then** the recovery state shows, the same as when the browser reports offline
5. **All text comes from `copy.ts`**
   **Given** the recovery state is shown
   **When** it is read
   **Then** every string in it comes from `copy.ts`, none is written in the component
6. **The online-but-unreached wording is settled**
   **Given** the `deferred-work.md` entry of spec-gh-209 (`:376`): an `/admin/*` route on a cached identity says « Hors ligne… » while the browser is online and `/api/me` failed
   **When** the story is done
   **Then** the owner's wording for that state is in `copy.ts`, and the deferred-work entry is closed with it
7. **A timeout on the gate's `/api/me` is decided**
   **Given** the admin gate waits on `/api/me` with no timeout today
   **When** the story is done
   **Then** either a timeout sends a hanging check to the Hors ligne screen, with a test, or the PR says why none is added

## Boundaries

- Must not change: the admin offline banner, the Hors ligne screen a cache-sourced admin sees (its `recheckIdentity` retry stays; criterion 3 only adds the still-offline line), and the field screens' own loading and error states.
- Must not change: the screen stays free of any link to the field side (ADR-0037).
- Must not change: the admin chunk stays out of the service worker precache, and the service worker caches no `/api/*` response.

## References

- parent — _bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/epic-retro-follow-ups.md
- spec — _bmad-output/specs/spec-retro-follow-ups-2026-10/SPEC.md, CAP-13
- retro — _bmad-output/implementation-artifacts/epic-579-retro-2026-10-24.md, findings C-2 and C-3, action 5
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
- S7 = existing #562, reuse that issue, don't open a duplicate.
- hitl: PR says "Refs #n", I close.
- Assumption: `refined` is back to false. Criteria 3, 6 and 7 are new on 2026-10-25 (CAP-13) and the owner has not reviewed them; criteria 1, 2, 4 and 5 are unchanged.
- Unknown: whether a timeout on the gate's `/api/me` is worth adding (criterion 7); it is separate from the chunk-load decision above, which rules out a probe of the chunk.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
