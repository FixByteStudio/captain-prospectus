---
title: 'Extract the band header into a Band component'
type: 'refactor'
created: '2026-09-25'
status: 'done'
route: 'oneshot'
route_source: 'auto'
baseline_commit: 'dfbfd860a83fc14df1930b6e5912baefa47f66c7'
worktree: '/home/m0/PROJECTs/captain-prospectus-band'
branch: 'refactor/band-header'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-59-retro-2026-09-25.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic #59's retrospective, finding F1 (action 1), records that
`<header className="safe-top bg-band text-band-foreground"><div className="flex h-band-height
items-center gap-3 px-4">…` is written out verbatim four times in `src/client/App.tsx` — the field
frame (:117), the admin-chunk fallback (:198), the identity-error state (:292) and the loading state
(:308). `src/client/Band.tsx` already exists as the home for shared band pieces and already exports
`BandBrand`. The fourth copy was added by the sweep whose job was to close the epic's gaps, so
nothing in the current review lenses catches the next one.

**Approach:** Add a `Band` component to `src/client/Band.tsx` beside `BandBrand` — the `<header>`
plus its `h-band-height` row, taking the row's contents as children — and use it at all four sites
in `App.tsx`. Move the `.safe-top`-is-padding-not-height rationale onto `Band`, where the two
classes now live. Then add a DOM test to `src/client/App.test.tsx` asserting that the loading, the
identity-error and the field frames each render that band header.

</frozen-after-approval>

## Implementation Notes

Oneshot: a single extracted presentational component, four call sites in one file, and test cases in
one existing suite — well under 100 lines, with no contract, data-model or sync surface touched.

Files changed, all in the `refactor/band-header` worktree at
`/home/m0/PROJECTs/captain-prospectus-band` (the shared checkout stays on `main`, and the worktree
was already cut from `dfbfd86`):

- `src/client/Band.tsx` — new `Band({ children })`: the `<header className="safe-top bg-band
  text-band-foreground">` plus its `flex h-band-height items-center gap-3 px-4` row. The
  `.safe-top`-is-padding-not-height rationale moved here from `FieldFrame`'s doc comment, since both
  classes now live here. `children` is required, not defaulted to `<BandBrand />`: three of the four
  sites want only the brand, but making that implicit would hide which site renders what.
- `src/client/App.tsx` — all four sites now `<Band>…</Band>`. `FieldFrame`'s doc comment says what
  is left of it (the one frame whose row carries more than the brand), and the loading state's
  comment no longer points at the error state as the shape it copies — it just says why a band is
  there at all.
- `src/client/App.test.tsx` — a `describe("App band header")` block with the loading, identity-error
  and field frames. `bandHeader()` queries `header.safe-top.bg-band > .h-band-height`: the band is a
  plain `<header>` with no accessible name, so the two classes that are its whole job are what there
  is to assert. The field case also asserts the tab `<nav>` is inside the row, not beside it.

Surprises:

- The error frame had no test at all, so the case needed a new `stub.identityUnreachable` — a bare
  `Error`, deliberately not an `ApiError`, which with the `meta` table cleared in `afterEach` is
  `resolveIdentity`'s offline-first-run branch.
- The fourth site, `AdminFrameFallback`, is not covered: reaching it needs a real lazy admin chunk
  and the suite mocks `./admin/AdminApp` away. The test comment says so.
- The guards were mutation-checked (dropping `safe-top` from `Band` fails exactly the three new
  cases, 3 failed / 8 passed) rather than assumed green — epic #59's F4 lesson.

Patched after review (below): `FieldTabs.tsx`'s tab-bar comment pointed at `App.tsx`'s `<header>`,
which this change removed; `beforeEach` now clears `fieldDb.meta` as well as `afterEach`, because the
identity effect's unawaited `setMeta` can land after the clear and the error case's outcome flips on
that row; and the pre-existing loading case now asserts only the busy `<main>`, with the brand
assertion living once, in the new block.

## Verification

**Commands (in `/home/m0/PROJECTs/captain-prospectus-band`):**
- `pnpm typecheck` — clean.
- `pnpm lint` — eslint clean, Prettier clean.
- `pnpm test` — 43 files, 991 tests, all passing.
- `pnpm build` — precache **676.74 KiB** over 14 entries, against ADR-0026's 1,000 KiB ceiling
  (676.74 of 1,000; the retro measured 677.09 KiB before this change, so the extraction gave back
  0.35 KiB). Required because the change touches the field route (CLAUDE.md › UI).
- Mutation check: dropping `safe-top` from `Band` fails exactly the three new cases and nothing else.

## Review Triage Log

Quick lens, one reviewer, 4 findings — 3 patched, 1 patched as documentation.

- `medium`, **patch** — `field/FieldTabs.tsx:62` said the band's class split was "`.safe-top` on
  `App.tsx`'s `<header>`": verified stale, `App.tsx` has no `<header>` left after this change. It is
  the same pointer the Intent moved, in the one other place that names it. Fixed to name `Band`.
- `medium`, **patch** — `App.test.tsx`'s new identity-error case needed an empty Dexie `meta` table
  to reach `offlineFirstRun`, and only `afterEach` cleared it while the identity effect's `setMeta`
  is not awaited. Verified against `field/identity.ts:72-78` (a cached identity returns
  `kind: "ready"` instead) and the suite's own comment naming that hazard. Latent, not failing —
  the reviewer ran the file 12 times green. Fixed by clearing in `beforeEach` too.
- `low`, **patch** — the new loading case restated the pre-existing one's `copy.appName` assertion.
  Real: same stub, same route, same text. Fixed by narrowing the older case to the busy `<main>`
  (its actual subject) and pointing it at the new block; the deletion was simple, so not rejected.
- `low`, **patch (documentation)** — the precache total was not quoted, which CLAUDE.md requires of a
  field-route change. Verified: neither the diff nor the spec had a figure. Now in **Verification**
  above and in the PR description.
