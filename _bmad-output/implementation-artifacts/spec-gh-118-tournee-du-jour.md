---
title: 'Tournée du jour (GH #118)'
type: 'feature'
created: '2026-09-26'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-117-context.md']
baseline_commit: 'a96ab86d634dd309569f14ee94ec5a12549776eb'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tournée du jour still renders the pre-redesign ledger: a card-less next stop, rows that jump straight to the visit form, "Plus tard" rows that can be visited, and no sign on a stop whose visit is still waiting to send. Carte and the admin round view need a shared stop row and stop number that do not exist yet.

**Approach:** Rebuild the screen to DESIGN.md › Next-stop card and Stop row and `mockups/key-f1-tournee.html`, from two new shared components, `StopNumber` and `StopRow`. A row expands on tap to the same "Y aller" and "Visiter" as the card. "Pas encore envoyé" marks a stop with a queued visit. From 768 px the list sits left (≈40 %) and the next stop right. Rewrite `docs/design.md`'s Tournée section to match.

## Boundaries & Constraints

**Always:** Walking order and the later group stay exactly as `buildTodayList` computes them. The badge is read-only knowledge of the outbox and never changes status or order (invariants 2, 3). Every French string is in `copy.ts`. Status edges come from `STATUS_EDGE`. Targets are ≥48 px (`size="touch"`). Use native `<button>`/`<a>` with the vendored `buttonVariants` and `Badge`. The empty state, position-denied state and the saved/added `role="status"` lines keep working offline. Quote the precache total and the entry chunk in the PR.

**Never:** No daily-progress line or bar (story 2 owns G8). No swipe (story 3). No Carte tab or map. Do not touch `app.css` (epic decision while epic-dashboard runs). Do not change `navigationUrl`, `orderByNearestNext`, Dexie's schema or the sync payload. Do not hide or reorder a stop because a visit to it is queued: the server decides status. No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Round with stops | 3 due prospects, position known | Card "Prochain arrêt" with gold 1, then rows 2 and 3 with distance | — |
| Tap a row | row 2 collapsed | row expands with Y aller + Visiter, `aria-expanded="true"`; tapping row 3 collapses 2 | — |
| Queued visit | `outboxVisits` has a row for stop 2 | row 2 shows "Pas encore envoyé"; order and edge unchanged | — |
| Field prospect not yet accepted | row in `outboxProspects` only | stop shows "Pas encore envoyé" and the `new` edge | — |
| No coordinates | stop with `lat` null | "Position inconnue"; Y aller absent, Visiter full width | — |
| Position denied | geolocation refused | notice + "Réessayer" under the title; distances "Position inconnue" | — |
| Future follow-up | `follow_up`, `nextVisitAt` > now | under "Plus tard": name + "À relancer le {date}"; not a link or button | — |
| Empty round | no prospects, no outbox | "Aucun prospect à visiter. Synchronisez pour récupérer votre liste." | — |

</frozen-after-approval>

## Code Map

- `src/client/field/TodayScreen.tsx` -- rewrite. Keep `useAgentPosition`, `useSyncState` → `now`, the `RoundState` saved/added lines and their comments. Drop the local `NextStop`, `StopRow` and the bottom "Ajouter un prospect" link (the Ajouter tab replaces it; the mock has none). Add `useLiveQuery(() => fieldDb.outboxVisits.toArray())` and derive the set of queued `prospectId`s.
- `src/client/field/today.ts` -- `buildTodayList` gains an optional `queuedVisitProspectIds: ReadonlySet<string>`. `TodayItem` gains `visitQueued: boolean`. Keep `pending`: it still means "field prospect, no status".
- `src/client/field/StopNumber.tsx` (new) -- 32 px `rounded-full` tabular disc. `variant: "next"` → `bg-primary text-primary-foreground ring-1 ring-inset ring-primary-edge font-bold`; default → `bg-secondary font-semibold`.
- `src/client/field/StopRow.tsx` (new) -- exports `StopRow` and `StopActions` (Y aller secondary with `Navigation`, Visiter primary with `ClipboardCheck`, equal columns, `h-touch`). Row: button header (number, name in label weight, "type · address" meta, badge, distance right), 4 px status edge, `min-h-16`, `rounded-xl border`, `bg-card`. Expanded: `StopActions` below the header. Parent-controlled `expanded`/`onToggle`, so Carte and the admin view can own the state.
- `src/client/field/NextStopCard.tsx` (new) -- a card with a gold 4 px inset edge, overline `copy.today.nextStop`, `StopNumber variant="next"`, name (`text-base font-semibold`), meta, distance, then `StopActions`.
- `src/client/copy.ts` `today` -- `notSynced` now documents both cases. Add `meta(type, address)` → "Restaurant · Rue du Midi 42", or the type alone. Remove `addProspect` if nothing else uses it.
- `src/client/admin/status.ts` -- reuse `STATUS_EDGE`. Use `STATUS_EDGE.follow_up` for Plus tard, and `STATUS_EDGE.new` when status is null.
- `src/client/ui/badge.tsx` -- use as is: `<Badge className="bg-tint-warn text-warn rounded-sm border-transparent">`. Radix Slot is already in the entry chunk, so this adds nothing.
- `src/client/format.ts` -- reuse `formatDistance` and `formatDate`.
- `test/setup-dom.ts` -- fake-indexeddb and denied geolocation are already set up.
- `docs/design.md:721-762` "The next stop is the screen" -- rewrite. The "No card around the next stop" rule is reversed by DESIGN.md › Next-stop card, so say so and update the ASCII sketch, the row-expand rule, Plus tard, the badge and the tablet two panes.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/field/today.ts` -- add `visitQueued` and the optional set parameter -- badge source
- [x] `src/client/field/today.test.ts` -- queued visit flags only its stop and leaves `now` order and `later` unchanged; the default parameter keeps old calls working -- matrix rows 3–4
- [x] `src/client/field/StopNumber.tsx`, `StopRow.tsx`, `NextStopCard.tsx` -- build the shared components -- CAP-6, reuse by Carte and the admin view
- [x] `src/client/field/TodayScreen.tsx` -- compose the screen: header ("Tournée du jour", "{n} arrêts"), notices, then a `md:grid md:grid-cols-5` with the card `md:col-span-3 md:col-start-3 md:row-start-1 md:sticky md:top-4` and the list + Plus tard `md:col-span-2 md:col-start-1 md:row-start-1`. DOM order is card first. One row expanded at a time -- CAP-6
- [x] `src/client/copy.ts` -- copy changes above -- invariant 15
- [x] `src/client/field/StopRow.test.tsx`, `TodayScreen.test.tsx` -- DOM: tap toggles `aria-expanded` and shows both actions with the right `href`s (`/tournee/:id`, OSM url); single-open; no Y aller without coordinates; badge from a seeded `outboxVisits` row; Plus tard row has no link; empty state -- matrix
- [x] `docs/design.md` -- rewrite the Tournée section -- CAP-11

**Acceptance Criteria:**
- Given the built app offline at 390 px and 820 px in light and dark, when Tournée du jour opens on a seeded round, then it matches `key-f1-tournee.html` (minus progress and swipe), and at 820 px the list is left and the next stop right.
- Given any stop row, when it is tapped or activated with Enter/Space, then Visiter and Y aller appear in place and nothing is written to Dexie.
- Given the branch, when `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm check:precache` run, then all pass and the precache stays ≤ 1,000 KiB.

## Implementation Notes

- Implemented by a pwa-engineer subagent from this spec, then patched on diff read: `Distance` takes a `className` (the card's distance was inheriting the row's small muted style; the mock has it bold in ink), the card's grid cell gets `md:self-start` (a stretched grid item never sticks), the screen header stacks "{n} arrêts" under the title as in the mock, and two comments that pointed at a non-existent design.md "Design Notes" now point at design.md's "Pas encore envoyé" paragraph. The design.md ASCII sketch was redrawn to an even 34-column box.
- Matrix audit added assertions for the card's gold "1", the row's number and "120 m", "Position inconnue" (no coordinates, and position denied), the `new` edge for a status-less stop, the "À relancer le" line, and "expanding writes nothing to Dexie".
- Files: `today.ts`, `today.test.ts`, `StopNumber.tsx`, `StopRow.tsx`, `StopRow.test.tsx`, `NextStopCard.tsx`, `TodayScreen.tsx`, `TodayScreen.test.tsx`, `copy.ts` (`today.meta` added, `today.addProspect` removed as unused), `docs/design.md`.
- Size: precache 680.68 KiB (baseline 676.74 KiB, +3.94), entry chunk `index-*.js` 514.94 kB / 165.17 kB gzip (baseline 511.76 / 163.92).

- Review patches applied by the implementer (all 11 patch rows). Final: lint, typecheck, 1,050 tests, build and check:precache green; precache 680.61 KiB, entry chunk 514.87 kB / 165.22 kB gzip. Baseline re-stamped at PR time: merge-base is still `a96ab86d634dd309569f14ee94ec5a12549776eb` (main gained only backlog docs). Committed as `c7a0507`, PR #134. The manual 390/820 px browser check has not run yet.

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Counts: high 0 · medium 2 · low 8 · false 7 · maybe-false 0 · rejected-low 5. No intent_gap or bad_spec, so no loopback.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | VG, BH, IA | Card badge from a queued visit only covered on ~50 % of runs (random UUID order); "without touching order" never asserted | medium | patch | Verified: no position in happy-dom → primary-key order. Deterministic ids, a single-stop card case, order asserted |
| 2 | ECH, BH | `aria-controls` names an id absent while collapsed | low | patch | Panel always rendered, `hidden` when collapsed |
| 3 | ECH, BH, IA | Next stop's name lost its `<h3>` | medium | patch | Old `NextStop` rendered `<h3>`; now `<h3 className="text-heading">` per design.md type table |
| 4 | IA | Card name and meta not on the Heading/Meta tokens | low | patch | design.md:206 names `text-heading` for the next stop's name; meta lines on `text-meta` (mock 12px) |
| 5 | ECH | Long unbroken name overflows the card at 390px | low | patch | `break-words` on the card's name and meta |
| 6 | ECH | Empty left column adds stray space when only a card exists | low | patch | Column rendered only when rows or Plus tard exist |
| 7 | BH | Badge block duplicated in card and row | low | patch | One `NotSyncedBadge` in StopRow.tsx |
| 8 | BH | Plus tard block duplicated in TodayScreen | low | patch | One local `LaterSection` |
| 9 | BH | Docstrings cite a non-existent design.md "Stop row"; "story 3" opaque | low | patch | Pointed at "Next-stop card", "story 117.3 (swipe)" |
| 10 | BH | design.md never records the removed "Ajouter un prospect" button | low | patch | One sentence added |
| 11 | BH, IA | No test for next stop + Plus tard together, nor keyboard activation | low | patch | Two DOM cases added |
| 12 | ECH, BH | Stale `expandedId` re-opens a row that reorders back into the list | low | reject | Needs an effect/guard; only on a position refresh that moves the stop out and back, and the outcome is one row open — harmless |
| 13 | ECH | A Plus tard row with a queued visit shows no badge | low | reject | Plus tard rows cannot be visited from the round, so a queued visit there needs another path; adds a branch |
| 14 | BH | Row button has no focus style | false | reject | `app.css:364` gives every `:focus-visible` an `outline-ring outline-2` ring |
| 15 | BH | Card drops the next stop's status edge | false | reject | DESIGN.md › Next-stop card specifies a gold 4px edge |
| 16 | BH, IA | Bordered stop rows contradict design.md:492 "no cards around rows" | false | reject | :492 is the admin live-feed section citing a top-of-file rule that the Grounding rewrite already removed; Grounding says later sections are rewritten as adopted. The mock draws bordered rows |
| 17 | BH, IA | Visited stop stays on the card offline instead of "gone" (Flow 1) | false | reject | Frozen Never: "Do not hide or reorder a stop because a visit to it is queued" (human-approved; invariant 3). Surfaced to the owner in the summary |
| 18 | BH | Precache cost not measured | false | reject | Implementation Notes: 680.68 KiB / 514.94 kB |
| 19 | BH | StopNumber claims reuse it does not have; admin import would pull field code into the admin chunk | false | reject | Epic 117 names Carte and the admin round view as consumers; the admin chunk may import entry-chunk modules |
| 20 | IA | StopActions hard-codes Visiter, which the admin round view cannot use | low | reject | No admin consumer exists yet; that story extends the row additively (e.g. an actions prop). Building it now is speculative |
| 21 | BH | Glossary lacks "round"/"stop"/"Plus tard" | low | reject | Vocabulary predates this change (old TodayScreen, today.ts) |
| 22 | BH | "CAP-6" comment references opaque | low | reject | CAP ids are the initiative spec's own ids (SPEC.md) |
| 23 | IA | Badge on the card is not in DESIGN.md › Next-stop card | false | reject | Follows from finding 17: the visited stop can be the card, and it must say it has not been sent |
| 24 | IA | 768px layout and "card first in DOM" untested | false | reject | happy-dom does no layout; covered by the spec's manual browser check at 390/820 px |

## Design Notes

- EXPERIENCE.md Flow 1 says the visited stop is "gone" at once. Hiding it client-side would mean deriving status from the outcome, which invariant 3 forbids. DESIGN.md's stop row keeps it on the list with "Pas encore envoyé" until a sync replaces `prospects`. This story follows the invariant and DESIGN.md.
  **Superseded by GH #239** (`_bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md`): the outcome the agent picked, not a derived status, now places the stop immediately — a closed result does leave the round before the sync, which is what makes Flow 1's climax actually happen. "Pas encore envoyé" still shows on whatever stop is queued; it no longer implies the stop never moves.
- The row header is one `<button aria-expanded aria-controls>`, and the actions sit outside it, so no link is nested in a button. Plus tard rows are plain `<li>`: "They can't be visited from here" (EXPERIENCE.md).

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: precache ≤ 1,000 KiB. Record the total and the `index-*.js` size against the baseline of 676.74 KiB / 511.76 kB.

**Manual checks:**
- Open the screen in the browser pane at 390×844 and 820×1180, light and dark, with the network off after the first load. Compare with the mock, then tap a row.
