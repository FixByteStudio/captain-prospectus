---
tracker_id: "265"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/265"
tracker_status: backlog
id: 2
type: story
title: "Position stored at sync and served to the admin"
parent: epic-admin-round-view
covers: [CAP-4]
after: [1]
risk: medium
refined: true
---

# Position stored at sync and served to the admin

## Description

Tracer bullet for ADR-0028's server side. Adds an `agent_positions` table (agent_email primary key, lat, lng, accuracy, captured_at, received_at) via pnpm db:generate. Adds an optional `position` {lat, lng, accuracy, capturedAt} to syncRequestSchema in zod/mini, with no clientVersion bump: lat/lng bounded, accuracy finite, not negative and capped. The field is parsed on its own, so an invalid one is dropped and never fails the sync. Only an assignable agent's reading is stored, and an admin syncing from the field stores none. The write is one upsert statement, `onConflictDoUpdate … where excluded.captured_at > agent_positions.captured_at`, on the phone's raw capturedAt: an equal or older reading is a no-op. Reads and the today test use min(captured_at, received_at), and a reading that is not today in Brussels after that clamp is not written. runRetention deletes rows older than the start of today in Brussels (DST-aware), in its own try/catch, logging counts only. GET /api/admin/agents/:email/round sits behind requireAdmin, parses and lowercases `:email` with the shared emailSchema, refuses an email that is not in assignableEmails, answers with `Cache-Control: no-store`, and returns {prospects: the same open assigned prospects the sync pull returns, position: {lat, lng, accuracy, capturedAt} | null when not today}. The sync response never echoes the position. Entries 3, 5 and 6 build on this shape. Updates docs/api.md and docs/data-model.md.

## Acceptance Criteria

Verify: Worker tests show: a clientVersion 1 body with no position still syncs; a position is stored and served; an invalid position is dropped while the same request's visits are still accepted; an admin's sync stores no position; an older or equal capturedAt does not replace the stored one; a future capturedAt is served clamped to received_at; a reading not from today is neither written nor served, and runRetention removes yesterday's row but keeps one taken after midnight; the sync response carries no position; the endpoint sends `no-store`, gives 404 for an unknown agent and 403 to an agent caller. The migration applies with pnpm db:migrate:local, and the PR links an approved security-reviewer verdict on the diff.

## References

- parent — _bmad-output/initiative-dashboard-redesign/epic-admin-round-view/epic-admin-round-view.md
- adr — docs/adr/0028-agent-position-at-sync.md, Decision › On the server, How long it lives, Who sees it
- src/shared/schemas.ts, syncRequestSchema and emailSchema
- src/worker/routes/agent.ts
- src/worker/retention.ts
- src/worker/routes/admin.ts, assignableEmails

## Notes

- Open question: None known.
- ADR-0028 is the doc that allows the `agent_positions` upsert (invariant 4), and it explains why invariant 2 holds. CLAUDE.md does not point there yet: see the 5.1 entry in `_bmad-output/implementation-artifacts/deferred-work.md`.
- Brussels-day helpers already exist in `src/worker` (dashboard, places, dev-seed-history); reuse one rather than write a new one.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
