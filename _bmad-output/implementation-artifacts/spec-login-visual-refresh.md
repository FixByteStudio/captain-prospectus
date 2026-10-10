---
title: 'Restyle /login to the locked 3o design'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: 'c08520cf1d6940e22c425f4b2c2351858ddafdcf'
context:
  - '{project-root}/_bmad-output/forge/login-page-visual-refresh/forged-idea.md'
  - '{project-root}/_bmad-output/forge/login-page-visual-refresh/mockups/3o-final.html'
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/login` is the first screen anyone sees, and it still wears the field band over a bare card. The owner locked design 3o in the forge (`forged-idea.md`): no band, the brand above the card, a centred header and a gold top edge.

**Approach:** Visual change only in `LoginScreen.tsx` — drop the `<Band>`, centre the content on `bg-background` (vertically from `md` up), put the navy-ink mark (48px phone, 56px desktop; `/mark.svg` in the dark theme) and `copy.appName` in a new `text-brand` token above a `max-w-sm` card with a soft shadow and a 4px `primary` top border, and centre "Connexion" (still the `h1`, `text-title`) and the lede. Add the navy-ink mark to `public/` from `docs/brand/logo.svg`, the `text-brand` token (1.375rem / 1.2 / 700 / -0.015em) to `@theme`, and rewrite `docs/design.md › The login page` for 3o plus the one-line gold exception in `› Colour`. Fields, the code/admin swap, alerts, lockout, offline, focus and landing stay as they are; no new copy; `App.test.tsx` keeps finding `/login` by `copy.login.title`.

</frozen-after-approval>

## Implementation Notes

Oneshot: one component restyled, one asset copied, one token, two doc sections — about 60 lines, no behaviour change.

- `public/mark-ink.svg` is a byte copy of `docs/brand/logo.svg` (navy + gold, 4.83 KiB). Named beside `mark.svg`, which stays the dark-theme and band mark. The swap is two `<img>`s with `dark:hidden` / `hidden dark:block`, so it follows both the system theme and a pinned `data-theme` (the `dark` custom variant); `<picture media>` would miss the pin.
- Soft shadow is Tailwind's `shadow-lg` token rather than the mockup's navy-tinted arbitrary value (no hardcoded colours). Gold edge: `border-t-4 border-t-primary` on the shadcn `Card`. Desktop padding `md:py-8` / `md:px-8` follows the mockup's roomier card.
- `.safe-top` sits on the outer `<main>` and `pt-12` on the inner column, since both set `padding-top`; the band used to carry the inset.
- Surprise: `src/client/lib/utils.test.ts` asserts every `--text-*` token is registered in `cn()`'s tailwind-merge font-size group (GH #136). Added `brand` there and to the test's list — without it `cn("text-brand", "text-…colour")` would drop one.
- `docs/design.md`: login sketch and layout bullets rewritten; gold exception in Colour; a `text-brand` row in Type and a `mark-ink.svg` row in Icons (the docs that own those rules). "the band's usual update prompt" → "the usual update prompt", since the page has no band; that the prompt is not actually rendered on /login is pre-existing and tracked in #339.

## Review Triage Log

Quick lens, pass 1: 1 medium, 1 false.

- medium, patched: the mark `<img>`s had no intrinsic size, so the name and card would drop ~55px once the SVG arrived (first visit on a slow network, before the precache). Added `width={1018} height={1178}` (the SVG's own size) so the box is reserved; CSS still sets the rendered width.
- false: "the forge folder is missing from the change". It was left out of the review diff on purpose and is committed with the PR, per the task.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass
- `pnpm build && pnpm check:precache` -- expected: pass; quote the total against 1,000 KiB in the PR
