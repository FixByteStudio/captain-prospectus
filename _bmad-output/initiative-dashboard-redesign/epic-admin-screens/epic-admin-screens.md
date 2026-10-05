---
tracker_id: "174"
remote: "https://github.com/FixbyteStudio/captain-prospectus/issues/174"
tracker_status: done
type: epic
title: "Every admin screen runs on the new design"
parent: initiative-dashboard-redesign
covers: [CAP-3, CAP-11]
after: []
assignee: ""
risk: medium
status: done
---

# Every admin screen runs on the new design

## Description

Prospects, Import, Doublons, À rattacher, Visites and Scripts are rebuilt in the new design, one screen per story, with every current behaviour kept. Prospects gains name search (G4) and keeps the URL filters epic-dashboard adds (G3, G10). Visites gains a KPI strip (via G1) and a date range (G5).

## Outcome

The admin's daily work (assigning, importing, repairing, reading the feed, editing scripts) happens on the new design with nothing lost; CAP-3's success criterion is the signal.

## Done when

1. Every existing admin test passes unchanged in what it asserts.
2. Each of the six screens meets its EXPERIENCE.md Component Patterns and State Patterns rows, in light and dark, at desktop, tablet and phone widths.
3. Name search, the due-date filter, the Visites date range and the KPI strip return results that match D1.
4. `docs/design.md`'s admin screen sections match the screens, including the map import rules the spines don't cover.

## Boundaries

The six existing admin screens, G4 and G5, and the G6 definition. Not the dashboard or G3 and G10 (epic-dashboard), not the admin round view.

## References

- parent — _bmad-output/initiative-dashboard-redesign/initiative-dashboard-redesign.md
- spec — _bmad-output/specs/spec-dashboard-redesign/SPEC.md, CAP-3; _bmad-output/specs/spec-dashboard-redesign/server-gaps.md, G4–G6; _bmad-output/specs/spec-dashboard-redesign/screen-map.md, Admin
- design — _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/EXPERIENCE.md, Component Patterns; Stitch A2–A13 in _bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/stitch/admin/ (light only, corrected by the spines)

## Notes

- Waits on epic-shared-shell because: every screen renders inside the new admin shell.
- Waits on epic-dashboard because: the Visites KPI strip reads the G1 aggregate.
- Decision (2026-09-26): G6 settled in the spec: "Agents en tournée" is agents with a visit received today, no server change.
- Handoff (2026-09-26): epic-dashboard's 2.10 makes Prospects read its filters (status, several statuses, dueBefore) from the URL, and Tableau de bord links to them; the Prospects rebuild keeps those URL filters. G3 is now built in epic-dashboard.

### Inception (2026-09-27)

- Decision: the tracer bullet is entry 4, Visites. It is the thinnest screen at 94 lines but crosses every layer this epic touches — worker param, query layer, screen, copy.ts, docs/design.md and a DOM test.
- Decision: entries 4 to 10 are one lane. All six screens edit `src/client/admin/queries.ts`, `src/client/copy.ts` and `src/worker/routes/admin.ts`, so they are chained rather than run in parallel. Splitting those modules first was considered and rejected: precache headroom is about 100 KiB of 1,000, and epic-dashboard's sweep already showed a moved helper landing in the field entry chunk.
- Decision: Scripts ships question cards, and docs/design.md's "no steps, no cards" is rewritten. Three sources say cards and only docs/design.md says no; SPEC.md's precedence rule puts DESIGN.md and EXPERIENCE.md above it. The "no raised surface" principle governs cards around data tables, which the ledger screens stay; a script question is an editable unit that reorders as a unit, and the card is what makes the drag target legible.
- Decision: Doublons and the CSV import path each get a new docs/design.md section, written in their own story. Neither has one today.
- Decision: 25-row pagination and a CSV export button are in scope on Prospects and Visites. EXPERIENCE.md requires the pagination; both export endpoints already exist.
- Decision: Import is two stories, splitting at the stepper's own CSV/map fork. This deviates from the initiative's one-screen-per-story rule because Import is roughly three times the next-biggest screen.
- Decision: Done when 2 gets a closing hitl story (entry 11). The DOM harness is happy-dom, which evaluates neither media queries nor computed colour, and epic-shared-shell closed with this same clause unverified (retro F6).
- Decision: the Visites date range is a 7/30/90 selector, not an arbitrary range. The feed receives the matching `from`/`to` (G5) and the strip reads the period-scoped aggregate, so both halves of the screen show one window. EXPERIENCE.md's "Period is the dashboard selector or the Visites date range" is satisfied without giving the dashboard endpoint a free range it cannot afford at 7.9-8.2 ms of the 10 ms budget.
- Decision: Done when 1 is scoped to the six rebuilt screens' own tests. Entry 4 deliberately repoints the dashboard's Visites KPI card at the selected range, which changes what `DashboardScreen.test.tsx` asserts; that is an approved exception, not a regression.
- Decision (owner, 2026-09-27): the Visites strip figures extend the G1 aggregate additively rather than being computed from the 500-row-capped feed. Entry 3 is `hitl` because it writes a new row into `server-gaps.md`, whose preamble requires each row to carry its own go-ahead.
- Decision: the prospects CSV export route gains `q`, `dueBefore` and multi-value `status` in entry 2, so the export always matches the filtered list on screen.
- Source conflict: docs/design.md § The script editor — says "no steps, no cards" and "No card, drag handle instead of a shadow", against EXPERIENCE.md § Script editor, DESIGN.md § Script question card and screen-map.md's "Scripts with question cards". Settled by the cards Decision above.
- Source conflict: docs/design.md:300 — says the Visites KPI card links unfiltered "since the feed has no date range yet", which this epic makes false. Settled by the selector Decision above; the sentence is deleted in entry 4.
- Open question: whether the new `server-gaps.md` row should be folded back into the spec by `bmad-spec` once this epic lands.
