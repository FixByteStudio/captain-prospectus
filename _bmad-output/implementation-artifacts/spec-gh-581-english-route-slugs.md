---
title: 'Rename every client route slug to English'
type: 'refactor'
created: '2026-10-19'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'e319beb0ade801604587fc6aec40250861a3cfc3'
context:
  - '{project-root}/_bmad-output/initiative-admin-field-separated/epic-english-slugs/epic-english-slugs.md'
  - '{project-root}/docs/glossary.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Client URLs mix French and English (`/admin/doublons`, `/tournee/carnet`, `/admin/agents` for a screen listing every user), so there is no one slug convention for the next screen (GH #581, epic #578, R1).

**Approach:** Rename the ten route slugs of R1 everywhere the client defines, matches or navigates to them, in the tests that pin them and in the docs that quote them, and give the glossary each screen's slug. No redirect from the old paths (disposable stage).

R1, old → new: `/tournee` → `/round`, `/tournee/carte` → `/round/map`, `/tournee/carnet` → `/round/logbook`, `/tournee/nouveau` → `/round/new`, `/tournee/:id` → `/round/:id`, `/admin/agents` → `/admin/users`, `/admin/doublons` → `/admin/duplicates`, `/admin/visites` → `/admin/visits`, `/admin/a-rattacher` → `/admin/orphans`, `/admin/tournee` → `/admin/round`.

## Boundaries & Constraints

**Always:** Rename absolute paths, relative `<Route path>` segments, `useMatch` patterns, `navigate`/`Link`/`NavLink`/`to` targets, path helpers (`visitPath`, `visitsPath`), `window.location.assign` targets, comments that quote a route path, and test fixtures/assertions on them. Docs that quote a live path use the new one.

**Never:** Touch API paths (`/api/admin/agents` stays), identifiers, file or directory names (`tournee-stops.ts`, `admin/agents/`, `seedTournee`), the `tournee` wire field, router `state` values (`{ from: "carnet" }`), copy keys, or French UI copy. No redirect routes. Do not edit `docs/backlog/*` files with `status: done` (010 keeps `/tournee` as history), `_bmad-output/` specs, or merged migrations. No ADR quotes an old path, so no ADR changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Agent lands | `/` or login as agent | redirected to `/round` | — |
| Field tabs | tap Carte / Carnet / Ajouter | `/round/map`, `/round/logbook`, `/round/new`; tab current per `isCurrentTab` | — |
| Visit | stop row "Visiter" | `/round/<id>`; back goes to `/round` or `/round/logbook` | — |
| Index-tab exactness | pathname `/rounds` | Tournée tab not current | — |
| Admin nav | each sidebar entry | `/admin/users`, `/admin/duplicates`, `/admin/visits?…`, `/admin/orphans`, `/admin/round`; breadcrumb resolves | — |
| Old path | `/tournee/carte` or `/admin/doublons` | existing catch-all (`path="*"`) behaviour, no redirect | — |

**Decisions (2026-10-19):** The glossary gets a `## Screens` table (Screen · French · Slug) listing every routed screen — field: Today list, Carte, Carnet, Ajouter, visit form; admin: Dashboard, Utilisateurs, Prospects, Import, Doublons, Visites, À rattacher, Scripts, Admin round view. The main table's screen rows keep their meaning but point to that table instead of quoting a path. The spec stays whole above the 1,600-token guideline: one rename, no seam.

</frozen-after-approval>

## Code Map

Find every site with `grep -rnE '(^|[^A-Za-z0-9_.-])/(tournee|admin/(agents|doublons|visites|a-rattacher|tournee))\b' src docs | grep -v /api/` — the `[^….-]` guard skips import paths like `../shared/tournee` and `./tournee-stops`.

- `src/client/App.tsx` -- `/tournee/*` route (544), relative `path="carte|carnet|nouveau"` (141–157), `useMatch` patterns (195–201), `Navigate`/`action.to` (537–576), comments (111, 137, 194, 199).
- `src/client/admin/AdminApp.tsx` -- relative `path="agents|doublons|visites|a-rattacher|tournee"` (42–49).
- `src/client/admin/nav.ts` -- sidebar paths (49–66); breadcrumb derives from them.
- `src/client/field/tabs.ts` -- tab paths and `isCurrentTab` index rule (34–71).
- `src/client/field/today.ts:24` (`visitPath`), `src/client/admin/queries.ts:129` (`/admin/visites?period=`), `BackLink.tsx`, `VisitScreen.tsx:81`, `AllDoneCard.tsx`, `CarteScreen.tsx`, `StartScreen.tsx`, `AddProspectScreen.tsx`, `auth/LoginScreen.tsx:70`, `admin/agents/AgentsScreen.tsx` (26, 92), `admin/OrphansScreen.tsx`, `admin/dashboard/TodoPanel.tsx`, `admin/dashboard/RecentVisits.tsx`, `admin/round/remembered-agent.ts`, `field/leave-guard.tsx` comment, `styles/class-literals.ts` comment -- link targets and comments.
- Tests: `App.test.tsx`, `field/{tabs,FieldTabs,CarteScreen,CarnetScreen,VisitScreen,StopRow,StartScreen,AddProspectScreen,TodayScreen,AccountMenu,SyncIndicator,leave-guard}.test.ts(x)`, `auth/LoginScreen.test.tsx`, `admin/{nav,VisitsScreen,OrphansScreen}.test.ts(x)`, `admin/dashboard/DashboardScreen.test.tsx`, `admin/round/RoundScreen.test.tsx`, `admin/agents/AgentsScreen.test.tsx`, `styles/class-literals.test.ts` -- fixtures and assertions; `tabs.test.ts:63` `/tournees` → `/rounds`.
- `docs/glossary.md` (33–37), `docs/design.md` (1229, 1288, 1887, 2004, 2605–2614), `docs/domains/field-operations.md` (4, 126) -- quoted paths.
- `vite.config.ts` -- names no field path; leave.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/**` (non-test) -- apply R1 to every site in the Code Map -- the rename itself.
- [x] `src/client/**/*.test.ts(x)` -- apply R1 to fixtures, assertions and test names -- tests pin the new paths.
- [x] `docs/design.md`, `docs/domains/field-operations.md` -- replace quoted paths -- docs match code.
- [x] `docs/glossary.md` -- replace quoted paths in the screen rows and add the `## Screens` table per the Decisions -- R1's glossary requirement.

**Acceptance Criteria:**
- Given the change, when the Code Map grep runs over `src` and `docs` (excluding done backlog files), then it finds nothing.
- Given `grep -rn 'path="' src/client`, then no French slug appears.
- Given the dev server, when each field tab and admin nav entry is opened, then its screen renders.


## Implementation Notes

- Implemented by a sonnet subagent: 46 files across `src/client` (code, tests, comments) and `docs/{design,glossary,domains/field-operations}.md`. Prettier reflowed three test files whose lines got shorter. A test-only `/carte` fixture in `field/CarteRound.test.tsx` became `/round/map` as well.
- Orchestrator follow-ups: the glossary `## Screens` table's first column uses English terms (Add prospect, Users, Duplicates, Visits, Orphans), with the French label in its own column, to match the glossary's convention. The Users row's French label is « Agents », because `copy.nav.agents` stays unchanged here (copy is out of scope).
- Matrix "Old path" row had no covering test: added `App.test.tsx` (`/tournee/carte` → not-found, no redirect) and `admin/AdminApp.test.tsx` (`/admin/doublons` → not-found). These two are the only hits the Code Map grep now finds, and they are deliberate: they assert the old slugs are gone.

- Review patches (pass 1): `AdminApp.test.tsx` pins `/admin/duplicates`, `/admin/visits`, `/admin/orphans` through the real router; `SyncIndicator.test.tsx` stubs `https://app.example/round`; the Screens table gains `/login`.
- Verification: lint, typecheck, test (116 files, 3060 tests), build and `check:precache` (25 entries, 973.09 KiB of 1000 KiB) green. Dev server (`pnpm dev`, admin@example.com with 10 assigned prospects, geolocation stubbed): every admin nav entry renders its screen and is current; `/admin/doublons` shows « Page introuvable. »; the tab bar links `/round`, `/round/map`, `/round/logbook`, `/round/new`, each opens its tab; a stop's Visiter opens `/round/<id>`, back link `/round`.

## Spec Change Log

## Review Triage Log

**Pass 1** (blind-hunter, edge-case-hunter, verification-gap, intent-alignment; sonnet) — high 0 · medium 1 · low 7 · false 4 · maybe-false 0; 3 patched, 9 rejected.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | `AdminApp.test.tsx` pins only `users` and `round`; `duplicates`/`visits`/`orphans` registrations untested through the real router (verification-gap) | medium | patch | `nav.test.ts` compares against a hand-copied list; screen tests render directly. Table-driven registration test added. |
| 2 | `SyncIndicator.test.tsx:116,124,201` stub `https://app.example/tournee` (blind, verification-gap) | low | patch | Grep guard skips `e/tournee`; direct correction to `/round`. |
| 3 | Screens table omits `/login` while claiming every client path (blind, edge-case) | low | patch | `App.tsx` routes `/login`; one row added. |
| 4 | Acceptance grep "finds nothing" fails on the two deliberate old-slug tests (blind, edge-case) | low | reject | Fix edits this build's spec; Implementation Notes already name the two hits. |
| 5 | Spec frontmatter `in-progress`, tasks unchecked (blind, verification-gap) | false | reject | Diff was cut mid-workflow; status moves to `in-review`/`done` by the workflow. |
| 6 | Old-path negative tests cover 2 of 10 slugs (blind) | low | reject | One catch-all per side, path-agnostic; extra cases add no new behaviour. |
| 7 | `"/round"` hand-written in ~10 files; no route constants (blind) | low | reject | Pre-existing design; fix adds new public surface; out of R1. |
| 8 | Users row keeps French « Agents » against the glossary's User term (blind) | low | reject | Copy is out of scope; epic-admins-leave-the-field R8 renames the screen to Utilisateurs at `/admin/users`. |
| 9 | `round`/`logbook` are not glossary terms (blind) | false | reject | Slugs are fixed by R1; the epic's 2026-10-19 decision records `/round` against Tournée. The Screens table maps slug to term. |
| 10 | Glossary rows lose inline paths for a link to Screens (blind) | false | reject | The owner chose this shape (Decisions, 2026-10-19). |
| 11 | No note about bookmarks or installed phones on old paths (blind) | low | reject | Disposable stage; `start_url` is `/` and redirects by role; the outbox is keyed by visit id, not URL; an old path shows not-found with a back link. |
| 12 | Deployed URL surface (asset SPA fallback, SW `navigateFallback`) untested (intent-alignment) | false | reject | Both are path-agnostic (`single-page-application`, `index.html`) and untouched; covered by the manual dev-server check. |

## Verification

**Commands:**
- Code Map grep over `src docs` (minus `docs/backlog/010-*`) -- expected: no output.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:precache` -- expected: all green; quote precache total.

**Manual checks:**
- `pnpm dev`: open `/round`, each field tab, a visit, and every admin nav entry.
