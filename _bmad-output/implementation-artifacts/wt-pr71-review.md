# Walkthrough: PR #71 — DESIGN.md tokens and palette rules

Target: [PR #71](https://github.com/FixbyteStudio/captain-prospectus/pull/71), commit 249e2cb against main 5e3af93. Spec: [spec-gh-62-design-md-tokens-and-palette-rules.md](spec-gh-62-design-md-tokens-and-palette-rules.md).

Current block: 1

## - [ ] 1. Intent — in progress

Source: the spec's frozen Intent section, verbatim.

**Problem:** `app.css` lacks the tokens DESIGN.md adds (band accent and border, outcome colours, badge tints, the overline and other type roles, the named spacing), and `palette.test.ts` asserts only part of DESIGN.md › Colors' five rules, and only for the `data-theme="dark"` block. Stories 4–7 need these tokens, and `docs/design.md`'s Grounding, Colour and Type sections still describe the old app.

**Approach:** Add every DESIGN.md token to `app.css` in light and dark. Make `palette.test.ts` assert the five rules per theme, compute each badge tint from its `color-mix` declaration, and check every DESIGN.md colour name resolves. Then rewrite the three `docs/design.md` sections from DESIGN.md.

Note: the owner then decided light `warn` moves from #9A6B12 to #9A5B18 (it failed rule 5 on its own tint).

## - [ ] 2. Broad strokes — unvisited

One token set in app.css, one test that reads it back, one doc that explains it. Open in order:
- [app.css:62](../../src/client/styles/app.css#L62) — `@theme inline`: every token becomes a Tailwind utility (`bg-tint-warn`, `text-overline`, `h-band-height`).
- [app.css:215](../../src/client/styles/app.css#L215) — `:root`, the light values; the two dark blocks at [app.css:266](../../src/client/styles/app.css#L266) and [app.css:297](../../src/client/styles/app.css#L297) override them.
- [palette.test.ts:45](../../src/client/styles/palette.test.ts#L45) — the three themes the test evaluates, and [palette.test.ts:120](../../src/client/styles/palette.test.ts#L120), `evaluate()`, which turns a declaration into a colour.
- [palette.test.ts:277](../../src/client/styles/palette.test.ts#L277) — the five rule `describe`s start here.
- [design.md:37](../../docs/design.md#L37) — the rewritten Colour section.

## - [ ] 3. New colour tokens and the warn move — unvisited

Band accent/border are 8-digit hex (white at low alpha) so they follow the band in either theme; the three outcome colours are plain hex per theme. Light warn changes value.
- [app.css:98](../../src/client/styles/app.css#L98) — the new `--color-*` utilities.
- [app.css:231](../../src/client/styles/app.css#L231) — light `--warn: #9a5b18`.
- [app.css:237](../../src/client/styles/app.css#L237) — light band/outcome values; dark ones at [app.css:285](../../src/client/styles/app.css#L285) and [app.css:315](../../src/client/styles/app.css#L315).

## - [ ] 4. Badge tints — unvisited

Each tint is its colour mixed ≤ 12 % into the card in oklab, declared once in `:root` so it recomputes from whichever theme applies. Dark overrides only `tint-destructive`, to 10 %.
- [app.css:124](../../src/client/styles/app.css#L124) — `--color-tint-*` utilities.
- [app.css:250](../../src/client/styles/app.css#L250) — the recipes; `tint-assigned` is 7 % ink, kept opaque.
- The dark 10 % override sits in both dark blocks, just after the outcome colours.

## - [ ] 5. Type roles and shell spacing — unvisited

Each type role is a `--text-*` token carrying size, line height, tracking and weight; an explicit `font-*` still wins. Spacing names the shell's fixed sizes; there is no sidebar width (shadcn owns it).
- [app.css:168](../../src/client/styles/app.css#L168) — `text-overline` (named so because Tailwind's `overline` is a text decoration); the other roles sit just above it.
- [app.css:192](../../src/client/styles/app.css#L192) — `--spacing-band-height` and the rest.

## - [ ] 6. How the test reads app.css — unvisited

The test strips comments, parses each theme block, and has each dark theme inherit light's undeclared tokens. `evaluate()` resolves hex, `var()`, `transparent` and oklab `color-mix`, so tints are computed as the browser does.
- [palette.test.ts:20](../../src/client/styles/palette.test.ts#L20) — `block()`.
- [palette.test.ts:103](../../src/client/styles/palette.test.ts#L103) — `mixOklab()`, premultiplied.
- [palette.test.ts:138](../../src/client/styles/palette.test.ts#L138) — `solid()`, a token as painted on the card.

## - [ ] 7. The rules and coverage checks — unvisited

One `describe` per DESIGN.md rule, each run in all three themes, plus checks that every DESIGN.md colour resolves, the dark blocks match, and dark redeclares every hex token.
- [palette.test.ts:174](../../src/client/styles/palette.test.ts#L174) — the token set.
- [palette.test.ts:273](../../src/client/styles/palette.test.ts#L273) — warn stays clear of gold (≥ 14.5° HSL hue).
- [palette.test.ts:277](../../src/client/styles/palette.test.ts#L277) to [palette.test.ts:341](../../src/client/styles/palette.test.ts#L341) — rules 1–5.

## - [ ] 8. Periphery — unvisited

- [design.md:12](../../docs/design.md#L12) — Grounding, with the caveat that Layout onwards still describes today's shell.
- [design.md:86](../../docs/design.md#L86) — the Badges table.
- [design.md:108](../../docs/design.md#L108) — the five rules and what each protects.
- [design.md:161](../../docs/design.md#L161) — Type roles.
