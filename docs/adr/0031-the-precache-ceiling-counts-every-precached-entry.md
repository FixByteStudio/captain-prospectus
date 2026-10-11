# ADR-0031: The precache ceiling counts every precached entry

- Status: proposed
- Date: 2026-10-11
- Deciders: owner
- Amends: [ADR-0026](0026-budget-the-field-precache-not-the-entry-chunk.md), the basis of its 1,000 KiB ceiling

## Context

ADR-0026 caps the field route's precache at 1,000 KiB, measured as `pnpm build` prints it on the
Workbox line. That line sizes only the entries Workbox found by globbing `globPatterns` in
`vite.config.ts`. The three web-manifest icons and `manifest.webmanifest` are added afterwards as
`additionalManifestEntries`. They are precached, so a phone downloads them on install, but the
printed total counts them as zero bytes ([issue #88](https://github.com/FixbyteStudio/captain-prospectus/issues/88)).
The icons could grow, or new ones could be added, and the number the ceiling checks would not move.

The owner settled this at the epic #104 retrospective (2026-09-28): count the icons and manifest,
and keep the ceiling at 1,000 KiB. On `main` at `e732e18` Workbox prints 951.56 KiB. Counting
every entry gives 1,017.32 KiB, of which 65.76 KiB is icons and manifest.

## Decision

We will **measure ADR-0026's 1,000 KiB ceiling as the sum of every entry in the precache manifest
that `dist/client/sw.js` lists**, including the web-manifest icons and `manifest.webmanifest`.
`pnpm check:precache` enforces that sum, and it is the figure PRs quote. The ceiling stays at
1,000 KiB. To bring the first total under it, the three icons are recompressed as palette PNGs:
65.33 KiB becomes 29.06 KiB, and no pixel channel moves by more than 3/255.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep Workbox's printed total, as ADR-0026 wrote it | About 66 KiB of real install download stays invisible to the ceiling, and icon changes never move the number |
| Count every entry and raise the ceiling to make room | The owner chose to keep 1,000 KiB (epic #104 retrospective, 2026-09-28) |
| Add `png` and `webmanifest` to `globPatterns` so Workbox sizes them itself | `public/` holds `logo.png` (66 KiB) and `apple-touch-icon.png`, which the field never needs offline. They would be precached and add download only to make the printed line agree |

## Consequences

- **Our total and Workbox's line differ.** The build prints 951.56 KiB; `pnpm check:precache` prints
  981.06 KiB. The second one is the figure that counts and the one PRs quote.
- **Headroom is 18.94 KiB**, not the 48.44 KiB Workbox's line suggests. The next field change has to
  make room before it adds weight.
- **Icons are budgeted like code.** A larger or additional manifest icon now moves the total and can
  fail CI.
- `check-precache.mjs` no longer reads `globPatterns` from `vite.config.ts`, so it has one input fewer
  that can drift.
