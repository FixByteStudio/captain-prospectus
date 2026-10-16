---
title: 'GH #529: give the field precache headroom by scanning only src/client for Tailwind classes'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_commit: 'dbaadc40812a8f8dba4649395552fe1e45f7a1d4'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The field precache is at 999.99 of its 1,000 KiB ceiling (ADR-0026, ADR-0031), so the next field-reachable change fails `pnpm check:precache` (GH #529). The precached `index-*.css` is 125 KiB because Tailwind v4's automatic source detection scans the whole repository, including tracked `docs/` and the Stitch mockup HTML under `_bmad-output/`. That puts 482 selectors no component uses into the stylesheet.

**Approach:** Pin Tailwind's source scanning to `src/client` (`@import "tailwindcss" source("..")` in `src/client/styles/app.css`). That is the only tree whose markup the browser renders: `index.html`, `src/shared` and `src/worker` carry no class names. The stylesheet drops to about 93 KiB and the precache total to about 967.7 KiB, with no runtime change. Record the rule in the one doc line that owns the stylesheet.

</frozen-after-approval>

## Implementation Notes

Oneshot because the fix is a few lines in one CSS file, plus one doc line.

Investigation (2026-10-17, on `dbaadc4`):
- The JS chunks are what the field needs: react-dom (`index-*.js`), Dexie, react-hook-form (ADR-0018), react-router + zod/mini (`schemas-*.js`), tailwind-merge (`geo-*.js`), Leaflet (`RoundMap-*.js`, precached by ADR-0026). No admin-only package is in a precached chunk.
- CSS experiments: the whole-repo scan gives 128,175 B; `source("..")` gives 95,108 B (−32.3 KiB); additionally excluding `src/client/admin` gives 80,757 B. That last step would need a second, admin-only stylesheet and is left for a later issue if the headroom runs out again.
- The 482 dropped selectors come only from files outside `src/client`. Tailwind still scans every non-test file under `src/client`, so no class a component uses can disappear.
- The PNG icons (29 KiB) are untouched: no lossless optimiser is available here, and the saving would be small.

Implemented (2026-10-17):
- `src/client/styles/app.css`: `@import "tailwindcss" source("..")` plus a comment saying why and that `index.html` is outside the scan. The output stylesheet is byte-identical to the experiment build (`index-yzexg6Ec.css`, 95,108 B).
- `docs/design.md`: one line in the intro, which owns `app.css`.
- `docs/vision.md`: a new measurement entry in the precache log (review finding).
- Result: `check:precache` 967.70 KiB across 25 entries, so headroom is 32.30 KiB. The entry chunk is unchanged at 461.77 kB.
- Tried `@source not "../**/*.test.ts(x)"` too. The stylesheet came out byte-identical, so it is filed as #535 rather than shipped here.

## Review Triage Log

Quick review, pass 1 (high 0 / medium 1 / low 2 / false 0 / maybe-false 0, plus 2 pre-existing):
- medium, patch: `docs/vision.md` precache log had no entry for this budget event. Added a "Measured on 2026-10-17" entry.
- low, patch: the `app.css` comment said `src/client` is "the one tree whose markup ships", but `index.html` ships too and is now outside the scan. Reworded it to name `index.html` and say what to do.
- low, patch: the `docs/design.md` line sat under Type and leaned on the font paragraph's "same reason". Moved it to the intro paragraph that owns `app.css`.
- pre-existing, defer: `CarteScreen.tsx:40,42` cites drifted `app.css` line numbers. Filed #534.
- pre-existing, defer: the test-file `@source not` globs only cover `src/client/styles/`. A byte-identical build shows no current cost. Filed #535.

## Verification

**Commands:**
- `pnpm build && pnpm check:precache` -- expected: passes, total ≈ 967.7 KiB, `index-*.css` ≈ 93 KiB
- `pnpm typecheck && pnpm test && pnpm lint` -- expected: all pass

**Manual checks:**
- The selectors in the old CSS minus the new one: none of them is a class token used in `src/client` or `index.html`.
