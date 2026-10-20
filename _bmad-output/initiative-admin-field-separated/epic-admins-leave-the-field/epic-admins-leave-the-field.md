---
tracker_id: "579"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/579"
tracker_status: backlog
type: epic
title: "Admins leave the field side"
parent: initiative-admin-field-separated
covers: [R2, R3, R4, R5, R6, R7, R8, R12]
after: []
assignee: ""
risk: medium
---

# Admins leave the field side

## Description

Today an admin can sync from the field (`/api/agent` checks only for an identity), read any prospect's visits (`agent.ts:342`), be assigned prospects (`admin.ts:163`: "an admin may well walk a round"), and falls back to the field side when offline (ADR-0019). The admin's position is never stored (`agent.ts:284`), so an admin's tournée never shows on the round view. The owner decided admins do no tournée: an admin who canvasses uses an agent account. Roles become fixed at creation, the Agents screen becomes Utilisateurs in two sections, and an offline admin sees a Hors ligne screen instead of the field side.

## Outcome

An admin account only ever reaches the dashboard, and every visit, tournée and position belongs to an agent account, so the round view shows every person in the field.

## Requirements

- R2: an admin cannot do a tournée.
- R3: `/api/agent/*` answers 403 to an admin session (`requireAgent`).
- R4: a prospect can be assigned only to an active agent, on every write that sets `assignedTo`.
- R5: the admin field side and every link to it are removed, server and client, with their tests and the done backlog 010's pinned behaviour.
- R6: an offline admin sees « Vous êtes hors ligne », « Le tableau de bord a besoin du réseau. Reconnectez-vous puis réessayez. » and one Réessayer button.
- R7: roles are fixed at creation; the role toggle and the self-demotion jump go; the deactivation confirmation asks for a sync first.
- R8: the Utilisateurs screen at `/admin/users` lists Administrateurs and Agents in two sections; Ajouter un utilisateur sets the role once.
- R12: an ADR amending ADR-0019 (offline admin) and ADR-0028 (admin syncing from the field) is accepted before the other stories are cut.

## Done when

1. An admin session gets 403 from `POST /api/agent/sync`, and assigning a prospect to an admin is refused on PATCH, bulk assign and import.
2. A grep for `adminAccess`, `adminOnline` and `role !== "admin"` in `src/worker/routes/agent.ts` and `src/client` finds nothing, and each client PR quotes the precache total against its 1,000 KiB ceiling.
3. An admin signed in on a phone opens `/admin` from `/login`, `/` and the installed PWA; offline, it shows the Hors ligne screen.
4. The Utilisateurs screen shows two sections and no role toggle, matching the mockup the owner approved.
5. The amending ADR is accepted, the epic is on production through CI, and `docs/design.md`, `docs/domains/identity-access.md`, `docs/domains/field-operations.md`, `docs/glossary.md` and `docs/api.md` match what shipped.

## Boundaries

The agent and assignment routes, the client's identity gate and field frame, the Utilisateurs screen, and ADR-0019 and ADR-0028. Owns the landing after sign-in (`LoginScreen.tsx` `landingFor`, the `/` redirect). Not the login forms' credentials or the passphrase (epic 3). Not the admin round view's content.

## References

- parent — _bmad-output/initiative-admin-field-separated/initiative-admin-field-separated.md, Requirements R2–R8, R12
- adr — docs/adr/0019-admin-chunk-out-of-the-precache.md
- adr — docs/adr/0028-agent-position-at-sync.md
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md
- domain — docs/domains/identity-access.md
- design — docs/design.md, section Agents
- constraint — CLAUDE.md, invariant 5 (never lose a visit)

## Notes

- Decision (2026-10-19): only the ADR story is planned now; the owner and Winston chose to cut the rest once the ADR is accepted, as with ADR-0036. The expected stories: agent-only routes and assignment (server); remove the admin field side and its links (client); fixed roles and the Utilisateurs screen (mockup first); the admin Hors ligne screen (mockup first).
- Decision (2026-10-19): fixed roles replace refusing a promotion while work is assigned. A user deactivated with visits still in the phone's outbox is reactivated, syncs, and is deactivated again; no new code for it.
- Waits on epic-english-slugs because: the stories here edit the same routes and would otherwise carry the rename.
- Source conflict: R4 — the initiative and ADR-0037 refuse an admin assignee on import too, but `importRowSchema` and `prospectBatchSchema` carry no `assignedTo`; the refusal covers PATCH and bulk assign, and import has nothing to change.
- Decision (2026-10-20): ADR-0037 accepted; the remaining six stories are cut. Tracer bullet: 2 (agent-only field API and assignment), the rule the rest of the epic cleans up around. Next, the least certain: 3 (Hors ligne screen, mockup first).
- Decision (2026-10-20): two client lanes after the server story: 3 then 4 (both edit the identity gate in `App.tsx`), and 5 then 6 (both edit the Agents screen). 2, 3 and 5 can run at once. 5 and 6 stay apart so only 6 waits on its mockup.
- Decision (2026-10-20): the epic's `after` on epic-english-slugs is pinned on 3 and 5 (as `1.1`); the server story needs nothing from it.
- Decision (2026-10-20): the release step of ADR-0037 (each admin who walked a round syncs from the field before the 403 ships) is story 2's hitl step, done before it merges.
- Decision (2026-10-20): a closing refactor sweep (7) after every other story; no end-to-end suite, since the source has no test plan.
- Decision (2026-10-20): R4's import part needs no work, since an import cannot set an assignee; story 2 covers PATCH and bulk assign.
