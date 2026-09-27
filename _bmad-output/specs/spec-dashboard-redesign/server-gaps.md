# Server gaps

Every redesign need that today's API, sync contract or data model cannot serve. The spec's non-goal
is **no server change unless it is listed here**. Each row is additive and needs its own go-ahead:
- API changes follow the `add-api-route` skill.
- Sync changes follow the `sync-contract-change` skill.
- Schema changes follow the `d1-migration` skill.
- Anything that meets ADR-0024's bar gets an ADR.

A row marked **Settled: no server change** is kept for traceability and needs no go-ahead.

Everything else in the redesign uses existing endpoints.

| # | Need (CAP) | Why the existing surface falls short | Smallest change | Kind |
|---|---|---|---|---|
| G1 | Dashboard KPIs, chart and per-agent activity (CAP-2) | `GET /api/admin/visits` returns at most 500 rows and filters on `received_at > since`, so it can't page backwards; 30 days already holds 386 visits, and a 90-day period plus its delta needs 180 days. The metrics count on `visited_at`. Nothing stores when a prospect became `converted`. | A read-only `GET /api/admin/dashboard?period=7\|30\|90` that computes the EXPERIENCE.md › Dashboard metrics in SQL. "Became Converti" is derived from `visits.outcome = 'converted'` plus `prospects.status_set_at` for manual changes, so no new column is needed. | API (new route) |
| G2 | The same query within 10 ms of CPU (invariant 13) | No index covers `visits(visited_at)` alone: the existing indexes lead with `prospect_id` or `agent_email`. | Add an index on `visits(visited_at)`. Additive migration. | Data model (index only) |
| G3 | "Relances dues" and "Relances dues sous 7 jours" (CAP-2, CAP-3); the "Voir" link lands on the filtered list | `GET /api/admin/prospects` filters on status, agent and source only. | A `dueBefore=<ms>` query param that filters `next_visit_at`. The counts themselves come from G1. | API (additive param) |
| G4 | Prospect name search in the Prospects filter bar (CAP-3), and later the ⌘K search | There's no text filter on `GET /api/admin/prospects`. | A `q=` param matching the name case-insensitively, bound as a parameter (invariant 7). | API (additive param) |
| G5 | The Visites date range, e.g. "30 derniers jours" (CAP-3) | The feed only takes `since`. The CSV export already has `from` and `to`. | `from` and `to` on `GET /api/admin/visits`, on `received_at` like the export. | API (additive param) |
| G6 | The "Agents en tournée" KPI (CAP-3) | Its first definition was "agents who synced today", but no sync timestamp is stored. | **Settled: no server change.** The KPI is "agents with a visit received today" — distinct `agent_email` over visits whose `received_at` falls today, read from the existing `GET /api/admin/visits` feed or from G1. No sync timestamp is stored. This overrides EXPERIENCE.md › Dashboard metrics. | Definition (no change) |
| G7 | Admin round view ordered from the agent's position (CAP-4) | The server never receives the phone's position. Order is computed on the device. | The phone sends its position at each sync; the server stores the latest per agent with a retention rule. This needs a security review, an ADR, an additive `clientVersion`-safe sync field and a migration. | Sync + data model + ADR |
| G8 | Daily progress "n visites sur N" counts visits already sent (CAP-6) | The outbox deletes accepted rows (invariant 5), and the today list is replaced on each pull, so the phone forgets today's sent visits. | **Settled: no sync change.** The phone keeps a local Dexie log of today's sent visit ids, written when a visit is queued and pruned to today; `n` is that log plus the pending outbox rows, deduplicated by visit id. Client-only Dexie version bump; the outbox still clears only on `accepted`. | Client storage (Dexie only) |
| G9 | Notifications in the admin top bar (CAP-1) | They have no defined content (EXPERIENCE.md open question). | None now. The bell ships without a feed until its content is decided. | Deferred |
| G10 | The Prospects ouverts KPI opens Prospects filtered to open statuses (CAP-2) | `status` on `GET /api/admin/prospects` takes one value, and "open" is three: new, assigned and follow_up. | Let `status` take several values, bound as parameters (invariant 7). Additive: one value behaves as today. | API (additive param) |

**No server change:**
- Pipeline par statut and Prospects ouverts: they can come from G1, or from `total` on `GET /api/admin/prospects?status=…&limit=1`.
- The À rattacher count: `remaining` on `GET /api/admin/visits/orphaned`.
- The Doublons count: `pairs` on `GET /api/admin/prospects/duplicates`.
- Dernières visites: the existing feed.
- Every field screen, the G8 daily progress count included: it is Dexie-only.
- The "Agents en tournée" KPI (G6): the existing visits feed carries it.
