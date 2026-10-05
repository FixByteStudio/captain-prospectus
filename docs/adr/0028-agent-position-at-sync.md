# ADR-0028: The phone sends its last reading of the day with each sync

- Status: proposed
- Date: 2026-10-05
- Deciders: owner
- Amends: [ADR-0023](0023-retention-by-redaction.md) (a second table in the retention sweep)

## Context

**The admin needs to see where a round stands without calling the agent.** Epic 5
adds Terrain › Tournée du jour to the admin: a chosen agent's remaining stops for
today, ordered nearest-next from where the agent is, as a list and a map
(`spec-dashboard-redesign`, CAP-4 and server gap G7).

**The server has never held an agent's position on its own.** Today a reading
reaches the server in exactly two places: on a visit at check-in and on a field
prospect when it is added. The today list takes a reading too, to order the round,
but that one stays in memory. `security.md` promises it is "never persisted or
sent", and `vision.md` says position is "captured at check-in only".
Field-operations.md lists agent-position retention as undecided.

**A position is personal data.** ADR-0023 already treats it as personal data: two
named employees, and a history of their positions is a movement trail nobody agreed
to. Continuous GPS tracking is a v1 non-goal in `vision.md`.

**The phone already takes readings.** `useAgentPosition` calls
`getCurrentPosition` (never `watchPosition`) when the round is ordered, at check-in
and when a field prospect is added. Each reading is a one-off and is accepted up to
2 minutes old.

**The phone already syncs.** It syncs at app start, when it comes back online, after
each visit, and every 60 s while the app is open (`src/client/field/sync.ts`). Phones
on the current build must keep syncing (INVARIANT 9), the server is the only source
of truth (INVARIANT 2), and the outbox must never stall (INVARIANT 5).

## Decision

We will **send the latest reading the phone already took today with each sync it
was already making, and keep only the latest one per agent until the night's
sweep.**

### On the phone

- `position: {lat, lng, accuracy, capturedAt}` is an optional field on the sync
  request. `accuracy` is in metres. `capturedAt` is the time the device took the fix
  (`GeolocationPosition.timestamp`), not the time the hook resolved.
- Sync never calls geolocation, never asks for permission, and never wakes the phone
  to take a reading.
- **The reading is kept in module memory only.** It is not stored in Dexie or
  localStorage, so a reload forgets it. It is stamped with the identity that was
  active when it was taken. The phone sends it only when:
  - that identity is the confirmed one, never a cache-sourced one;
  - the reading was taken today, in Brussels time.

  An identity change or `clearAgentCache` drops it. A phone with no qualifying
  reading sends no field.
- The client checks the field against the shared schema before sending and leaves
  it out if the check fails.

### On the server

- **A bad `position` never fails a sync.** The field is parsed on its own. An
  invalid one is dropped, and the visits and field prospects in the same request
  are still accepted (INVARIANT 5). The shared zod/mini schema bounds `lat` and
  `lng`, takes `capturedAt` as epoch ms, and requires `accuracy` to be finite, not
  negative and capped (INVARIANT 6).
- **One row per agent.** The table is `agent_positions`, keyed by the agent's
  verified email (INVARIANT 10). Only an assignable agent's position is stored; an
  admin syncing from the field route stores none.
- **The write is an upsert, and this ADR is the doc that allows it (INVARIANT 4).**
  The upsert is one statement, `onConflictDoUpdate … where excluded.captured_at >
  agent_positions.captured_at`, so two syncs in flight cannot race. The comparison
  uses the phone's `capturedAt` as sent, and an equal time is a no-op. Re-sending the
  same reading changes nothing, even from a phone whose clock runs ahead.
- **The clock.** Reads and the today test use `min(captured_at, received_at)`, the
  same clamp as `visited_at` (INVARIANT 12). A reading that is not today in Brussels
  after clamping is not written.
- **No history is kept.** The previous reading is overwritten when a newer one
  arrives.

### How long it lives

- A row is served only while its clamped time is today in Brussels; after that the
  endpoint returns `null`.
- The daily retention sweep from ADR-0023 (Cron Trigger, 03:40 UTC) deletes rows
  older than the start of today in Brussels. It is DST-aware. A reading taken between
  midnight and the sweep belongs to today and stays.
- The row is therefore stored for at most the rest of its day plus the hours until
  the next morning's sweep. D1 Time Travel, and the R2 backup once it is enabled,
  keep their own copies for their own windows (ADR-0023, `deployment.md`).

### Who sees it

- Only admins, and only on Terrain › Tournée du jour, through
  `GET /api/admin/agents/:email/round`. The endpoint:
  - sits behind `requireAdmin`;
  - validates and lowercases `:email` with the shared email schema;
  - refuses an email that is not an assignable agent;
  - answers with `Cache-Control: no-store`.
- The map shows the exact position marker (DESIGN.md › Map) with the reading's age
  beside it.
- The sync response never echoes the position, and no agent can read another
  agent's position. Positions appear in no export, list, feed or log line: the
  sweep logs counts only.

### Why this is not tracking

No reading is taken for this feature, nothing runs in the background, and the server
holds at most one point per agent, which it deletes overnight. The `vision.md`
non-goal is reworded to say exactly this rather than "check-in only".

INVARIANT 2 holds: the row is the agent's own state, not shared prospect data. The
phone only offers a reading inside the insert-only sync, and the server decides
whether to keep it. This row is not a precedent for an agent-side update of a
shared table.

## Alternatives considered

| Option | Why not |
|---|---|
| Order the admin view from the agent's last synced visit (`visits.lat/lng`) | No new data and no contract change. But it is wrong exactly when it matters: before the first visit of the day there is none, and after a visit it lags behind every street the agent has walked since. It also turns visit coordinates into a location feed, which ADR-0023 kept them from being |
| Keep a trail of readings for the day | It would draw the walked path, but it is a movement history, which is the non-goal. One point answers "where does the round stand" |
| Have sync take a fresh reading | It would be more accurate. But it makes every sync, the 60 s one included, a location request the agent did not make. That is background tracking by another name, and it costs battery |
| Keep the reading in Dexie so it survives a reload | One more reading reaches the admin. But it puts location data on the device's disk, with its own wipe rules, and on a shared phone it could outlive an identity switch |
| Show only the reading's age and order from it, with no marker | It exposes less on screen. But the server holds the same data either way, and the stop order already gives the position away to within a street. The owner chose the exact marker (epic 5 Notes, 2026-10-05) |
| Keep positions as long as visit positions (90 days) | A position without a visit is worth nothing once the day ends. Keeping it is a cost with no use |

## Consequences

- The admin can see where a round stands, and from what time, without a phone call.
- **The sync contract gains an optional field.** It is additive: an older phone
  sends nothing and still syncs, and the admin view falls back to name order with a
  notice.
- **The retention sweep gains a second table.** It has the same failure mode as
  ADR-0023: if the cron stops, nothing breaks and positions outlive their day. The
  delete runs in its own try/catch and logs what it deleted. The read path serves a
  stale row as `null` anyway, so a missed night never shows yesterday's position.
- **The written promise to agents changes.** `security.md` said the round reading
  is never sent; once the phone side ships, the latest one is. **The owner tells both
  agents before that release.** The release checklist carries this check.
- Harder: a dispute about where an agent was later in a day has no answer. Only the
  latest point exists, and only until the night. That is intended.
- Follow-up in epic 5:
  - story 2: the table, the upsert, the endpoint and the sweep, with `docs/api.md` and
    `docs/data-model.md`;
  - story 3: the phone side, including the `useAgentPosition` header comment and
    `docs/design.md`'s note that it has no shared state;
  - stories 5 and 6: the admin screen.

  Each cites this ADR.
