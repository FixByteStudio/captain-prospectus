# Field operations

## The gates and the swipe
Every `/tournee/*` route sits behind a gate ([ADR-0036](../adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) › The gates, screens in [design.md](../design.md#before-the-swipe)). `decideTourneeGate` (`src/client/field/tournee-gate.ts`) reads Dexie live and shows the first that applies:
- **Open:** a tournée exists for today's Brussels day, either pulled (`tournees.dayStart` is today's midnight) or queued by this identity (`outboxTournees`, the Brussels day of `startedAt`). A second phone or a reinstall opens straight into the app. The pulled one decides when both exist: the server keeps the first swipe of the day.
- **Never loaded** (no `lastSyncAt` in `meta`) and **nothing assigned** (pulled, and the snapshot below is empty): a message, no tab bar.
- **Start screen:** the date, the snapshot's stop count and a name-sorted preview of seven, then the swipe. No tab bar. The band, the sync dot and the unsent strip stay on every gate screen: the sync is never gated.
- **The snapshot** (`snapshotProspects`, `src/shared/tournee.ts`) is what a swipe freezes: the agent's open prospects, a `follow_up` only once due (before tomorrow's Brussels midnight; one with no date counts as due), and this identity's field prospects still in the outbox, each once.
- **The swipe** numbers the snapshot nearest-next from the agent's reading (`numberStops`, unlocated stops last, from 1), then writes one `outboxTournees` row and its `outboxStops` rows in one transaction (`startTournee`), triggers a sync and opens Tournée. The swipe works offline. It is a button the keyboard starts at once; a pointer tap only nudges, a drag past three quarters of the track starts it. Until a reading exists it is `aria-disabled` (« En attente de votre position », with « Réessayer » if refused); the location dialog and an accuracy threshold are a later story. Neither the tournée nor its stops hold a position.
- "Today" for the gate follows `useRound`: the last sync of this session on the phone's clock, else the moment the field screens opened, so a phone last synced yesterday still reads a swipe made now as today's. `meta.lastSyncAt` (the server's clock) only tells never loaded from loaded. Midnight is not watched yet.

## Today list
- One rule builds it, `buildTodayList` in `src/shared/today.ts`: the phone calls it with its outbox and queued visits. It is shared so the admin round view (epic 5) can call it with none and the position stored at sync, and show the same stops in the same order.
- All prospects assigned to the agent with an open status.
- Ordered by **greedy nearest-next** from the phone's current position; prospects without coordinates go last.
- With epic 5, the latest reading the phone took today goes with each sync, so the admin round view (Terrain › Tournée du jour) can order the same stops; sync never takes a reading itself ([ADR-0028](../adr/0028-agent-position-at-sync.md)).
- `follow_up` prospects whose `next_visit_at` is in the future are shown in a separate "later" group.
- Each item links to the phone's maps app for navigation.
- **A saved visit places its stop immediately, before the sync confirms it**
  (GH #239, `_bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md`):
  a closed outcome (Intéressé, Converti, Pas intéressé) leaves the round
  entirely, and À relancer or Personne sur place moves it to Plus tard or to
  the end of today's round, depending on the when choice. The phone never
  derives or shows a status from this (invariant 3) — the picked outcome only
  decides placement, in `buildTodayList`.
- **A `follow_up` stop visited today stays on today's round, at the end.**
  After the sync, a stop with `status = follow_up`, `last_visit_at` on today's
  Brussels calendar day and no `next_visit_at` at or after tomorrow's Brussels
  midnight is kept in the round rather than moving to "later" — "end of
  today's round" ignores distance and always sorts after every stop not
  visited today.

## Visit
Captured fields: check-in position (one reading, if permitted), `flyer_given`, script answers, `outcome`, optional `follow_up_at`, optional notes.

- The visit form shows the **previous visits' notes** for that prospect when online (`GET /api/agent/prospects/:id/visits`); offline it shows what is cached.
- The script is asked only where someone could answer it. For `interested` and `converted`, its required questions must be answered. For `follow_up` and `no_contact` the boss may be busy or away, so the script's questions are not asked at all and no answer is sent; the when step below replaces them (`_bmad-output/specs/spec-done-stop-leaves-the-round/SPEC.md`, CAP-6). For `not_interested` the agent picks one refusal reason instead of answering the script — the list is in [prospecting.md](prospecting.md#refusal-reasons); "Autre" also requires a note, checked phone-side only.
- `follow_up_at` is required when the outcome is `follow_up` or `no_contact` — both share one when step (Aujourd'hui / Choisir une date): "Aujourd'hui" sends today's Brussels midnight, "Choisir une date" requires a date strictly after today (`_bmad-output/specs/spec-done-stop-leaves-the-round/when-step.md`).

### The script is a second step

The form is two screens, not one (`docs/design.md`, "The script is the second
screen"): flyer and outcome first, then the questions and the notes. Principle 6
decides it — a screen that asks two questions is two screens — and choosing the
outcome first is also what says whether the questions are obligatory at all.

- **The script is pinned when the form opens**, read once from `meta.script`. A
  sync landing a newer version mid-visit does not swap the questions under the
  agent's thumb, and the visit records the version it was actually answered with
  (`scripts.md`).
- **Step 2 exists only when there is something to ask.** No cached script, or a
  script whose questions this build cannot render, and the form is one screen
  with the notes inline. A missing questionnaire never stands between an agent
  and a saved visit.
- **`no_contact` and `follow_up` still get step 2, but the script's questions
  are replaced by the when step.** Nobody able to answer may have been at the
  door (closed, or the boss busy or away), so the questions are not rendered at
  all rather than asked-and-waived (see Rules); the notes still live there, and
  what an agent reads off a sign in the window is the most useful thing they
  can record about a door nobody answered.
- **`not_interested` always gets step 2, even with no cached script — the one
  exception to "step 2 exists only when there is something to ask" above.**
  There is always a reason to ask why, so the radios and the notes hold that
  place instead of the questions. The reason is a draft field, not an answer:
  it never reaches `answersSchemaFor`, and it rides with `answers: {}`
  (`prospecting.md#refusal-reasons`).
- **A question this build cannot ask is skipped, never fatal.** A script is data,
  not contract shape: `clientVersion` governs the sync payload, not the
  questionnaire inside it, so an admin on a newer build can save a question type
  an older phone has never heard of. That phone renders the rest, saves the
  visit, and sends the answers it does have (`src/shared/answers.ts`). Throwing
  instead would take down the visit form, and an agent who cannot open it loses
  the visit — INVARIANT 5 by another route.

## Field prospects
Agents add places not in the base: name and type required, position defaults to current location.

## Offline sync
See [ADR-0007](../adr/0007-offline-first-insert-only-sync.md).

**Identity has an offline fallback too.** The app shell calls `GET /api/me` on
load; if that fails, it falls back to the last identity `meta.identity` cached,
so an agent standing where `/api/me` cannot be reached still gets their round
instead of a blocked shell. The cached copy proves nothing by itself — the
Worker re-derives identity from the session on every request
(INVARIANT 10) — so a stale or tampered copy unlocks no admin route; a cached
identity opens the field screens only, never `/admin/*`.

### Local store (Dexie)
| Table | Content |
|---|---|
| `prospects` | Last pulled today list (replaced on each successful sync) |
| `outboxProspects` | Field prospects not yet accepted, each stamped `writtenBy` (the email signed in when it was saved) and, if that identity was cache-sourced, `unconfirmed: true` (docs/backlog/013) |
| `outboxVisits` | Visits not yet accepted, each stamped `writtenBy` the same way, and `unconfirmed` the same way |
| `visitHistory` | Cached `GET /api/agent/prospects/:id/visits` results, one prospect's cache replaced per pull, so the visit form's « Visites précédentes » still shows something with no signal |
| `outboxTournees` | The swipe's tournée (`id`, `startedAt`) until the server lists it in `accepted`, stamped `writtenBy` / `unconfirmed` like a visit |
| `outboxStops` | The swipe's numbered stops (`id`, `tourneeId`, `prospectId`, `number`, `addedAt`), stamped the same way; indexed by `tourneeId` and `prospectId` |
| `tournees`, `tourneeStops` | Today's tournée and its stops as the last pull returned them (a stop keeps its `tourneeId` and `left`), replaced wholesale on each successful sync; cleared by `clearAgentCache` |
| `visitedStops` | Today's door-days from the last pull, replaced wholesale; cleared by `clearAgentCache`. Carnet and the counter read it in later stories |
| `meta` | active script, last sync time, the last identity `/api/me` returned |
| `sentVisits` | A log of the visit ids queued today (id, `prospectId`, `sentAt`, `writtenBy`, `unconfirmed`), written by `queueVisit` on the same write as the outbox row |

**"{n} portes sur {total} aujourd'hui" (GH #119, server-gap G8; doors since
GH #492).** `n` counts doors: each prospect visited today once, however many
visits it got, so a stop revisited after an À relancer "Aujourd'hui" never
reads as a second one and `n <= total` always holds. The prospects come from
`sentVisits` unioned with the pending `outboxVisits` — the union, not the log
alone, is what still counts a visit an older build queued with no log entry.
Both sides are bound to the same Brussels calendar day: the log is already
bound by `todaysSentVisits`, and the outbox side is filtered by each visit's
own `visitedAt`, so a visit queued yesterday and still unsent this morning
does not read as today's. The line counts the agent's doors, not the admin's
"Visites aujourd'hui" visits, so the two can differ by design. `total` is the
union of every prospect counted in `n` and the stops still on today's
list, not `n` plus the stops left: a visit's stop stays on today's list
after it is logged (invariant 3 — status is the server's to derive), so
adding the two would double-count it, and a stop that has since left the
list (moved to "Plus tard", or dropped by a pull) still holds its place in
`total` because it is still counted in `n`. A visit is **counted, never
deleted**: unlike the outbox, `sentVisits` rows survive a sync, and only a
housekeeping prune below the day boundary removes them — never in response
to the server. "Today" is a Europe/Brussels calendar day,
`brusselsPeriod(now, 1).from` (`src/shared/period.ts`), the same boundary the
admin dashboard counts "Visites aujourd'hui" with, so the two can never
disagree. Both sides of the union are filtered through `writtenByOrUnstamped`
(`src/client/field/outbox-stamp.ts`): on a shared phone, the line is the
signed-in agent's own progress, and an unstamped row from before Dexie v3
counts for whoever syncs it first. A row still `unconfirmed`
(docs/backlog/013) still counts here — it is this agent's own queued visit,
only not yet sendable, which is a narrower predicate (`sendableBy`) that only
`runSync` needs.

The today list itself is built from `prospects` **and** `outboxProspects`
together: a field prospect the server has not accepted yet still has to be
walkable and visitable in the same offline session that created it, so it is
shown — with no status, since the server has not derived one — until the
outbox row it came from is deleted.

`writtenBy` never goes on the wire. `runSync` sends only the rows stamped with
the identity signed in now (or unstamped, from before Dexie v3), so a row
another agent queued on the same phone is held back, counted apart from the
pending count («N éléments appartiennent à un autre agent…»), and waits until
that agent signs in again — never sent under the wrong name, never dropped.

**`unconfirmed` never goes on the wire either**, and a row carrying it is
never sendable, whatever identity `runSync` runs as (docs/backlog/013,
`identity-access.md#offline-and-session-expiry`). It is set when the identity
was cache-sourced at write time, and cleared — along with the flag itself —
the moment a live `/api/me` says who is really signed in
(`confirmOutbox`, `src/client/field/db.ts`).

### Protocol
`POST /api/agent/sync`
```json
{
  "clientVersion": 2,
  "prospects": [{ "id": "uuid", "name": "…", "type": "food_truck", "lat": 0, "lng": 0 }],
  "visits": [{ "id": "uuid", "prospectId": "…", "visitedAt": 0, "outcome": "interested", "flyerGiven": true, "answers": {} }],
  "tournees": [{ "id": "uuid", "startedAt": 0 }],
  "stops": [{ "id": "uuid", "tourneeId": "uuid", "prospectId": "…", "number": 1, "addedAt": 0 }],
  "position": { "lat": 0, "lng": 0, "accuracy": 0, "capturedAt": 0 }
}
```
`position` is optional and additive: the phone's latest reading of the day, kept by the server for the admin's round view ([ADR-0028](../adr/0028-agent-position-at-sync.md)). An invalid one is dropped; the visits still sync.

Response
```json
{
  "serverTime": 0,
  "accepted": { "prospects": ["uuid"], "visits": ["uuid"], "tournees": ["uuid"], "stops": ["uuid"] },
  "idMap": { "client-uuid": "existing-prospect-id" },
  "prospects": [],
  "script": {},
  "tournee": { "id": "uuid", "dayStart": 0, "startedAt": 0, "stops": [{ "id": "uuid", "prospectId": "…", "number": 1, "addedAt": 0, "left": false }] },
  "visitedStops": [{ "prospectId": "…", "outcome": "converted", "visitedAt": 0, "flyerGiven": false, "visitIds": ["uuid"], "name": "…", "type": "restaurant", "address": null }]
}
```
`tournees` and `stops` are the morning swipe ([ADR-0036](../adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)); an admin syncing from the field gets their own tournée like an agent. `tournee` is the agent's tournée for today's Brussels day, stops in number order, or `null` before the first swipe. `left` is derived by the server: false once the agent has a visit on the stop today, otherwise true unless the prospect is still assigned to the agent, open and not merged. `visitedStops` lists today's door-days (one per prospect, the latest visit's outcome, flyer if any visit gave one), closed prospects included.

### Rules
- **Phone send order:** a tournée goes first, with its stops in the same request, at most `SYNC_TOURNEES_PER_REQUEST` and `SYNC_STOPS_PER_REQUEST` per pass. A stop is sent only with its tournée, or once that tournée has left the outbox, so a big snapshot drains tournée first, then stops over further passes. Rows another identity wrote are never sent, like visits. When `idMap` maps a field prospect, the phone rewrites `outboxStops.prospectId` along with `outboxVisits.prospectId` before anything is resent. Accepted ids delete outbox rows (invariant 5) and the same response replaces `tournees`, `tourneeStops` and `visitedStops` wholesale, so a phone that lost the first-swipe race adopts the winner's numbering. In the strip, a swipe counts as one element; its stops count alone only after their tournée left the outbox.
- **Order matters on the server:** field prospects first, then visits (visits may reference a prospect created in the same payload), then tournées, then stops (a stop may reference a field prospect from the same payload, and a tournée from it too).
- **Tournées and stops:** a tournée takes its Brussels day from its clamped `startedAt`, and the first one per agent and day wins. A phone sends a stop only in the same request as its tournée, or after that tournée was accepted; a stop for a tournée id the server does not hold, or that is not the sender's (the other phone's, lost on the day), is treated as lost and drained. The other phone's tournée, and its stops, are accepted and not stored, since they can never be attached later and an outbox row kept for them would retry for ever. A stop waits for its field prospect: one whose prospect (after `idMap`) does not exist yet is **not** accepted, and the phone resends it once the prospect is accepted; prospects are never deleted, so "unknown" only means "not arrived yet". A stop on a prospect reassigned since is stored and comes back with `left: true`.
- **Dedupe collision on a field prospect:** if the agent adds a place that already exists, the server keeps the existing prospect, returns `idMap[clientId] = existingId`, and rewrites `prospectId` on visits and stops in the same payload. The client applies `idMap` to anything still in its outbox.
- **Idempotency:** resending an accepted payload is a no-op. The client deletes outbox rows only after they appear in `accepted`. A visit the server already holds is listed in `accepted` again, so a phone that lost the first response can still clear its outbox instead of resending for ever.
- **Bounded payload:** the client sends at most `SYNC_VISITS_PER_BATCH` visits and `SYNC_PROSPECTS_PER_REQUEST` field prospects per sync, and the server accepts at most `SYNC_TOURNEES_PER_REQUEST` tournées and `SYNC_STOPS_PER_REQUEST` stops (a bigger snapshot drains over passes; a stop `number` is at most `TOURNEE_STOP_NUMBER_MAX`) (`src/shared/constants.ts`) and repeats until the outbox is empty. A phone offline for a week must not build one request that exceeds the Worker's CPU budget. The server accepts up to `SYNC_VISITS_PER_REQUEST` visits, which older builds send; why the two differ is in [free-tier-budget](../free-tier-budget.md#watch-outs) (GH #404). `MAX_DRAIN_PASSES` is derived from the batch, so one trigger drains up to `DRAIN_VISITS` (`src/client/field/sync-schedule.ts`).
- **"Repeats" means while it is making progress.** `shouldDrain` (`src/client/field/sync-schedule.ts`) goes again only after a pass that succeeded, left rows behind **and** had something listed in `accepted`. The outbox slice is taken from the front, so a pass that accepted nothing would build the identical request again. Since ADR-0022 a quarantined visit is listed in `accepted` too, which is correct — the outbox really is draining, and the front of the queue really does move — so the condition now guards only against a pass the server rejected outright. The pass cap stays as the backstop above it.
- **A visit the server cannot take is quarantined, not dropped and not refused.**
  Two cases: its `prospectId` resolves to nothing, or the prospect belongs to another
  agent ([only the assignee's visit moves status](prospecting.md#prospect-lifecycle)). Either way the visit is written to `visits_orphaned` with a `reason`, listed in
  `accepted`, and left out of the prospect's history until an admin repairs it
  ([ADR-0022](../adr/0022-quarantine-visits-the-server-cannot-take.md)).
  **`accepted` means the server has durably taken the visit, not that a row exists in
  `visits`.** That is what lets the phone let go: before this, an orphan was neither
  stored nor accepted, so the outbox never drained when the prospect genuinely was not
  coming, and a visit for someone else's prospect could move that prospect's status
  (#33). Repairing a row inserts it into `visits` and derives status normally; the admin
  may also discard it, which is the one place a visit is deliberately lost.
- **Versioning:** `clientVersion` is an integer bumped on any breaking contract change. Once the data stage is `protected`, `MIN_CLIENT_VERSION` follows only after every phone reports the new version; while it is `disposable`, both rise in the same change, with no window ([ADR-0033](../adr/0033-rollout-rules-wait-for-protected-data.md)). The server answers `426 Upgrade Required` below the minimum supported version; the client then forces a service worker update *without* dropping the outbox (`applyUpdateNow` in `src/client/pwa.ts`, called from `useSync` — it re-checks for a build and activates a waiting one, at most once per page load, and is a no-op when there is nothing to take). The version is checked **before** the body is validated, so a build old enough to send a now-invalid shape is told to update rather than that its data is bad.
- **Never lose a visit.** The outbox survives app updates, reloads and failed syncs. Clearing it requires a successful sync.
- **Attribution:** a visit is always attributed to the agent whose session sent it, never to a field in the payload.

### Triggers
App start · `online` event · immediately after saving a visit · every 60 s while the app is open.

**While the identity is `unconfirmed` (docs/backlog/013), each trigger re-asks
`/api/me` instead of syncing** — `SyncProvider` never calls `runSync` until a
live answer confirms who is signed in. Confirmation itself then runs a sync at
once, rather than waiting for the next trigger.

## Live feed

`GET /api/admin/visits?since=&from=&to=&limit=` backs the admin's live feed,
polled every 15 s. `since` is the paging cursor — exclusive, "what's new since
I last asked" — while `from`/`to` (GH #176) narrow it to a range, inclusive at
both ends; all three bounds apply together. Like the export, the range reads
**`received_at`, not `visited_at`**, for the same reason (INVARIANT 12).

## Export

`GET /api/admin/visits/export.csv?from=&to=` hands visits to a spreadsheet for a
date range, defaulting to the last 30 days. The range reads **`received_at`, not
`visited_at`**: a phone can sync days late, and a range on the phone's clock
would silently drop exactly those visits (INVARIANT 12). Script answers are not
included — a nested shape in a flat CSV is a decision, not an implementation
detail — and neither are agent positions, which only the admin round view shows
([ADR-0028](../adr/0028-agent-position-at-sync.md)).
