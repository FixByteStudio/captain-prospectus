---
title: 'Centre the admin empty states (#185 finding)'
type: 'bugfix'
created: '2026-09-29'
status: 'done'
baseline_commit: '28339a7f6b3c18e3fbcb07bc214174d874fc08b0'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** During the #185 screens check the owner found that on Prospects, Doublons and Visites an empty list shows its empty state pinned to the left: the icon tile, the text and the button sit at the start of the card instead of in its centre. Visites is worse: it shows a bare grey sentence with no icon tile at all.

**Approach:** Centre the shared `EmptyTile` (icon, text and button centred horizontally, and the text centred line by line), so every screen that uses it follows. Visites then uses `EmptyTile` inside a `Surface` too, with an icon and its existing one sentence. It gets no button, because design.md names none for it.

</frozen-after-approval>

## Implementation Notes

Oneshot: two components, about 15 lines. `EmptyTile` is the one home of the empty-state shape (design.md › Doublons), so centring it there covers Prospects (both states), Doublons and À rattacher at once. À rattacher also changes, and that is intended: design.md says every empty state has "the same shape".

Files: `src/client/admin/EmptyTile.tsx` (`items-center` + `text-center`), `src/client/admin/visits/VisitsLedger.tsx` (EmptyTile + `InboxIcon` in a `Surface`), `docs/design.md` (Doublons › EmptyTile paragraph, Visites empty line).

## Review Triage Log

Quick lens, pass 1: 0 high, 0 medium, 1 low, 0 false, 0 maybe-false.
- low — patched: the centring rule sat in design.md's Prospects section, but the Doublons paragraph is where `EmptyTile` is defined ("a rule has one home"). Moved it there.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass; the existing `copy.visits.empty` assertions in VisitsScreen and DashboardScreen tests still find the sentence.

**Manual checks:**
- `pnpm dev` with an empty database: Prospects, Doublons, À rattacher and Visites show the icon, text and button centred in the card at 1280, 820 and 390 px, in light and dark.
