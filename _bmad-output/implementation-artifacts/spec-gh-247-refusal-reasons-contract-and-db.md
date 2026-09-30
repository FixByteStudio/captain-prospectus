---
title: 'Refusal reasons in the contract and the database'
type: 'feature'
created: '2026-09-30'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'a8b59ca1f1201bb8d89286cfa0e65f33cf2caf31'
context:
  - '/home/m0/PROJECTs/captain-prospectus/_bmad-output/specs/spec-not-interested-skips-script/refusal-reasons.md' # untracked in the main checkout, read it from there
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Pas intéressé visit records no reason, so the team can't learn why Brussels says no. Stories 2–4 of epic #246 (field step, Visites, Hors cible filter) need one shared list, a wire field and the columns to build on (GH #247).

**Approach:** Add the fixed list of 7 `REFUSAL_REASONS` and their French labels, an optional `refusalReason` on the sync's `visitSchema`, a nullable `visits.refusal_reason` (mirrored in `visits_orphaned`) and a nullable `prospects.out_of_target_reviewed_at`, expand-only. The sync keeps the reason only on `not_interested`. Document the list, the rule, the field and the columns.

## Boundaries & Constraints

**Always:** Additive sync change, no `clientVersion` bump (docs/api.md Conventions). The reason never costs a visit (INVARIANT 5): missing or sent with another outcome → stored null. Status still comes from `OUTCOME_TO_STATUS` (INVARIANT 3). Values English, labels French in `copy/shared.ts` re-exported by `copy/field.ts` (INVARIANT 15). Schema in `zod/mini` (INVARIANT 6). Migration via `pnpm db:generate`, expand only. Values and order exactly as `refusal-reasons.md`.

**Never:** No field UI, no admin filter/column/CSV change, no writer of `out_of_target_reviewed_at` (stories 2–4). No backfill of old visits. No ADR (the domain doc is the home, ADR-0024). No change to the retention sweep.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Refusal with reason | `not_interested`, `refusalReason: "too_many_devices"` | Accepted; row stores `too_many_devices`; prospect `rejected` | none |
| Old build | `not_interested`, no `refusalReason` | Accepted; stored null; prospect `rejected` | none |
| Reason on another outcome | `converted` + `refusalReason: "no_need"` | Accepted; stored null; prospect `converted` | none |
| Quarantined refusal | `not_interested` + reason on a prospect not assigned to the sender | Held in `visits_orphaned` with the reason; a repair copies it to `visits` | none |
| Unknown value | `refusalReason: "bogus"` | 400, as for any value outside an enum | Batch refused by validation, outbox kept |

</frozen-after-approval>

## Code Map

- `src/shared/constants.ts` -- `OUTCOMES`, `OUTCOME_TO_STATUS`, `ORPHAN_REASONS` pattern; add `REFUSAL_REASONS` + `RefusalReason` beside `OUTCOMES`.
- `src/shared/schemas.ts:430` -- `visitSchema` (zod/mini object + refine); add `refusalReason: z.nullish(z.enum(REFUSAL_REASONS))` like `followUpAt`.
- `src/worker/db/schema.ts:86` -- `visits`; `:147` `visitsOrphaned` ("mirrors visits so a repair is a straight copy"); `:19` `prospects` (see `statusSetAt` doc comment as the model for the new column's comment).
- `src/worker/routes/agent.ts:158` -- visit row mapping; set `refusalReason: v.outcome === "not_interested" ? (v.refusalReason ?? null) : null`. Quarantine spreads `row`, so orphans get it free. Chunks use `boundParamsPerRow`, so no manual cap change.
- `src/worker/routes/admin.ts:1700` -- orphan repair insert; add `refusalReason: held.refusalReason`.
- `src/worker/routes/dev.ts:282` -- dev seed visit literal; add `refusalReason: null` only if typecheck needs it.
- `src/client/copy/shared.ts:104` -- `OUTCOME_LABELS` pattern; add `REFUSAL_REASON_LABELS: Readonly<Record<RefusalReason, string>>`.
- `src/client/copy/field.ts:9` -- re-export list; add `REFUSAL_REASON_LABELS`. `copy.ts` already `export *` from shared.
- `src/worker/sync.test.ts` -- `sync()`, `seedProspect()` helpers and the "stores a visit and derives the prospect's status" test to copy.
- `drizzle/` -- generated migration; do not hand-edit an existing one.
- Docs: `docs/glossary.md` (term table line 16, `## Enum values` at 36), `docs/domains/prospecting.md` (`## Prospect lifecycle`, `## Rules`), `docs/api.md` (sync payload section and `## Conventions`), `docs/data-model.md` (visits / visits_orphaned / prospects tables and `## Rules`).

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/constants.ts` -- add `REFUSAL_REASONS` (7 values, list order) and `RefusalReason`, doc comment pointing at prospecting.md and "never rename or reuse a value".
- [ ] `src/shared/schemas.ts` -- optional nullish `refusalReason` on `visitSchema`.
- [ ] `src/worker/db/schema.ts` -- nullable `refusalReason` (`refusal_reason`, enum `REFUSAL_REASONS`) on `visits` and `visitsOrphaned`; nullable integer `outOfTargetReviewedAt` (`out_of_target_reviewed_at`) on `prospects`, commented as stamped only by a direct admin PATCH (story 4); then `pnpm db:generate`.
- [ ] `src/worker/routes/agent.ts` -- store the reason only for `not_interested`, with a one-line why.
- [ ] `src/worker/routes/admin.ts` -- orphan repair copies `refusalReason`.
- [ ] `src/client/copy/shared.ts`, `src/client/copy/field.ts` -- `REFUSAL_REASON_LABELS` with the 7 French labels, re-exported for the field route.
- [ ] `src/worker/sync.test.ts` -- tests for every I/O matrix row, including a status assertion per case and an orphan-repair carry-through test (or in `orphans.test.ts` if that is where repair is tested).
- [ ] `docs/glossary.md` -- **Refusal reason / Raison du refus** term row and a 7-row value/label table under `## Enum values`.
- [ ] `docs/domains/prospecting.md` -- the rule, the list, the "not refusals" table from `refusal-reasons.md`, and "stored only on not_interested, never refuses a visit".
- [ ] `docs/api.md`, `docs/data-model.md` -- the optional sync field; the three new columns.

**Acceptance Criteria:**
- Given the new schema, when `pnpm db:migrate:local` runs on a local DB at main's migrations, then it applies with only `ALTER TABLE … ADD` statements.
- Given any `OUTCOMES` value synced with a reason, when the sync completes, then the prospect's status equals `OUTCOME_TO_STATUS[outcome]`.
- Given the field build, when `pnpm build` runs, then the precache total is at or under 1,000 KiB and is quoted in the PR.

## Implementation Notes

- Verification: migrate:local clean, typecheck, lint, 2027 tests green, build precache 929.92 KiB / 1,000 KiB. Migration renamed to 0007_refusal_reasons in review.
- Work only in the worktree `/home/m0/PROJECTs/captain-prospectus-247` (branch `feat/247-refusal-reasons-contract`); never touch `/home/m0/PROJECTs/captain-prospectus`. Do not commit; the orchestrator commits.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 2, low 4, false 5, maybe-false 0.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge | Docs say the reason never refuses a visit, yet an unknown value is 400 | medium | patch | 400 is the approved matrix row; the SPA ships from the same Worker, so no newer build meets an older server. The doc overclaims: reworded in prospecting.md |
| 2 | blind, edge | `other` note "required" not enforced server-side | low | patch | Rule is phone-side (SPEC CAP-1, story 2); server stays lenient per INVARIANT 5. Doc now says "on the phone" |
| 3 | blind | No response schema reads the reason back | false | reject | The intent assigns every reader to stories 2–4 of #246 |
| 4 | blind, intent | `out_of_target_reviewed_at` documented as stamped by a PATCH that doesn't exist | low | patch | Direct wording fix in data-model.md and schema.ts comment: reserved, nothing writes it yet |
| 5 | blind | Migration name `0007_narrow_the_hunter` breaks the descriptive convention | low | patch | 0000–0006 are all descriptive; renamed to `0007_refusal_reasons` before it reaches main |
| 6 | blind | Storage rule restated in glossary, api.md, data-model, prospecting.md | medium | patch | CLAUDE.md "a rule has one home"; copies already drifted (finding 1). Glossary and api.md now link to prospecting.md |
| 7 | blind | New tests cast payloads `as never` | false | reject | Every existing sync test uses the same cast because `Partial<SyncRequest>` is the parsed output type; not a new defect |
| 8 | blind, verification | `it.each(OUTCOMES)` asserts only status and passes without the change | low | patch | Added the stored-reason assertion per outcome |
| 9 | blind | No test for explicit null, or resend with a different reason | false | reject | `z.nullish` accepts null by construction; resend idempotency is covered by the existing "is idempotent" test |
| 10 | blind | Client outbox/form not carrying the field | false | reject | Field UI is story 2 by the intent |
| 11 | intent | Push path only; no read-back surface | false | reject | Same as 3: R1 reading is the approved intent |

## Design Notes

`z.enum`, not a free string: the list is fixed and its values are permanent, the server deploys before any build that sends a new value, and every other enum on the wire behaves this way. A missing or misplaced reason is what must not cost a visit, and those two cases are accepted.

`visits_orphaned` gets the column because its contract is "a repair is a straight copy". Without it a quarantined refusal would lose its reason on repair.

## Verification

**Commands:**
- `pnpm db:generate` -- expected: one new migration, ADD COLUMN only
- `pnpm db:migrate:local` -- expected: applies cleanly
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green
- `pnpm build` -- expected: green, precache line ≤ 1,000 KiB
