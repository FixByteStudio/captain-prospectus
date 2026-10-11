---
title: 'One home for wire caps, Vertex, the map-cache read/write and the hour (GH #430–#433)'
type: 'refactor'
created: '2026-10-11'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'duplication-map']
review_loop_iteration: 0
baseline_commit: 'f524960d5d0e657ef378cdefc501cb72bad51f2d'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The review of #419–#421 deferred four more copies of one thing (CLAUDE.md: never duplicate). The 2000 / 30 / 60 / 320 wire caps are bare literals repeated across `schemas.ts` and `answers.ts` (#430). `Vertex` is declared once per side, and the lat/lng tuple schema is written twice (#431). The Overpass and Places routes each write their own map-cache lookup and upsert (#432). An hour in ms is spelled out in four source files (#433).

**Approach:** Give each one home, with no behaviour change and no test expectation change. `LONG_TEXT_MAX`, `QUESTION_OPTIONS_MAX`, `QUESTION_KEY_MAX`, `EMAIL_MAX` and `HOUR_MS` go in `src/shared/constants.ts`, with `DAY_MS = 24 * HOUR_MS`. A named `vertexSchema` and its inferred `Vertex` type go in `schemas.ts`, and both sides import them. `readMapCache` and `writeMapCache` go in `src/worker/map-cache.ts`, which already owns that table. All four issues ship as one sweep PR because the user named them together, the way #419–#421 shipped.

</frozen-after-approval>

## Implementation Notes

- Oneshot, worktree `../captain-prospectus-430`. Branch `refactor/one-home-wire-caps-430-433` was cut from `origin/main` f524960, its merge-base.
- The work is a single goal, the same sweep shape as #314, #373 and #419–#421. It touches about 14 files, and every edit is mechanical.
- `Vertex` is `z.infer` of the tuple, so it is mutable. The Worker's `readonly Vertex[]` parameters still accept it. `MapCanvas.tsx` and `MapStep.test.tsx` import it from `shared/schemas` instead of `./map`, because a re-export would give one type two import paths (the same call #419 made for `DAY_MS`). `queries.ts`'s two inline `[number, number]` mutation params also take `Vertex`. The `RoundMap` tuples are Leaflet coordinates, not the wire contract, so they stay as they are.
- `SESSION_SLIDE_MS` keeps its name and becomes `HOUR_MS`. `dev-seed-history.ts` drops its local `DAY` and uses the shared `DAY_MS`.
- `map.test.ts` also imported `Vertex` from `./map`, and typecheck caught it.
- `readMapCache` returns `{ mapped, cachedAt } | null`. It treats a stale row and an unparseable body as one miss, which is what both routes did before. `writeMapCache` reads `Date.now()` once rather than twice and merges the two routes' upsert comments into one. Neither route test covered the unparseable-body fall-through, so `map-cache.test.ts` now tests both helpers directly: a round trip, the three kinds of miss, and an upsert refresh.
- Verification: typecheck, lint, tests (2669) and build all pass, also after the review patches. Precache is 25 entries, 952.13 KiB of the 1,000 KiB ceiling.
- After review, `script-draft.ts` drops its private `KEY_MAX = 60` for `QUESTION_KEY_MAX`; #430 had not listed that copy. The two comments that still said "2000" (`sync.ts`, `visit-draft.ts`) now name `LONG_TEXT_MAX`.

## Review Triage Log

- Quick + duplication-map, pass 1. Nothing rated `high`. 1 `medium` and 1 `low` patched, 5 deferred as issues, the rest rejected.
- medium, patch: `script-draft.ts:43` still held `KEY_MAX = 60`, which trims generated keys and must match `QUESTION_KEY_MAX`. It now imports the shared constant.
- low, patch: two comments still said "2000" where `LONG_TEXT_MAX` now exists. Both now name the constant.
- defer: #437 `seedDayStart` against `brusselsMidnightDaysFromNow`; #438 the 15-minute login window on both sides, plus `MINUTE_MS`; #439 the rating range 1–5; #440 Leaflet setup repeated in MapCanvas and RoundMap; #441 the `111_320` metres per degree. All of them predate this change.
- low, rejected: the cache-hit and fresh response blocks are still repeated in both routes. #432 asked for the lookup and the upsert only, and folding the responses would need a new helper for an 8-line block.
- low, rejected: tests keep their local HOUR/DAY literals and raw-tuple fixtures as independent oracles, as #419–#421 decided.
- low, rejected: the "seed day k at hour h" repeats in dev seeding, the inline circle type in `queries.ts`, the `longText` expression in `answers.ts` (now tied to its schema through `LONG_TEXT_MAX`), the small within-file repeats in the map step, and the stat-tile markup. All are cosmetic, and the fixes would go beyond a simple correction.
- low, rejected: `Vertex` names a circle centre as well as a polygon corner. #431 asked for this name, and both are the same `[lat, lng]` wire tuple.
- accepted, not findings: `CREDENTIAL_MAX` (documented as its own number), the two email normalisations, the multi-answer shapes, the Leaflet `[number, number]` tuples, `SESSION_SLIDE_MS = HOUR_MS`, and the `overpass_cache` table name (renaming it is a migration).

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green. No test expectation is edited; at most an import path changes.
- `grep -rnE "maxLength\((2000|30|60|320)\)|60 \* 60 \* 1000|3_600_000|type Vertex =" src --exclude=*.test.*` -- expected: matches only in `constants.ts` and `schemas.ts`.
