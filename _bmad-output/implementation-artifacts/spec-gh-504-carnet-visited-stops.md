---
title: 'Carnet lists today''s visited stops and reopens them (story 1.8, #504)'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '19523067d70304c3c93124cf20526fba6a575d93'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A stop leaves Tournée once its visit is queued, but nothing on the phone shows it again. The agent cannot see what they did today, and cannot visit a stop a second time (a follow-up due today, a wrong outcome).

**Approach:** Build `docs/design.md` › Carnet: a third tab at `/tournee/carnet` that lists today's door-days from `doorDaysToday` (entry 7), with the stop's number and latest outcome, newest first. Tapping a row opens the visit form, which says « Retour au carnet » and returns to Carnet after a save. The all-done cards point to Carnet.

## Boundaries & Constraints

**Always:** Carnet reads the same snapshot, `now`, identity and period as `useRound` (one hook, no second clock), so its rows and the counter agree. A row shows the number from `stopsOfToday`, `left` stops included, or a dash ring when the prospect has no stop today. Its name, type and address come from the `visitedStops` row, then `prospects`, then this identity's `outboxProspects`. A door-day with none of these is not drawn. The latest outcome is a neutral badge (`secondary`, never a status colour, invariant 3). « Pas encore envoyé » (`warn`) shows while `pending`, and the muted « {2} visites » when there is more than one visit. A closed prospect stays listed and can be reopened: the visit form falls back to `visitedStops` for its name and type. Reopening saves a new visit through `queueVisit` (invariants 2, 4), and the counter does not move. Each row is one link named « Arrêt {n} · {name} · {outcome}, à {HH:MM}. Rouvrir », or without « Arrêt {n} · » when it has no number. Copy is verbatim from design.md and lives in `copy/field.ts` and `copy/shared.ts`. The field precache stays under 1,000 KiB, and the PR quotes the total.

**Never:** Midnight (entry 9), admin screens (entries 10–12), any change to the server, the sync contract, `CLIENT_VERSION` or Dexie's schema. Carnet has no count, no swipe on its rows, and no day before today. Never raise the precache ceiling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Converted + no contact | pulled visited stops 4 (converted, 10:00) and 7 (no contact, 11:00) | rows « 7 » then « 4 », badges Converti and Personne sur place |
| Reopen | tap stop 7, save « À relancer » | back on Carnet with « Visite enregistrée… », row 7 on top with À relancer, « Pas encore envoyé » and « 2 visites »; counter unchanged |
| Outbox only | visit queued, no sync | row shows with « Pas encore envoyé » |
| Same visit both sides | outbox id also in `visitIds` | one visit, not pending |
| Not in the tournée | door-day for a prospect with no stop | dash ring, label without « Arrêt » |
| Left stop visited | stop `left`, door-day today | row keeps its number |
| Closed prospect | converted, gone from `prospects` | listed; reopening opens the form by its `visitedStops` name |
| Another identity / yesterday | outbox visit of another agent, or dated yesterday | not listed |
| Empty | no door-day today | invitation card, `NotebookPen`, no button |
| Cache wipe | tables empty, then a pull with visited stops | same rows again |

</frozen-after-approval>

## Code Map

- `src/client/field/tournee-stops.ts` -- add pure `carnetEntries(input: TodaysStopsInput minus point)` → `CarnetEntry[]` (`prospectId, number | null, name, type, address, outcome, visitedAt, visitCount, pending`), sorted by `visitedAt` desc. Reuse `doorDaysToday`, `stopsOfToday` and `brusselsPeriod(now, 1)` as `tourneeCounter` does. Do not change `doorDaysToday`'s output.
- `src/client/field/useRound.ts` -- expose `carnet: CarnetEntry[]` from the same `stored` snapshot (a `useMemo` beside `progress`). No second `useLiveQuery`.
- `src/client/field/CarnetScreen.tsx` (new) -- header (`formatBrusselsWeekday`-style date overline as StartScreen does, then « Carnet »), the `role="status"` save line read from `location.state.saved` like `TodayScreen.tsx:46`, the list of `Link` rows (`min-h-16` card, `StopNumber` default variant, `formatBrusselsTime`, `ChevronRight`, `Badge variant="secondary"` like `SaveConfirmation.tsx:150`, `NotSyncedBadge`-style warn badge), and the empty card. Wait on `loaded` before the empty card.
- `src/client/field/StopNumber.tsx` -- accept `number: number | null`. Null draws an empty ring (`ring-1 ring-inset ring-border`, no fill) with « – », `aria-hidden` since the row's label carries the number.
- `src/client/App.tsx:119-146` -- `carnet` route before `:id`, lazy like `carte`. `FieldFrame` subtitle gets `onCarnet` → `copy.nav.subtitle.carnet`.
- `src/client/field/tabs.ts` + `tabs.test.ts`, `FieldTabs.test.tsx` -- Carnet third (`/tournee/carnet`, `NotebookPen`, `end: false`). Fix the doc comment.
- `src/client/field/VisitScreen.tsx` + `BackLink.tsx` -- read `location.state?.from === "carnet"`. When set, `BackLink` gets `to="/tournee/carnet"` and the label `copy.visit.backToCarnet`, the save at `:533` navigates to `/tournee/carnet` with `{ saved: true }`, and the not-found link at `:585` goes there too. Add a third live query, `fieldDb.visitedStops.get(id)`, as the last fallback for `liveName` and `liveType`, and include it in `settled`. Carnet's links pass `state={{ from: "carnet" }}`.
- `src/client/field/AllDoneCard.tsx`, `CarteSheet.tsx:54`, `CarteList.tsx:65` -- design.md › All done: the card adds the muted « Retrouvez-les dans Carnet. » (only when `total > 0`) and a `secondary` `Link` « Ouvrir le carnet » in both states. Carte's sheet and list add « Retrouvez-les dans Carnet. » after `allDone`, with no button.
- `src/client/copy/shared.ts:44-57` -- `subtitle.carnet` and `tabs.carnet`, both « Carnet ».
- `src/client/copy/field.ts` -- `carnet: { title, empty, emptyHint, visits(n), rowLabel(n | null, name, outcome, time) }`, `today.findInCarnet`, `today.openCarnet`, and `visit.backToCarnet` « Retour au carnet ». Fix the comment at `:42`.
- `public/mark.svg`, `public/mark-ink.svg` -- precache trim. Round the path coordinates to one decimal (`npx svgo@3 --precision 1`), which saves about 3.2 KiB at no visible cost (0.1 unit of a 1018-wide viewBox). The build sits at 999.39 KiB, and the screen will not fit without it (CLAUDE.md › Stay in scope: a blocking fix, named in the PR).
- Tests: `tournee-stops.test.ts` (one case per matrix row), `CarnetScreen.test.tsx` (new; seeded with `seedPulledTournee` from `tournee-test-helpers.ts`), and `VisitScreen.test.tsx` (back link and save from Carnet, a closed prospect by its `visitedStops` name). `TodayScreen`'s all-done case checks the button.
- Docs: `docs/domains/field-operations.md` -- a « Carnet » section after the counter's, and fix `:90` and `:103` (« Carnet will », « Carnet reuses it »). In `docs/design.md`, the Carnet slot line at `:2572` says it ships. `docs/api.md` and `docs/data-model.md` do not change.

## Tasks & Acceptance

**Execution:**
- [ ] `tournee-stops.ts` + test, `useRound.ts` -- `carnetEntries` and the matrix -- R9.
- [ ] `StopNumber.tsx`, `CarnetScreen.tsx` + test, copy, `tabs.ts`, `App.tsx` -- the screen, tab and route -- R9.
- [ ] `VisitScreen.tsx`, `BackLink.tsx` + tests -- reopen from Carnet, closed-prospect fallback -- R9.
- [ ] `AllDoneCard.tsx`, `CarteSheet.tsx`, `CarteList.tsx` -- point to Carnet -- R9.
- [ ] `public/mark*.svg` -- precache trim -- R16.
- [ ] `field-operations.md`, `design.md` -- R16.

**Acceptance Criteria:**
- Given a swiped tournée with a converted stop and a no-contact stop, when Carnet opens, then both rows show their numbers and outcomes, newest first.
- Given that state, when the no-contact row is reopened and a visit saved, then Carnet shows the row on top with « 2 visites », and Tournée's counter reads as before.
- Given a converted prospect absent from `prospects`, when its Carnet row is tapped, then the visit form opens with its name and saves.
- Given an agent, when the tab bar renders after the swipe, then it reads Tournée, Carte, Carnet, Ajouter (then Tableau de bord for an online admin).

## Implementation Notes

- A Sonnet `pwa-engineer` subagent implemented this from the spec, and then the main session read the diff. It also switched the Carnet row link to `visitPath()` (`today.ts`), the one spelling of the form's path.
- **Precache trim, deviation:** `svgo --precision 1` saved 3.2 KiB, but the build then read 1001.61 KiB, because Carnet adds about 5.4 KiB (the main chunk, a lazy `CarnetScreen` chunk and a shared `badge` chunk). `public/mark.svg` and `public/mark-ink.svg` therefore use path precision 0 with svgo's default preset, keeping `stroke-width=".25"`. Each file drops from 4.83 to 1.75 KiB. At 28–56 px the error is about 0.03 px. At the full 1018 px size, about 2,900 of 1.2 million pixels differ (edge pixels only). An eager Carnet would have saved only 0.56 KiB, so it stays lazy.
- Verification: typecheck, lint and build are green, with 2920 tests passing. `check:precache` reads 998.67 KiB of 1,000 KiB, down from 999.39 KiB. The `pnpm dev` manual check was not run by the subagent.
- Review pass 1 patches, by the same subagent: a CarteList nothing-left assertion, a three-visit server case, and the design.md wording on « Pas encore envoyé ». After the patches, typecheck, lint and build are green, with 2921/2921 tests passing and `check:precache` at 25 entries and 998.68 KiB. Baseline re-stamped at PR time from the merge-base with `origin/main`.

## Spec Change Log

## Review Triage Log

### Pass 1

Lenses: blind-hunter and verification-gap ran on Sonnet (the owner asked for Sonnet on routine work), and edge-case-hunter and intent-alignment on the session's model. duplication-map was skipped because this is not a refactor sweep.

Counts: high 0 · medium 0 · low 12 · false 6 · maybe-false 0. Routes: patch 3 · defer 0 · rejected 12 · noted 3.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| The tablet `CarteList` nothing-left test does not assert `findInCarnet` is absent (verification-gap) | low | patch | Pre-verified. Assertion added |
| No case for a door-day the server lists with several visits (blind) | low | patch | A `carnetEntries` case: three `visitIds` → `visitCount` 3, not pending |
| design.md › Carnet says « Pas encore envoyé » follows the latest visit, while the code and field-operations.md say any unsent visit (intent f, blind) | low | patch | design.md reworded. The spec's Design Notes give the reason. The over-long line at :2572 was rewrapped |
| Row `aria-label` hides « Pas encore envoyé » and « {n} visites » from a screen reader (blind, edge) | low | rejected | design.md › Carnet and the frozen Always give the accessible name word for word. Raised in the PR |
| A door-day no table can name is not drawn, while the counter counts it (edge, intent e) | low | rejected | It needs a visit still in the outbox after a pull that dropped its prospect, and a sync sends the outbox before it pulls. Only an `unconfirmed` row could get there. The fix adds a placeholder branch |
| Stale `now` after midnight hides new visits and dates the header yesterday (blind, edge) | low | rejected | Midnight is entry 9's (frozen Never). The counter and Tournée use the same clock (entry 7's triage) |
| Reopening a converted prospect and saving a lower outcome reverts its status (edge) | false | rejected | That is invariant 3 working: the server derives status from the latest visit. design.md › Carnet lets a closed prospect be reopened |
| Reopening a stop reassigned after its visit gets the new visit quarantined `not_assigned` (intent a) | — | noted | ADR-0022: the visit is kept and the admin can repair it. Rare, and raised in the PR |
| The saved status line persists across a reload or history (blind) | low | rejected | Same pattern as `TodayScreen`'s `saved` state since #35, and the form navigates with `replace` |
| Carte's sheet and list have no « Ouvrir le carnet » link (blind, intent g) | false | rejected | design.md:1930 says the sheet shows the line with « no actions » |
| `carnetEntries` recomputes `doorDaysToday` and `stopsOfToday`, and every `useRound` consumer pays for it (blind) | low | rejected | A day is tens of rows. One snapshot is what keeps the counter and Carnet in agreement |
| Name order differs between the row (visitedStops first) and the form (prospects first) (blind) | false | rejected | Both tables come from the same pull, which names a prospect the same in both |
| Sort has no tie-break (blind) | false | rejected | `Array.prototype.sort` is stable and the Map keeps insertion order, so equal times cannot swap between renders |
| No test that the Carnet tab carries `aria-current` at `/tournee/carnet` (blind) | low | rejected | `NavLink`'s `end: false` matcher is pinned by `isCurrentTab`'s test, the same as Carte |
| `–` is hardcoded and `min-h-16` is not a token (blind) | false | rejected | A dash is not French copy. design.md › Carnet names `min-h-16`, as `StopRow` uses |
| No visible precache quote (blind) | low | rejected | It is in Implementation Notes and the PR |
| The SVGs are out of scope, and the paths are coarser than the spec's one decimal (blind, verification-gap other, intent h) | — | noted | A blocking fix the spec planned. The precision change is in Implementation Notes and raised in the PR |
| Reopen and cache-wipe are tested at component level with seeded tables, and the counter is checked through `tourneeCounter` (intent b, c, d) | — | noted | The end-to-end path is the PR's manual check |

## Design Notes

The « opened from Carnet » signal travels in router state, like `saved`. It is lost on a reload of the form, which then falls back to « Retour à la tournée ». That is harmless, because the row is on Carnet either way. `pending` is any unsent visit of the door-day rather than strictly the latest one. The two differ only when two phones interleave, and either way it means « something here is not sent ».

## Verification

**Commands:**
- `pnpm typecheck && pnpm test` -- expected: green.
- `pnpm lint && pnpm build && pnpm check:precache` -- expected: green, under 1,000 KiB (999.39 KiB before).

**Manual checks:**
- `pnpm dev`: swipe, then save Converti on one stop and Personne sur place on another. Carnet shows both with their numbers. Reopen the second and save: « 2 visites », and the counter does not move. The admin's visit list shows both visits. A second browser profile signed in as the same agent shows the same Carnet after a sync.
