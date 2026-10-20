# ADR-0037: Admins leave the field side

- Status: accepted
- Date: 2026-10-19
- Deciders: owner
- Amends: [ADR-0019](0019-admin-chunk-out-of-the-precache.md) (what an offline admin sees), [ADR-0028](0028-agent-position-at-sync.md) (an admin syncing from the field)

## Context

**An admin can do everything an agent can, and the round view cannot show it.**
`/api/agent/*` checks only that there is an identity, so an admin can sync visits
and field prospects. `admin.ts:163` lets a prospect be assigned to an admin ("an
admin may well walk a round"), and `agent.ts:342` lets an admin read any prospect's
visits. But ADR-0028 stores no position for an admin syncing from the field
(`agent.ts:284`), so an admin's tournée never appears on Terrain › Tournée du jour.

**An offline admin is shown the field side.** ADR-0019 relies on it:
`adminAccess(...).screens` is `false` for a cache-sourced identity, so an admin
with no network lands on the round, the visit form and the outbox, which is why the
admin chunk could leave the precache.

**Roles can change after creation.** The Agents screen has « Passer admin » /
« Passer agent » and a jump that follows a self-demotion. A role change on someone
with assigned prospects or an outbox leaves work attached to the wrong kind of
account.

**Visits in an outbox must survive** (INVARIANT 5). `src/client/field/sync.ts`
treats 401 and 403 alike as a lost session: the outbox is kept and `/login` is the
way back. The data stage is disposable (CLAUDE.md), so no stored row has to survive,
but an outbox does.

The owner decided (initiative admin-field-separated, 2026-10-19) that **admins do
no tournée**: an admin who canvasses uses an agent account.

## Decision

We will **make the field side agent-only and the dashboard admin-only.**

- **No tournée for an admin.** `/api/agent/*` sits behind a `requireAgent` beside
  `requireAdmin` and answers 403 to an admin session. The admin exceptions in
  `agent.ts` go.
- **Assignment targets an active agent only**, on every write that sets
  `assignedTo`: PATCH, bulk assign and import. `/api/admin/agents` lists agents only.
- **The admin field side is removed with every link to it**: `adminAccess`, the
  `adminOnline` prop chain, the avatar card's Tableau de bord, and the `/` redirect
  that sends an offline admin to the field. An admin landing on `/`, `/login` or the
  installed PWA (`start_url` `/`) goes to `/admin`.
- **An offline admin sees a Hors ligne screen** — « Vous êtes hors ligne », « Le
  tableau de bord a besoin du réseau. Reconnectez-vous puis réessayez. » and one
  Réessayer button — never the field side. It ships in the entry chunk, so it renders
  without the admin chunk; ADR-0019's precache rule is unchanged.
- **Roles are fixed at creation.** The role toggle and the self-demotion jump go.
  Changing someone's role means a new account and deactivating the old one; the
  deactivation confirmation asks for a sync first.
- **The Agents screen becomes Utilisateurs** at `/admin/users`, in two sections,
  Administrateurs and Agents. Ajouter un utilisateur sets the role, once.

**The 403 is not a sync contract change.** The request and response shapes are
untouched, and the client already handles 403 by keeping the outbox. Neither
`CLIENT_VERSION` nor `MIN_CLIENT_VERSION` moves.

**Visits already in an admin phone's outbox are kept, not lost.** After the deploy
they cannot sync, and they stay on the phone (INVARIANT 5). Before the release, the
owner has each admin who walked a round sync from the field; the release checklist
for this epic carries that step. A user deactivated with an outbox is handled the
way the epic already decided: reactivate, sync, deactivate again — no new code.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep admins on the field and store their position too | The round view would show them, but every admin rule (assignment, visits, landing, offline) keeps two branches, and roles stay switchable with work attached |
| Refuse a role change while work is assigned, instead of fixing roles | Narrower, but it leaves the outbox case open and keeps the toggle and its jump; a new account is simpler and the owner chose it (epic note, 2026-10-19) |
| Let an offline admin keep the field side, read-only | It needs the field code on the admin path anyway, and an admin has no round to read once assignment is agent-only |
| Return a new status (e.g. 409) so the phone can tell "wrong role" from "lost session" | It is a contract change for a case that disappears with fixed roles; 403 already keeps the outbox |
| Migrate an admin's outbox to an agent account on the server | Needs an agent-side reassignment path that INVARIANT 2 forbids, for a case one manual sync before release removes |

## Consequences

- Every visit, tournée and position belongs to an agent account, so the round view
  shows everyone in the field.
- The client loses a whole branch: `adminAccess`, `adminOnline` and the
  `role !== "admin"` checks in `agent.ts` and `src/client` go, with their tests and
  the done backlog 010's pinned behaviour.
- **Harder:** an admin who wants to canvass needs a second account, and a second
  sign-in on the phone. A role change is a new account, so history under the old
  email stays there.
- **Harder:** an admin outbox left unsynced at release stays stuck until someone
  signs that phone into the field again; the release step is what prevents it.
- ADR-0019's offline argument now rests on the Hors ligne screen instead of the
  field fallback; its decision (admin chunk out of the precache) stands.
- ADR-0028's "an admin syncing from the field route stores none" becomes moot: an
  admin cannot sync.
- Follow-up stories, cut once this is accepted: agent-only routes and assignment;
  remove the admin field side and its links; fixed roles and the Utilisateurs screen
  (mockup first); the Hors ligne screen (mockup first). Each updates
  `docs/domains/identity-access.md`, `docs/domains/field-operations.md`,
  `docs/design.md`, `docs/glossary.md` or `docs/api.md` as it ships.
