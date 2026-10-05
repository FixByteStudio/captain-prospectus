# Epic 5 Context: An admin sees any agent's round

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give the admin a read-only Terrain › Tournée du jour screen: pick an agent and see that agent's remaining stops for today as a list and a map, ordered nearest-next from the position the phone last sent at sync. The admin can then tell where a round stands, and move work between agents, without phoning anyone. The server has never held an agent's position before, so this is new personal data. The epic is therefore gated on an ADR (ADR-0028) and a security review, and it must stay inside the product's "no continuous GPS tracking" non-goal.

## Stories

- Story 5.1: ADR-0028: agent position at sync
- Story 5.2: Position stored at sync and served to the admin
- Story 5.3: The phone sends its last reading at sync
- Story 5.4: Today's round rule moves to src/shared
- Story 5.5: Admin Tournée du jour: agent picker and ordered list
- Story 5.6: Admin Tournée du jour: map pane
- Story 5.7: Flow 3 at 1280, 820 and 390, light and dark
- Story 5.8: Refactor sweep

## Requirements & Constraints

- **Success signal:** for an agent who synced today, the list order matches nearest-next from the stored position, and the position's age is shown ("Position du {date heure}"). With no position from today, the list is ordered by name and shows the no-position notice.
- **Not tracking.** The phone sends only the last reading it already took today, with a sync it was making anyway. Sync never calls geolocation, and a phone with no reading from today sends no field. The existing vision line ("position is captured at check-in only") and the glossary must be updated to state the new rule.
- **Retention:** one row per agent. A newer reading overwrites it, an older one never does, and a row not from today is deleted overnight by the retention sweep. A row not from today is served as `null` even before the sweep removes it. "Today" means today in Brussels time.
- **Clock:** the position's captured time is clamped server-side to `received_at`, the same way `visited_at` is (invariant 12).
- **Visibility:** only admins see positions, and only on this screen. The endpoint refuses agent callers (403) and emails that are not assignable agents (404).
- **Sync contract stays additive:** `position` is an optional field on the sync request, so no `clientVersion` bump. A phone on `clientVersion` 1 that sends no position must still sync (invariant 9).
- **Security review:** a security-reviewer verdict is required on the ADR (5.1) and on the location code diffs (5.2, 5.3) before they merge.
- **Same stops as the agent:** the admin sees exactly the stops the agent's Tournée shows for today, and no Plus tard group.
- **Docs in the same change:** `docs/design.md` (admin round view section, CAP-11), `docs/api.md`, `docs/data-model.md` and `docs/domains/field-operations.md` (which today says agent-position retention is undecided).

## Technical Decisions

- **ADR-0028 is required.** Retention of personal data and a change to the sync wire contract both meet the bar for an ADR. It must reconcile the new data with:
  - invariant 2: the position row belongs to the agent and is not shared prospect data;
  - invariant 4: the write is idempotent;
  - invariant 12: the captured time is clamped.
  ADR-0023 is the precedent: personal location data is minimised, and the clock is `received_at`, not the phone's. The ADR also decides whether the admin map shows the exact position dot or only its age.
- **Storage (5.2):** a new `agent_positions` table with `agent_email` as primary key and `lat`, `lng`, `accuracy`, `captured_at`, `received_at`. Generate it with `pnpm db:generate` (expand/contract, `d1-migration` skill). The upsert is conditional, so an older `captured_at` never replaces a newer one. Deleting rows not from today is added to the existing retention sweep.
- **Wire contract:** `syncRequestSchema` gains an optional `position` (zod/mini). A new endpoint, `GET /api/admin/agents/:email/round`, returns `{prospects, position: {lat, lng, accuracy, capturedAt} | null}`, where `prospects` are the same open assigned prospects the sync pull returns. Stories 5.5 and 5.6 build on this shape.
- **Client (5.3):** the last reading `useAgentPosition` took is kept outside React state and outside Dexie, and `runSync` attaches it only when it is from today. Report the field precache total against the 1,000 KiB ceiling (ADR-0026).
- **Shared rule (5.4):** the pure stop-selection part of `buildTodayList` (due today, kept for today, Plus tard, as left by story 4.14) moves into `src/shared` with no DOM or Dexie inputs. The admin passes empty outbox and queued arrays. The field's behaviour must not change.
- **Order:** the admin list uses the shared rule's order from the stored position, with no second sort. With no position, it sorts the rule's stops by name and shows no distances.
- **Map (5.6):** reuses `RoundMap`, `mapPins` and `walkingPath`, with selection and recentre made optional. The admin chunk stays out of the field precache (ADR-0019). The field Carte must not change.

## UX & Interaction Patterns

- **Route and entry point:** `/admin/tournee` under Terrain in the admin nav.
- **Header:** an agent Select fed by `GET /agents`, with the position age beside it in meta, and the title "Tournée du jour" with "{n} arrêts".
- **Two panes:** the stop list on the left and the map on the right. Rows and pins look like the field's stop rows and Carte pins, with the number, name, "type · address", status badge and distance.
- **Read-only:** no Visiter or Y aller on any row, no swipes.
- **Map:** numbered pins in the list's order, the dashed walking path, the position marker per ADR-0028, and Leaflet's attribution "© les contributeurs OpenStreetMap" (invariant 11).
- **No-position state:** the notice "Aucune position reçue aujourd'hui. La tournée est triée par nom.", a name-ordered list with no distances, and the age shown wherever a position appears.
- **Copy:** every French string goes in `copy.ts`.
- **Design reference:** `mockups/key-admin-round.html`, and EXPERIENCE.md Flow 3 (the admin opens Terrain › Tournée du jour mid-afternoon, picks an agent, reads the stops left, and reassigns follow-ups). Story 5.7 screenshots it at 1280, 820 and 390 px, in light and dark, in both states.

## Cross-Story Dependencies

- 5.1 (ADR, needs a person in the loop) comes before 5.2. 5.2 is the tracer bullet: sync, then D1, then the admin API.
- 5.3 waits on 5.2.
- 5.4 waits on story 4.14 (merged) and can run beside 5.2 and 5.3.
- 5.5 waits on 5.2, 5.4 and story 3.1 (admin shell and nav).
- 5.6 waits on 5.5 and reuses epic 4's (field screens) Carte map, pin and stop-row components.
- 5.7 (needs a person in the loop) waits on 5.3 and 5.6, using a seeded local build with a phone sync that carries a position.
- 5.8 comes last: cleanup only, scoped from the findings deferred during this epic.
