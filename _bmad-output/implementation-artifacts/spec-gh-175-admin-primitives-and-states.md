---
title: 'Admin screen primitives and shared states (GH #175)'
type: 'refactor'
created: '2026-09-27'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment', 'duplication-map']
review_loop_iteration: 0
baseline_commit: 'f7e6144f6fabb59f1867bb05e3e4f5c3029ab838'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-174-context.md'
  - '{project-root}/_bmad-output/initiative-dashboard-redesign/epic-admin-screens/epic-admin-screens.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The six admin screens each hand-spell their own page heading and their own panel chrome, and each invents its own loading and load-failure treatment. EXPERIENCE.md requires one Loading, one Load-failed and one action-toast treatment across every admin screen, and the six screen rebuilds that follow in this epic have nothing shared to compose from. Separately, `cn()` is plain `twMerge`, which reads this project's eight `--text-*` tokens as colour utilities and silently drops a colour passed beside one (GH #136); `KpiCard` already carries a comment working around it.

**Approach:** Teach `cn()` the project's font-size tokens, then add the three admin-side primitives the later stories compose from — a page header, a panel surface, and one loading-and-failure convention that keeps data under an inline retry Alert the way the dashboard already does. Adopt the header across the six screens because it is a one-line, durable swap.

**Decisions taken at the scope gate (2026-09-27):** Only the header is adopted now. `Surface` and `ScreenState` ship with tests and their first consumer is #178 (Visites); panel-chrome and load-state adoption move into each screen's own rebuild, recorded in `deferred-work.md`, because #178-#184 restructure all six files anyway. GH #92 and #147 were split out of this ticket the same day.

## Boundaries & Constraints

**Always:** Primitives live under `src/client/admin/`, never `src/client/ui/`, which reaches the field entry chunk (ADR-0019). French from `copy.ts`; per-screen `loadFailed` prose reused, not replaced. Tokens only.

**Never:** Do not touch field headings or panel chrome — field uses `rounded-xl`/`lg` and epic-field-screens may be rebuilding those files concurrently. Do not fix #92 or #147. Do not restructure any screen beyond the heading swap. No new dependency: `tailwind-merge@^3.7.0` exports `extendTailwindMerge`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Size token beside a colour | `cn("text-success","text-meta")` | Both survive, in either order | No error expected |
| Two of a kind | two colours, or two size tokens | Last wins — size tokens are one group | No error expected |
| Tailwind's own scale | `cn("text-xs","text-success")` | Both survive, as today | No error expected |
| Pending, no data | `isPending`, no data | Skeleton in the content's shape, `aria-busy` | No error expected |
| Failed, no data | `isError`, no data | Inline destructive Alert with the screen's own `loadFailed` and a retry | Retry refetches; disabled while fetching |
| Failed, data kept | `isError`, data present | Alert above the still-rendered data, never replacing it | Same retry |

</frozen-after-approval>

## Code Map

- `src/client/lib/utils.ts` -- all of `cn()`: `twMerge(clsx(inputs))`, 9 lines.
- `src/client/styles/app.css:158-197` -- the `@theme` font-size tokens. **Eight:** `display`, `title`, `heading`, `body-field`, `body`, `label`, `meta`, `overline`. Tailwind's own `xs…9xl` scale stays and must keep working.
- `admin/dashboard/KpiCard.tsx:91-94` -- the #136 workaround comment; the Badge at `:94` takes its size token back.
- Headings to swap, all `text-xl font-semibold tracking-[-0.005em]` = exactly `--text-title`: `ProspectsScreen.tsx:175`, `DuplicatesScreen.tsx:46`, `OrphansScreen.tsx:52`, `VisitsScreen.tsx:28`, `import/ImportScreen.tsx:105` (adds `mb-4`), `scripts/ScriptsScreen.tsx:204`.
- `admin/dashboard/DashboardScreen.tsx` -- `:76` already uses the token and pairs it with a subtitle plus a right-aligned `ToggleGroup`, so the header needs `subtitle` and `actions`. `:69-70,104-123` is the state convention to generalise: a gate on data-or-not-errored, `{busy, dimmed}` row props, an sr-only live region, and a destructive Alert with a disabled-while-fetching retry sitting **above kept data**.
- `ui/skeleton.tsx`, `ui/alert.tsx` -- vendored, unchanged. `Skeleton` has no variants; `Alert` has `default | destructive` plus Title/Description.
- `copy.ts:749-754` -- `copy.errors`, home for a shared `retry`. Per-screen `loading`/`loadFailed` exist at `:218,447,463,499,524`; `retry` only at `:208`.
- `styles/scan-files.ts:12` with `palette.test.ts:457` -- any new `.tsx` under `src/client` is scanned automatically and held to palette rule 4 (a bare `bg-primary` needs a `primary-edge`) and the safe-area rule.
- `field/DailyProgress.test.tsx` -- house style for an isolated component test: no provider, assertions through `copy.*`.
- **Do not change:** the eleven hand-spelled panel sites, `ProspectsScreen.tsx:188,291` (a split panel no single-element Surface expresses — #179 owns it), every field file.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/lib/utils.ts` -- rebuild `cn()` on `extendTailwindMerge`, registering the eight `--text-*` tokens as one `font-size` class group -- so a size token and a colour can coexist (#136)
- [ ] `src/client/lib/utils.test.ts` -- new: cover the matrix's four `cn()` rows -- the bug was invisible for a reason; pin it
- [ ] `src/client/admin/dashboard/KpiCard.tsx` -- give the Badge back its size token, delete the workaround comment -- first proof the fix works
- [ ] `src/client/admin/ScreenHeader.tsx` -- new: `title`, optional `subtitle`, optional right-aligned `actions`
- [ ] `src/client/admin/Surface.tsx` -- new: the panel chrome as one component -- named `Surface`, not `Panel`, because `PipelinePanel`/`TodoPanel` are content panels and would confuse
- [ ] `src/client/admin/ScreenState.tsx` -- new: the shared skeleton shape and the retry Alert, taking the screen's own `loadFailed` string
- [ ] `src/client/copy.ts` -- add `copy.errors.retry` -- the one string the shared Alert needs that is not screen-specific
- [ ] the six screens above -- swap each hand-spelled heading for `ScreenHeader`, keeping `ImportScreen`'s `mb-4` through the wrapper
- [ ] `ScreenHeader.test.tsx`, `Surface.test.tsx`, `ScreenState.test.tsx` -- new: title/subtitle/actions; chrome; skeleton vs Alert vs Alert-above-kept-data with retry disabled while fetching

**Acceptance Criteria:**
- Given a class string pairing a `--text-*` token with a text colour in either order, when it passes through `cn()`, then both survive.
- Given any of the six admin screens, when it renders, then its heading comes from `ScreenHeader` and no file under `src/client/admin` still spells `text-xl font-semibold tracking-[-0.005em]`.
- Given the full suite, when it runs, then the existing admin and field tests pass unchanged in what they assert.

## Implementation Notes

**The precache total moved, and the Verification line above was wrong to predict otherwise.** Baseline `f7e6144` builds to 899.71 KiB; this branch builds to 900.81 KiB, `+1.10 KiB`, against the 1,000 KiB ceiling. Traced per file rather than assumed:

| delta | precached file |
|---|---|
| **+1102 B** | `assets/constants.js` (66464 → 67566) |
| +21 B | `assets/index.css` |
| −220 B | `assets/AdminApp.js` |

The cause is the `cn()` fix, not the new components. `extendTailwindMerge` pulls in tailwind-merge's config-merging code that the prebuilt `twMerge` export does not need, and `lib/utils.ts` lands in the shared `constants.js` chunk because every vendored `ui/` component imports `cn`, so both sides pull it. `copy.errors.retry` accounts for only a few dozen of those bytes. The field entry chunk is unchanged at 389.20 kB (gzip 123.87 vs 123.88), and the three new admin components cost nothing in the precache — they live in `AdminApp-*.js`, which is not precached, which is why the admin chunk's own −220 B does not show up in the total.

Headroom after this story is ~99 KiB. Accepted rather than reverted: the alternative is keeping a class-merge helper that silently drops colours, and the epic has five more screen stories that would each trip over it.

Defects found while judging the diff, fixed before review: `Surface` was first built on `ui/card.tsx`, giving it `rounded-xl` and invented padding when the eleven real panel sites are `border-border bg-card rounded-md border` with none — and `card.tsx` is dashboard-only because `docs/design.md` rules cards out on the admin side; its test asserted the wrong shape too. `ScriptsScreen`'s lede lost `max-w-2xl text-sm` when routed through a string `subtitle`, so `subtitle` became a `ReactNode` and the screen passes its own `<p>`. `ScreenHeader` hardcoded `items-end`, changing the four count-bearing screens from their `items-baseline`; it now defaults to `items-baseline` and applies `items-end` only when a subtitle stacks under the title.

**Verification nuance.** The `rg -n 'text-xl font-semibold tracking-\[-0\.005em\]' src/client/admin` check returns one match rather than none: `ScreenHeader.tsx:8`, a doc comment naming the literal the component replaces. No live class string remains, so the acceptance criterion holds; the command itself wants narrowing to exclude comments if it is reused.

**Review pass 1 outcome.** Five lenses, 25 findings, no `high` and no loopback. Seven patches applied and re-verified; eight items deferred to `deferred-work.md`; six rejected on their refutation. Final: typecheck clean, 1683 tests green across 71 files, lint clean, precache 900.81 KiB of 1,000.

## Spec Change Log

## Review Triage Log

### Pass 1 (2026-09-27) — thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment, duplication-map

Verdicts: high 0 · medium 4 · low 12 · false 3 · maybe-false 0. Routed: patch 7, defer 8, rejected 6.

| Verdict | Finding | Evidence | Route |
|---|---|---|---|
| medium | `cn()`'s font-size group is pinned for only 2 of its 8 tokens | Pre-verified by the gap lens. `label` and `overline` have real `cn()` consumers at `ui/sidebar.tsx:236,272-274` and `field/FieldTabs.tsx:119-126`. Drop one token and #136 silently returns there with a green suite. | patch |
| medium | Nothing guards the token list against `app.css` drift | Same root cause. The eight names are hand-copied; a ninth `--text-*` token in `@theme` regresses silently. | patch |
| medium | The one production adoption of the #136 fix is observed only via `data-variant` | Pre-verified. `DashboardScreen.test.tsx:463-485` reads `chip().dataset.variant`, set straight from the prop at `badge.tsx:52`, never the merged class. Revert `utils.ts` and every assertion still passes while the chips lose their tone. | patch |
| medium | `ScreenState` drops the sr-only live region the spec's Code Map named | Verified: `DashboardScreen.tsx:104-107` puts the announcement *outside* `aria-busy` with the comment "so it is announced rather than hidden"; `ScreenState` wraps the skeleton *inside* `role="status" aria-busy`, so a screen reader is told nothing. The spec's Code Map lists "an sr-only live region" as part of the convention to generalise. Six screens will adopt this. | patch |
| low | Registering the tokens under `font-size` makes a token drop a preceding `leading-*` | Verified directly against tailwind-merge 3.7.0: `cn("leading-none","text-title")` → `"text-title"`. Order-sensitive — `"text-title leading-none"` keeps both. Checked every `leading-*` site: `ui/card.tsx:34`, `ui/dialog.tsx:113`, `ui/alert-dialog.tsx:88` take no `--text-*` from any caller, and `AgentActivityTable.tsx:12` is in the safe order. Latent trap, no live defect. | patch |
| low | `ScreenState` gates on `data !== undefined`, so a query resolving to `null` calls `children(null)` | Verified reachable in principle; no admin query returns `null` today. Fix is a one-token correction. | patch |
| low | `onRetry` is never exercised | Verified: `ScreenState.test.tsx` builds a `vi.fn()` and asserts only the `disabled` flag. The matrix row says "Retry refetches". | patch |
| low | Five `<div className="mb-1\|mb-4">` wrappers exist only because `ScreenHeader` takes no `className` | Verified, all five created by this change: `DuplicatesScreen.tsx:46`, `OrphansScreen.tsx:52`, `ProspectsScreen.tsx:175`, `VisitsScreen.tsx:28`, `import/ImportScreen.tsx:106`. `Surface` in this same diff already has the passthrough. | patch |
| low | `Surface`'s comment says "eleven" panel sites; there are twelve, and its `deferred-work.md` path does not resolve | Verified: 12 sites (ProspectsScreen has two halves). The file is under `_bmad-output/implementation-artifacts/`, not `docs/`. | patch |
| low | The six heading swaps are guarded by typecheck and an `rg` check, not by any rendering assertion | Verified: no admin screen test asserts a level-2 heading; the only such assertion, `AdminApp.test.tsx:89`, covers the dashboard, which was not swapped. | patch |
| medium→defer | The spec's by-eye list of `cn()` sites is incomplete | Verified: `field/FieldTabs.tsx:119-126` and `dashboard/RecentVisits.tsx:117,123` also pair a token with a colour through `cn()` and are absent from the six the spec names. Fix is to the manual-check list, not the code — folded into Implementation Notes rather than patched. | defer |
| low | `ScreenState` omits the `isPlaceholderData` dimming the dashboard uses | Verified at `DashboardScreen.tsx:70`. A capability gap for #178, not a defect in an unused component. | defer |
| low | `"Réessayer"` now has five keys | Verified: `copy.ts:208,349,404,631` plus the new `:758`. Consolidating `dashboard.retry` is only possible once the dashboard adopts `ScreenState`. | defer |
| low | `copy.errors` now mixes error messages with a button label | Verified: every other member is a message; `retry` is an affordance. Renaming churns a shared key for no user-visible gain. | defer |
| low | The count `<span>` is spelled three times inside `actions` props | Verified at `DuplicatesScreen.tsx:49-54`, `OrphansScreen.tsx:55-60`, `VisitsScreen.tsx:31-34`, all created here. Folding it into a `count?` prop is a design decision for the screens' own rebuilds. | defer |
| low | `Surface` and `ScreenState` ship with zero consumers, and `DashboardScreen` still hand-rolls the header | Verified. The first two are excluded by the intent's own scope gate and already recorded; the dashboard header is not recorded anywhere. | defer |
| low | `KpiCard`'s Badge gains `--text-meta`'s tracking that no other badge has | Verified: `badge.tsx:6` hardcodes `text-xs`, which now merges away at this one site. Moving it into the variant touches vendored `ui/` shared with the field route. | defer |
| low | `field/NumberStepper.tsx:53-55` carries a now-stale comment about tailwind-merge not knowing `text-display` | Verified. Boundaries forbid touching field files in this story. | defer |
| false | `ScreenState` renders a blank fragment when not pending, not error and data undefined | A disabled or idle TanStack v5 query reports `isPending: true`, so the skeleton branch takes it. The cited state is not reachable for any query in this repo, and the proposed fix adds a branch. | rejected |
| false | A disabled query leaves a permanent skeleton with no retry | That is the correct rendering for a query that was never allowed to run; there is no failure to retry. | rejected |
| false | A falsy `subtitle` (`0` or `""`) renders under the title while alignment stays baseline | `subtitle` is `ReactNode` supplied by this repo's own call sites, which pass either a `<p>` or nothing. No caller passes `0`. | rejected |
| low | The new tests assert Tailwind class strings rather than behaviour | For a chrome component the class string *is* the behaviour, and there is no computed-style alternative under happy-dom. Rejecting per the low-finding rule: the fix is not a direct correction. | rejected |
| low | `docs/design.md` was not updated | CAP-11 puts each screen's `docs/design.md` section in that screen's own rebuild, and this story changes no user-visible screen behaviour. The precache figure the PR owes is recorded in Implementation Notes. | rejected |
| low | The action-toast clause of the intent is neither implemented nor deferred | Verified already satisfied outside this diff: Sonner is wired in `AdminApp.tsx` and used by Doublons, Visites, À rattacher and Scripts. Nothing to build. | rejected |

## Design Notes

`extendTailwindMerge` needs the tokens as one `font-size` class group, so `text-meta` and `text-title` still collapse against each other while a colour passes through untouched:

```ts
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "title", "heading", "body-field", "body", "label", "meta", "overline"] },
      ],
    },
  },
});
```

`extend` adds to Tailwind's `font-size` group rather than replacing it, so `text-xs` behaves as today.

One caution: about nineteen sites pair a size token with a colour, but most are plain `className=` strings that never reach `twMerge`. Only these six go through `cn()` and can change how they render — `field/TodayScreen.tsx:30`, `field/OutcomeCard.tsx:46`, `field/StopRow.tsx:150`, `field/CarteSheet.tsx:28`, `ui/field-controls.tsx:152`, `admin/scripts/QuestionRow.tsx:92`. Each loses one of the pair today; afterwards both apply, which is what each author wrote. Check those six by eye — happy-dom asserts no computed colour.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: clean
- `pnpm test` -- expected: all green, with the four new test files passing
- `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: under the 1,000 KiB ceiling, precache total unchanged from baseline since every new file is admin-only
- `rg -n 'text-xl font-semibold tracking-\[-0\.005em\]' src/client/admin` -- expected: no matches

**Manual checks (if no CLI):**
- The six `cn()` sites named in Design Notes render with both their size and their colour, in light and dark.
