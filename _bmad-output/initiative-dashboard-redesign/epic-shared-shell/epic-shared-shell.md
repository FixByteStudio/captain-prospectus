---
tracker_id: "59"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/59"
tracker_status: done
type: epic
title: "Admin and field share the new shell and tokens"
parent: initiative-dashboard-redesign
covers: [CAP-10, CAP-1, CAP-5, CAP-11]
after: []
assignee: ""
risk: medium
status: done
---

# Admin and field share the new shell and tokens

## Description

Both sides get their new frame and the one token set every later screen draws from. The admin side gets the navy sidebar and the top bar, inside the lazy admin chunk. The field side gets the band, the sync strip and the tabs. Today's screens keep working inside the new frames until the later epics replace them.

## Outcome

Every later epic swaps screen content inside a working frame, on shared tokens; the frames themselves are the first visible sign of the redesign.

## Requirements

- CAP-10: `app.css` `@theme` holds every DESIGN.md token, including the new `band-accent`, `band-border`, `outcome-*` and badge tints, in light and dark; `palette.test.ts` asserts the five rules in DESIGN.md › Colors. (spec)
- CAP-1: the grouped navy sidebar and the top bar, at desktop, tablet and phone width. (spec) *This epic: Prospects and Terrain groups for today's routes. The Tableau de bord item arrives with epic-dashboard, the Tournée du jour item with epic-admin-round-view.*
- CAP-5: the field band with its sync dot, the 7 sync-strip states, and the tabs. (spec) *This epic: the Tournée and Ajouter tabs, plus Tableau de bord for an admin. The Carte tab arrives with epic-field-screens.*
- CAP-11: `docs/design.md` matches what ships. (spec) *This epic: Grounding, Colour, Type, Layout, and the shell and sync sections.*

## Done when

1. Every existing route renders inside its new frame: `/admin/*` in the sidebar and top-bar layout, `/tournee/*` in the field band and tabs. The existing tests pass.
2. `palette.test.ts` asserts the five DESIGN.md › Colors rules for both themes, and `app.css` holds every DESIGN.md token.
3. At 1280, 820 and 390 px the admin sidebar is full, an icon rail, then a drawer. The current item is gold, and the Doublons and À rattacher counts match their queues.
4. Each of the 7 sync states renders as in `key-f8-sync.html`, in light and dark. The tabs sit at the bottom on a phone and in the band from 768 px, and Tableau de bord shows only for an admin with a network.
5. The build's precache line reads at or under 1,000 KiB, and the shadcn Sidebar, Sheet and Tooltip code sits only in the admin chunk.
6. `docs/design.md`'s Grounding, Colour, Type, Layout, and shell and sync sections match the shipped shell.

## Boundaries

The two frames and the tokens. Not any screen's content (epics 2–5), not the ⌘K search back end, not notifications content.

## References

- parent — _bmad-output/initiative-dashboard-redesign/initiative-dashboard-redesign.md
- spec — _bmad-output/specs/spec-dashboard-redesign/SPEC.md, CAP-1, CAP-5, CAP-10, CAP-11 and Constraints
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md, front matter and sections Colors to Components; _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, Information Architecture, Component Patterns (Sync dot and strip, Top-bar search), State Patterns
- mockups — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-a1-dashboard.html (shell at 3 widths), _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-f1-tournee.html (field shell), _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/mockups/key-f8-sync.html
- constraint — docs/adr/0026-budget-the-field-precache-not-the-entry-chunk.md; docs/adr/0019-admin-chunk-out-of-the-precache.md
- code — src/client/App.tsx (today's shared header, `BandLink`, `UpdatePrompt`), src/client/admin/AdminApp.tsx, src/client/field/SyncIndicator.tsx, src/client/styles/app.css, src/client/styles/palette.test.ts

## Notes

- Decision (2026-09-24): tracer is entry 2: split the shell by side before any styling, so both frames are proven with today's screens.
- Decision (2026-09-24): sidebar, tab and route items appear only with the epic that ships their screen; nothing links to a screen that does not exist.
- Decision (2026-09-24): "Se reconnecter" reloads the current page so Cloudflare Access re-authenticates, leaving the outbox untouched; "Se déconnecter" goes to `/cdn-cgi/access/logout` (user's choice).
- Decision (2026-09-24): the notifications bell renders disabled. ⌘K and the search button open the Command palette, which finds nothing until the search back end exists (user's choice).
- Decision (2026-09-24): a refactor sweep closes the epic (default, accepted).
- Source conflict: spec Non-goals, "no new dependency except Recharts", vs CLAUDE.md, "never hand-roll an element shadcn provides". The ⌘K palette is shadcn Command, which needs `cmdk`. Entry 5 stays unrefined until a Decision line settles it.
- Decision (2026-09-24): `cmdk` is allowed as a second dependency exception beside Recharts, for shadcn Command. It stays in the admin chunk, and entry 5's PR states its size and maintenance (user's decision; spec updated). This settles the source conflict above.
- Unknown: with search inert, what the open palette says. "Aucun prospect ne porte ce nom." would be false for a prospect that exists. Entry 5 waits on it.
- Decision (2026-09-24): the inert palette says "La recherche n'est pas encore disponible. Utilisez les filtres de la page Prospects." (user's choice). This settles the unknown above, and entry 5 is refined.
- Assumption: the theme choice is stored in `localStorage` and applied to `<html data-theme>` before first paint; the field side follows the same pin.
- Decision (2026-09-25): entry 9 (#83) adds a DOM test harness for the shell before the refactor sweep, and entry 8 now waits on it. It closes the verification gap the GH #61 review deferred: nothing automated checked frames, redirects, the sync strip, the top bar or the leave guard (user's request). It adds dev-only dependencies, justified in #83.
- Decision (2026-09-25): closed after the closure check on main at dfbfd86. Done when 1, 2, 5 and 6 are met: 988 tests pass, the precache is 677.09 KiB and CI enforces it, and ADR-0026 and ADR-0019 are accepted. Done when 3 and 4 (the visual match at 1280, 820 and 390 px, light and dark) are not browser-checked. Code and tests cover them. Leftovers were filed as #90–#94, and #74, #75 and #85–#88 were already open (user's choice).
