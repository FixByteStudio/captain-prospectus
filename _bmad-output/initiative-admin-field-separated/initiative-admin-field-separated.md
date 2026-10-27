---
tracker_id: "6"
remote: "https://github.com/FixByteStudio/captain-prospectus/milestone/6"
tracker_status: done
status: done
type: initiative
title: "Admin and field, separated"
parent: none
covers: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12]
after: []
assignee: ""
risk: medium
---

# Admin and field, separated

## Description

An admin who signs in with a code lands on the dashboard, not the tournée, and nothing in the admin UI leads to the field side. The owner traced it to a deeper mix-up: admins can sync, visit any prospect and be assigned work, yet their tournée is invisible on the round view, the Agents screen lists admins too, and the login offers a passphrase that only admins use. This initiative separates the two roles. Admins leave the field side entirely; an admin who wants to canvass creates an agent account. Roles are fixed at creation. The admin form signs in with an email and a code instead of a passphrase, and break-glass stays where it is. Every client URL slug moves to English first, as a separate change.

## Outcome

Each account is either an admin on the dashboard or an agent in the field, and nothing in the code, the UI or the URLs mixes the two. The signal is that a grep for an admin branch on the field side (`adminAccess`, `adminOnline`, `role !== "admin"` in `/api/agent`) finds nothing, and no client slug is French.

## Requirements

Source: the owner's decisions in the party-mode session of 2026-10-19 (board items 1–9).

- R1 (item 9): every client URL slug is English: `/round`, `/round/map`, `/round/logbook`, `/round/new`, `/round/:id`, `/admin/users`, `/admin/duplicates`, `/admin/visits`, `/admin/orphans`, `/admin/round`. The UI stays French; the code keeps `tournee`; the glossary gets a slug column.
- R2 (item 1): an admin cannot do a tournée. An admin who wants to canvass creates an agent account.
- R3 (item 2): `/api/agent/*` is for agents only (a `requireAgent` beside `requireAdmin`).
- R4 (item 2): a prospect can be assigned only to an active agent: `/api/admin/agents`, PATCH and bulk assign. Import writes `assignedTo: null`.
- R5 (item 2): the admin's field side is gone with every link to it: `adminAccess`, the `adminOnline` prop chain, the avatar card's Tableau de bord, the `/` redirect that sends an offline admin to the field (so an installed PWA, `start_url` `/`, opens `/admin` for an admin), `agent.ts`'s admin exceptions, and their tests.
- R6 (item 3): an admin with no network sees « Vous êtes hors ligne » a one-line reason and one Réessayer button, no field side.
- R7 (items 4, 7): roles are fixed at creation: no « Passer admin » / « Passer agent ». Changing a role means a new account and deactivating the old one; the deactivation confirmation asks the admin to have the user sync first. Item 4 (refuse a promotion while work is assigned) is superseded by this.
- R8 (item 8): the Agents screen becomes Utilisateurs, in two tabs (Agents, Administrateurs; first built as two sections, amended to tabs on 2026-10-21, #607); the role is chosen once, in Ajouter un utilisateur.
- R9 (item 5): two login forms stay. The admin form takes an email and a code; the passphrase is removed everywhere (column, dialog, schema, copy); the admin route keeps break-glass.
- R10 (item 5): each form checks the role: an admin code on the agent form, or an agent code on the admin form, gets the same 401 as a wrong code.
- R11 (item 6): an admin gets a code from their own row on a device already signed in, or from another admin. Break-glass stays in the admin form as today (`OWNER_EMAIL` + `BREAK_GLASS`), the last resort.
- R12: R2–R8 amend ADR-0019 and ADR-0028; R9–R11 amend ADR-0029. Each amendment is an ADR the owner accepts before its stories are cut.

## Done when

1. No route in `src/client` has a French slug, and the glossary names each slug.
2. An admin session gets 403 from `/api/agent/*`, cannot be assigned a prospect, and opens `/admin` from `/login`, `/` and an installed PWA; an offline admin sees the Hors ligne screen.
3. The Utilisateurs screen lists admins and agents apart, with no role toggle, and its URL is `/admin/users`.
4. An admin signs in with email and code; no passphrase exists in the code or the schema, and the docs name it only as history (ADR-0029, ADR-0038); break-glass still opens `OWNER_EMAIL`.
5. Each change is on production through CI, with `docs/design.md`, `docs/glossary.md`, `docs/api.md`, `docs/data-model.md` and `docs/domains/identity-access.md` matching what shipped.

## Boundaries

Client routing, the admin Utilisateurs screen, the login page, the auth and agent routes, prospect assignment, and the ADRs they amend. Not the tournée itself (ADR-0036), not the admin round view's content, not passkeys, and not the code's own format or lifetime.

## References

- adr — docs/adr/0019-admin-chunk-out-of-the-precache.md
- adr — docs/adr/0028-agent-position-at-sync.md
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md
- constraint — docs/adr/0033-rollout-rules-wait-for-protected-data.md
- domain — docs/domains/identity-access.md
- glossary — docs/glossary.md, rows User, Tournée, Carnet, Admin round view
- party — _bmad-output/party-mode/memories/installed/.memlog.md, session 5 (2026-10-19)

## Notes

- Decision (2026-10-19): three epics in this order: English slugs, admins leave the field, admin code login. The slugs go first so later diffs carry no mass rename.
- Decision (2026-10-19): no platform-baseline epic; the platform is in production and this initiative changes shipped behaviour.
- Decision (2026-10-19): R12 is split by epic: epic 2 owns the ADR amending ADR-0019 and ADR-0028, epic 3 the one amending ADR-0029.
- Decision (2026-10-19): strict English slugs, `/round` included, though the glossary's English word is Tournée. The code keeps `tournee`.
- Decision (2026-10-19): roles fixed at creation (Winston's proposal) replaces refusing a promotion while work is assigned.
- Decision (2026-10-19): the code-generated dialog, the admin login form and the deactivation confirmation already exist; they change copy only, with no mockup. Two mockups are needed: Utilisateurs and the admin Hors ligne screen, one at a time, before their stories are built.
- Closed (2026-10-22): closure check passed on R1–R12 and every Done when; epics #578, #579 and #580 are done and on production through CI. R11 ships without the code-dialog line the owner dropped in epic #580. Deferred as separate issues: #597, #605, #617, #619.
