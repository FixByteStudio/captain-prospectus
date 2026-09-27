---
id: SPEC-dashboard-redesign
companions:
  - ../../planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md
  - screen-map.md
  - server-gaps.md
  - ../../../docs/design.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Dashboard redesign

## Why

This is a vision the owner decided to realise. Today's admin is a ledger behind an ink band, and the field side is a single tear-off list. The owner wants a quiet shadcn-style dashboard for the admin (who also goes out in the field) and a field app with tabs, a map of the round, swipe actions and a confirmation before a visit is saved. The whole app is replaced before it goes live, while changing it is still free. Brand colours and logo stay as they are. The design is settled in DESIGN.md (how it looks) and EXPERIENCE.md (how it behaves); this spec turns them into buildable capabilities within the repo's invariants.

## Capabilities

- **CAP-1**
  - **intent:** An admin moves between every admin screen through a grouped navy sidebar and a top bar that work at desktop, tablet and phone width.
  - **success:** At 1280, 820 and 390 px, every existing `/admin/*` route is reachable from the sidebar (drawer below 768 px, icon rail from 768 to 1023 px). The current item shows in gold. Doublons and À rattacher show their live counts. The top bar holds the breadcrumb, search, notifications, theme toggle and avatar (EXPERIENCE.md › IA).
- **CAP-2**
  - **intent:** On opening `/admin`, an admin sees how the canvassing is going and what needs doing, for the last 7, 30 or 90 days.
  - **success:**
    - Against a seeded database, each figure matches its EXPERIENCE.md › Dashboard metrics definition computed straight from D1, for all three periods, deltas included: the 4 KPIs, the chart by outcome, the pipeline, the per-agent activity, and the À traiter counts.
    - Dernières visites updates within one 15 s poll of a sync.
- **CAP-3**
  - **intent:** An admin runs Prospects, Import, Doublons, À rattacher, Visites and Scripts in the new design, with every current behaviour preserved. Prospects gains name search. Visites gains a KPI strip and a date range.
  - **success:** The existing admin tests pass unchanged in what they assert. Each screen meets its EXPERIENCE.md Component Patterns and State Patterns rows. Name search, the Visites strip and the date range return results consistent with D1. "Agents en tournée" counts the distinct agents with a visit received today, from the existing visits feed (`server-gaps.md` G6).
- **CAP-4**
  - **intent:** An admin picks an agent and sees that agent's round as a read-only list and map, ordered from where the agent last synced.
  - **success:** For an agent who synced today, the order matches nearest-next from the stored position, and the position's age is shown. With no position today, the list is ordered by name and says so (`mockups/key-admin-round.html`).
- **CAP-5**
  - **intent:** A field user always sees their sync state and moves between Tournée, Carte and Ajouter, plus Tableau de bord for an admin, with one thumb on a phone or from the band on a tablet.
  - **success:**
    - Each of the 7 sync states renders as in `mockups/key-f8-sync.html`, in light and dark. Only "Session expirée" and "Mise à jour" carry a button, and the strip is never a toast.
    - The Tableau de bord tab shows only for an admin with a network.
- **CAP-6**
  - **intent:** An agent opens the app to the next stop, starts a visit or directions in one gesture or tap, and sees the day's progress.
  - **success:**
    - Swiping left opens the visit and swiping right opens directions. Tapping a row reveals the same two buttons.
    - "n visites sur N aujourd'hui" counts visits already sent as well as pending ones: `n` is a local Dexie log of today's sent visit ids plus the pending outbox rows, deduplicated by visit id (`server-gaps.md` G8). It survives a sync that empties the outbox and a reload, and never gates outbox deletion.
    - Every state in EXPERIENCE.md renders offline: position denied, empty, waiting to send.
- **CAP-7**
  - **intent:** An agent sees the round on a map, with stops numbered in walking order, and opens the next stop from it.
  - **success:**
    - Online, the pins, the walking path, the sheet above the tab bar and the OSM attribution render as in `mockups/key-f2-carte.html`.
    - Offline, the tab shows "Carte indisponible hors ligne…" and the sheet, with no tile requests.
    - Leaflet is in a lazy chunk, not the entry chunk.
- **CAP-8**
  - **intent:** An agent records a visit in two steps and confirms it before it is saved, without the phone predicting the prospect's new status.
  - **success:**
    - Flow 1 in EXPERIENCE.md runs offline end to end.
    - The chosen outcome, answers and flyer box show gold with a check, and no outcome card carries a status colour.
    - The save sheet (phone) or dialog (tablet) writes one outbox row, and "Modifier" loses nothing typed.
- **CAP-9**
  - **intent:** An agent adds a place not on the list, in the new design.
  - **success:** Flow 4 in EXPERIENCE.md works offline, and the new place appears on the round at once.
- **CAP-10**
  - **intent:** Every screen draws from one token set, in light and dark.
  - **success:**
    - `app.css` `@theme` holds every DESIGN.md token, including the new `band-accent`, `band-border`, `outcome-*` and badge tints, and no component hardcodes a colour.
    - `palette.test.ts` asserts the five gold and contrast rules in DESIGN.md › Colors for both themes.
- **CAP-11**
  - **intent:** `docs/design.md` describes the shipped screens.
  - **success:**
    - Its screen sections are rewritten from DESIGN.md and EXPERIENCE.md, and nothing in it contradicts them.
    - The sections the spines don't cover keep their rules: the map import's provider and circle rules, "Working with shadcn in this repo", and Icons.
    - It lands in the same change set as the screens.

## Constraints

- Agents only insert. Swipes and every field action start only Visiter or Y aller, never an edit of shared data (invariant 2).
- The phone never shows or implies the status an outcome leads to. The server derives it (invariant 3).
- Every French string lives in `src/client/copy.ts`; components never inline one. `copy.ts` rides in the field entry chunk (invariant 15, issue #20).
- Every map carries the OSM attribution. Tiles load only online and are never bulk-cached (invariant 11, OSM tile policy).
- The admin chunk stays online-only and out of the precache (ADR-0019). Recharts (via shadcn Chart) and `cmdk` (via shadcn Command) live only in the admin chunk, each justified in the PR that adds it: size, maintenance, and why the platform can't do it.
- The field precache is at most 1,000 KiB, and every field PR quotes the precache total and the entry chunk (ADR-0026).
- The field keeps the native date input, radios, checkboxes and labels (ADR-0015, ADR-0026). Everything else is shadcn with Tailwind v4 tokens and Lucide icons: no second component or CSS framework, no hardcoded colours or spacing.
- Forms use shadcn `form` over react-hook-form (ADR-0018). The service worker never caches `/api/*` (invariant 8). Admin live data uses 15 s polling (ADR-0010).
- DESIGN.md and EXPERIENCE.md win over every mock, Stitch or `mockups/`, and over `docs/design.md`. `docs/design.md` still governs where the spines are silent, such as the map import's Google circle gesture and cost wording. The one override runs the other way: `server-gaps.md` G6 redefines EXPERIENCE.md › Dashboard metrics "Agents en tournée".

## Non-goals

- No API, sync-contract or data-model change except the ones listed in `server-gaps.md`, each approved on its own.
- No notifications content and no ⌘K search back end. The bell and ⌘K ship as designed but inert (server-gaps G9). Name search in the Prospects filter bar (G4) is in scope.
- No Stitch invention beyond the four the owner kept. The rejected list is in EXPERIENCE.md › Inspiration & Anti-patterns.
- No brand change: colours, logo and Archivo stay.
- No new dependency except Recharts and `cmdk` (for shadcn Command, the ⌘K palette). Swipe uses a pointer handler with no library.

## Success signal

On a seeded local build, EXPERIENCE.md Flows 1, 2 and 4 run end to end:
- on a phone and a tablet, in light and dark;
- Flow 1 in airplane mode;
- with `pnpm lint`, `typecheck`, `test` and `build` green;
- with the build's precache line at or under 1,000 KiB.

## Assumptions

- The admin round view lives at `/admin/tournee` and Carte at `/tournee/carte`. The UX spines name the screens but not their paths.
- `/admin` gets an index route for Tableau de bord. Today it has none.
- The redesign ships as several PRs against this one spec, and each PR keeps the app working.

## Open Questions

- Does CAP-4 (admin round view) stay in this spec? It needs server-gaps G7: agent position at sync, a security review, an ADR, and a sync and schema change.
- ADR-0026 is still `proposed` on PR #57. CAP-5 to CAP-9 rely on its 1,000 KiB ceiling. Is it accepted?
- What does the notifications bell announce (G9)?
