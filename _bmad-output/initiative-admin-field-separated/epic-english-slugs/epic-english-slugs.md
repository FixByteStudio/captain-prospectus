---
tracker_id: "578"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/578"
tracker_status: done
type: epic
title: "Every client URL slug is English"
parent: initiative-admin-field-separated
covers: [R1]
after: []
assignee: ""
risk: low
status: done
---

# Every client URL slug is English

## Description

The client's URLs mix languages: `/admin/doublons`, `/admin/visites`, `/admin/a-rattacher`, `/tournee/carte`, `/tournee/carnet`, `/tournee/nouveau`, and `/admin/agents` for a screen that lists every user. The owner wants every slug in English. This is a mechanical rename of routes, links, tests and docs. The UI stays French, and identifiers in the code keep `tournee`. It goes first so the later epics carry no mass rename in their diffs.

## Outcome

Every path the app navigates to is English, and the glossary names each screen's slug, so the next screen added has one convention to follow.

## Requirements

- R1: the slugs, old → new: `/tournee` → `/round`, `/tournee/carte` → `/round/map`, `/tournee/carnet` → `/round/logbook`, `/tournee/nouveau` → `/round/new`, `/tournee/:id` → `/round/:id`, `/admin/agents` → `/admin/users`, `/admin/doublons` → `/admin/duplicates`, `/admin/visites` → `/admin/visits`, `/admin/a-rattacher` → `/admin/orphans`, `/admin/tournee` → `/admin/round`. The glossary gets a slug column for the screens it names. No redirect from the old paths (disposable stage).

## Done when

1. `grep -rn 'path="' src/client` finds no French slug, and every `navigate`, `Link` and `NavLink` target uses the new paths.
2. The glossary's screen rows carry their slug, and `docs/design.md`, `docs/api.md`, `docs/roadmap.md`, `docs/domains/*.md` and the ADRs that name a path use the new one.
3. `pnpm lint`, `typecheck`, `test`, `build` and `check:precache` are green, and the rename is on production through CI.

## Boundaries

Client route paths, the links to them, their tests and the docs that quote them. Not API paths (`/api/admin/agents` keeps its name: it becomes agents-only in epic 2). Not identifiers, table names or the `tournee` wire field. Not the French UI copy.

## References

- parent — _bmad-output/initiative-admin-field-separated/initiative-admin-field-separated.md, Requirements R1
- glossary — docs/glossary.md
- code — src/client/App.tsx, src/client/admin/AdminApp.tsx, src/client/admin/nav.ts

## Notes

- Decision (2026-10-19): `/round` for the field, though the glossary's English term is Tournée; the code keeps `tournee`.
- Decision (2026-10-19): one story; the rename has no seam worth splitting.
