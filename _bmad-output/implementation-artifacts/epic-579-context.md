# Epic 579 Context: Admins leave the field side

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Admins do no tournée: an admin who canvasses uses an agent account. After this epic an admin account only reaches the dashboard, and every visit, tournée and position belongs to an agent account, so the round view shows everyone in the field. (Planning artifacts dir holds only research and a UX folder; the epic, the accepted ADR-0037 and the stories were the sources.)

## Stories

- Story 1: ADR: admins leave the field side (accepted)
- Story 2: Agent-only field API and assignment
- Story 3: Admin Hors ligne screen
- Story 4: Remove the admin field side and its links
- Story 5: Roles are fixed at creation
- Story 6: Utilisateurs screen in two sections
- Story 7: Refactor sweep

## Requirements & Constraints

- An admin session gets 403 on every `/api/agent/*` route, including sync.
- A prospect can be assigned only to an active agent, on every write that sets `assignedTo` (PATCH and bulk assign; import carries no assignee, so nothing to change). The admin agents list returns agents only.
- The admin field side and every link to it go, server and client, with their tests and the pinned behaviour of done backlog 010. Grep for `adminAccess`, `adminOnline` and `role !== "admin"` in `src/worker/routes/agent.ts` and `src/client` must find nothing.
- An admin landing on `/`, `/login` or the installed PWA (`start_url` `/`) goes to `/admin`. Landing logic lives in `LoginScreen.tsx` `landingFor` and the `/` redirect.
- An offline admin sees « Vous êtes hors ligne », « Le tableau de bord a besoin du réseau. Reconnectez-vous puis réessayez. » and one Réessayer button, never the field side.
- Roles are fixed at creation: no role toggle, no self-demotion jump. Changing a role means a new account and deactivating the old one; the deactivation confirmation asks for a sync first.
- `/admin/users` (Utilisateurs) lists Administrateurs and Agents in two sections; Ajouter un utilisateur sets the role once.
- Every client PR quotes the precache total against its 1,000 KiB ceiling.
- Docs must match what ships: `docs/design.md`, `docs/domains/identity-access.md`, `docs/domains/field-operations.md`, `docs/glossary.md`, `docs/api.md`.
- Out of scope: login credentials and passphrase (another epic); the admin round view's content.

## Technical Decisions

- Add `requireAgent` beside `requireAdmin`; remove the admin exceptions in `agent.ts` (visit reads of any prospect, position never stored for an admin).
- The 403 is not a sync contract change: shapes are untouched, so `CLIENT_VERSION` and `MIN_CLIENT_VERSION` do not move. The client already treats 401 and 403 as a lost session and keeps the outbox (invariant 5: never lose a visit; auth errors never clear it).
- The Hors ligne screen ships in the entry chunk so it renders without the admin chunk; ADR-0019's rule (admin chunk out of the precache) is unchanged, but its offline argument now rests on this screen instead of the field fallback.
- ADR-0028's "admin syncing from the field stores no position" becomes moot.
- Release step (story 2's hitl step, before merge): each admin who walked a round syncs from the field before the 403 ships, so no admin outbox is stuck. A user deactivated with an outbox is reactivated, syncs, then deactivated again; no new code.
- French strings go in `src/client/copy.ts` modules; UI uses vendored shadcn elements; forms use react-hook-form with shadcn `form`.
- The epic waits on the english-slugs epic (same routes); stories 3 and 5 are pinned after its story 1.1.

## UX & Interaction Patterns

- Stories 3 (Hors ligne) and 6 (Utilisateurs) are mockup first: show rendered mockups and wait for the owner's go-ahead before docs or code; the Utilisateurs screen must match the approved mockup.
- Check screens against `docs/design.md` (section Agents) before building.

## Cross-Story Dependencies

- Story 2 (server rule) is the tracer bullet and needs story 1 only; the rest cleans up around it.
- Client lane A: 3 then 4 (both edit the identity gate in `App.tsx`). Lane B: 5 then 6 (both edit the Agents screen). 2, 3 and 5 can run at once.
- Story 4 after 3; story 6 after 5; story 7 (refactor sweep) after 2, 4 and 6.
