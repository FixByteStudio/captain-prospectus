# Free-tier budget

Limits change. **Re-verify on the vendors' pricing pages before relying on them**, and update the "checked" date.

| Service | Free limit (as understood) | Our expected usage | Headroom |
|---|---|---|---|
| Workers requests | 100,000 / day | ~2 agents × ~200 syncs + admin polling ~4,000 (the live feed, and the recap card on every admin page) ≈ 5,000 / day | ~20× |
| Worker CPU per request | **10 ms** (hard limit, free plan) | a phone's 50-visit sync batch of bare visits is ~5 ms at worst warm (field prospects, notes and answers not measured); an old build's 200-visit batch is over, and a cold isolate's first request can be (see watch-outs) | **over on an old build's full batch, and at times on a cold first request** (GH #404) |
| Static asset requests | free and unlimited, *if the Worker is not invoked for them* | the whole PWA shell | n/a |
| D1 storage | 5 GB | < 50 MB in year one | large |
| D1 rows read | 5 M / day (**enforced**: queries fail past it) | up to a few hundred thousand, most of it the recap card's poll (see watch-outs) | ~10× or more |
| D1 rows written | 100 k / day (**enforced**) | imports up to a few thousand; visits ~100 | large |
| Zone rate-limiting rules | 1 per zone on the Free plan, counted per IP | 1, in front of `/api/auth/*` ([ADR-0035](adr/0035-serve-the-app-on-a-domain-we-already-own.md)) | **none** |
| Custom domain | `fixbyte.cloud`, already owned for other work | one subdomain | no added cost |
| Overpass API | Public, fair-use | a few queries per week, cached 7 days | fine if cached |
| Google Places — Nearby Search **Pro** | Per-SKU monthly free call count; Google retired the universal $200 credit in March 2025 | one call per map search, cached 7 days; a few dozen a month | **verify in the Cloud console** |
| OSM tiles | Public, fair-use, attribution required | light admin use | fine |
| GitHub Actions | Free on standard runners while the repository is public; 2,000 minutes a month if it turns private | a few minutes per push and PR, a deploy per merge, a backup a day | fine |

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
- **The exposed request quota.** No Access application stands in front of the hostname
  ([ADR-0034](adr/0034-launch-on-our-own-login-alone.md)), so anonymous `/api/auth/*` requests run the Worker
  and count against the 100,000 a day **even when its throttle answers 429**; the D1 throttle cannot prevent
  that, because the request is already counted. The zone's rate-limiting rule blocks an IP before the Worker
  runs, so a request it blocks is not counted
  ([ADR-0035](adr/0035-serve-the-app-on-a-domain-we-already-own.md),
  [deployment](deployment.md#one-time-setup-production)). **Residual risk, recorded**: the rule counts per IP,
  so a flood from many IPs can still exhaust the day's quota and take the app down until midnight UTC. Nothing
  bills.

## Watch-outs

- **The sync pull also reads today's door-days and tournée each pass** (`doorDaysOn`, `todayTournee`, ADR-0036), and a request may carry tournées and stops. Not yet measured; `scripts/measure-sync-cpu.mjs` now sends `clientVersion` 2, re-run it before the swipe ships.
- **The recap card polls from every admin page** (`GET /api/admin/recap`, docs/api.md › The
  recap card): 240 requests an hour per visible admin tab (ADR-0010), paused on a hidden one.
  Each call reads about the day's received visits plus the `users` rows, so the cost grows
  through the day: an estimate, not a measurement, of 240 × 8 h × ~100 rows ≈ 200,000 rows a
  day for one tab open all day on a 100-visit day. If D1 reads ever get tight, lengthen this
  poll first; the card's figures do not need 15 s.
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
- A second, similar exception: `GET /api/admin/prospects`'s `q` (GH #176, #188) is a `%needle%` `LIKE` on
  `name_search`, and there is no index on it — a leading wildcard would bypass one anyway, so an index would not remove
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
  at 250 rows per request ([ingestion](domains/ingestion.md)) and why the session HMAC key is
  cached in module scope rather than imported per request (`hmacKey`, `session.ts`).
- **A full sync, measured** (GH #102, 2026-10-11). A `POST /api/agent/sync` of
  `SYNC_VISITS_PER_REQUEST` (200) visits to 200 distinct prospects, with the same shim as
  `measure-dashboard-cpu.mjs` (now `scripts/worker-cpu-shim.mjs`), on the local seed, alternating
  the two builds three times. Before #102 the status of each prospect was derived with two statements: **439 D1
  statements**, 28.5 ms CPU warm median, 66 ms cold. Now there is one statement per 88 prospects
  (`deriveProspectStatus`, `routes/status.ts`): **42 statements**, of which 40 are the 5-row visit
  inserts, plus 3 for the derivation; 8.6 ms warm median, 14.5 ms worst warm, 37 ms cold. That is
  well inside the 1,000 subrequests to Cloudflare services a Free invocation allows, **but still
  over 10 ms of CPU** (GH #404). A sync of a few visits, the common case, is far below that. The
  derivation reads each named prospect's visits through `visits_prospect_visited_idx` and writes
  one row per prospect, as before.
- **So the phone sends 50 visits a pass** (GH #404, 2026-10-12). `node scripts/measure-sync-cpu.mjs`
  times a sync by batch size, one bare visit (no notes, no answers) to each of that many distinct
  prospects and no field prospects, three alternating rounds of 50 warm runs on a Ryzen 9 7900 (two
  runs; the second in brackets). A pass that also carries field prospects (up to
  `SYNC_PROSPECTS_PER_REQUEST`) or visits with notes and answers costs more, and was not measured:

  | visits | warm median ms | warm max ms | cold ms (3 rounds × 2 runs) |
  |---|---|---|---|
  | 1 | 1.18 (1.16) | 4.21 (3.61) | 7.6–14.3 |
  | 25 | 1.91 (1.88) | 4.18 (4.73) | 9.5–12.1 |
  | 50 | 2.50 (2.53) | 4.48 (5.14) | 11.7–16.2 |
  | 100 | 3.97 (4.02) | 7.63 (8.22) | 14.9–25.9 |
  | 200 | 6.70 (6.68) | 10.77 (11.68) | 19.8–25.4 |

  50 keeps the warm worst near 5 ms, where 100's reached 8.2 ms; 25 buys little and doubles the
  passes. So the phone sends `SYNC_VISITS_PER_BATCH` (50) and the server still accepts
  `SYNC_VISITS_PER_REQUEST` (200), which an old build still sends and which still costs what the
  table says. If Cloudflare enforces the limit on such a request, it fails: the old build keeps its
  outbox (INVARIANT 5) and retries with backoff until the PWA update lands, then sends 50 a pass. **A cold isolate's first request can run past 10 ms at any size, one visit included**
  (14.3 ms above): that is compile cost, the dashboard's thin case below, and no batch size fixes
  it, so #404's cold case stays open.
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
- **After GH #341.** The growth was not the dashboard's: bisected across the commits since GH #177,
  cold medians stayed at 8.0–8.3 ms until the identity-access epic, then crept to 9.2 ms (#301
  +0.2, #302/#303 +0.5, #307 +0.3), with every route and table that epic added. Two fixed costs
  scaled with the app, not the request: Hono's default router compiling every route into one regex
  on the first match, and Drizzle rebuilding its relational config from the whole schema on each
  `getDb`, for a `db.query` nothing calls. The Worker now uses `hono/quick` and `getDb` passes no
  schema. Same seeded D1 (313 prospects, 1,690 visits), alternating `main` and this build, 14 cold
  first requests each: median 7.76 ms after vs 9.29 ms before (7.50–8.16 vs 9.09–11.51). Warm
  medians 0.53–0.63 ms, unchanged. Every route's first request gains the same, sync's included.
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
It also folds up to `NAME_SEARCH_FOLD_BATCH` (500) prospect names still missing `name_search`
([ADR-0032](adr/0032-a-stored-folded-name-for-search.md)): the accented backlog once, then only rows the
previous Worker wrote during a deploy. When none are left it costs one scan of `prospects`, a few thousand reads.
It also deletes expired `login_codes` and `sessions` and finished-window `login_attempts` rows, each
table bounded to `AUTH_SWEEP_BATCH` (500) per run: a flood of failed logins can write a day's request
quota of `login_attempts` rows, and deleting them all at once could use the D1 write quota. There is
no index for it: in normal use the tables hold a few rows per user, so a scan costs a few reads. After a
flood, `login_attempts` is read in full each night until it drains.

Backups go to an R2 bucket. The free tier is 10 GB of storage and 1 million Class A
operations a month; the daily export uses one operation. The bucket's lifecycle rule expires
objects after 90 days, so it holds 90 exports: under 4.5 GB if an export stays under 50 MB.
That is an assumption, not a measurement: an export is SQL text, not the database file, so
its size is not the 50 MB of the table above. The `Backup` run logs it. **Watch-out**: past
about 110 MB an export, 90 of them cross the 10 GB and R2 bills the rest. Shorten the
lifecycle rule, or compress the export, before then.
