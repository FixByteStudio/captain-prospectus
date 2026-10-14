# ADR-0036: A morning swipe freezes each agent's numbered tournée

- Status: proposed
- Date: 2026-10-14
- Deciders: owner
- Amends: [ADR-0028](0028-agent-position-at-sync.md) (the admin round view takes its order from the tournée, not from the synced reading)

## Context

**The round is rebuilt on every render.** `useRound` runs `buildTodayList` over the cached
prospects, the outbox and the latest reading each time any of them changes
(`src/client/field/useRound.ts:70`, `src/shared/today.ts`). The order is nearest-next from
wherever the phone is now. Stop numbers are positions in that list: the next-stop card is
always 1 (`NextStopCard.tsx:17`), the rows start at 2, and the map pins start at 1
(`round-map.ts:37`). After every saved visit, the agent's next stop is "1" again.

**The day's counter is wrong in two ways.** `dailyProgress` puts visit ids in `n` and
prospect ids in `total` (`src/client/field/progress.ts:36`), so a second visit to one stop
reads "17 sur 16" (#492). Half of `n` comes from `sentVisits`, a log kept only on the phone.
`clearAgentCache` wipes it on a sync 401/403, on a `/api/me` 401 and on an identity switch
(`src/client/field/db.ts:276`). The round comes back with the next pull, but the log does
not, so an agent who saved 16 visits can read "0 sur 23".

**A saved stop leaves the agent's sight.** A closed outcome removes the stop from the round.
A dated follow-up moves it to "Plus tard". A follow-up for today goes to the end of the round
(`_bmad-output/specs/spec-done-stop-leaves-the-round/round-placement.md`). Nothing on the phone lists what the agent did today.

**The admin counts in two units.** "Visites", the visits-by-day chart and "Activité par
agent" count every visit (`src/worker/routes/admin.ts:269`, `:491`). Conversions count each
prospect once (`:573`). One door with Personne sur place at 10:00 and Converti at 16:00 shows
as 2 visits and 1 conversion, and it also shows in the chart as a `no_contact`. "Agents en
tournée" means "has a visit received today" (`:359`). The admin round view runs the same
`buildTodayList`, ordered from the reading stored at sync (`src/client/admin/round/round-list.ts:13`,
ADR-0028).

**Constraints that hold.**
- Agents only insert. An agent cannot edit a visit, and a correction is a new visit
  ([ADR-0007](0007-offline-first-insert-only-sync.md)). The server derives status from the
  newest visit ([ADR-0011](0011-server-derived-prospect-status.md)). It already accepts a new
  visit on a closed prospect assigned to the agent (`src/worker/routes/agent.ts:174`).
- A prospect has one `assigned_to`. Two agents never share a stop. The only overlap is a
  reassignment while a phone is offline, which is quarantined
  ([ADR-0022](0022-quarantine-visits-the-server-cannot-take.md)).
- A position is personal data. The phone takes one-off readings with `getCurrentPosition`,
  never `watchPosition`, because continuous tracking is a non-goal in `vision.md`
  (`useAgentPosition.ts:4`). The sync accepts readings with up to 10 km of uncertainty
  (`AGENT_POSITION_ACCURACY_MAX_M`), and the hook asks for a coarse fix.
- A web app cannot switch location on or open the phone's settings. It can trigger the
  browser's permission prompt. After a refusal, the browser does not ask again.
- `docs/design.md:1723` and `useAgentPosition.ts:10` promise that the round still works with
  position refused.
- The data stage is disposable. A breaking contract change raises `CLIENT_VERSION` and
  `MIN_CLIENT_VERSION` together ([ADR-0033](0033-rollout-rules-wait-for-protected-data.md)).
  Nothing here adds a service or a cost ([ADR-0002](0002-zero-cost-constraint.md)).

## Decision

We will **start each agent's day with a swipe that freezes a numbered tournée, keep it on the
server as inserts only, and count everything an agent or an admin sees by door and day.**

### The tournée

- A **tournée** is one agent's stops for one Brussels calendar day. There is at most one per
  agent per day.
- At the swipe it holds what is open for the agent that morning: assigned prospects with an
  open status, follow-ups due today or earlier, and field prospects still in the outbox.
  Follow-ups due on a later day are not in it. Admins keep assigning prospects as they do now.
  Admin-built tournées for a date are a later decision.

### The gates, in order

1. **Sign-in**, as today.
2. **No tournée:** a message says nothing is assigned. A different message says the phone has
   never loaded a round and needs a connection. When an assignment arrives, the next sync shows
   the start screen.
3. **Location:** an alert dialog over the start screen, which shows the date and the stops.
   It has one action, "Activer". That action takes the same one-off reading as the existing
   "Réessayer" (`refresh()`). On first use, it brings up the browser's permission prompt. A
   short line names Réglages › Localisation for a refusal. While the dialog is open, the phone
   repeats one-off readings until the accuracy passes a threshold. The first story sets the
   threshold after a pavement test. The target is 100–200 m. The dialog appears only when a
   tournée exists. T1 has no way past it without a position.
4. **Swipe "Commencer la tournée".** The swipe works offline and is a real button for the
   keyboard and screen readers. It reuses the stop-row gesture maths (`swipe.ts`).
5. **The app:** Tournée, Carte, Carnet and adding a prospect.

The location gate ends at the swipe. If GPS is lost later in the day, nothing locks. The sync
is never gated: the outbox drains and the unsent-visits strip shows before and after the swipe.
At Brussels midnight the gates come back. A visit form that is open at midnight saves first.

### Numbers

- The phone numbers the stops **once, at the swipe**, nearest-next from the swipe position.
  The numbers never change after that.
- Prospects that join the tournée after the swipe take the next numbers (21, 22…) at the end,
  marked "Nouveau".
- An unvisited stop that leaves the agent's open work (reassigned, closed by the admin or
  merged) leaves a gap. It also leaves the total.
- The next-stop card shows the lowest-numbered stop with no visit today. The card, the list,
  the Carte pins and the admin round view all show the same number.
- The swipe position is used for this ordering on the phone only. It is never sent or stored.

### The counter

- The counter reads "{n} sur {total}". In the UI, a stop is an **arrêt**, never a "visite".
- `n` is the number of the tournée's stops with at least one visit today. Every outcome counts.
  A second visit to the same stop does not count again.
- `total` is the tournée's stops: the snapshot, plus stops that joined, minus stops that left
  unvisited.
- `n` comes from today's visits listed by the server, joined with the outbox by visit id. The
  phone-only `sentVisits` log goes away.

### Placement and Carnet

- **Every saved stop leaves Tournée, whatever its outcome.** "Plus tard" leaves Tournée too.
  This replaces the "end of today's round" rows of `round-placement.md`.
- A new tab, **Carnet**, lists today's visited stops. Each row shows its number and the latest
  outcome. The list comes from the server and the outbox. It includes closed prospects, which
  the sync pull does not carry today.
- Reopening a stop from Carnet opens the visit form and saves a **new visit**. ADR-0007 is
  unchanged. Carnet shows today only.
- A follow-up due on a later day comes back as a stop in that day's tournée.

### On the server, inserts only

- A **tournée row** holds the agent (from the session), the Brussels day and the start time.
  The start time is clamped to `received_at`, like `visited_at`. It is unique per agent and
  day, and it is inserted with `onConflictDoNothing`.
- **Stop rows** hold the tournée, the prospect, the number and the time the stop was added.
  They are unique per tournée and prospect. The phone sends them through the outbox, the
  snapshot at the swipe and a joiner when it appears. Nothing is updated. A stop that left is
  derived from the prospect's assignment and status, never written.
- The sync response returns today's tournée and its stops. A second phone or a reinstalled
  app gets the same numbers and does not show the gate again. The response also returns
  today's visited stops for Carnet and the counter.
- Visits carry **no tournée id**. The visit contract does not change. "Which stop, which day"
  is derived from the agent, the prospect and the Brussels day of `visited_at`.
- The sync request and response gain fields. `CLIENT_VERSION` and `MIN_CLIENT_VERSION` rise
  together in the same change.

### Admin and stats count door-days

- A **door-day** is one agent, one prospect and one Brussels day. Its outcome is the latest
  visit that day.
- "Visites", the visits-by-day chart, "Activité par agent", flyers (one door-day counts if any
  of its visits gave a flyer), refusal reasons (the latest visit only) and conversions all
  count door-days.
- The admin's Visites ledger shows one row per door-day. Opening a row shows the details and
  the full visit history. Visits are never updated or deleted.
- "Agents en tournée" counts agents who started today's tournée.
- The admin round view shows the tournée's stops in their numbers. The reading stored at sync
  (ADR-0028) still places the agent's marker. It no longer orders the stops.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the live round and fix only the counter (#492) | The next stop still reads "1" after every visit, the map and the admin view still number stops differently, and the phone still has no record of the day |
| Let agents edit or overwrite a visit | Reverses ADR-0007. It brings offline update conflicts back and erases the earlier visit, which refusal-reason stats need. Grouping the reads gives the admin one row without losing the history |
| Admin builds a tournée for each date | Needs a planning screen and rules for sick days. It can be built later on the same tables, with the admin filling the snapshot instead of the swipe |
| Number a stop when its visit is saved, or renumber as the agent moves | A number changes under the agent's eyes, and the admin view cannot show the same numbers without the agent's live position |
| Start without a position and number at the first fix or the first save | One more branch on every screen for a case the owner prefers to refuse at the door |
| Keep the tournée on the phone only | A cache wipe, a reinstall or a second phone loses it. That is the same failure as `sentVisits`, and the admin could not see the start or the numbers |
| Put a tournée id on each visit | Changes the visit contract and leaves outbox rows from the current build without one. The agent and the day already identify the tournée |

## Consequences

- An agent sees "Arrêt 16 sur 20" after 15 stops. The count never exceeds the total and never
  resets. The phone, the map and the admin view agree on every number.
- Carnet gives the agent a record of the day and the only way to reopen a stop.
- Every admin number uses one unit. A corrected visit replaces the earlier outcome in the
  stats, and the history keeps both.
- "Agents en tournée" is true from the swipe, before the first visit.
- **Harder:** a phone whose GPS fails cannot start the day in T1. The agent calls the admin.
  If that happens in practice, a later decision can let the admin start a tournée for them.
- **Harder:** a swipe made offline freezes the tournée from the phone's last pull. Stops
  assigned since then join at the end with the next numbers, not in distance order.
- **Harder:** every dashboard figure changes meaning at once. The data stage is disposable, so
  no old figure needs to match.
- Two new tables, new sync fields and a version bump. The start screen and Carnet count
  against the 1,000 KiB field precache ceiling
  ([ADR-0031](0031-the-precache-ceiling-counts-every-precached-entry.md)).
- The tournée rows hold no position, so the retention sweep
  ([ADR-0023](0023-retention-by-redaction.md)) gains no table.
- **Follow-up docs, in the change that implements each part:** `docs/domains/field-operations.md`
  (tournée, gates, counter, Carnet), the `round-placement.md` spec, `docs/design.md` (including line
  1723), `EXPERIENCE.md`, `docs/api.md`, `docs/data-model.md`, the comment at
  `useAgentPosition.ts:10`, and the glossary (Tournée, Arrêt, Carnet, door-day).
- #492 ships first as a stopgap. This decision replaces it.
