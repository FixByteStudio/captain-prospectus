---
title: 'Refactor sweep (GH #67)'
type: 'refactor'
created: '2026-09-25'
status: 'done'
baseline_commit: '6bcc5a0843fccbee4215d26c8fcbc78c0b8503a6' # re-stamped 2026-09-25, epic #59 retro F2: stamped at draft time as fc2d4cda39ae…, one merge behind the branch (PR #84's harness) that `8c2a1cd` was cut from
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Six defects the epic's own stories left behind, each already filed: two vendored shadcn variants break the palette rules `palette.test.ts` proves only at the token level (#69, #70), `.safe-bottom` is dead wherever a `py-*` sits with it (#80), `BackLink`'s comment argues from a budget ADR-0026 replaced (#81), the field loading state has no band while its neighbouring error state does, and ADR-0026's 1,000 KiB precache ceiling is still a number a human reads off a build line.

**Approach:** Close all six in one sweep, and close each one's *class* where the repo can: extend `palette.test.ts` from tokens to the component class strings that use them, and turn the precache ceiling into a CI step that fails. No new behaviour, no new screen, no new runtime dependency.

## Boundaries & Constraints

**Always:** Tokens only — every colour comes from `app.css`'s `@theme`, per CLAUDE.md. French strings live in `copy.ts`. The vendored-shadcn edits stay inside `src/client/ui/` variant strings; no component's API or markup changes. The admin chunk keeps shadcn Sidebar/Sheet/Tooltip/Command (ADR-0019), and the precache total stays at or under 1,000 KiB (ADR-0026). The PR quotes the precache total and the entry chunk.

**Never:** No behavioural change to the field forms, the leave guard, the sync strip or identity — #74's remaining exits and #75's 401 recovery are split out to `deferred-work.md` and wait on the #83 DOM harness. Not #72 (admin screens epic), not the admin-offline Tableau de bord tab (dashboard epic), not the `/admin` index or `*` not-found route (dashboard epic), not the admin `Input` `md:text-sm` step-down (admin screens epic), not the outcome-chart contrast decision (needs a design call before epic-dashboard). No DOM test harness here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Gold fill scan | A `src/client/ui/` variant string sets `bg-primary` (any state prefix) | `palette.test.ts` requires a `primary-edge` boundary on the same fill — `border-`, `ring-` or an inset `shadow-` | Test fails naming the file and the class |
| Destructive fill | `Button`/`Badge` `variant="destructive"`, dark theme | Text is `destructive-foreground` (ink) on the full `destructive` fill — the pair `palette.test.ts` already asserts at 4.5:1 | Test fails if `text-white` or a `dark:bg-destructive/*` opacity returns |
| Notched phone, admin frame | `<main>` on `/admin/*`, `AdminFrameFallback`, the identity-error screen | Bottom padding is the page's own 6 *plus* `env(safe-area-inset-bottom)` | No error expected |
| Field loading | `/api/me` in flight, `me === null` | The band renders above the busy `<main>`, as the error state already does | No error expected |
| Precache over ceiling | A build whose precached entries total > 1,000 KiB | `pnpm check:precache` exits non-zero and prints the total and the entries | Exits non-zero; CI fails the build job |
| Precache absent | `dist/client/sw.js` missing | The check exits non-zero saying to build first — never silently passes | Exits non-zero |

</frozen-after-approval>

## Code Map

- Work only in the checkout `/home/m0/PROJECTs/captain-prospectus-67` (branch `refactor/67-shell-sweep`, at the baseline commit, **`pnpm install` not yet run**). Never touch `/home/m0/PROJECTs/captain-prospectus` or `captain-prospectus-harness` — concurrent story sessions own them (#83 is live). Paths below are relative to that checkout; this spec and its `context:` file live under `/home/m0/PROJECTs/captain-prospectus/_bmad-output/` and are read-only.
- `src/client/ui/checkbox.tsx:11` — `data-[state=checked]:border-primary` is the boundary to change to `-primary-edge`. `src/client/ui/field-controls.tsx:70` is the precedent (`checked:border-primary-edge`) and must not change.
- `src/client/ui/badge.tsx:11` — `default: "bg-primary …"`, no edge; `:14` — `destructive` carries `text-white` and `dark:bg-destructive/60`.
- `src/client/ui/button-variants.ts:21` — the `default` variant already carries `border-primary-edge` with the comment that states the 2.2:1/3.4:1 reason; reuse that reason, do not restate it. `:23` — `destructive` carries the same `text-white` and `dark:bg-destructive/60`.
- `src/client/ui/progress.tsx:18` — `bg-primary` indicator on a `bg-primary/20` track, the third bare gold fill. Used by `admin/import/PreviewStep.tsx:122` and `admin/import/MapStep.tsx:299` only.
- `src/client/styles/app.css:347` — the single `@layer base` block holds the base resets *and* the custom classes `.safe-top` (:358), `.safe-bottom` (:362), `.above-tab-bar`, `.pb-action-bar`, `.pb-tab-bar` (:411, the `height + env()` idiom to copy), `.tnum`. Tailwind v4 orders `utilities` after `base`, which is #80.
- `src/client/App.tsx:203` and `:297` — `<main className="safe-bottom px-4 py-6">` (`AdminFrameFallback`, identity error). `:303` — `if (!me) return <main className="safe-top px-4 py-6" aria-busy="true" />`, the bandless loading state; `:292-299` is the band + `<main>` shape to mirror, and `BandBrand` comes from `./Band`. `src/client/admin/AdminLayout.tsx:58` — the third `safe-bottom … py-6`.
- `src/client/field/BackLink.tsx:4-7` — the comment citing lucide's 2.4 kB in the field entry chunk; false since `App.tsx:12` and `field/SyncIndicator.tsx:14` import six lucide icons into it.
- `src/client/styles/palette.test.ts:349` — `describe("rule 4: every gold fill carries primary-edge")` checks only the *tokens*. Its `block()`/`solid()`/`contrast()` helpers and the `THEMES` triple are what the new AA row reuses; the file reads `app.css` by `import.meta.url` and deliberately never reads `docs/design.md`.
- `config.test.ts:87` — `precaches the field app only`, the pattern for a config guard, and the file's own framing: "A comment in a config file is not a control; these are." `.github/workflows/ci.yml` ends with `- run: pnpm run build`.
- `dist/client/sw.js` — Workbox writes `precacheAndRoute([{url:"…",revision:…},…])`; URLs are relative to `dist/client/`. Summing `statSync` over them reproduces the build's own precache line. `scripts/seed.mjs` is the repo's only script and is `.mjs`; `tsconfig.node.json` includes `scripts`.
- `docs/design.md:125` — "Every gold fill carries `primary-edge`", unconditional, which is what makes `progress.tsx` in scope. `:56` — `primary-edge` is "The border of every gold fill". `docs/adr/0026-…md:88` — names the CI check as follow-up work; this change does it.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/ui/checkbox.tsx`, `src/client/ui/badge.tsx`, `src/client/ui/progress.tsx` — give each gold fill a `primary-edge` boundary (#69). Rationale: the fill is 2.2:1 against the page, so without its own edge the control has no discernible boundary (WCAG 1.4.11); `button-variants.ts:21` already carries the reason.
- [ ] `src/client/ui/button-variants.ts`, `src/client/ui/badge.tsx` — `text-white` → `text-destructive-foreground`, and drop the `dark:bg-destructive/60` fill override (#70). Rationale: `palette.test.ts` asserts ink-on-`destructive` at AA in all three themes; at 60 % opacity the rendered pair is not the asserted one, so the override made the proof vacuous.
- [ ] `src/client/styles/palette.test.ts` — add a `rule 4, in the components` block scanning every `src/client/ui/*.tsx|ts` for a `bg-primary` fill without a `primary-edge` boundary, and a `rule 2` component row rejecting `text-white` on a destructive fill. Rationale: the existing rules prove the tokens and would have passed all three bugs above; this is the control.
- [ ] `src/client/styles/app.css` — move `.safe-top` and `.safe-bottom` into a new `@layer utilities` block, and add a `.pb-page` utility (`calc(var(--spacing) * 6 + env(safe-area-inset-bottom, 0px))`) in the `.pb-tab-bar` idiom (#80). Rationale: in `base` they lose to any `py-*`; `.pb-page` is what lets the three call sites keep their 6 *and* the inset.
- [ ] `src/client/App.tsx`, `src/client/admin/AdminLayout.tsx` — replace `safe-bottom px-4 py-6` with `px-4 pt-6 pb-page` at the three sites, and give the `!me` loading state the same band-plus-`<main>` shape as the error state above it (#80 + the loading-band deferral). Rationale: one element must not own `padding-bottom` twice, and a bandless loading frame flashes an unbranded screen before every field session.
- [ ] `src/client/field/BackLink.tsx` — replace the hand-rolled `<svg>` with lucide's `ArrowLeft` and rewrite the comment against ADR-0026's precache budget (#81). Rationale: lucide is already in the field entry chunk, so the comment's saving does not exist and the file argues from a retired rule.
- [ ] `scripts/check-precache.mjs` (new), `package.json`, `.github/workflows/ci.yml` — sum `dist/client/sw.js`'s precached entries and exit non-zero above 1,000 KiB, wired as `check:precache` and run after `pnpm run build`. Rationale: ADR-0026:88 left the ceiling as a line a human reads; this makes passing it fail CI.
- [ ] `config.test.ts` — assert `ci.yml` runs `check:precache` after the build and that the script names the 1,000 KiB ceiling. Rationale: without it the step can be dropped and nothing notices — the same reason every other guard in that file exists.
- [ ] `docs/design.md`, `docs/adr/0026-…md` — record that the ceiling is now enforced in CI, and that `progress.tsx`'s bar carries the edge. Rationale: CLAUDE.md's definition of done; ADR-0026's "harder: read by hand" consequence is no longer true.

**Acceptance Criteria:**
- Given a `src/client/ui/` variant that sets a gold fill with no `primary-edge` boundary, when `pnpm test` runs, then `palette.test.ts` fails naming that file — verified by reverting one of the three fixes.
- Given the three destructive call sites in dark mode, when inspected, then no `text-white` and no `dark:bg-destructive/*` opacity remains anywhere in `src/client`.
- Given a built `dist`, when `pnpm check:precache` runs, then it prints a total matching the build's own Workbox precache line and exits 0; given the ceiling lowered below that total, it exits non-zero.
- Given `ci.yml` with the `check:precache` step deleted, when `pnpm test` runs, then `config.test.ts` fails.
- Given `/tournee` on a 390 px notched viewport, when `/api/me` is still in flight, then the band is already visible above the busy `<main>`.
- Given `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, when all four run, then all pass and the epic's "Done when" checks still hold.

## Implementation Notes

**Matrix-audit follow-up (post-handback, same worktree, same branch).** Three I/O matrix rows had no automated test:

1. **"Precache over ceiling" / "Precache absent".** Added `scripts/check-precache.test.mjs`, wired into the `unit` vitest project (`vitest.config.ts` now includes `"scripts/**/*.test.mjs"`). It runs `scripts/check-precache.mjs` as a real subprocess (`node:child_process.spawnSync`) against throwaway `dist/client/sw.js` + `vite.config.ts` fixtures in a temp dir, and asserts: exit 0 and the total printed when under the ceiling; exit non-zero and the total still printed when over it; exit non-zero with `Run "pnpm build" first` when `sw.js` is absent; exit non-zero when the manifest has no entries.
   - **Seam added, CLI unchanged:** `CHECK_PRECACHE_ROOT` and `CHECK_PRECACHE_CEILING_KIB` env vars override the script's root and ceiling; unset (the real `package.json`/`ci.yml` invocation), behaviour and output are byte-identical to before.
   - **Real bug found and fixed while writing the "empty manifest" case:** the original `if (!call?.[1])` treated a genuinely-empty `precacheAndRoute([], …)` capture (`""`, falsy) the same as "no call found at all", printing the wrong message. Changed to `if (call === null)`, with the empty-array case falling through to the existing (now reachable) `urls.length === 0` check. Proved by reverting the fix and re-running: the test failed, naming the wrong message.
   - Proved the other three rows by breaking, in turn: the ceiling comparison (`> CEILING_KIB * 1000`), the absent-`sw.js` message, and the `countsTowardTotal` filter — each broke exactly the test written for it, no others.

2. **"Notched phone, admin frame" (#80's bug class).** Added `src/client/styles/safe-area.test.ts`: (a) asserts `.safe-top`/`.safe-bottom`/`.pb-page` are declared inside `app.css`'s `@layer utilities` block and that `.safe-top`/`.safe-bottom` are absent from `@layer base` (brace-balanced block extraction, no CSS parser); (b) scans every `.ts`/`.tsx` file under `src/client` (excluding tests) for a class string that pairs `safe-top` with a `p-*`/`pt-*`/`py-*` token, or `safe-bottom` with a `p-*`/`pb-*`/`py-*` token (`pb-page`/`pb-tab-bar` count, on purpose: stacking `.safe-bottom` on either would double the inset the same way a plain `pb-6` used to).
   - **Real bug found and fixed in the test itself, not the app:** the first version's string-literal scanner used the same naive `/(["'\`])(...)*\1/` approach as `palette.test.ts`'s existing rule-4 component scan, either un-stripped or with a naive comment-stripper. Both break on real code — `useMatch("/tournee/*")` contains a `/*` *inside a string*, which a comment-stripper reads as a comment start, and reads until the next `*/` found anywhere later in the file, silently merging dozens of real string literals (including the exact `className="safe-bottom px-4 py-6"` under test) into one bogus blob. Proof: reintroduced the #80 regression in `App.tsx` and re-ran — the buggy scanner's 87 tests all still passed (a false negative on the thing it exists to catch).
   - **Fix, and a scope note:** wrote a proper one-pass tokenizer (`src/client/styles/class-literals.ts`, `classLiterals()`) that tracks "inside a `//`/`/* */` comment" vs "inside a quoted string" character-by-character, so a `/*`-shaped substring inside a real string (or an apostrophe inside a real comment) can no longer be misread as a boundary. Diffed its output against the old regex across every `src/client/ui/*.tsx|ts` file: 10 of 23 files disagreed (`command.tsx` 14 literals → 29; `form.tsx` 33 → 24; others off by one or two), confirming the old approach was silently unreliable well beyond the one file this audit happened to catch it in. **`palette.test.ts`'s existing rule-4/rule-2 component tier (from the original handback) was switched to the same shared `classLiterals()`, replacing its private, buggy copy** — this was already-delivered work with a latent correctness bug, not something the two new matrix rows asked for directly, but "the control needs its own control" applied to it exactly as much. Re-ran all five original revert-tests (three gold-fill, two destructive) against the fixed extractor: all still fail exactly as before, and the fix surfaced no previously-hidden violation in any of the 23 files (all 151 `palette.test.ts` cases pass clean).
   - Proved the new test's three assertions by breaking, in turn: moved `.safe-bottom` into `@layer base` (both the "declared in utilities" and "not in base" checks failed); reintroduced `safe-bottom px-4 py-6` in `App.tsx` (the pairing check failed, naming the file and the clashing token).

**Verification re-run after all of the above:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 files, 819 passed), `pnpm build && pnpm check:precache` (14 entries, 677.36 KiB — unchanged versus the original handback's 677.31 KiB to within Tailwind's own content-scan noise from the two new test files' literal strings, both well under the 1,000 KiB ceiling).

**Left deliberately alone:** the "Field loading" row stays hand-checked, per instruction — no DOM harness added, #83's to pin. `command.tsx`'s and the other nine files' now-differently-segmented literals did not reveal any new palette violation, so no further `src/client/ui/` changes were needed.

## Spec Change Log

## Review Triage Log

**Pass 1 (2026-09-25) — PARTIAL.** Lenses launched: `blind-hunter` (returned 12 findings).
`edge-case-hunter` was cut off by an API session limit; `verification-gap` and `intent-alignment`
never launched. Verdict counts over what was reviewed: medium 7, low 2, false 1, split 1, rejected 1.
The three unrun lenses are an open verification gap on this change, not a clean pass.

| Verdict | Finding | Route | Evidence |
|---|---|---|---|
| medium | `.above-tab-bar`, `.pb-action-bar`, `.pb-tab-bar` stayed in `@layer base` | patch | Confirmed in `app.css`: the #80 fix moved only 3 of 6 custom classes, leaving the identical trap for the three the field route actually uses, and `safe-area.test.ts` did not guard them. No live bug (no element pairs them with a conflicting `py-*`), but the fix's own rationale applies verbatim. Fixed: every custom class moved to `@layer utilities`, and the test now asserts `@layer base` declares *no* custom class, driven off `app.css` instead of a hand list. |
| medium | `statSync` unguarded; a non-numeric ceiling passes silently | patch | Confirmed by reading the script: `Number("abc")` → NaN, and `total > NaN` is false, so the guard reported success. Fixed with a `Number.isFinite` gate and a per-entry "lists X, not a file" message. Writing the test for this also exposed an unguarded `vite.config.ts` read throwing a raw ENOENT stack — fixed the same way. |
| medium | A partial manifest match yields a plausible subtotal instead of failing | patch | Real fail-open: `/\{url:"…"/g` assumes minified double quotes. Fixed by counting `url:` occurrences and erroring when the parsed count differs; pinned by a single-quoted-entry fixture. |
| medium | The enforced total omits ~66 KiB of genuinely precached icons | defer | Confirmed and already filed as issue #88. Workbox's printed line omits `additionalManifestEntries`, so the ceiling under-measures what a phone downloads — which `vision.md` gives as the ceiling's whole rationale. Deciding the basis is an ADR question, not a sweep fix; recorded in ADR-0026 and `vision.md` so the gap is documented outside a script comment. |
| low | ADR-0026's Decision and `vision.md` still described the ceiling as read off `pnpm build` | patch | Confirmed at `0026-…md:56` and `vision.md:39`; the diff had updated only the Consequences bullet. Both now name `pnpm check:precache`. |
| medium | The change touches the field bundle but quoted no measurement in the docs | patch | Confirmed: ADR-0026 requires every field-route PR to quote both figures and `vision.md`'s log to record them; the log still ended at 2026-09-24. Extended with entry chunk 163.91 kB and precache 677.36 KiB, against 163.93 / 676.52 at baseline. |
| false | `docs/design.md:242` is stale on safe areas | — | Checked the cited line: it describes the top bar's avatar and `DropdownMenu`, not safe-area insets, and the Layout section does not enumerate which classes carry the inset. The claim does not hold at the cited location. |
| medium | The two `config.test.ts` assertions were weaker than they read | patch | Confirmed: `indexOf` ordering would pass for commands in different jobs, and `/1000/` also matches `10000` or a comment. Fixed to parse the `check` job's own `- run:` steps in order and to assert the literal default `return 1000`. |
| low | `layerBlock()`'s brace walk was unbounded | patch | Confirmed: `while (depth > 0)` with no length check spins on `undefined`, hanging CI instead of failing it, on a truncated `app.css`. Bounded with an explicit throw. |
| medium | `class-literals.ts` still swallows on a quote outside a string, and had no test | patch | Half real. The load-bearing new logic genuinely had no test — fixed, with cases for `/*` inside a string, an apostrophe in a comment, all three quote styles and escaped quotes. The residual claim (a regex literal containing a quote would mis-segment) is a real limit but unreachable today: no non-test file under `src/client` contains one. Recorded rather than guarded, since handling it properly means a parser. |
| split | Both component tiers scan `src/client/ui/` only; the rule-2 test's title overstates it | patch + reject | The title was wrong and is fixed: `--on-destructive` *is* `#ffffff` in light mode, so what the test forbids is the hardcoded `text-white` utility, not white text. Widening the scan to all of `src/client` is rejected as scope the intent does not cover — and verified moot: every gold fill outside `ui/` (`App.tsx:137`, `AccountMenu.tsx:32`, `FieldTabs.tsx:97,108`) already carries an edge. |
| medium | Untested script branches, and a stale "no DOM harness here" claim | patch | Both confirmed. Added tests for the no-`precacheAndRoute` and missing-`vite.config.ts` exits. The harness claim became false when #83 merged as PR #84 mid-review; the comment now states the real reason a render test cannot cover this (happy-dom resolves `env()` to 0 and never evaluates the cascade). |
| rejected | "One concern per change" — the diff bundles five concerns | — | Rejected on the intent: #67 exists precisely to close the epic's six filed issues as one reviewable sweep, and that cut was presented and approved before implementation. Rejecting a finding whose fix is to re-cut the approved scope. |

**Pass 2 (2026-09-25) — COMPLETE.** The three lenses the session limit cut short in pass 1 all ran:
`edge-case-hunter` (20 findings), `verification-gap` (4 gaps + 2 notes), `intent-alignment`
(descriptive). Verdict counts: high 0, medium 9, low 5, false 2, deferred 3, rejected 4. Four findings
were verified by reintroducing the exact defect and confirming the guard stayed green; all four are
fixed in `35affe1`. Three lenses converged independently on the same root cause — **both new scanners
matched tokens too loosely to catch the defect class they were added for** — which is the finding of
this review.

| Verdict | Finding | Route | Evidence |
|---|---|---|---|
| medium | The rule-4 scan is prefix-blind: an edge for one state satisfies a fill for another | patch | Verified by experiment: adding `hover:bg-primary` to `checkbox.tsx` — a full-opacity gold fill whose only boundary is `border-input` — passed, because `data-[state=checked]:border-primary-edge` sat in the same literal. The guard admitted #69's exact defect. Fixed: an edge now qualifies only when its prefix set applies to the fill's, so `dark:data-[state=checked]:bg-primary` still accepts the plain checked edge while `hover:bg-primary` fails by name. |
| medium | Rule 2 only fired on the bare `bg-destructive` token, and banned a dimmed fill only under `dark:` | patch | Confirmed by reading the scan: `hover:bg-destructive text-white`, or a bare `bg-destructive/60`, skipped the check entirely. Both now match under any prefix chain. `hover:bg-destructive/90` stays allowed, and the reason is now written at both call sites: a transient hover fill is not the resting fill the contrast pair asserts. |
| medium | The safe-area clash scan read one literal at a time | patch | Verified by experiment: adding `py-2` to the `"md:contents"` literal at `FieldTabs.tsx:70` — a sibling `cn()` argument to the `safe-bottom` literal — reintroduced #80's double padding with the guard green. Fixed by unioning a `className` expression's literals via a new `classLiteralGroups()`. |
| medium | Both component tiers scanned `src/client/ui/` only | patch | Confirmed, and the asymmetry was inside the same commit: `safe-area.test.ts` already walked all of `src/client` on the same helper. Dropping `ring-primary-edge` from `App.tsx:137` or `FieldTabs.tsx:108` left a 2.2:1 fill and a green suite. Nothing outside `ui/` was non-compliant, so widening changed no result — it closes the scope, not a defect. |
| medium | The 1,000 KiB default was pinned only by a regex over source text | patch | Confirmed: every case reaching the comparison injected its own ceiling, and the ones omitting it exited earlier on another guard. A refactor moving the default while leaving the asserted line would have enforced a different number. Two cases now exercise it as a threshold, at 999 and 1001 KiB with nothing set. |
| medium | The loading band was verified by nothing, although #84's `dom` project had landed | patch | Two lenses converged on this as the clearest gap against the intent. Note the sequencing: the human chose "hand-checked is enough" while no harness existed, and #84 merged during the review. Using the existing harness is not adding one, so it stays inside the frozen Boundaries. Verified: collapsing the branch back to a bare `<main aria-busy>` now fails on the missing band brand. |
| medium | Custom padding classes were not treated as padding owners after the move to `utilities` | patch | Real: `.pb-page`/`.pb-tab-bar`/`.above-tab-bar` own `padding-bottom` and now win, so pairing one with `py-*` silently discards the other. The owner list is now parsed out of `app.css`'s declarations rather than guessed from class names, which is what catches `.above-tab-bar`. |
| medium | Tailwind scanned the new tests' fixture strings and emitted them into the precached CSS | patch | Confirmed and self-inflicted: the tests written to guard the budget were inflating it. `@source not "**/*.test.ts(x)"` excludes them; `bg-primary-foreground` is gone from the built CSS and the figure drops 677.36 → 677.09 KiB. I separately disproved the related worry that docs prose leaks in — a probe utility added to `vision.md` did not reach the bundle and the CSS hash did not change. |
| low | `layerBlock` read only the first block of a layer, and matched only simple `.foo {` selectors | patch | Real: a second `@layer base` block, or `.foo:hover {`, escaped the guard that replaced the hand-written list. Now collects every block and matches any selector containing a class. |
| low | `decodeURIComponent` unguarded; glob extensions split without trimming | patch | Both real and cheap: a lone `%` threw a raw URIError, and `{js, css}` would have made matching entries uncounted, silently shrinking the total. Fixed. |
| low | The env-var seam could silently change the ceiling or the tree measured | patch | Real: a passing run said nothing about which ceiling applied. The success line now reads the applied ceiling and flags an overridden root. |
| low | The dark destructive fill is now full-opacity with no non-text contrast check | patch | Not a defect — I measured it at 5.66:1 against the dark page, so dropping the dimming improved the boundary. Added to the 3:1 `it.each` to pin what the change now relies on. |
| low | `.pb-page` documented only in an `app.css` comment | patch | Fair: it is new styling vocabulary and `docs/design.md`'s Layout section owns the safe-area rules. One line added. |
| false | `docs/design.md:242` is stale on safe areas (pass 1) | — | Re-checked: the cited line describes the top bar's avatar, not safe-area insets. |
| false | A manifest url containing `],{` truncates the capture so the mismatch guard never fires | — | The scenario is real in principle but not reachable: Workbox emits `{url,revision}` pairs only, and a url containing `],{` would have to survive `encodeURI`. Recorded rather than guarded; guarding it means a bracket walk for a case no build can produce. |
| defer | The rule-4 guard asserts string co-occurrence, not rendered state | defer | True and now narrowed rather than closed: prefix-aware matching removes the reachable false negative, but a fill and its edge composed across two `cn()` arguments still passes rule 4 (rule 2 and the safe-area scan do union them). Closing it properly needs computed-style assertions the repo has no way to make. |
| defer | The "comment cites a superseded ADR" class #81 belongs to has no guard | defer | Pre-existing and already tracked by #47, #58 and #48. Out of scope on the intent, which names #81's own comment. |
| defer | Workbox's total omits ~66 KiB of precached icons (pass 1, carried) | defer | carried — issue #88, and now recorded in ADR-0026 and `vision.md`. The intent-alignment lens independently reached the same reading: the CI step enforces the build-line surface while the ADR's sentence describes the download surface. An ADR decision, not a sweep fix. |
| rejected | Widen the component tier to rules 1, 3 and 5 | — | Out of scope on the intent, which names the two rules that escaped (#69, #70). `docs/design.md` already states rule 1 stays a review rule. |
| rejected | Move `:focus-visible` out of `@layer base` too | — | It is an element-level pseudo-class rule, which is what a base layer is for; the new test asserts no *custom class* remains in `base`, and `:focus-visible` is not one. No named harm. |
| rejected | `config.test.ts` should parse `run: |` block scalars and allow `pnpm build` | — | Speculative: no such step exists, and the assertion failing loudly on a format it does not understand is correct behaviour, not a defect. |
| rejected | "One concern per change" (pass 1, carried) | — | carried — rejected on the intent; the cut was approved before implementation. |

**Accuracy note on the frozen Intent.** It says all six defects were "already filed". Five were
(#69, #70, #80, #81, and the ceiling via ADR-0026:88); the field loading band never had an issue. The
intent-alignment lens caught this. Recorded rather than corrected, since the frozen block is
human-owned and the discrepancy changed no scope.

## Design Notes

`palette.test.ts` grows a second tier rather than a new file: rules 1–5 are one idea — "the palette as shipped" — and the token tier alone let three violations through. The component tier is a text scan of class strings, in the same spirit as `config.test.ts`, so it needs no DOM and no new dependency. Scan the fill and its boundary as one string per variant, not per file, so `badge.tsx`'s `default` and `destructive` are judged separately.

`.pb-page` exists because `.safe-bottom` cannot both be a pure inset (what `FieldTabs` needs) and carry a page's 6 of padding. `.pb-tab-bar` already established the idiom:

```css
@layer utilities {
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0); }
  /* A page's own bottom margin plus the inset, in one declaration: two
     utilities on one element cannot both own padding-bottom (GH #80). */
  .pb-page { padding-bottom: calc(var(--spacing) * 6 + env(safe-area-inset-bottom, 0px)); }
}
```

The `ArrowLeft` swap changes the glyph from a chevron to an arrow. Nothing in `docs/design.md` or the mockups pins a back glyph, and the tabs already set the precedent that field icons are Lucide.

## Verification

**Commands:**
- `pnpm install` — in `/home/m0/PROJECTs/captain-prospectus-67` first; the worktree has no `node_modules`.
- `pnpm build` — run once before any edit and record the baseline precache total and entry-chunk gzip size, so the PR can quote the delta.
- `pnpm typecheck` — expected: clean.
- `pnpm test` — expected: all pass, including the new `palette.test.ts` and `config.test.ts` assertions.
- `pnpm lint` — expected: clean.
- `pnpm build && pnpm check:precache` — expected: exits 0, and its total matches the build's Workbox precache line to the same KiB.
- Revert each of the three gold-fill fixes and the `text-white` fix in turn and re-run `pnpm test` — expected: a named failure each time. Restore them.

**Manual checks:**
- `pnpm dev` at 390 px, light and dark: a checked checkbox and a default badge have a visible gold edge; a destructive button and badge read in dark mode.
- The field route with `/api/me` throttled: the band is present in the loading state.
