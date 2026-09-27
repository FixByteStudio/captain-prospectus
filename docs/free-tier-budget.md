# Free-tier budget

Limits change. **Re-verify on the vendors' pricing pages before relying on them**, and update the "checked" date.

| Service | Free limit (as understood) | Our expected usage | Headroom |
|---|---|---|---|
| Workers requests | 100,000 / day | ~2 agents × ~200 syncs + admin polling ~2,000 ≈ 3,000 / day | ~30× |
| Worker CPU per request | **10 ms** (hard limit, free plan) | a sync is a few ms; see watch-outs | thin — measure |
| Static asset requests | free and unlimited, *if the Worker is not invoked for them* | the whole PWA shell | n/a |
| D1 storage | 5 GB | < 50 MB in year one | large |
| D1 rows read | 5 M / day (**enforced**: queries fail past it) | low tens of thousands | large |
| D1 rows written | 100 k / day (**enforced**) | imports up to a few thousand; visits ~100 | large |
| Cloudflare Access | Free Zero Trust plan, seat-capped | 3–4 users | large |
| Overpass API | Public, fair-use | a few queries per week, cached 7 days | fine if cached |
| Google Places — Nearby Search **Pro** | Per-SKU monthly free call count; Google retired the universal $200 credit in March 2025 | one call per map search, cached 7 days; a few dozen a month | **verify in the Cloud console** |
| OSM tiles | Public, fair-use, attribution required | light admin use | fine |
| GitHub Actions | Free minutes for private repos | a few minutes per PR | fine |

Checked: 2026-09-22 (from public sources, to be confirmed on official pricing pages).

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
- **Tableau de bord's query plans** (GH #113, `EXPLAIN=1` on the same script). Ten statements at
  GH #113, eleven since GH #177, the
  largest with 11 bound parameters. Every range read on `visits` — Visites and its previous period,
  Visites dans le temps, Convertis and the rate, the Convertis series, the agents' visits and
  Convertis — is a `SEARCH visits USING INDEX visits_visited_idx (visited_at>? AND visited_at<?)`
  (a covering index for Visites), with each joined prospect found by primary key. Prospects
  ouverts and Relances dues search `prospects_status_idx`; the pipeline and the agents'
  assignments search `prospects_merged_idx`. GH #177 adds one statement, `agentsActiveToday`,
  searching `visits_received_idx (received_at>? AND received_at<?)`.
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

Backups go to an R2 bucket. The free tier is 10 GB of storage and 1 million Class A
operations a month; a weekly export of a database measured in megabytes uses one operation
and a rounding error of the storage. The bucket's lifecycle rule expires objects after 90
days, so the total never grows.
