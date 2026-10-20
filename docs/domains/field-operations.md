# Field operations

## The gates and the swipe
Every `/round/*` route sits behind a gate ([ADR-0036](../adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) › The gates, screens in [design.md](../design.md#before-the-swipe)). `decideTourneeGate` (`src/client/field/tournee-gate.ts`) reads Dexie live and shows the first that applies:
- **Open:** a tournée exists for today's Brussels day, either pulled (`tournees.dayStart` is today's midnight) or queued by this identity (`outboxTournees`, the Brussels day of `startedAt`). A second phone or a reinstall opens straight into the app. The pulled one decides when both exist: the server returns the earliest swipe of the day (by the phone's start time).
- **Never loaded** (no `lastSyncAt` in `meta`) and **nothing assigned** (pulled, and the snapshot below is empty): a message, no tab bar.
- **Start screen:** the date, the snapshot's stop count and a name-sorted preview of seven, then the swipe. No tab bar. The band, the sync dot and the unsent strip stay on every gate screen: the sync is never gated.
- **The snapshot** (`snapshotProspects`, `src/shared/tournee.ts`) is what a swipe freezes: the agent's open prospects, a `follow_up` only once due (before tomorrow's Brussels midnight; one with no date counts as due), and this identity's field prospects still in the outbox, each once.
- **The swipe** numbers the snapshot nearest-next from the agent's reading (`numberStops`, unlocated stops last, from 1), then writes one `outboxTournees` row and its `outboxStops` rows in one transaction (`startTournee`), triggers a sync and opens Tournée. The swipe works offline. It is a button the keyboard starts at once; a pointer tap only nudges, a drag past three quarters of the track starts it. Until a reading passes the location gate it is `aria-disabled` (« En attente de votre position »). The gate is an alert dialog over the start screen with no way out (`LocationDialog`, `useLocationGate`): « Activer » takes a one-off `getCurrentPosition` reading, which also brings up the browser's permission prompt, and readings start with no tap when the Permissions API already says `granted`. The gate's readings are fresh (`maximumAge: 0`), so a cached coarse fix cannot come back, and each is still remembered for the ADR-0028 marker. A reading over `LOCATION_GATE_ACCURACY_M` repeats after `LOCATION_GATE_RETRY_MS` while the page is visible; a refusal or a lost fix does not repeat, and coming back from Réglages re-checks the permission. The first reading at or under the threshold closes the dialog and focuses the swipe; it is the swipe's fallback point. The swipe itself takes one more fresh one-off reading (`maximumAge: 0`, `LOCATION_GATE_SWIPE_TIMEOUT_MS`, the track holding « Démarrage… » meanwhile) and numbers from it when it is at or under the same threshold; coarse, failed or timed out, it numbers from the gate's point. That reading is remembered for the ADR-0028 marker like any other and never reopens the gate. The constants and `LOCATION_GATE_HIGH_ACCURACY` live in `src/client/field/location-gate.ts`; the owner's pavement test sets them (provisional: 200 m, coarse fix, 2 s, a 3 s swipe wait). Nothing locks after the swipe. Neither the tournée nor its stops hold a position.
- **Today** for the gate, Tournée, Carte, Carnet and the start screen is one clock, `useFieldNow` (`src/client/field/field-clock.ts`): the latest of the last sync of this session on the phone's clock, the moment the field screens mounted and the last Brussels midnight the phone crossed while mounted, so a phone last synced yesterday still reads a swipe made now as today's, a remount after midnight reads the new day, and a sync after midnight never pulls it back. `meta.lastSyncAt` (the server's clock) only tells never loaded from loaded.
- **Midnight brings the gates back** (design.md › Midnight). One timer set for the next Brussels midnight (`brusselsMidnightDaysFromNow`), re-checked when the page becomes visible, moves the clock; Tournée, Carte and Carnet give way to the new day's first gate with no message, and the start screen remounts with the new date and a fresh location dialog. A visit or add-prospect form that was entered while the gate was open stays (`holdGate`, `tournee-gate.ts`): the frame keeps its tabs and the leave guard, « Enregistrer » writes to the outbox with `visitedAt` taken at the tap, and only then navigates to the start screen, whose dialog shows the save's line once: `StartScreen` takes it from the router state at mount, only when the save's time (`savedAt` / `addedAt`) falls in the clock's day, then clears the state. A visit saved after midnight is a door-day of the new day; Carnet lists it without a number only when its prospect is not in that day's tournée (a still-open prospect is in the next snapshot and gets a number); an add-prospect save queues the place and no stop, because the new day has no tournée yet. A form opened while gated (a deep link) is not held. The sync is never gated.

## Today list
- Tournée and Carte list **today's tournée** in the numbers the swipe gave its stops ([ADR-0036](../adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)), in number order. `src/client/field/tournee-stops.ts` reads the pulled tournée (else this identity's queued one), joins each stop with its prospect from the cache or the outbox, and drops the stops with a visit today and the stops the server marks `left`. The number is the stop's own: it never changes and a missing number is a gap, with no placeholder row.
- **A stop leaves the moment it has a visit today**, whatever the outcome: the server's visited stops for the day, unioned with this identity's outbox visits. Placement reads the outbox, never a status (invariants 2, 3). There is no "Plus tard" section and no end-of-round rows; a follow-up due on a later day comes back as a stop in that day's tournée.
- The next stop is the lowest-numbered stop left. When none is left, Tournée shows the all-done card and Carte's sheet the same sentence, unless the day holds no stop at all (`total` is 0, every stop having left unvisited), which reads « Plus aucun arrêt dans votre tournée aujourd'hui. » instead. `useRound` exposes that `total` (`tourneeCounter`'s `total`, below).
- **Leavers.** A stop the server marks `left` (reassigned, closed by an admin or merged, and not visited today) is not drawn on Tournée or Carte, leaves the total, and leaves a gap: nothing renumbers, so the next stop is still the lowest number left. `left` comes from the server only (`isStopLeft`); the phone writes it nowhere. If the prospect comes back, the next pull clears `left` and the stop returns under its first number.
- **Joiners.** A prospect that becomes open for the agent after the swipe, or a field prospect they add (Ajouter), is appended to today's tournée as a stop numbered after the highest number ever given, left and queued stops included, so a number is never reused. `appendJoiners` (`db.ts`) does it in one transaction at two points: at the end of each pull, and together with the queued field prospect (`queueFieldProspect`). It compares the swipe's set (`snapshotProspects`: open prospects, follow-ups due today or earlier, the identity's queued field prospects) with the tournée's stops, pulled and queued, and `joinersFor` (`tournee-joiners.ts`) numbers the missing ones nearest-next from the last stop the phone can place, else by name. A prospect already among the stops, left ones included, never joins again, so one that comes back keeps its first number. Nothing is appended before the swipe or on a day with no tournée. A joiner is an ordinary `outboxStops` row, stamped like the swipe's and never updated; a stop is a joiner when its `addedAt` differs from the tournée's `startedAt` (the swipe writes them equal, both from the phone clock, so no clock is compared; `isJoiner` in `src/shared/tournee.ts`; the server derives `joiner` for pulled stops and sends `clientStartedAt` for the queued ones), and shows « Nouveau » (an outline badge) on its row, the card and Carte's sheet.
- **Two phones, one joiner number.** If two phones of one agent append different joiners under the same number, the server keeps the first stored: the other stop is listed in `accepted` and not stored, and that phone's next pull re-appends the prospect as the next number. An unsynced joiner can therefore renumber, the second exception to "the numbers are the swipe's" ([design](../design.md#next-stop-card)).
- A stop whose prospect the phone does not hold has no row, no pin and a missing number. A stop without coordinates keeps its row and number and draws no pin. A field prospect still in `outboxProspects` shows « Pas encore envoyé ».
- Distances come from the latest reading and are information only: they never reorder anything. With no reading they read « Position inconnue », with no notice and no « Réessayer » on Tournée or Carte; each screen takes one reading when it opens.
- Each item links to the phone's maps app for navigation.
- The phone's order and numbers are the tournée's alone: `buildTodayList` is gone. The admin's round view lists the same stops from the server (`GET /api/admin/agents/:email/round`: today's tournée stops with no visit today and not left, in the swipe's numbers), and the stored reading only places its marker and distances. With epic 5, the latest reading the phone took today goes with each sync ([ADR-0028](../adr/0028-agent-position-at-sync.md)); sync never takes a reading itself.

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
(INVARIANT 10) — so a stale or tampered copy unlocks no admin route. The field
side is agent-only: an admin, cached or live, never reaches it
([ADR-0037](../adr/0037-admins-leave-the-field-side.md)).

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
| `visitedStops` | Today's door-days from the last pull, replaced wholesale; cleared by `clearAgentCache`. The counter and Carnet read it |
| `meta` | active script, last sync time, the last identity `/api/me` returned |

**The counter « {n} sur {total} » (GH #119; ADR-0036 › The counter).** Tournée
shows how many of today's stops the agent has been to, in arrêts. It is computed
in `useRound` from its one snapshot, by `tourneeCounter` in
`src/client/field/tournee-stops.ts`, so it reads the same tournée and the same
day as the list.

- **Door-days.** `doorDaysToday` joins the server's `visitedStops` with this
  identity's `outboxVisits` by visit id into one door-day per prospect for
  today: every visit of the day, the latest one's outcome, and `pending` while
  an outbox visit is not yet listed by the server. A visit seen on both sides
  counts once. Carnet reuses it (below).
- **`n`** is the tournée's stops that have a door-day today, each once: a second
  visit to a stop never moves it.
- **`total`** is the tournée's stops the server has not marked `left`, plus any
  `left` stop that has a door-day today (a visit still in the outbox keeps its
  stop). So a visited stop is always in `total` and `n <= total`. Joiners add
  one; a stop reassigned unvisited removes one. With no stop (or all left
  unvisited), `total` is 0 and no counter shows.
- **A door-day outside the tournée** (no stop for that prospect) counts in
  neither `n` nor `total`.
- **Today** is the Brussels calendar day `stopsOfToday` uses,
  `brusselsPeriod(now, 1)` with `useRound`'s `now` (`useFieldNow`: the latest of
  the last sync, the moment the screens mounted and the last Brussels midnight
  crossed). A visit from another day never counts.
- **Mine** is `writtenByOrUnstamped` (`src/client/field/outbox-stamp.ts`): on a
  shared phone the outbox side is the signed-in agent's own, and a row still
  `unconfirmed` (docs/backlog/013) counts, being their own queued visit.
- Nothing about the counter lives only on the phone: after a cache wipe or a
  reinstall, the next sync pulls the visited stops and the counter reads the same
  again. The admin's figures count the same unit: door-days ([api](../api.md#the-dashboard)).

**Carnet (GH #504; ADR-0036 › Placement and Carnet).** The third tab,
`/round/logbook`, lists today's door-days newest first: what is done, where
Tournée shows what is left. `carnetEntries` in `tournee-stops.ts` builds the rows
from the same inputs and period as the counter, and `useRound` exposes them from
its one snapshot, so the two cannot disagree.

- **A row** is one prospect's day: the number from `stopsOfToday` (`left` stops
  keep theirs; a prospect with no stop today shows a dash ring), its name, type
  and address, the latest outcome as a neutral badge (never a status colour,
  invariant 3), the latest visit's time, and « Pas encore envoyé » while any of
  the day's visits is unsent. From the second visit of the day it adds
  « {n} visites ».
- **Naming.** The row takes its name, type and address from the `visitedStops`
  row, then `prospects`, then this identity's `outboxProspects`. A door-day none
  of them can name is not drawn. A closed prospect (converted, gone from
  `prospects`) stays listed.
- **Reopening** is a link to the visit form with `state.from = "carnet"`. The form
  says « Retour au carnet », and saving returns to Carnet. It adds a **new visit**
  through `queueVisit` (invariants 2, 4), so the row rises with « 2 visites » and
  the counter does not move. A closed prospect opens by its `visitedStops` name
  and type. The signal lives in router state, so a reload of the form falls back
  to Tournée.
- **Today only**, with no count and no swipe on rows. The all-done cards on
  Tournée and Carte point here.

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
  "clientVersion": 3,
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
  "tournee": { "id": "uuid", "dayStart": 0, "startedAt": 0, "clientStartedAt": 0, "stops": [{ "id": "uuid", "prospectId": "…", "number": 1, "addedAt": 0, "left": false, "joiner": false }] },
  "visitedStops": [{ "prospectId": "…", "outcome": "converted", "visitedAt": 0, "flyerGiven": false, "visitIds": ["uuid"], "name": "…", "type": "restaurant", "address": null }]
}
```
`tournees` and `stops` are the morning swipe ([ADR-0036](../adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)). `tournee` is the agent's tournée for today's Brussels day, stops in number order, or `null` before the first swipe. `joiner` is derived by the server too (`isJoiner`: the stop's `client_added_at` differs from the tournée's `client_started_at`). `left` is derived by the server: false once the agent has a visit on the stop today, otherwise true unless the prospect is still assigned to the agent, open and not merged. `visitedStops` lists today's door-days (one per prospect, the latest visit's outcome, flyer if any visit gave one), closed prospects included.

### Rules
- **Phone send order:** a tournée goes first, with its stops in the same request, at most `SYNC_TOURNEES_PER_REQUEST` and `SYNC_STOPS_PER_REQUEST` per pass. A stop is sent only with its tournée, or once that tournée has left the outbox, so a big snapshot drains tournée first, then stops over further passes. Rows another identity wrote are never sent, like visits. When `idMap` maps a field prospect, the phone rewrites `outboxStops.prospectId` along with `outboxVisits.prospectId` before anything is resent. Accepted ids delete outbox rows (invariant 5) and the same response replaces `tournees`, `tourneeStops` and `visitedStops` wholesale, so a phone holding a later swipe adopts the earliest swipe's numbering. In the strip, a swipe counts as one element; its stops count alone only after their tournée left the outbox.
- **Order matters on the server:** field prospects first, then visits (visits may reference a prospect created in the same payload), then tournées, then stops (a stop may reference a field prospect from the same payload, and a tournée from it too).
- **Tournées and stops:** their write has its own failure policy, as the position's does ([ADR-0028](../adr/0028-agent-position-at-sync.md)): if it throws, the sync still answers 200 with its visits and prospects accepted, and none of the request's tournées or stops is listed in `accepted`, so the phone resends them; every insert ignores a conflict, so what the failed write stored makes the resend a no-op. A tournée takes its Brussels day from its clamped `startedAt`, and every one is stored; the earliest `clientStartedAt` per agent and day (the id breaks a tie) is the one read. A phone sends a stop only in the same request as its tournée, or after that tournée was accepted; a stop for a tournée id the server does not hold, or that is not the sender's, is treated as lost and drained. The other phone's tournée and its stops are stored like any other, and never read once an earlier swipe exists. A stop waits for its field prospect: one whose prospect (after `idMap`) does not exist yet is **not** accepted while the tournée's Brussels day lasts, and the phone resends it once the prospect is accepted; prospects are never deleted, so "unknown" only means "not arrived yet". Once that day has passed the stop is accepted and not stored, so a stop whose prospect never came is not resent for ever. A stop on a prospect reassigned since is stored and comes back with `left: true`. A stop that asks for a number another prospect already holds in that tournée (or holds earlier in the same request) is accepted and not stored, decided by the unique `(tournee_id, number)` index: the first stored keeps the number, and the losing phone re-appends its prospect as the next number after its next pull (see Today list › Joiners). The phone appends joiners at the end of each pull's transaction and with each queued field prospect, so the stops it sends are numbered above what it last saw, which another phone may have taken meanwhile.
- **Dedupe collision on a field prospect:** if the agent adds a place that already exists, the server keeps the existing prospect, returns `idMap[clientId] = existingId`, and rewrites `prospectId` on visits and stops in the same payload. The client applies `idMap` to anything still in its outbox.
- **Idempotency:** resending an accepted payload is a no-op. The client deletes outbox rows only after they appear in `accepted`. A visit the server already holds is listed in `accepted` again, so a phone that lost the first response can still clear its outbox instead of resending for ever.
- **Bounded payload:** the client sends at most `SYNC_VISITS_PER_BATCH` visits, cut further to fit `SYNC_BYTES_PER_BATCH` (the first visit always goes, whatever its size), and `SYNC_PROSPECTS_PER_REQUEST` field prospects per sync, and the server accepts at most `SYNC_TOURNEES_PER_REQUEST` tournées and `SYNC_STOPS_PER_REQUEST` stops (a bigger snapshot drains over passes; a stop `number` is at most `TOURNEE_STOP_NUMBER_MAX`) (`src/shared/constants.ts`) and repeats until the outbox is empty. A phone offline for a week must not build one request that exceeds the Worker's CPU budget. The server accepts no more visits than that batch and answers 400 above it; why 50 is in [free-tier-budget](../free-tier-budget.md#watch-outs) (GH #404, #451). `MAX_DRAIN_PASSES` is derived from the batch, so one trigger drains up to `DRAIN_VISITS` (`src/client/field/sync-schedule.ts`) of ordinary visits; visits heavy enough to hit the byte budget take more triggers, the rest draining on the next heartbeat.
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
