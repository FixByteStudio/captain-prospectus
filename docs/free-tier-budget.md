# Free-tier budget

Limits change. **Re-verify on the vendors' pricing pages before relying on them**, and update the "checked" date.

| Service | Free limit (as understood) | Our expected usage | Headroom |
|---|---|---|---|
| Workers requests | 100,000 / day | ~2 agents × ~200 syncs + admin polling ~2,000 ≈ 3,000 / day | ~30× |
| Worker CPU per request | **10 ms** (hard limit, free plan) | a sync of a few visits is a few ms; a full 200-visit batch is over (see watch-outs) | **over at a full sync batch** (GH #404) |
| Static asset requests | free and unlimited, *if the Worker is not invoked for them* | the whole PWA shell | n/a |
| D1 storage | 5 GB | < 50 MB in year one | large |
| D1 rows read | 5 M / day (**enforced**: queries fail past it) | low tens of thousands | large |
| D1 rows written | 100 k / day (**enforced**) | imports up to a few thousand; visits ~100 | large |
| Cloudflare Access | Free Zero Trust plan, seat-capped | 3–4 users | large |
| Overpass API | Public, fair-use | a few queries per week, cached 7 days | fine if cached |
| Google Places — Nearby Search **Pro** | Per-SKU monthly free call count; Google retired the universal $200 credit in March 2025 | one call per map search, cached 7 days; a few dozen a month | **verify in the Cloud console** |
| OSM tiles | Public, fair-use, attribution required | light admin use | fine |
| GitHub Actions | Free minutes for private repos | a few minutes per PR | fine |

Checked: 2026-10-09 (the Workers requests, CPU and D1 rows read, written and storage figures against Cloudflare's D1 pricing and Workers limits pages; the other rows are as of 2026-09-22 and unconfirmed).

## Own login (ADR-0029)

Each figure follows from a constant or query on `main`, named in brackets. The estimate is the table's ~3,000 requests a day.

- **Reads.** Every authenticated request looks its session up: `sessions` by primary key, joined to `users`
  by primary key, so 2 rows (`identityFromSession`, `src/worker/auth.ts`). 3,000 × 2 = 6,000 rows a day,
  0.12 % of 5 M. A request with no cookie reads nothing.
- **Writes.** A session slides at most once an hour (`SESSION_SLIDE_MS`, `src/worker/session.ts`): one row,
  so at most 24 a day per live session, about 100 for four. A sign-in writes the session (D1 counts its three
  indexes too: 4 rows), the spent code (1), the attempt reservation (2 the first time in a window, plus 1 for
  the refund when the login succeeds): at most 8 (`routes/auth.ts`, `login-throttle.ts`). A failed login
  keeps its reservation: 1 write, and at most `LOGIN_MAX_FAILURES` (10) per IP per `LOGIN_WINDOW_MS` (15 min),
  because a locked IP's requests write nothing. With 10 sign-ins a day this is roughly 200 rows, 0.2 % of
  100 k. The nightly sweep's deletes stay bounded by `AUTH_SWEEP_BATCH` (see below).
- **CPU.** A request with a session cookie costs one HMAC-SHA-256; the imported key is cached in module scope
  (`hmacKey`, `session.ts`), so there is no key import. A sign-in does 3 to 5 HMACs (the IP, the credential,
  the new token; break-glass adds a second to compare). D1 time is not billed. **Not measured**: unlike the
  dashboard's below, no script times a sign-in, so the 10 ms watch-out is argued, not shown.
- **The exposed request quota.** While Access fronts the hostname (phases 1 and 2) it refuses anonymous
  requests before the Worker runs. Once it is gone, anonymous `/api/auth/*` requests run the Worker and count
  against the 100,000 a day **even when they get 429**; the D1 throttle cannot prevent that, because the
  request is already counted. **Residual risk, recorded**: until the question of a free WAF rate-limiting rule
  in front of `/api/auth/*` is answered, before phase 3 (epic-access-removed), a flood can exhaust the day's
  quota and take the app down until midnight UTC. Nothing bills.

## Watch-outs

- **Google Places is the one line here that can actually bill us** (ADR-0020), and the only
  one whose free allowance this file does not state a number for. Per-SKU allowances changed
  in March 2025 and the figures in circulation disagree; the authoritative number is in the
  owner's own Cloud console, under the *Nearby Search Pro* SKU. Read it there before relying
  on headroom.
- **The field mask decides which SKU is billed.** `places.nationalPhoneNumber`,
  `places.internationalPhoneNumber` and `places.websiteUri` are Enterprise-tier on Nearby
  Search; adding one moves every search — including ones that find nothing — onto a smaller
  allowance at a higher price, and nothing in the response would say so. `places.test.ts`
  fails if the mask grows to include them.
- **A cache miss on the Google provider is a charge.** The 7-day TTL is not etiquette there,
  it is the bill; coordinates are rounded to 5 decimals before hashing so a nudged pin is not
  a second search.

- A bug that loops syncs could burn request quota: the client backs off exponentially on errors.
- Row reads count scanned rows: keep the indexes in [data-model.md](data-model.md) and avoid unindexed filters.
  One known exception: the likely-duplicate check on every map search filters `prospects` on a bounding box,
  and there is no index on `lat`/`lng`, so each search scans the whole table. At 3,000 prospects and 30
  searches a day that is 90 k rows, about 2 % of the daily limit. An index on `lat` is the fix if it ever
  is not.
- A second, similar exception: `GET /api/admin/prospects`'s `q` (GH #176) is a `%needle%` `LIKE` on `name`,
  and there is no index on `name` — a leading wildcard would bypass one anyway, so an index would not remove
  the scan. The list's own `WHERE` runs twice per search, once for the page of rows and once for `total`'s
  `count()`, so a search costs that scan twice. Accepted at this project's scale (two agents, one city); it is
  the reason `q` is not offered on the 500-row visits feed as well (INVARIANT 13).
- **The sidebar's badges run the duplicate sweep on every admin page, not just Doublons** (GH #63):
  `AdminSidebar` calls the same `useDuplicates()` the screen does, to keep its count identical. The sweep
  reads ≤ 5,000 rows; at 3,000 prospects and about 20 admin loads a day that is roughly 60 k rows, 1.2 % of
  the daily limit. `useOrphans()` runs the same way and also refetches on every tab focus
  (`refetchOnWindowFocus: true`, no `staleTime`); a non-empty queue additionally scans up to
  `DUPLICATES_SCAN_LIMIT` live prospects for repair candidates, so a busy admin tab with visits waiting to be
  rattached reads meaningfully more than the healthy empty-queue case, which costs only a `count(*)`.
- **CPU, not wall time, is the binding limit.** Waiting on D1 or Overpass is free; `JSON.parse`,
  zod validation, dedupe-key normalisation and crypto are not. This is why the CSV batch is capped
  at 250 rows per request ([ingestion](domains/ingestion.md)) and why the Access JWKS is cached in
  module scope rather than refetched per request.
- **A full sync, measured** (GH #102, 2026-10-11). A `POST /api/agent/sync` of
  `SYNC_VISITS_PER_REQUEST` (200) visits to 200 distinct prospects, with the same shim as
  `measure-dashboard-cpu.mjs` (not committed), on the local seed, alternating the two builds three
  times. Before #102 the status of each prospect was derived with two statements: **439 D1
  statements**, 28.5 ms CPU warm median, 66 ms cold. Now there is one statement per 88 prospects
  (`deriveProspectStatus`, `routes/status.ts`): **42 statements**, of which 40 are the 5-row visit
  inserts, plus 3 for the derivation; 8.6 ms warm median, 14.5 ms worst warm, 37 ms cold. That is
  well inside the 1,000 subrequests to Cloudflare services a Free invocation allows, **but still
  over 10 ms of CPU** (GH #404). A sync of a few visits, the common case, is far below that. The
  derivation reads each named prospect's visits through `visits_prospect_visited_idx` and writes
  one row per prospect, as before.
- **Tableau de bord's CPU, measured** (GH #113, 2026-09-26). `node scripts/measure-dashboard-cpu.mjs`
  runs the Worker, bundled by Vite, in Node's V8 against a copy of the local 180-day seed (303
  prospects, 1,981 visits), with D1's own time taken out, since production does not bill it.
  Nothing else local can say: workerd's inspector samples a request only a few times, and the
  workerd process's CPU also holds the local SQLite. On a Ryzen 9 7900, 200 warm requests a period:
  0.42–0.53 ms median and 3.2 ms worst, at 7, 30 and 90 days. **A cold isolate's first request is
  the thin case**, and the script times and gates it too: 7.9–8.2 ms over three runs (9.9 ms seen
  once), about 4 ms of it the one-time compile any first route pays, the rest the dashboard's own
  code compiled on first use. Re-measure when a statement or a figure is added, and read local
  hardware as an estimate.
- **After GH #177** (`flyersGiven`, `agentsActiveToday`, `followUpsDueSoon`: two folded into
  existing statements, one new, 11 in all). Measured against the pre-change build alternately on the
  same seeded D1, 14 cold first requests each: median 8.14 ms after vs 8.15 ms before (7.80–8.62 vs
  7.76–9.54). Warm medians 0.48–0.61 ms. No measurable change, but the cold request's run-to-run
  noise already reaches about 9.9 ms on either build, so the headroom is under 2 ms: the next figure
  added to G1 should be measured the same way (alternating builds, not one run) and may need its own
  endpoint.
- **After GH #308** (`inactiveAgentProspects`: one new statement, 13 in all). Measured the same way
  on the same seeded local D1 (303 prospects, 1,689 visits), alternating the pre-change build
  (e6e6ffc) and this one, 14 cold first requests each: median 9.28 ms after vs 9.27 ms before
  (8.93–10.46 vs 8.87–11.16). Warm medians 0.56–0.65 ms. No measurable change, but the cold first
  request now reaches about 11 ms on either build, beyond the 10 ms budget on local hardware (GH #341).
- **Tableau de bord's query plans** (GH #113, `EXPLAIN=1` on the same script). Ten statements at
  GH #113, eleven since GH #177, the
  largest with 11 bound parameters. Every range read on `visits` — Visites and its previous period,
  Visites dans le temps, Convertis and the rate, the Convertis series, the agents' visits and
  Convertis — is a `SEARCH visits USING INDEX visits_visited_idx (visited_at>? AND visited_at<?)`
  (a covering index for Visites), with each joined prospect found by primary key. Prospects
  ouverts and Relances dues search `prospects_status_idx`; the pipeline and the agents'
  assignments search `prospects_merged_idx`. GH #177 adds one statement, `agentsActiveToday`,
  searching `visits_received_idx (received_at>? AND received_at<?)`. GH #308 adds one statement
  (thirteen in all), `inactiveAgentProspects`, which searches `prospects_merged_idx
  (merged_into=?)` with a correlated subquery that searches `users` by primary key
  (`sqlite_autoindex_users_1 (email=?)`).
- **D1 free-tier limits are hard-enforced since 2026-09-01.** Past the daily row read/write limit,
  queries fail until midnight UTC with `Your account has exceeded D1's free tier daily row read
  limit` (or `…row write limit`). The sync route must translate that into a clear "retry later"
  message with the outbox left intact — never a generic 500, which an agent would read as data loss.
- **Keep `run_worker_first` as `["/api/*"]`, never `true`.** Static asset requests are free only
  while they do not invoke the Worker. Setting it to `true` puts the whole app shell on the
  100,000/day meter ([ADR-0003](adr/0003-single-cloudflare-worker.md)).

## Cron Triggers and R2 (ADR-0023)

The retention sweep is one scheduled invocation a day. Cron Triggers are included on the
Workers free plan, and one invocation against a 100,000/day request budget is noise. The
sweep is bounded to `RETENTION_BATCH` (500) rows written per run, which keeps it inside
the D1 daily write quota even on the first run after a backlog — the backlog drains over a
few days rather than in one statement.
The same run then deletes expired map-cache rows, bounded to `MAP_CACHE_EVICT_BATCH` (500).
It also deletes expired `login_codes` and `sessions` and finished-window `login_attempts` rows, each
table bounded to `AUTH_SWEEP_BATCH` (500) per run: a flood of failed logins can write a day's request
quota of `login_attempts` rows, and deleting them all at once could use the D1 write quota. There is
no index for it: in normal use the tables hold a few rows per user, so a scan costs a few reads. After a
flood, `login_attempts` is read in full each night until it drains.

Backups go to an R2 bucket. The free tier is 10 GB of storage and 1 million Class A
operations a month; a weekly export of a database measured in megabytes uses one operation
and a rounding error of the storage. The bucket's lifecycle rule expires objects after 90
days, so the total never grows.
