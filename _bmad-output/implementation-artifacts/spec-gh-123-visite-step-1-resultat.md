---
title: 'Visite step 1: Résultat (GH #123)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-117-context.md']
baseline_commit: 'acfb094d994fb732bd5eee45325e8f6c011a0eb3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Visite step 1 still renders the M2 form: plain 56 px text radios, a bare flyer checkbox, no step indicator, and "Continuer" with no outcome marks the group but moves nothing, so the agent is not taken to the problem. `docs/design.md` still says "no 1 sur 2, no dots".

**Approach:** Rebuild step 1 to DESIGN.md › Step indicator and Outcome card and `mockups/key-f3-f5-visit.html` (F3): the step indicator, a Flyer remis card with its hint, five neutral outcome cards (icon tile, label, hint, radio disc) styled over native radios, gold selection with a check, "Relancer le" with the native date input, Visites précédentes and the back links. A missing outcome shows "Choisissez un résultat." and moves focus to the outcome group. Rewrite `docs/design.md`'s visit section for step 1.

## Boundaries & Constraints

**Always:** Radios, the checkbox, the date input and labels stay native (ADR-0015, ADR-0026). Before and after selection, no outcome card shows a status or `outcome-*` colour. All five icons share one neutral tile, and selection is gold only (DESIGN.md `outcome-card-selected`) (invariant 3). Hints describe the outcome and never name a status. Every French string lives in `copy.ts`. The resolver stays `toVisit`, and `withOutcome` still drops a stale date. Step 1 works with no network. Targets are ≥48 px, and outcome cards are ≥ `min-h-decision`. Quote the precache total and the entry chunk in the PR.

**Never:** Do not rebuild step 2's controls, the no-script one-step path or the save sheet (stories 117.7 and 117.8). Leave the tablet layout alone (117.9). Do not touch `app.css`, Dexie, the sync payload, `visit-draft.ts` rules or the save path. No Radix and no new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Two-step visit opens | script with answerable questions | "Étape 1 sur 2 · Résultat" after a gold dot; name; type; Flyer remis card; five cards with hints; "Continuer" | — |
| Pick an outcome | tap "Intéressé" | that card is gold-bordered, washed, with a gold icon tile and a check. The other four stay neutral, and no card carries a status token | — |
| Continuer, no outcome | nothing chosen | "Choisissez un résultat." under Résultat (`role="alert"`), and focus on the first outcome radio, scrolled into view. Stays on step 1 | — |
| À relancer | pick `follow_up` | "Relancer le" with a native `type="date"` appears. Switching away removes it and its value | Empty date on Continuer → `followUpRequired`, and the date is focused |
| One-step visit, no outcome | no cached script, tap "Enregistrer la visite" | same message and focus as Continuer. No outbox row | — |
| Offline | `apiFetch` rejects | the step renders, cached history shows, and Continuer works | fetch error swallowed |
| Step 2 back | "Résultat" tapped on step 2 | step 1 with outcome, flyer and date intact | — |

</frozen-after-approval>

## Code Map

- `src/client/field/VisitScreen.tsx` -- rewrite the step-1 branch and header only. Keep `visitId`, the pinned `script`, `resolver`, `useRegisterDirty`, `save`, the history fetch and the keyed Continuer/save button. `goToQuestions` and `showFirstProblem` call one new `focusFirstProblem()`: when the outcome is missing, focus and `scrollIntoView({block:"center"})` the first outcome radio by DOM id. When the date is the problem, call `form.setFocus("followUpDate")`. Step 2 keeps its body and changes only its back button to BackLink's look (`ArrowLeftIcon`). Show the indicator only when `hasQuestions`, on both steps.
- `src/client/field/StepIndicator.tsx` (new) -- a `text-overline text-muted-foreground uppercase` line led by a `size-1.5 rounded-full bg-primary` dot. It takes `step: 1 | 2`.
- `src/client/field/OutcomeCard.tsx` (new) -- a `<label>` over a native `<input type="radio">` (`appearance-none`, 24 px disc on the right, with a `CheckIcon` stacked over it as `FieldCheckbox` does). Classes: `min-h-decision rounded-xl border bg-card`, `has-[:checked]:border-primary-edge has-[:checked]:ring-1 has-[:checked]:ring-inset has-[:checked]:ring-primary-edge has-[:checked]:bg-primary/12`. The 40 px `rounded-lg bg-secondary` icon tile turns `bg-primary text-primary-foreground` through `group-has-[:checked]`. It shows the label in `text-heading` and the hint in `text-meta text-muted-foreground`, and `aria-describedby` points at the hint. The `OUTCOME_ICONS` map is `DoorClosed`, `ThumbsUp`, `ThumbsDown`, `Clock` and `BadgeCheck`.
- `src/client/ui/field-controls.tsx` -- `FieldCheckbox` gains an optional `hint`. `FieldRadioGroup` passes through `aria-describedby`. Nothing else changes: ScriptQuestions and AddProspectScreen still use them.
- `src/client/copy.ts` -- add `OUTCOME_HINTS: Record<Outcome, string>` (EXPERIENCE.md › Voice and Tone, verbatim) and `visit.step(n, total, name)` → "Étape 1 sur 2 · Résultat". Reuse `visit.flyerHint`, `outcomeRequired` and `backToOutcome`.
- `src/client/field/BackLink.tsx` -- reuse it on step 1 as is.
- `test/setup-dom.ts` -- fake-indexeddb and denied geolocation already exist. Mock `./useSync` and `../api`, as `TodayScreen.test.tsx` does.
- `docs/design.md:841-950` -- rewrite "One decision per screen" and the step-1 half of "The script is the second screen". The new sketch has the indicator, the flyer card and the cards with hints and discs. "No 1 sur 2, no dots" is reversed by DESIGN.md › Step indicator, and the section should say so. Add the missing-outcome focus. Leave step 2's paragraphs for 117.7.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy.ts` -- add hints and step text -- invariant 15
- [ ] `src/client/ui/field-controls.tsx` -- add the `hint` and `aria-describedby` passthroughs -- flyer card, error association
- [ ] `src/client/field/StepIndicator.tsx`, `OutcomeCard.tsx` -- new components -- DESIGN.md components
- [ ] `src/client/field/VisitScreen.tsx` -- compose step 1, and add the focus on the first problem -- CAP-8
- [ ] `src/client/field/VisitScreen.test.tsx` (new) -- DOM coverage for every matrix row. Assert that no card's class list matches `/outcome-|success|warn|destructive|status/` before or after each selection, that no hint contains a `STATUS_LABELS` value, and that `document.activeElement` is the first outcome radio -- matrix
- [ ] `docs/design.md` -- rewrite the visit section's step 1 -- CAP-11

**Acceptance Criteria:**
- Given the built app offline at 390 px in light and dark, when a visit opens on a seeded prospect with a script, then step 1 matches F3 in `key-f3-f5-visit.html`.
- Given any outcome selected, when the cards are inspected, then only the selected one is gold, and none shows a status colour or text.
- Given the branch, when `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm check:precache` run, then all pass and the precache stays ≤ 1,000 KiB.

## Implementation Notes

- Implemented by a pwa-engineer subagent from this spec. `focusFirstProblem` reads `form.getFieldState` because `formState.errors` is stale right after `await trigger()` (RHF 7.88). Icon tile and step dot carry `ring-primary-edge` to satisfy `palette.test.ts` (gold fill needs its edge).
- Matrix audit added a `type="date"` check, the dropped date value on re-select, and a seeded cached-history row that renders offline.
- Size before review: precache 692.00 KiB (baseline 686.44), entry chunk `index-*.js` 505.63 KiB (baseline 505.29), VisitScreen chunk 15.17 KiB (baseline 11.60).
- Review patches (rows 1–13) applied by the implementer. Final: lint, typecheck, 1,161 tests, build and check:precache green. Precache 692.10 KiB / 1,000 (baseline 686.44, +5.66), 16 entries. Rolldown now splits a 132.96 KiB `schemas-*.js` chunk out of the entry, which statically imports and modulepreloads it: `index-*.js` is 372.36 KiB (381.29 kB / 121.33 kB gzip), and entry + schemas is 505.32 KiB vs the 505.29 KiB baseline. VisitScreen chunk 15.33 KiB (baseline 11.60).
- Baseline re-stamped at PR time: merge-base is still `acfb094d994fb732bd5eee45325e8f6c011a0eb3` (main gained only #139, dev seed data, no overlap). Committed as `e760e57`.
- `_bmad-output` in the worktree is a symlink to the main checkout's (gitignored) copy.

## Spec Change Log

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Counts: high 0 · medium 3 · low 12 · false 6 · maybe-false 0 · rejected-low 3. No intent_gap or bad_spec, so no loopback.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | VG, BH, ECH | Invariant-3 check reads only the `<label>` className, and only "interested" is selected | medium | patch | VG mutated the icon tile with a per-outcome status class, and all tests still passed. Fix: walk the subtree and select all five |
| 2 | VG, BH | No test for a script with only unanswerable questions (the no-indicator case design.md names) | medium | patch | VG mutated `hasQuestions` to `script`, and the suite stayed green. Test added |
| 3 | VG | Step-2 blocked save → first invalid question focus untested after the `getFieldState` rewrite | medium | patch | VG mutated it to an early return, and the suite stayed green. Test added |
| 4 | VG | New `aria-describedby` links untested | low | patch | No `describedby` assertion exists. Assertions added |
| 5 | BH | Hint read twice: inside the label's name and again via `aria-describedby` | low | patch | The label wraps the hint, and the test comment admits it. Fix: `aria-labelledby` on the label span (card and checkbox) |
| 6 | BH, ECH | `focusFirstProblem` focuses before step 1 mounts when called from step 2 | low | patch | Reachable: step 1's `trigger` returns early on the unanswered question before `visitSchema`, so a year-0026 date first fails on step 2's save. Fix: `flushSync` the step change |
| 7 | BH | `focus()` after `scrollIntoView` can re-scroll | low | patch | `focus({preventScroll:true})`, as the question path does |
| 8 | ECH | Tests query the indicator and button before the async script read settles | low | patch | `renderVisit` awaits only the prospect heading. Now waits for the settled state |
| 9 | BH | Hint status-word test is case-sensitive, and the header overstates "status word" | low | patch | Labels "À relancer" and "Converti" equal STATUS_LABELS. Compare lowercased and narrow the claim to hints |
| 10 | BH, VG | design.md calls `outcome-card-selected` a class | low | patch | It is DESIGN.md's component token, implemented with `has-[:checked]:` utilities. Reworded |
| 11 | BH, IA | Comments cite missing sections, and design.md/StepIndicator invent a field observation as the reason for the reversal | low | patch | No "Step indicator" heading in docs/design.md, and no source records that observation. Now cites DESIGN.md/EXPERIENCE.md › Step indicator |
| 12 | BH | ASCII sketches misaligned: emoji are double-width, and the step-2 header row is one column too wide | low | patch | Plain placeholders, equal widths |
| 13 | BH, ECH | FieldCheckbox: a caller's `aria-describedby` overrides the hint id | low | patch | Spread order. Merged |
| 14 | BH | No visible focus ring after programmatic focus on touch | low | reject | Needs a new error-state style. The group is scrolled to centre and the alert sits right under it |
| 15 | BH, ECH | Indicator pops in once `getMeta` resolves | low | reject | IndexedDB read in ms, alongside the prospect's own live query. The button flip predates this change. Gating adds a branch |
| 16 | IA | Flyer box 20 px vs the mock's 28 px tile | low | reject | DESIGN.md does not size it. Needs a size variant. The manual check covers it |
| 17 | BH | "On repassera." previews what happens next | false | reject | Verbatim approved copy (EXPERIENCE.md › Voice and Tone). It names no status |
| 18 | BH | `copy.visit.step` has a `total` that never varies | false | reject | No bad outcome. It is a copy formatter |
| 19 | BH | Precache not reported | false | reject | Measured: 692.00 KiB vs 686.44 baseline. Quoted in the PR |
| 20 | IA | Converti turns gold despite "never gold for Converti" | false | reject | DESIGN.md `outcome-card-selected` applies to the chosen card. The Converti rule concerns its status/badge colour |
| 21 | IA | Indicator on step 2, the no-script path and the `getFieldState` rewrite exceed step 1 | false | reject | Approved spec Design Notes decided the indicator on both steps. The rewrite fixed stale `formState.errors`, which blocked the focus AC |
| 22 | IA | Focus goes to the first radio, not "the group" | false | reject | The radio is the group's focus target (native roving focus), as the approved Design Notes decided |
| 23 | IA | Mock cards are 64 px, the code uses 56 px | false | reject | `py-3` + 40 px tile = 64 px rendered, with `min-h-decision` as the floor |
| 24 | IA | 2 px selected edge and dark theme untested | false | reject | happy-dom resolves no `has-[:checked]` styling. Covered by the manual browser check |

## Design Notes

- The mock's selected icon tile turns gold. That is DESIGN.md's `outcome-card-selected`, so it is selection, not status. "Same neutral colour for all five" governs the unselected state.
- Focus goes to the first radio, not the message. The agent lands on the decision, the `role="alert"` line announces why, and the group's `aria-describedby` ties the two together. Native radios get arrow keys for free.
- The step indicator also renders on step 2, so the two steps never disagree during 117.7. It is hidden without questions, because the one-step path must not read "1 sur 2".

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: ≤ 1,000 KiB. Record the total and the `index-*.js` size against the baseline measured before the change.

**Manual checks:**
- In the browser pane at 390×844, light and dark, with the network off after the first load: open a visit, tap Continuer with no outcome, pick À relancer, then Intéressé, then Continuer, then Résultat.
