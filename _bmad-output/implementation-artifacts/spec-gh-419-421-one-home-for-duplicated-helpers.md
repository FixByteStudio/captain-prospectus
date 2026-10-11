---
title: 'One home for duplicated helpers and constants (GH #419–#421)'
type: 'refactor'
created: '2026-10-11'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick', 'duplication-map']
review_loop_iteration: 0
baseline_commit: '1f05a3bde4a682d6467368658b509068c3c668c2'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Work on #48 turned up three copies-of-one-thing (CLAUDE.md: never duplicate): `round5`, `text`, `num` and the SHA-256-to-hex step are written in both `overpass.ts` and `places.ts`, with hex a third time in `session.ts` (#419); a day in ms is spelled out in six places beside `period.ts`'s `DAY_MS` (#420); the `shortText` cap of 200 is a bare literal at every site that has to agree with it (#421).

**Approach:** One home each, no behaviour change, no test expectation change. `DAY_MS` and a new `SHORT_TEXT_MAX` live in `src/shared/constants.ts`; the parsing helpers are exported from `overpass.ts` (places.ts already imports from it); the hex step lives in a small `src/worker/hex.ts` so `session.ts` does not import the Overpass module. All three issues ship as one sweep PR because the user named them together, as #314 and #373 did before.

</frozen-after-approval>

## Implementation Notes

- Oneshot, worktree `../captain-prospectus-419`, cut from `origin/main` 1f05a3b (merge-base).
- Single goal: one home per duplicated value, as in the earlier sweeps (#314, #373). It touches about 11 files, but each edit is mechanical.
- `DAY_MS` moves to `constants.ts` and `period.ts` stops declaring it; its importers (`routes/admin.ts`, `dashboard.test.ts`) switch to `constants`. Re-exporting from `period.ts` would make two import paths for one constant. It must sit above its first use in `constants.ts`.
- `SHORT_TEXT_MAX` also replaces `Toolbar.tsx`'s `SEARCH_MAX_LENGTH` (the eighth copy, which #421 does not list) and the inline 200s in `passphraseLoginSchema`, `codeLoginSchema` and `answersSchema`. `IMPORT_LOG_FILE_NAME_MAX` stays as a named cap, set to `SHORT_TEXT_MAX`.
- `hex.ts` holds `toHex` and `sha256Hex`, with a known-vector test; `overpass.ts` exports `round5`, `text`, `num` and `places.ts` imports them. The two `text` comments are merged into one.
- `auth.test.ts` and `dashboard.test.ts` import the shared `DAY_MS`. The other test files keep their spelled-out days as independent checks.
- After review, the passphrase and code login fields cap at a local `CREDENTIAL_MAX` in `schemas.ts`, not `SHORT_TEXT_MAX`: a credential is never trimmed, so a change to the free-text cap must not reach it.
- Verification: typecheck, lint, test (2666) and build pass; precache is 25 entries, 952.09 KiB of 1,000.

## Review Triage Log

- Quick + duplication-map, pass 1. None `high`; 1 `medium` and 3 `low` patched; 1 rejected; 5 deferred as issues.
- medium, patch: `SHORT_TEXT_MAX` also capped the untrimmed passphrase and code, so two unrelated limits shared one name. Fixed with a local `CREDENTIAL_MAX` in `schemas.ts`.
- low, patch: the spec's verification grep matched test files and a date pad. Narrowed it to non-test files and `b.toString(16)`.
- low, patch: `dashboard.test.ts` imported from `constants` twice. Merged into one import.
- low, patch: `auth.test.ts` kept a private `DAY_MS`. It now imports the shared one, with no expectation change.
- low, rejected: day literals in other test files. Tests keep their own literals as independent oracles, and #420 listed source sites only.
- defer: the other bare wire caps (#430), `Vertex` on both sides (#431), the map-cache code repeated in the routes (#432), the hour in ms (#433), the source filter without `google` (#434). All predate this change.
- accepted, not findings: the two cache TTLs (the comment gives separate reasons), `IMPORT_LOG_FILE_NAME_MAX` (a named cap), the overpass/places mirror shape (its header documents it), `hmacHex` beside `sha256Hex` (different primitives).

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green, with no test expectation edited apart from the `DAY_MS` import path
- `grep -rnE "24 \* 60 \* 60 \* 1000|b\.toString\(16\)" src --exclude=*.test.*` -- expected: only `constants.ts` and `hex.ts` (tests keep their own literals as independent oracles)
