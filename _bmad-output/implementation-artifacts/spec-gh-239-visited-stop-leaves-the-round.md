---
title: 'A visited stop leaves the round'
type: 'feature'
created: '2026-09-30'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '0e1e080bb2cf8e129d5538b73834c67618da5821'
context:
  - '{project-root}/_bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md'
  - '{project-root}/_bmad-output/specs/spec-done-stop-leaves-the-round/when-step.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After Enregistrer the visited stop stays next stop 1 on Tournée du jour and Carte, before and after the sync, so Flow 1's climax ("Curry House is gone") cannot happen (GH #239, epic #117 retro F1–F3, actions 2–3).

**Approach:** Place every stop per `round-placement.md` in `buildTodayList` — before the sync from the queued visit's outcome and follow-up date, after it from server data alone — and add the shared when step ("Aujourd'hui" / "Choisir une date") of `when-step.md` for À relancer and Personne sur place, with the after-today date rule (SPEC CAP-1, CAP-2, CAP-5).

## Boundaries & Constraints

**Always:** After-sync placement reads only `status`, `lastVisitAt`, `nextVisitAt`: a `follow_up` stop with `lastVisitAt` on today's Brussels day and no `nextVisitAt` at or after tomorrow's Brussels midnight is kept for today and sorts after every other due stop, ignoring distance. The phone never derives or shows a status (invariant 3); the picked outcome drives only the when step and the before-sync placement. "Aujourd'hui" sends today's Brussels midnight as `followUpAt` for both results. Radios and date input stay native (ADR-0015, ADR-0026); every new string in `copy/field`. Decided by the owner: with no script the when choice sits above Notes on the single screen; the not-after-today message is "Choisissez une date à partir de demain." PR quotes precache against 1,000 KiB.

**Never:** No sync-contract or Worker change (invariant 9); the server keeps accepting any `followUpAt`. No change to the save sheet. No next-day return for Intéressé. No dialog after saving Personne sur place.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Queued closed result | outbox visit `interested`/`converted`/`not_interested` | stop absent from `now` and `later`; next-stop card names another stop | none |
| Queued with a date | outbox `follow_up`/`no_contact`, `followUpAt` ≥ tomorrow | stop under Plus tard, sorted by that date | none |
| Queued Aujourd'hui | outbox `follow_up`/`no_contact`, `followUpAt` today | last in `now`, keeps « Pas encore envoyé » | none |
| Pulled, kept for today | `follow_up`, `lastVisitAt` today, `nextVisitAt` today or null | last in `now` | none |
| Pulled, visited yesterday | `follow_up`, `lastVisitAt` yesterday, `nextVisitAt` null | normal nearest-next order | none |
| Personne sur place | pick result | step 2 (or single screen) opens on "Aujourd'hui", no questions | none |
| À relancer, nothing ticked | save | blocked | "Choisissez quand relancer : aujourd'hui ou une date." |
| Choisir une date, empty / impossible | save | blocked | existing `followUpRequired` / `followUpInvalid` |
| Typed date ≤ today | save | blocked; input `min` is tomorrow | "Choisissez une date à partir de demain." |

</frozen-after-approval>

## Code Map

- `src/client/field/today.ts` -- `buildTodayList(prospects, outbox, from, now, queued)`; `isLater` = `follow_up` && `nextVisitAt > now`. Replace the `queuedVisitProspectIds` set with queued visits (latest `visitedAt` per prospect wins); add `lastVisitAt` to `TodayItem`; update the `visitQueued` comment ("never … reorders").
- `src/client/field/useRound.ts:54-61` -- builds the queued set from `outboxVisits`; pass the visits instead. Shared by Tournée and Carte.
- `src/shared/period.ts` -- `brusselsPeriod(now, 1)` gives `{from, to}`; `periodDates(from, 2)` gives today/tomorrow `YYYY-MM-DD`. Reuse; no new date maths.
- `src/client/field/visit-draft.ts` -- `VisitDraft`, `withOutcome`, `toVisit`, `DraftErrors`. Add `when: "today" | "date" | null`, the when-step outcome set, errors `when: "required"` and `followUpDate: "notAfterToday"`; today derives from `context.visitedAt`.
- `src/client/field/VisitScreen.tsx:217-221,431-545` -- date field leaves step 1 (`:486`); `goToQuestions` triggers only `outcome`; `focusFirstProblem` must reach the when radios on whichever step shows them; step 2 for `no_contact` drops `ScriptQuestions` and the `questionsOptional` note.
- `src/client/ui/field-controls.tsx` -- `FieldRadioGroup` (native radios) to reuse for the when choice.
- `src/client/copy/field.ts:67-125` -- `visit.*`; remove `questionsOptional` once unused. `src/client/copy/shared.ts:124` -- À relancer hint becomes "Un rendez-vous à reprendre."
- `src/client/field/progress.ts:27-35` -- `total` union is still needed (a kept-for-today stop is both counted and in `stops`); rewrite the comment, keep the code.
- Tests: `today.test.ts`, `visit-draft.test.ts`, `VisitScreen.test.tsx` (:474, :675 use `questionsOptional`), `TodayScreen.test.tsx:148,160` (replace with Flow 1 climax), `progress.test.ts`, plus a Carte DOM test with the real `useRound` (`CarteScreen.test.tsx` mocks it module-wide, so a new file).
- Docs: `docs/design.md:1253-1261,1567`, `docs/domains/field-operations.md` › Today list and Rules, `EXPERIENCE.md:182,188,289`, `DESIGN.md` › Stop row (~387), a note in `spec-gh-118-tournee-du-jour.md` › Design Notes. prospecting/data-model/glossary were done by #238.

## Tasks & Acceptance

**Execution:**
- [x] `src/client/field/visit-draft.ts` (+ test) -- when choice, defaults, after-today rule, today's Brussels midnight for "Aujourd'hui" -- CAP-2, CAP-5.
- [x] `src/client/field/VisitScreen.tsx` (+ test) -- when radios on step 2 / single screen above Notes, date `min` tomorrow, error focus, no questions for Personne sur place -- CAP-2.
- [x] `src/client/copy/field.ts`, `src/client/copy/shared.ts` -- when labels and two errors; hint -- invariant 15.
- [x] `src/client/field/today.ts`, `useRound.ts` (+ tests) -- before/after-sync placement -- CAP-1.
- [x] `src/client/field/progress.ts` (+ test) -- comment, and a kept-for-today case -- action 3.
- [x] `TodayScreen.test.tsx` and a Carte DOM test -- Flow 1 climax, absent after pull, kept-for-today last.
- [ ] Docs listed in the Code Map -- retro action 2.

**Acceptance Criteria:**
- Given a queued Intéressé visit on the next stop, when Tournée and Carte render, then the card and the sheet name a different stop, and after the pull omits it the stop stays absent.
- Given the change, when `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` run, then all pass and precache is ≤ 1,000 KiB.

## Implementation Notes

- Implemented by a pwa-engineer subagent. Main session then fixed the date `min` (a Brussels `YYYY-MM-DD` via `periodDates`, not `epochMsToDateInput` of a Brussels instant, which drifts off Brussels time) and added DOM tests for the after-pull absence and a pulled kept-for-today stop.
- The review patches were started by the subagent, which stopped on a rate limit after `hasWhenStep`, the `no_contact` validation skip and the overnight fix. The main session finished the rest.
- `hasWhenStep(outcome)` in `visit-draft.ts` is the one home for which results have a when step. `today.ts` treats every other queued outcome as leaving the round, so there is no separate closed-outcome list and no status reasoning (invariant 3).
- A when-step visit still queued from before today's Brussels midnight rejoins normal order, matching where the sync would put it.
- Personne sur place: step 2 is named « Quand ? » in the step indicator. Its answers are neither validated nor sent, and the save sheet shows « 0 réponse ». The sheet itself is unchanged.
- `progress.ts`: `total` keeps the union, since a kept-for-today stop is both counted and in `stops`. Only the comment changed.
- Out-of-list doc touch: `docs/design.md` step indicator paragraph (the « Quand ? » step name).
- Verification: typecheck, lint, 2015/2015 tests, build green. Precache is 25 entries, 929.76 KiB of 1,000 KiB (927.50 after #238).

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment; duplication-map skipped, not a sweep). Verdicts: high 0 · medium 2 · low 14 · false 1 · maybe-false 0 · rejected-low 6. Verification-gap filed 4 gaps (patch).

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | Stale invalid answer blocks a Personne sur place save with nothing on screen | medium | patch | `toVisit` validated `draft.answers` for `no_contact` with questions unmounted; now skipped. |
| 2 | Carte DOM test rendered the desktop list, not the sheet the AC names | medium | patch | happy-dom is 1024px; `CarteRound.test.tsx` now stubs a phone and asserts the sheet. |
| 3 | Save sheet counted answers Personne sur place does not send | low | patch | Now `0`; the sheet's shape is unchanged. |
| 4 | Step indicator read "Questions" on Personne sur place's step 2 | low | patch | `StepIndicator` `whenOnly` → « Quand ? ». |
| 5 | `focusFirstProblem` skipped a question above the when radios | low | patch | Questions checked before when/date. |
| 6 | When-step/closed outcome sets restated three times | low | patch | One `hasWhenStep` in `visit-draft.ts`. |
| 7 | Queued visit from yesterday pinned last today, normal order after the sync | low | patch | Queued branch keeps for today only when `visitedAt >= todayStart`. |
| 8 | `min` comment claimed the floor and the save rule always agree | low | patch | Comment names the midnight lag and `notAfterToday`. |
| 9 | EXPERIENCE.md :118/:149/:182 not reconciled | low | patch | Hint, step-1 date and waiting-to-send row updated; :290 already said "gone". |
| 10 | Gaps: latest-queued-wins, dated `nextVisitAt`/sort, DOM dated queue via `useRound`, no-script Personne sur place, step-2 À relancer blocked save | low | patch | Verification-gap mutations passed the suite (pre-verified); tests added. |
| 11 | Stale `now` (`lastSyncAt`) across midnight misplaces "Aujourd'hui" | low | reject | `lastSyncAt` is in-memory (`useSync.tsx:78`), refreshed every heartbeat; needs the app open offline across midnight, and the fix reworks fixtures pinned to a fixed `lastSyncAt`. |
| 12 | Chosen date is device-local midnight while placement uses Brussels | low | reject | Pre-existing `dateInputToEpochMs`; only a phone set off Brussels time. |
| 13 | Equal `visitedAt` tie between two queued visits | low | reject | Needs two saves in the same millisecond. |
| 14 | Kept-for-today stops in insertion order | low | reject | No rule orders them; the spec only says "last". |
| 15 | Save before the script read settles shows no when radios | low | reject | The Dexie meta read resolves in milliseconds, before a tap. |
| 16 | Plus tard row shows no « Pas encore envoyé » | low | reject | SPEC assumption: the band's pending count still shows unsent visits. |
| 17 | After-pull test simulates the sync by hand | false | reject | Pull omission of `interested` is covered by `sync.test.ts` (#238); this test pins the client side. |
| 18 | Spec tasks unticked, notes empty | — | reject | Filled at the present step. |

## Design Notes

- Any outcome change resets `when` to the new result's default (Personne sur place "today", À relancer `null`, others `null`) and clears the date: a "today" carried from Personne sur place into À relancer would be the hurried-agent error `when-step.md` rejects.
- `when` is required for both when-step results; Personne sur place can only lack it by bug.
- A Personne sur place visit sends `answers: {}`: its questions are hidden, and answers typed under another result must not ride along unseen (the `withOutcome` date reasoning).
- Date comparison is on `YYYY-MM-DD` strings against Brussels today, so "not after today" never depends on the device zone.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all green
- `pnpm build` -- expected: precache ≤ 1,000 KiB; quote it in the PR
