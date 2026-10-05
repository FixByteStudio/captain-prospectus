---
title: 'Position stored at sync and served to the admin'
type: 'feature'
created: '2026-10-05'
status: 'done'
baseline_commit: '453fee99190587f3d4744e79fce00b2548fe4e47'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0028-agent-position-at-sync.md'
  - '{project-root}/.claude/skills/d1-migration/SKILL.md'
  - '{project-root}/.claude/skills/sync-contract-change/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 5's admin round view needs the agent's latest position, but the server has no place to keep it and no endpoint to serve it. ADR-0028 (accepted) decides how; nothing implements it yet. Story #265.

**Approach:** Tracer bullet for ADR-0028's server side: an `agent_positions` table, an optional `position` on the sync request upserted strictly-newer, a sweep of rows not from today, and `GET /api/admin/agents/:email/round` returning `{prospects, position | null}`.

## Boundaries & Constraints

**Always:**
- ADR-0028 is the rule; cite it, don't restate it. `position` = `{lat, lng, accuracy, capturedAt}`; lat/lng bounded, accuracy finite, ≥ 0 and capped (metres), `capturedAt` epoch ms. zod/mini only (INVARIANT 6).
- An invalid `position` is dropped on its own; the request still syncs its visits and prospects (INVARIANT 5). A `clientVersion` 1 body with no position syncs unchanged; no `clientVersion` bump (INVARIANT 9).
- Stored only for an assignable agent: role `agent` and listed in `AGENT_EMAILS`. An admin syncing stores nothing.
- One statement: insert … `onConflictDoUpdate` with `setWhere excluded.captured_at > agent_positions.captured_at`, on the phone's raw `capturedAt`; equal or older is a no-op.
- "Today" = clamped time `min(captured_at, received_at)` ≥ today's Brussels midnight (`brusselsMidnightDaysFromNow(now, 0)`). A reading not today after the clamp is not written; a stored row not today is served as `null`; the sweep deletes exactly those rows. One helper holds that rule.
- The sweep deletion runs in its own try/catch inside the retention run and logs counts only, never coordinates or emails.
- Endpoint: behind `requireAdmin` (403 for agents), `:email` parsed and lowercased with `emailSchema` (400 on malformed), 404 when not in `assignableEmails`, `Cache-Control: no-store`, `prospects` = exactly the sync pull's query (one shared function), `position.capturedAt` served clamped.
- The sync response never carries the position.
- Decision (owner, 2026-10-05): ADR-0028 is accepted. This PR flips its `Status` and its README row from `proposed` to `accepted` (a status-only edit) and says so in the PR description.
- Decision (owner, 2026-10-05): the spec is kept whole (~1,700 tokens), as one tracer bullet.

**Never:**
- No client (`src/client`) change — that is 5.3. No admin screen — 5.5/5.6.
- No position in any export, list, feed or log line. No history table.
- Do not hand-edit an existing migration; do not change `visits` retention behaviour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Old phone | v1 body, no `position` | 200, visits accepted, no row | — |
| Store | agent, today's reading | row written; endpoint serves it | — |
| Invalid | `lat: 200` + one visit | 200, visit accepted, no row | field dropped silently |
| Admin syncs | admin identity + position | no row | — |
| Older/equal | stored 10:00, send 09:00 or 10:00 | row unchanged | — |
| Future clock | `capturedAt` = now + 1 h | stored raw; served `capturedAt` = `received_at` | — |
| Stale | reading from yesterday | not written; a yesterday row is served `null` | — |
| Sweep | rows from yesterday 23:00 and today 00:30 | yesterday's deleted, today's kept | own try/catch |
| Endpoint | agent caller / unknown email / bad email | 403 / 404 / 400 | JSON error body |

</frozen-after-approval>

## Code Map

- `src/shared/schemas.ts:52-65,464-471` -- `latSchema`, `lngSchema`, `epochMsSchema`, `emailSchema`; add `agentPositionSchema`, `position` on `syncRequestSchema`, `agentEmailParamSchema`, `agentRoundResponseSchema` (+ types). `agentsResponseSchema` (:419) is the neighbour for the admin response.
- `src/shared/constants.ts` -- add `AGENT_POSITION_ACCURACY_MAX_M`.
- `src/shared/period.ts:96` -- `brusselsMidnightDaysFromNow(now, 0)`: the one Brussels-midnight helper to reuse.
- `src/worker/db/schema.ts:239-253` -- add `agentPositions` after `overpassCache`, plus row types. Then `pnpm db:generate` → `drizzle/0008_*.sql`.
- `src/worker/routes/agent.ts:93-310` -- sync handler; position write after visits/status (step 3), before the pull. The pull query (:285-295) moves into a shared function.
- `src/worker/routes/admin.ts:179-190` -- `assignableEmails` (admins included); add the round route beside `GET /agents`. Has its own `toWireProspect` (:150).
- `src/worker/auth.ts:64-74` -- `roleFor`, `parseEmails`, `requireAdmin` (mounted in `index.ts:67`).
- `src/worker/retention.ts` -- `runRetention`, `SweepResult`, `describeSweep`; add the position delete. `index.ts:121-140` calls it from `scheduled`.
- `src/worker/validate.ts` -- `validate("param", schema)` as used in agent.ts:322.
- Tests: `src/worker/sync.test.ts` (helpers `call`, `sync`, `seedProspect`; identity via `env.DEV_USER_EMAIL`, admin by default; `agent@example.com` is the agent), `src/worker/admin.test.ts` (`authorization` block :1234 shows the 403 pattern), `src/worker/retention.test.ts` (fixed `NOW`).
- Docs: `docs/api.md` (Agent and Admin tables), `docs/data-model.md` (erDiagram, Rules, Indexes), `docs/domains/field-operations.md#protocol` (request shape only).

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/constants.ts`, `src/shared/schemas.ts` -- position schema, sync field wrapped so an invalid value parses to `undefined`, param and response schemas -- one wire contract for 5.3/5.5.
- [x] `src/worker/db/schema.ts` + `pnpm db:generate` -- `agent_positions(agent_email text PK, lat real, lng real, accuracy real, captured_at int, received_at int)`, all not null -- storage.
- [x] `src/worker/agent-position.ts` (new) -- `isToday(clampedAt, now)`, `writeAgentPosition(db, email, position, now)`, `readAgentPosition(db, email, now)`, `sweepAgentPositions(db, now)` -- the one home of the today rule.
- [x] `src/worker/round.ts` (new) -- `openAssignedProspects(db, email)`: the sync pull's query, used by sync and the endpoint.
- [x] `src/worker/routes/agent.ts` -- write the position when role is agent and email in `AGENT_EMAILS`; use `openAssignedProspects`.
- [x] `src/worker/routes/admin.ts` -- `GET /agents/:email/round`.
- [x] `src/worker/retention.ts` -- call the sweep in its own try/catch; count in `SweepResult` and `describeSweep`.
- [x] `src/worker/sync.test.ts`, `src/worker/admin.test.ts`, `src/worker/retention.test.ts`, `src/shared/schemas.test.ts` -- every row of the I/O matrix.
- [x] `docs/api.md`, `docs/data-model.md`, `docs/domains/field-operations.md` -- one line each, linking ADR-0028.
- [x] `docs/adr/0028-agent-position-at-sync.md`, `docs/adr/README.md` -- `proposed` → `accepted` -- owner decision.

**Acceptance Criteria:**
- Given the branch, when `pnpm db:migrate:local` runs on a fresh local state, then it applies the new migration without error.
- Given the diff, when the `security-reviewer` subagent reviews it, then its verdict is approved (or its changes applied) and recorded in Implementation Notes for the PR.
- Given `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`, then all pass.

## Implementation Notes

- Implemented by an `api-engineer` subagent; files as in Tasks, plus `drizzle/0008_wandering_lyja.sql` with its meta snapshot and journal entry. The precache total is 932.61 KiB of 1,000 KiB (no client change).
- The position sweep runs at the start of `runRetention`, in its own try/catch, so a failure never stops the visit redaction.
- **security-reviewer verdict (2026-10-05): APPROVED WITH CHANGES.** The one medium change (an unguarded upsert could 500 the sync) and two lows (log only the error name; document an admin email answering `position: null`) are applied by the pass-1 patches. The third low (a fast phone clock blocks later readings) is rejected because ADR-0028 prescribes it (triage row 9). Link this verdict in the PR.
- Found in passing: `toWireProspect` is duplicated in `routes/admin.ts` and `routes/agent.ts`, already tracked as #17.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-05): high 0, medium 2, low 10, false 4, maybe-false 0. No intent_gap or bad_spec; 7 patch groups sent to the implementer, no deferral.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | security, edge, blind | A D1 failure in the position upsert 500s the sync after the visits are written | medium | patch | `agent.ts` 3b awaited unguarded; try/catch logging the error name, plus a test |
| 2 | verification, blind, intent | The round endpoint's `prospects` is asserted only as `[]` | medium | patch | Seed open, converted, merged and admin-owned; assert ids |
| 3 | verification | The sweep is not tested with a future-clock row | low | patch | Row with `capturedAt` today and `receivedAt` yesterday must go |
| 4 | verification, intent | The sweep's try/catch isolation is untested | low | patch | Proxy on `env.DB`, the pattern already in retention.test.ts |
| 5 | security | The retention catch logs `err.message` (Drizzle carries the bound values) | low | patch | Log `err.name` |
| 6 | blind | The store test checks only the row count | low | patch | Assert every column |
| 7 | security, blind, intent | An admin email answers 200 with `position: null`, not 404 | low | patch | Spec: 404 only outside `assignableEmails`; admins walk rounds. api.md says so |
| 8 | blind | The new imports are out of alphabetical order | low | patch | Moved |
| 9 | blind, edge, security | A fast phone clock blocks later true readings | low | reject | ADR-0028 prescribes the raw comparison; the block lasts at most as long as the skew, and the served age is clamped to receipt |
| 10 | edge | Tests flake within 20 s after Brussels midnight | low | reject | Unlikely; a fix needs clock injection into the route tests |
| 11 | blind | `describeSweep` prints "deleted 0" on a failed sweep; `.returning` loads emails | low | reject | The failure has its own `console.error` line; at most one row per agent |
| 12 | blind | The today rule is written twice (TS and SQL) | false | reject | Both live in `agent-position.ts`, and the sweep's docstring ties it to the read |
| 13 | blind | Drizzle meta for 0008 is missing | false | reject | `drizzle/meta/0008_snapshot.json` and the journal entry exist; the review diff excluded `drizzle/meta` |
| 14 | intent | The diff flips an ADR the intent calls accepted | false | reject | Owner decision in the frozen block |
| 15 | intent | No near-midnight write/read boundary test | false | reject | The sweep test pins the 22:00 UTC boundary, and write, read and sweep share `isToday`/the same clamp |

## Design Notes

- **Dropping an invalid field:** `position: z.catch(z.optional(agentPositionSchema), undefined)` keeps the shape in the contract and lets mini swallow a bad value without failing the parent. Add a schema unit test for it.
- **Accuracy cap:** 10,000 m. A coarser fix (IP-based) cannot order a walking round, so it is not worth keeping; rejecting it just drops the field.
- **Sweep SQL:** `delete … where min(captured_at, received_at) < :midnight`, the same rule as the read, so a missed night never leaves a row the endpoint would still serve.
- **Upsert:** `set` takes every column from `excluded`, including `received_at`, so the clamp follows the reading it belongs to.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all green.
- `pnpm db:migrate:local` -- expected: the new migration applies.
