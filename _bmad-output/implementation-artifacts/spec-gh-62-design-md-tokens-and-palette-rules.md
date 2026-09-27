---
title: 'DESIGN.md tokens and palette rules (GH #62)'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '5e3af93524e3406c827f68f1284fa37400020bbc'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-captain-prospectus-2026-09-24/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `app.css` lacks the tokens DESIGN.md adds (band accent and border, outcome colours, badge tints, the overline and other type roles, the named spacing), and `palette.test.ts` asserts only part of DESIGN.md › Colors' five rules, and only for the `data-theme="dark"` block. Stories 4–7 need these tokens, and `docs/design.md`'s Grounding, Colour and Type sections still describe the old app.

**Approach:** Add every DESIGN.md token to `app.css` in light and dark. Make `palette.test.ts` assert the five rules per theme, compute each badge tint from its `color-mix` declaration, and check every DESIGN.md colour name resolves. Then rewrite the three `docs/design.md` sections from DESIGN.md.

## Boundaries & Constraints

**Always:**
- Existing hex values stay as DESIGN.md has them, and so do the radii, which already match.
- New colours use DESIGN.md's names. Band accent and border are 8-digit hex (`#ffffff14`). Status and outcome badge tints use `color-mix(in oklab, <colour> N%, var(--card))` with N ≤ 12. A tint that fails 4.5:1 drops per theme until it passes (DESIGN.md rule 5).
- Badge text pairs: Nouveau and Personne sur place are `muted-foreground` on `secondary`. Assigné is `foreground` on the assigned tint (12 % of the 55 %-ink edge ≈ 7 % ink). À relancer, Converti, Refusé and Intéressé use their own colour on their tint. Pas intéressé is `foreground` on its tint. The outcome text colours come from the `key-a1-dashboard.html` badges, since DESIGN.md names none.
- Type roles become `--text-*` tokens with line height, tracking and weight. The overline stays sentence case in `copy.ts`, and components add `uppercase`. Tailwind's built-in `overline` utility is a text decoration, so no utility takes that name.
- Decision (2026-09-24, user): light `--warn` moves from `#9A6B12` to `#9A5B18` (5.41:1 on white, 4.58:1 on its 12 % tint, 15° clear of gold); dark `--warn` is unchanged. The PR records the change, since DESIGN.md is outside the repo.
- `docs/design.md` must not link to `_bmad-output` (it is gitignored). The rules it states live in `docs/design.md` itself.

**Never:**
- No component, screen or `copy.ts` change. Adopting the tokens is stories 4–7 and epics 2–5.
- No `sidebar` or `sidebar-collapsed` spacing token: shadcn Sidebar owns `--sidebar-width`, and story 4 vendors it.
- No test that reads DESIGN.md, and no new dependency.
- No change to `docs/design.md` beyond Grounding, Colour and Type.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Current palette | `pnpm test` | Palette suite green in light, `data-theme` dark and media dark | — |
| Rule broken | e.g. `--ring` set to gold, `--primary-foreground` white, a tint at 20 %, a badge colour lightened | The matching rule's test fails, naming the theme | — |
| Dark blocks drift | media-query dark ≠ `data-theme` dark | A test fails | — |
| Token missing | a DESIGN.md colour name absent from `@theme inline` or `:root` | "every token resolves" fails with the name | — |

</frozen-after-approval>


## Code Map

- `src/client/styles/app.css` -- `@theme inline` (61–131): add `--color-*` for the new colours and tints, `--text-*` roles, `--spacing-*` names. Theme blocks: `:root` (138–167), media dark (169–191) and `[data-theme="dark"]` (193–213) stay identical. `--status-new` and `--status-assigned` are declared only in `:root` and follow `--foreground`. Tints declared once in `:root` inherit into dark unless a dark block overrides them.
- `src/client/styles/palette.test.ts` -- `tokens()` (15–25) parses 6-digit hex only and reads only `:root {` and `[data-theme="dark"]`. The media block's selector `:root:not([data-theme="light"]) {` also appears without ` {` in `@custom-variant` (line 47). Keep `contrast()` (exported), the AA/control pair tables and the status-ramp hue test.
- `docs/design.md:12-120` -- Grounding, Colour (including "What gold may and may not do") and Type. Keep line 8's "the CSS is right" note. Leave "Status is read down the left edge" (73–94) and Layout onwards untouched.
- DESIGN.md (the `context` path) -- the front matter and the Colors, Typography and Brand & Style sections are the source.
- Measured with oklab: at 12 %, dark `destructive` is 4.38:1 on its tint, so its dark tint drops to ≤ 10 %. Every other pair passes at 12 % in both themes.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/styles/app.css` -- Add `band-accent`, `band-border` and `outcome-*` in all three theme blocks. Add the tints (`tint-assigned`, `-warn`, `-success`, `-destructive`, `-outcome-interested`, `-outcome-not-interested`). Add the eight type roles (DESIGN.md sizes in rem), and spacing `band-height`, `tab-bar-height`, `page-margin`, `page-margin-compact`, `panel-gap`, `stack-gap`. Set light `--warn` to `#9A5B18`. Update the header comment.
- [ ] `src/client/styles/palette.test.ts` -- Parse 8-digit hex and `color-mix(in oklab, var(--x) N%, var(--card))`. Evaluate the tints with sRGB↔oklab in the test file. Test three themes, with dark inheriting light's undeclared tokens, and assert both dark blocks are equal. Add one `describe` per DESIGN.md rule. Add a resolves-check over the DESIGN.md colour names. It may say, with a comment, that `on-destructive` resolves as shadcn's `destructive-foreground`.
- [ ] `docs/design.md` -- Rewrite Grounding (two faces, one palette), Colour (a token table with the new rows, status and outcome badge pairs, the five rules and what each protects) and Type (a role → token → use table, tabular and fr-FR figures).

**Acceptance Criteria:**
- Given the finished branch, when each rule is broken in turn by a one-hex edit in either theme, then `pnpm test` fails and names the theme.
- Given `app.css`, when every DESIGN.md front-matter colour is compared to it by hand, then each value matches, except light `warn`, now `#9A5B18`.

## Implementation Notes

- Implemented by a subagent from this spec: `app.css` (tokens, tints, type roles, spacing, light `warn` → `#9a5b18`), `palette.test.ts` (oklab `color-mix` evaluation, three themes, one `describe` per rule, resolves-check), `docs/design.md` Grounding, Colour, Type.
- Dark `tint-destructive` is 10 %: 12 % gives 4.38:1, 11 % 4.45:1, 10 % 4.52:1.
- `text-display` gains weight 700; every current use also sets `font-semibold`, which wins, so no screen changes.
- Each rule was broken by a scratch edit in light and dark and failed with the theme named; computed tints matched a browser's to the byte (except `tint-assigned`, one unit off — since made opaque).
- Build before review patches: precache 14 entries, 612.83 KiB (main 610.03), ceiling 1,000 KiB.
- After review patches (triage #1–9): typecheck, lint and test green (568 tests; palette suite 96). Build: entry chunk 145.53 kB gzip, CSS 59.35 kB, precache 14 entries 612.81 KiB. The warn-vs-gold check is ≥ 14.5° in HSL hue: `#9a5b18` sits 14.6° from gold, which the docs round to 15°; the old `#9a6b12` fails it at 6.3°.

## Spec Change Log

## Review Triage Log

**Pass 1 (thorough, 4 lenses).** Counts: high 0, medium 5, low 11, false 3, maybe-false 0 (22 rows; row 22 bundles two guard claims). Routes: patch 9, defer 5 (2 as found-in-passing issues #69, #70), rejected 8.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge | `tint-assigned` mixes the 55 %-alpha edge, so it is ~95 % opaque and rule 5 holds only over the card | medium | patch | Confirmed at `app.css` `--tint-assigned`; spec said ≈ 7 % ink. Now `var(--foreground) 7%` into the card |
| 2 | verif, blind | Nothing asserts `warn` stays 15° from gold, the reason it moved | medium | patch | Verifier set `--warn: #7f5a10` (5° from gold): all tests passed. Hue test added per theme |
| 3 | edge | Hue differences don't wrap at 0/360 | low | patch | `Math.abs(hue-hue)` in two places; direct correction with a circular distance helper |
| 4 | edge | Rule 5 recipe regex rejects decimal percentages that `MIX` accepts | low | patch | Direct regex correction |
| 5 | edge | Dropped "parsed every token" check: a token removed from both dark blocks silently inherits light | medium | patch | Dark themes spread `ROOT` first; the blocks-equal test can't see a shared omission. Now asserts every hex `:root` token is redeclared in dark |
| 6 | edge, blind | `:root` comment says every pair is asserted; `on-destructive` on `warn` newly documented, untested | low | patch | Comment reworded; AA pairs `on-destructive` on `destructive` and `warn` added |
| 7 | verif, blind, edge, intent | design.md says the test "asserts every one" of the rules; rules 1 and 4 are usage rules, only their tokens are tested | medium | patch | Wording now says the test asserts the tokens behind each rule. Existing usage breaches filed as #69 |
| 8 | self (diff read) | design.md and app.css give the wrong reason for the `warn` move | low | patch | The move is rule 5 (4.0:1 on its tint), per the user's decision; text corrected |
| 9 | blind | Untouched Layout still says "no left rail", contradicting the new Grounding | low | patch | Grounding's caveat widened to cover Layout and the sections after it (the intent limits the rewrite to three sections) |
| 10 | blind | Outcome chart colours: interested vs not-interested 1.00:1, no-contact 1.3:1 on the card | medium | defer | DESIGN.md's own values, not introduced here; charts ship with epic-dashboard. deferred-work entry |
| 11 | self (implementer) | `band-muted` on the `band-accent` hover wash is 4.26:1 | low | defer | DESIGN.md pair; nothing uses the wash until story 4 (sidebar). deferred-work entry |
| 12 | verif, blind | Checkbox and default badge fill gold without `primary-edge` | medium | defer | Pre-existing (`checkbox.tsx:11`, `badge.tsx:11`); issue #69 |
| 13 | verif | Destructive button and badge hardcode `text-white` | low | defer | Pre-existing (`button-variants.ts:23`, `badge.tsx:14`); issue #70 |
| 14 | verif, blind | Admin `Input` steps down to `md:text-sm`, but the new Type rule says every input is 16px | low | defer | Deliberate today (`input.tsx:4-8`); the new rule is the target the screens adopt later. deferred-work entry |
| 15 | blind | Type roles not adopted by `body`; five screens hand-roll `text-xl font-semibold …` | low | reject | The frozen Never excludes component changes; adoption is stories 4–7 and epics 2–5 |
| 16 | blind | "the reason at the top of this file" (design.md:434) dangles | low | reject | Pre-existing: the old top did not carry that reason either; the section is outside the three rewritten |
| 17 | blind, intent | Doc hex values and aliases not checked against app.css; comment names DESIGN.md | low | reject | Spec forbids reading DESIGN.md; design.md's header already makes the CSS win |
| 18 | blind | "Slightly tighter radius" never specified | low | reject | Radius lives in untouched Shapes/app.css; cosmetic |
| 19 | blind | Type table omits line heights and tracking | low | reject | app.css is the implementation; the table is a use guide |
| 20 | edge | Rule 1 AA-failure test asserts nothing in light | false | reject | Light page, card and secondary are all lighter than gold, so the branch runs; dark is vacuous by design (commented) |
| 21 | edge | Rule 1 only rejects exact gold matches | false | reject | A near-gold text token fails the AA text-pair table (4.5:1 on card) or rule 5 first |
| 22 | edge | `block()` misses a second `:root {` or nested braces; `over()` with a translucent under | false | reject | No such block or caller exists; guards for undemonstrated state |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green.
- `pnpm build` -- expected: success. The CSS is in the entry chunk, so quote the precache line (ceiling 1,000 KiB).

**Manual checks:**
- Break one token for each rule (a scratch edit, reverted) and confirm the matching test fails.
- In `pnpm dev`, the existing screens look unchanged, except light warn text, a little more orange.
