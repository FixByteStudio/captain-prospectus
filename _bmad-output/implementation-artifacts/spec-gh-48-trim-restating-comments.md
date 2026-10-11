---
title: 'Trim comments that restate docs in the most-commented files (#48)'
type: 'refactor'
created: '2026-10-11'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment', 'duplication-map']
review_loop_iteration: 0
baseline_commit: '418d6973b9f8f8693d2ee50ea418381ed12be598'
context:
  - '{project-root}/docs/adr/0024-adrs-only-for-hard-to-reverse-decisions.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Six files are mostly comment (`sync-schedule.ts` 67%, `constants.ts` 61%, `csv.ts` 52%, `worker/types.ts` 49%, `pwa.ts` 50%, `places.ts` 40%; `src/` averages 21%). Much of that text restates a rule that already lives in an ADR or a domain doc, so the rule now has two copies to keep in sync. ADR-0024 and CLAUDE.md say a rule has one home.

**Approach:** Go through each file comment by comment. Where a comment restates a documented rule, cut it to a one-line *why* plus a link to the doc or ADR. Where it explains something only the code knows, keep it and tighten it. The change touches comments only.

## Boundaries & Constraints

**Always:** Comments only: the compiled output and every exported name, value and signature stay byte-identical. Every rule that gets cut must already be stated in the doc it now links; never delete knowledge that lives nowhere else. Keep the warnings that stop a dangerous edit (`never change this format`, `bump this whenever the request changes`, `never rename or reuse`, `must never grow past 30 days`), in short form. Invariant numbers and doc names in the comments that remain must be correct against today's CLAUDE.md.

**Never:** No edits to docs, tests or files outside the six (a stale reference found elsewhere becomes a `found-in-passing` issue). No renames, reordering or code reformatting. Don't strip a file to zero comments to hit a number: the ratio is a signal, not a gate.

</frozen-after-approval>

## Code Map

Where each long comment's rule already lives (cut to a link):
- `src/client/field/sync-schedule.ts` -- `shouldDrain` progress rule → `docs/domains/field-operations.md` "Repeats means while it is making progress". The backoff rationale → `free-tier-budget.md:62`. **Keep:** why 6 passes (1200 visits, past a week's output), and why `auth`/`upgrade` back off too.
- `src/shared/constants.ts` -- `MAX_REQUEST_BYTES` measurements and the 19.7 MiB case → `docs/security.md` ~l.30–38 and `docs/api.md` ~l.83. `CLIENT_VERSION` → field-operations "Versioning" plus the `sync-contract-change` skill (keep the one-line SQL query only if no doc has it). `RETENTION_*` received_at rule → ADR-0023 l.42–56. `OVERPASS_CACHE_TTL_MS` → ADR-0008. `PLACES_*` → ADR-0020 (§4 cap, storage at 30 days). `EXPORT_ROWS` → `api.md` ~l.151. Keep the short one-liners as they are.
- `src/shared/csv.ts` -- ISO-8601/UTC, quoting, null-as-empty and the `#` trailer → `docs/api.md` ~l.140–155 (CSV export rules). CRLF is in no doc: keep one line. **Fix** the stale "architecture.md invariant 9" (2 places) → INVARIANT 11.
- `src/worker/types.ts` -- the `GOOGLE_PLACES_KEY` secret rule → ADR-0020 §7 and `ingestion.md:54`. The own-login fail-closed behaviour → `docs/deployment.md` ~l.32–40 and ADR-0029. **Keep:** why `wrangler types` literals are widened.
- `src/client/pwa.ts` -- the 426 force-update rule → field-operations "Versioning" (it already names `applyUpdateNow`). **Keep:** why the state lives in module scope, why the update runs at most once per page load, why the attempt isn't spent before registration, and the render-time assignment.
- `src/worker/places.ts` -- field-mask tier → `free-tier-budget.md:53`, ADR-0020. `rankPreference`/`regionCode`/`languageCode` → `ingestion.md` ~l.115–160, `vision.md:15`. Cuisine prefix and pizzeria fallback → `ingestion.md` ~l.142–150. Empty `{}` answer → `ingestion.md:151`. `google/<placeId>` dedupe tier → ADR-0020 §6. **Keep:** the `g` prefix collision note, the 200-char truncation, `named` stays false-able, and that a mask with spaces is rejected.

Don't touch: `src/worker/export.test.ts:117`, which has the same stale "architecture.md invariant 9" (found in passing).

## Tasks & Acceptance

**Execution:**
- [x] `src/client/field/sync-schedule.ts` -- trim per Code Map -- the rules live in field-operations.md
- [x] `src/shared/constants.ts` -- trim per Code Map -- the largest file, mostly restated ADR and api/security text
- [x] `src/shared/csv.ts` -- trim and fix the invariant number -- the CSV rules are in api.md
- [x] `src/worker/types.ts` -- trim per Code Map -- the secret and fail-closed rules live in their ADRs and deployment.md
- [x] `src/client/pwa.ts` -- trim per Code Map -- the 426 rule lives in field-operations.md
- [x] `src/worker/places.ts` -- trim per Code Map -- ingestion.md documents the request and the mapping

**Acceptance Criteria:**
- Given the six files, when their comment ratio is re-measured, then each is lower than before, and every remaining multi-line comment explains something the linked docs don't say.
- Given `git diff`, when it is read with comment lines removed, then no line of code differs.
- Given any comment that names a doc, ADR or INVARIANT number, when it is followed, then it points at the right rule.
- Given the repo, when typecheck, lint, tests and build run, then all pass.

## Implementation Notes

- Comments only: each file compiled with comments stripped is identical to `origin/main`; the non-comment diff filter prints nothing.
- Ratios (comment/total lines), baseline → final: sync-schedule 47/70 → 29/52, constants 228/376 → 174/322, csv 43/82 → 20/59, types 25/51 → 16/42, pwa 45/90 → 31/76, places 109/271 → 66/228.
- Two more stale pointers fixed in the trimmed comments: `MAX_REQUEST_BYTES` cited a security.md section that does not exist (now "The body cap"); `PLACES_MAX_RESULTS` cited ADR-0020 §4, which frames 20 as our setting (now ingestion.md "Limits").
- Doc references use the `docs/…` path and the exact heading throughout the six files.
- Found in passing: #417 (`export.test.ts:117` stale invariant number), #418 (`deployment.md` vs ADR-0029 on `OWNER_EMAIL`), #419–#421 (duplicated helpers and literals, from the duplication-map lens).

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment, duplication-map). Verdicts: high 0, medium 3, low 11, false 4, maybe-false 0. All 14 real findings routed to patch, fixed by the implementer in one round; the duplication-map code repetitions routed to defer (pre-existing).

| # | Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | blind, edge, dup | `MAX_REQUEST_BYTES` "413 for ever" overstated; omits that `sync.ts` trims to it | medium | patch | `serializeWithinCap` halves the visit batch to fit; only one oversized visit loops. Comment now names the dependency. |
| 2 | blind | `csvTimestamp` lost its DST reason, which no doc holds | medium | patch | api.md "CSV exports" says UTC without a reason; reason restored. |
| 3 | blind, intent | `OVERPASS_CACHE_TTL_MS` reason cut; ADR-0008 does not state it | medium | patch | Now links ingestion.md "Limits and etiquette". |
| 4 | blind | "Google's 50" read as metres | low | patch | Now "50 km". |
| 5 | blind, edge | `PLACES_MAX_RESULTS` cites ADR-0020 §4, which frames 20 as our setting | low | patch | ingestion.md "Limits" says Google's ceiling; relinked. |
| 6 | blind | `PLACES_FIELD_MASK` links ADR-0020 §5, which lacks `places.types` | low | patch | Now links ingestion.md "The field mask is the bill"; the ADR is history (ADR-0024), no issue. |
| 7 | blind | `buildPlacesBody` says docs explain `regionCode`, then explains it | low | patch | Kept only what docs lack. |
| 8 | blind, intent | `MAX_DRAIN_PASSES` links free-tier-budget, which has no pass cap | low | patch | Relinked to field-operations.md. |
| 9 | blind | `RETENTION_DAYS` lost its why | low | patch | INVARIANT 12 clause restored. |
| 10 | blind, edge | "CSV export" vs heading "CSV exports"; mixed doc paths | low | patch | Exact heading and `docs/…` paths throughout. |
| 11 | edge, dup | `applyUpdateNow` restates field-operations "Versioning" | low | patch | Kept only the prompt-mode no-op and the re-check/once reasons. |
| 12 | intent | `OVERPASS_CANDIDATES_LIMIT`, `DUPLICATES_SCAN_LIMIT` restate the 10 ms rule | low | patch | Replaced by INVARIANT 13, per-cap reason kept. |
| 13 | blind | Places 30-day cap cites bare ADR-0020 | low | patch | Now "Accepted risks", Storage. |
| 14 | intent | `GOOGLE_PLACES_KEY` 503 is ADR-0020 §8, comment cites §7 | false | reject | §7 is cited for "a secret", which it covers; the 503 is stated inline. |
| 15 | dup | `CLIENT_VERSION` bump rule still written beside its link | false | reject | Frozen Always keeps warnings that stop a dangerous edit, in short form. |
| 16 | dup | `shouldDrain` summary duplicates field-operations | false | reject | Lens itself calls it minimal: one-line why plus link, as the intent asks. |
| 17 | intent | csv.ts invariant fix goes beyond cut-or-tighten | false | reject | Planned in the spec; comments only, in scope. |
| 18 | dup | `round5`/`text`/`num`/SHA-256 hex duplicated across overpass/places/session | low | defer | Pre-existing; GH #419. |
| 19 | dup | Day-in-ms spelled out at six sites despite `DAY_MS` | low | defer | Pre-existing; GH #420. |
| 20 | dup | `shortText` 200 cap a bare literal at seven sites | low | defer | Pre-existing; GH #421. |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all pass
- `git diff -U0 origin/main -- src | grep -E '^[-+]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[-+]\s*(//|/\*|\*|$)'` -- expected: no output (only comment lines changed)
- the comment-ratio one-liner per file (`grep -cE '^\s*(//|/\*|\*)'` over `wc -l`) -- expected: every file lower than at baseline
