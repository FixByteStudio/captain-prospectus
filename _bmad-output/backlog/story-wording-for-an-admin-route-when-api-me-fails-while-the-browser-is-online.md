---
tracker_id: "572"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/572"
tracker_status: dropped
status: dropped
id: 1   # tracker_id and remote are written at publish on a tracker
type: story
title: "Wording for an /admin route when /api/me fails while the browser is online"
parent: none
covers: []
after: []
assignee: ""
refined: false
hitl: true
risk: low
severity: P3
labels: [area:field]
estimate: ""
---

# Wording for an /admin route when /api/me fails while the browser is online

## Description

An agent or admin who opens an `/admin/*` route on a cached identity while the browser is online, and `/api/me` has failed, reads a sentence that fits that case and does not contradict the sync strip above it. The owner chooses the French sentence first (hitl); the build after that is small.

## Acceptance Criteria

1. **Online with a failed check: its own sentence**
   **Given** a cached identity, a browser that reports it is online, and a failed `/api/me` that was not a 401
   **When** the person opens an `/admin/*` route
   **Then** the page shows the owner's chosen sentence, not the offline one, with the same "Retour à la tournée" action in the field band
   **And** the sentence does not say the person is offline or lacks access
2. **Offline keeps today's page**
   **Given** a cached identity and a browser that reports it is offline
   **When** the person opens an `/admin/*` route
   **Then** the page shows the existing offline sentence, unchanged
3. **The page follows the browser's state**
   **Given** the online-case page is showing
   **When** the browser goes offline, or a re-check confirms the identity
   **Then** the page changes to the offline sentence, or to the admin screen or the access-denied page the server's answer calls for
4. **The rule is written down**
   **Given** the identity-access domain doc and EXPERIENCE.md § State Patterns
   **When** they are read after this ticket
   **Then** both state the wording for the online case, and the domain doc no longer says the offline page also shows there
5. **The new wording is the only sentence added**
   **Given** the French copy modules
   **When** the build is done
   **Then** the sentence lives in the field copy module and no component inlines French

## Boundaries

- Must not change: the offline sentence, the access-denied sentence and when each shows for a role the server confirmed; the sync strip's wording; a cached identity never opening the admin screens or saying access is denied, whatever its role (invariant 10).

## References

- source — _bmad-output/implementation-artifacts/deferred-work.md, entry from spec-gh-209-offline-after-reload-page (PR #445)
- domain doc — docs/domains/identity-access.md, "On a cached identity, an `/admin/*` route says it needs the network"
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, § State Patterns, "Offline, after a reload"

## Notes

- hitl step: the owner picks the French sentence from the candidates below, or writes another. The build waits on that choice.
- Today: `/admin/*` on a cached identity shows `copy.adminRoute.offline` ("Hors ligne. Cette page a besoin du réseau. Votre tournée reste accessible.") even when the browser is online and `/api/me` failed (Worker 5xx, captive portal). The strip above it reads `copy.sync.unconfirmed` ("Vérification de votre session. Vos visites sont conservées et partiront ensuite."), so "Hors ligne" contradicts it.
- Candidate wordings, none picked. Each keeps the reassurance about the tournée and avoids "Hors ligne" and any access wording:
  - A. « Impossible de vérifier votre session pour le moment. Cette page a besoin du serveur. Votre tournée reste accessible. »
  - B. « Le serveur ne répond pas. Cette page a besoin de la connexion à votre compte. Votre tournée reste accessible. » (Not accurate with a captive portal: something answered, just not the server.)
  - C. « Connexion au serveur impossible. Nous réessayons. Votre tournée reste accessible. » (promises retry: the app re-checks `/api/me` while the network reads live, so this is true today.)
- Where the build goes (for the builder, not requirements): a new key beside `adminRoute.offline` in `src/client/copy/field.ts`; a branch on `navigator.onLine` (the `useOnline` hook) at the cached-identity route in `src/client/App.tsx` (~line 556, where the comment says "that case has no wording of its own yet"); one line in `docs/domains/identity-access.md` (~lines 125-130); the test "gives the same page, not the forbidden state, when /api/me fails while the browser reports a network" in `src/client/App.test.tsx` (~line 933) pins today's behaviour and changes.
- Decision (2026-10-18): the Wi-Fi-off icon stays on the offline page only. The online case gets a neutral icon, because a Wi-Fi-off glyph repeats the contradiction.
- Decision (2026-10-18): EXPERIENCE.md § State Patterns gets one row for the new state, beside the offline one, in addition to the identity-access.md line.
- Captive portal, checked 2026-10-18: a portal's redirect fails as an opaque redirect (status 0) and a portal's 200 HTML page fails JSON parsing. Both are non-401 failures, so both reach the same cache-sourced page as a Worker 5xx. One sentence covers all three. It must not name the server as the cause, because with a portal the server was never reached.
- Risk low: a copy change that shows at once on the page, and a revert is clean.
- Dropped: obsolete after ADR-0037 (triage 2026-10-22). A cache-sourced admin on `/admin/*` always gets the Hors ligne screen, with no field band; only an agent typing an `/admin/*` URL while `/api/me` fails online still reads the offline sentence (`src/client/App.tsx:553-561`), and the owner accepts that wording. Closed as not planned on GitHub.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
