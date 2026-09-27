---
title: 'Ajouter un prospect (GH #127)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 1
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-117-context.md']
baseline_commit: 'ca7a50390a826e121cb9ebc558f985eb7a5bde59'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ajouter (`/tournee/nouveau`) still has the old look: the six types are full-width rows in one column, and the position is a bare line of coordinates. EXPERIENCE.md (Ajouter un prospect, Flow 4), DESIGN.md › Choice controls (field) and Stitch F6 ask for type chips in two columns and a position preview. `docs/design.md` › Adding a place still shows "six targets, wrapping". The screen has no test.

**Approach:** Rebuild the screen's body in the new design and keep its write path. Type becomes six `choice` chips in a two-column grid over native radios. Position becomes a tile-free preview card (decision below) with fr-FR coordinates "50,8466 · 4,3528", and one secondary button: "Utiliser ma position" while there is no reading, "Actualiser" once there is. "Ajouter" writes one `outboxProspects` row, as today, and lands on Tournée du jour where the place is already a stop. Add `AddProspectScreen.test.tsx` and rewrite design.md's section.

## Boundaries & Constraints

**Always:**
- Decision (2026-09-26, owner): the position preview is a tile-free `bg-card` box with a `MapPinIcon` tile, the coordinates and the button. It looks the same online and offline, and makes no tile request. No map on this screen.
- Invariant 2: the screen inserts one outbox row and nothing else. It sends only `fieldProspectSchema`'s fields; no `status`, `source` or owner.
- Invariant 4: `prospectId` is minted once, so a double tap still makes one row (`onConflict` / `add` rolls back).
- Native radios under the chips (ADR-0015); react-hook-form with the `z.pick` resolver (ADR-0018). `FormMessage` shows `copy.fieldProspect.nameRequired`.
- Every string in `copy.ts` (invariant 15). Targets ≥ 48 px, text ≥ 16 px, `tnum` on coordinates.
- Gold only on the checked chip (`choice-selected`) and the "Ajouter" button.
- Quote the precache total and the entry chunk against the pre-change baseline (ADR-0026).

**Never:**
- No Leaflet, `RoundMap` or tile on Ajouter.
- No change to `fieldProspectSchema`, `db.ts`, the sync payload, `today.ts`, `useRound.ts`, `app.css` or the server.
- No geocoding, accuracy line or "GPS actif" badge (reconcile-stitch: invented).
- No per-type icons on the chips (not in DESIGN.md).
- No new dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Open | position granted | chips in 2 columns, Restaurant checked; preview shows "50,8466 · 4,3528"; button reads "Actualiser" | — |
| Locating | reading outstanding | preview reads "Recherche de votre position…" (`copy.today.locating`; owner decision 2026-09-26, was "Localisation…"); button disabled | — |
| No position | denied / unavailable | preview reads "Aucune position enregistrée"; button reads "Utiliser ma position" and asks again | save still allowed, `lat`/`lng` null |
| Empty name | Nom blank, tap "Ajouter" | "Indiquez le nom de l'établissement." under Nom, focus on Nom; 0 outbox rows | — |
| Add | name + type, offline | 1 `outboxProspects` row with `writtenBy`; lands on `/tournee` with "Prospect ajouté…"; the place is a stop in `list.now` at once | — |
| Nearest | added at the agent's position | the new place is the next stop | — |
| Double tap | "Ajouter" twice fast | still 1 row; button disabled, "Ajout…" | — |
| Write fails | `outboxProspects.add` rejects | stays, `saveFailed` alert, no navigation | retry allowed |
| Pick type | tap "Food truck" | only that chip checked; arrow keys move the choice (native group) | — |

</frozen-after-approval>

## Code Map

- `src/client/field/AddProspectScreen.tsx`. Keep `save`, the resolver, `prospectId`, `useRegisterDirty` and the sticky bar as they are.
  - Type: `FieldRadioGroup className="grid-cols-2"` with `FieldRadioOption variant="choice"` for each of `PROSPECT_TYPES`. Drop the duplicate `<p>` label and use a visible label tied with `aria-labelledby` or keep `aria-label` plus a visible `<p aria-hidden>`, so the group is named once.
  - Position: a tile-free preview block inline in the file. It shows the coordinates with `copy.fieldProspect.positionSet`, `copy.today.locating`, or `positionNone`. The button is `buttonVariants({ variant: "secondary", size: "touch" })` with `LocateFixedIcon`.
  - Add `MapPinPlusIcon` to the "Ajouter" button, as the tab does.
- `src/client/format.ts`: add `formatCoordinate(n)`, a module-scope `Intl.NumberFormat("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })`, like `count` and `tenth`. format.ts is the home for fr-FR numbers (ADR-0013); copy.ts holds words. Test it in `format.test.ts` with padding and rounding (`4.35` → "4,3500", `50.84664` → "50,8466").
- `src/client/copy.ts`, `fieldProspect.positionSet(lat: string, lng: string)`: join with " · ". The screen passes `formatCoordinate(point.lat)` and `formatCoordinate(point.lng)`.
- `src/client/ui/field-controls.tsx`: reuse as is. `FieldRadioGroup` already takes `className`.
- `src/client/field/useAgentPosition.ts`: reuse as is. It reads once on mount, which is the domain rule ("position defaults to current location", field-operations.md:43).
- `src/client/field/TodayScreen.tsx:124` already shows `copy.fieldProspect.saved` on `state.added`; `useRound.ts:52` and `today.ts` `fromOutbox` already put outbox prospects on the round. Do not change them.
- Tests: follow `VisitScreen.test.tsx`'s setup (mock `./useSync` and `../api`, real Dexie on fake-indexeddb, `MemoryRouter`). Stub `navigator.geolocation.getCurrentPosition` per test.
- `docs/design.md:1176-1191`: rewrite "Adding a place".

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/format.ts`, `src/client/format.test.ts`, `src/client/copy.ts` -- `formatCoordinate` plus the " · " join -- "50,8466 · 4,3528" per EXPERIENCE.md number format, in format.ts, the home for fr-FR numbers.
- [ ] `src/client/field/AddProspectScreen.tsx` -- two-column choice chips, position preview, button label swap, icon on Ajouter -- CAP-9.
- [ ] `src/client/field/AddProspectScreen.test.tsx` (new) -- one test per matrix row; the "Add" and "Nearest" rows render `TodayScreen` at `/tournee` and assert the new stop is the next stop; assert the outbox row has no `status`/`source` key.
- [ ] `docs/design.md` -- rewrite "Adding a place": a 34-column sketch with the 2×3 chips and the preview, the button swap, why the position is read on open, and the error line (CAP-11).

**Acceptance Criteria:**
- Given the built app in airplane mode at 390 px and 820 px, light and dark, when Flow 4 runs, then the place appears on Tournée du jour as a stop at once, and "Indiquez le nom de l'établissement." shows when Nom is empty.
- Given the branch, when `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm check:precache` run, then all pass and the precache stays ≤ 1,000 KiB.

## Implementation Notes

- Implemented directly in the orchestrating session. The owner did not ask for subagents.
- Owner decision during implementation: the Locating row reuses `copy.today.locating` (« Recherche de votre position… »). The matrix had "Localisation…", which contradicted the Code Map.
- The position card wraps (`flex-wrap`, text `basis-40`), because at 390 px the icon, the coordinates and « Utiliser ma position » do not fit on one row.
- The visible "Type" `<p>` is `aria-hidden`: the radiogroup's `aria-label` names the group, so the word is not read twice.
- Mutation checks, each of which fails at least one test: no `disabled={saving}`, `variant="row"`, `lat`/`lng` forced null, and the button label frozen on « Utiliser ma position ».
- Size: precache 884.73 KiB / 1,000 (baseline 883.65, +1.08), 22 entries (baseline 20). The two new entries are icon chunks Vite split out because other lazy screens use the same icons: `locate-fixed` 0.42 KiB and `map-pin` 0.28 KiB. Entry `index-*.js` 388.11 kB / 123.66 kB gzip (baseline 388.03 / 123.62). AddProspectScreen chunk 7.63 kB (baseline 7.13).
- Verification: lint, typecheck, 1,419 tests / 62 files, build and check:precache all green.
- Loop 1 re-derivation.
  - `formatCoordinate` is in format.ts with tests for padding, rounding and sign; `positionSet(lat: string, lng: string)` only joins.
  - The preview shows locating first, with a new test.
  - The comment now links design.md.
  - The design.md note reads "after « Ajouter » with Nom empty".
  - The `FieldRadioOption` docstring now says `row` has no caller. ScriptQuestions uses `choice` everywhere, so this change leaves `variant="row"` unused. Removing it touches a shared component's default, so it is flagged, not done here.
- Loop 1 mutation checks, each of which fails at least one test: no `disabled`, `variant="row"`, null `lat`/`lng`, and locating shown only without a point.
- Loop 1 size: precache 884.87 KiB / 1,000 (baseline 883.65, +1.22), 22 entries. Entry `index-*.js` 388.26 kB / 123.69 kB gzip (baseline 388.03 / 123.62); `formatCoordinate` sits in the shared format module. AddProspectScreen chunk 7.70 kB (baseline 7.13).
- Loop 1 verification: lint, typecheck, 1,422 tests / 62 files, build and check:precache all green.
- Pass-2 patches.
  - The preview keeps the reading « Ajouter » would save during « Actualiser ».
  - The dead `row` variant is removed.
  - `formatCoordinate` no longer prints a negative zero.
  - The first test awaits the reading.
  - design.md is rewrapped.
- Pass-2 mutation checks, each of which fails a test: the point hidden while locating, and the negative-zero strip removed.
- Final size: precache 884.43 KiB / 1,000 (baseline 883.65, +0.78), 22 entries. Entry `index-*.js` 388.29 kB / 123.70 kB gzip (baseline 388.03 / 123.62). AddProspectScreen chunk 7.71 kB (baseline 7.13).
- Final verification: lint, typecheck, 1,423 tests / 62 files, build and check:precache all green.
- Baseline re-stamped at PR time: the merge-base with `origin/main` is still `ca7a50390a826e121cb9ebc558f985eb7a5bde59`. main has moved to `ffdfac9` (#153), which also edits copy.ts and design.md; `git merge-tree` shows no conflict.
- Manual browser check not run. `pnpm dev` in this worktree answers `/api/me` with 500 (no local dev identity or D1 here), so the screen shows the offline sign-in state. The device run of Flow 4 is story 117.12 (#129).

## Spec Change Log

**Loop 1** (review pass 1, finding 10, from the blind hunter).
- **Trigger.** The Code Map put fr-FR number formatting inside `copy.ts`'s `positionSet`. `src/client/format.ts` is the home for fr-FR numbers ("Dates, numbers and distances, always fr-FR", ADR-0013) and already builds its formatters once in module scope. Following the spec gave the codebase two homes for one kind of rule.
- **Amended.** Code Map and Tasks: `formatCoordinate` goes in format.ts with a format.test.ts case; `positionSet` takes strings and only joins them.
- **Known-bad state avoided.** A per-render `toLocaleString` inside copy.ts, beside format.ts's module-scope formatters.
- **KEEP.**
  - The screen markup: the `grid-cols-2` choice chips, the wrapping `bg-card` position card, the secondary touch button with `LocateFixedIcon`, and `MapPinPlusIcon` on Ajouter.
  - The 10-test `AddProspectScreen.test.tsx`, which passed all four mutation checks.
  - The design.md section.
- **Also apply** the pass-1 patch findings, so re-derivation does not reproduce them:
  - the preview shows `copy.today.locating` whenever a reading is outstanding, even with a previous point (matrix row "Locating"), plus a test;
  - update the `FieldRadioOption` docstring (`variant="row"` is no longer Ajouter's);
  - the screen comment links docs/design.md › Adding a place, not the spec;
  - the design.md sketch note reads "after Ajouter with Nom empty".

## Review Triage Log

**Pass 1** (lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment).
- Counts: high 0 · medium 1 · low 9 · false 7.
- Finding 10 is `bad_spec`, which triggers loopback 1. The patch rows are carried into the re-derivation as "Also apply" in the Spec Change Log.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | BH, VG, IA | `FieldRadioOption` docstring still says Ajouter's type chips use `variant="row"` | low | patch | field-controls.tsx:121-122; this change moved them to `choice`, so the change made the comment false |
| 2 | BH | The screen comment cites `spec-gh-127`, which lives outside the repo | low | patch | CLAUDE.md: link the doc that owns the rule. Point it at docs/design.md › Adding a place |
| 3 | BH, IA | The design.md sketch says the name error shows "only when Nom is empty"; it shows after a submit | low | patch | `FormMessage` renders on a resolver error, which only a submit raises; the test confirms it |
| 4 | BH, ECH | Actualiser with a previous point shows no locating state | low | patch | `point ? coords : locating…`, so with a point, locating never renders. The frozen matrix row "Locating" says the preview reads locating whenever a reading is outstanding |
| 5 | BH, ECH | A failed Actualiser silently keeps the old coordinates | low | reject | The coordinates shown are the ones that will be saved, so nothing lies. Denied after an earlier grant is rare, and the fix needs new copy plus a branch |
| 6 | ECH | Ajouter tapped while the reading on open is outstanding saves null coordinates, so the place goes last | medium | defer | Real: `save` reads `point` at the tap. The write path predates this story and the spec keeps it; waiting for the reading or disabling Ajouter is a behaviour decision |
| 7 | ECH | No geolocation API: the button stays enabled and does nothing | low | reject | Pre-existing, and every supported phone browser has the API |
| 8 | BH | No test that a place with no position goes to the end of the round | false | reject | `today.test.ts:62` covers the ordering; this suite asserts the null coordinates |
| 9 | BH, IA | The precache total is not quoted | false | reject | It is in Implementation Notes and goes in the PR |
| 10 | BH | fr-FR number formatting in copy.ts, rebuilt on every render; format.ts is its home | low | bad_spec | format.ts:1 "Dates, numbers and distances, always fr-FR", with module-scope `Intl.NumberFormat`. The Code Map directed copy.ts → loopback 1 |
| 11 | BH | The aria-hidden visible label and `aria-label` can drift; the group has no `aria-invalid` | false | reject | Both read `copy.fieldProspect.type`; the type always has a value (default Restaurant), so it cannot be invalid |
| 12 | BH | The live region announces the coordinates with no context | low | reject | It announces the locating line, then the value under the visible "Position" heading. Rare, and the fix adds structure |
| 13 | BH | The className assertions are brittle | low | reject | The same class-scan pattern the outcome-card and choice-tile tests use (spec-gh-125 row 15) |
| 14 | VG | Padding and rounding in the four-decimal format are untested | low | patch | The fixture already has four decimals. Folded into loop 1: format.test.ts cases |
| 15 | IA | Visual expectations (two columns, gold, wrap at 390 px) are only checked through classes | low | reject | Covered by the spec's manual browser check at 390 and 820 px, light and dark |
| 16 | IA | Flow 4 has Karim tap "Utiliser ma position"; the screen reads on open | false | reject | A Design Note in the approved spec, from field-operations.md:43 |
| 17 | IA | Stitch icons, "GPS actif" and the precision line are missing | false | reject | Excluded by the frozen Never list |

**Pass 2** (loop 1; lenses: blind-hunter, edge-case-hunter, verification-gap, intent-alignment).
- Counts: high 0 · medium 0 · low 6 · false 3 · carried 8.
- There is no intent_gap or bad_spec, so no loopback. The patches were applied by the orchestrator.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | BH, ECH | After « Actualiser », the card showed « Recherche… » while « Ajouter » would save the old reading | low | patch | The loop-1 locating-first order hid `point`, but `save` still reads it. The card now keeps the reading « Ajouter » would save and shows the locating line under it; the test asserts both. Hiding the point again fails the test |
| 2 | BH | `variant="row"` is dead but is still the default | low | patch | No caller after this change (ScriptQuestions passes `choice` everywhere). The variant and the prop are removed; `FieldRadioOption` is the choice tile, and the 3 + 1 `variant="choice"` props are dropped |
| 3 | ECH | `formatCoordinate` prints "-0,0000" just west of the meridian | low | patch | Node 22: `-0.00003` gives "-0,0000". Stripped on the formatted string, with a test; removing the fix fails it. `signDisplay: "negative"` was avoided because older Safari throws at module load |
| 4 | BH | The first test resolves a reading without awaiting it | low | patch | It now awaits the coordinates |
| 5 | BH | The design.md paragraph runs to 143 columns, « is split across a line, and Adresse/Téléphone have no boxes | low | patch | Rewrapped to ≤ 80, « kept with its word, input boxes added to the sketch |
| 6 | VG | `PreviewStep.tsx:100` shows coordinates with `toFixed(4)` | low | defer | Pre-existing and admin only → issue #154 (found-in-passing) |
| 7 | BH | `copy.today.locating` is borrowed from Tournée's namespace | false | reject | Owner decision during implementation (matrix row "Locating") |
| 8 | BH | The double-tap test counts calls, not the row's arguments | false | reject | The retry test asserts one stored row, and `prospectId` is `useState`-minted; a call count is what tells a guard apart from no guard (spec-gh-125 row 10) |
| 9 | IA | Flow 4 is tested up to the next-stop card; the Visiter tap is not exercised | false | reject | The Visiter link on the next-stop card is TodayScreen's, covered in `TodayScreen.test.tsx` |
| 10 | BH, ECH | A failed Actualiser is silent | low | carried reject | Pass 1 row 5 |
| 11 | ECH | Ajouter during the reading on open saves null | medium | carried defer | Pass 1 row 6 (deferred-work.md) |
| 12 | ECH | No geolocation API: the button does nothing | low | carried reject | Pass 1 row 7 |
| 13 | BH | The aria-hidden label duplicates `aria-label` | false | carried reject | Pass 1 row 11 |
| 14 | BH, IA | className assertions; visual expectations unverified | low | carried reject | Pass 1 rows 13 and 15 |
| 15 | BH | No test that a no-position place goes last | false | carried reject | Pass 1 row 8 |
| 16 | BH, IA | Precache not quoted | false | carried reject | Pass 1 row 9 |
| 17 | IA | Map vs card; Flow 4's literal tap | false | carried reject | Pass 1 rows 16 and 17; owner decision on the card |

## Design Notes

- The position is still read on open, not only on the tap. The domain doc says the position defaults to the current location, and Flow 4's climax ("as the nearest stop") needs coordinates even when the agent never taps. So "Utiliser ma position" shows only when there is no reading yet, and "Actualiser" otherwise.
- `variant="choice"` rather than `"row"`: DESIGN.md lists type chips under Choice controls (field), the same tile as the yes/no pair.

## Verification

**Commands:**
- `pnpm lint && pnpm typecheck && pnpm test` -- expected: green.
- `pnpm build && pnpm check:precache` -- expected: ≤ 1,000 KiB; record total, `index-*.js` and the AddProspectScreen chunk against the baseline.

**Manual checks:**
- In the browser at 390×844 and 820×1180, light and dark, offline: add "Friterie des Minimes" as Restauration rapide, land on Tournée and see it as the next stop; submit with Nom empty and see the error.
