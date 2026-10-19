# Free-tier budget

Limits change. **Re-verify on the vendors' pricing pages before relying on them**, and update the "checked" date.

| Service | Free limit (as understood) | Our expected usage | Headroom |
|---|---|---|---|
| Workers requests | 100,000 / day | ~2 agents × ~200 syncs + admin polling ~4,000 (the live feed, and the recap card on every admin page) ≈ 5,000 / day | ~20× |
| Worker CPU per request | **10 ms** (hard limit, free plan) | a phone's 50-visit sync batch of bare visits is ~3 ms median and ≤5.7 ms worst warm through the session; a pass is also capped at `SYNC_BYTES_PER_BATCH` (384 KiB), so visits with full notes and answers go 11 a pass at ~3.7 ms median and ≤5.4 ms worst (50 of them, 1.7 MB, were ~10 ms median, GH #450); 100 field prospects add ~1.5 ms since GH #449 (~4 ms before); the server refuses more than 50 visits, since 200 peaked at ~11 ms (GH #451); a cold isolate's first request is 9–12 ms locally for one visit (over 10 ms in some rounds) and 13–17 ms for 50 (over 10 ms in every round), once per isolate; no production figure yet (Watch-outs, « A byte budget per pass », « The cold first request, measured fairly ») | **over at its worst on the morning pass of 100 field prospects and the swipe's stops (GH #577); a cold first request is over 10 ms locally in every round at 50 visits and in some at one visit, unmeasured in production** (GH #404) |
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
  the new token; break-glass adds a second to compare). D1 time is not billed. The cookie's HMAC and the session lookup are in the
  sync and dashboard figures below (since GH #415 both scripts authenticate through a seeded session, not
  `DEV_USER_EMAIL`). **Not measured**: no script times a sign-in's 3 to 5 HMACs, so that part of the 10 ms
  watch-out is argued, not shown.
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

- **The sync pull also reads today's door-days and tournée each pass** (`doorDaysOn`, `todayTournee`,
  ADR-0036), and a request may carry tournées and stops. Measured 2026-10-16, signed in through
  `DEV_USER_EMAIL` (the session path is in the figures of « Sync through the session »), with
  `TOURNEE=pull|swipe node scripts/measure-sync-cpu.mjs` on a Ryzen 9 7900 (`lscpu`: AMD Ryzen 9 7900
  12-Core), as in the table under « So the phone sends 50 visits a pass »: two runs, the second in
  brackets. `pull` finds today's tournée with 200 stops already stored; `swipe` also sends that tournée
  and its 200 stops (the morning pass). `none` is the same script without `TOURNEE`:

  | mode | visits | warm median ms | warm max ms | cold ms (3 rounds) |
  |---|---|---|---|---|
  | none | 1 | 1.34 (1.30) | 3.70 (7.34) | 9.0–15.9 |
  | none | 50 | 2.74 (2.76) | 4.70 (4.70) | 12.9–15.5 |
  | pull | 1 | 1.54 (1.57) | 3.43 (3.17) | 9.6–18.1 |
  | pull | 50 | 3.12 (3.05) | 6.11 (5.49) | 13.6–37.1 |
  | swipe | 1 | 4.40 (4.42) | 8.02 (7.33) | 18.0–33.9 |
  | swipe | 50 | 5.59 (5.74) | 8.00 (7.89) | 20.8–23.8 |

  The warm figures stay under 10 ms in every mode, the swipe pass included (8.6 ms at worst over a
  third run, after the script took its tournée from a real swipe instead of a seeded row), so
  INVARIANT 13 holds for the warm case of bare visits (heavier payloads are in « Sync through the session »). A cold isolate's first request runs past 10 ms in every mode,
  `none` included, and the swipe's reaches 33.9 ms: the cold case stays with #404.
  *Added 2026-10-19: the worst cold round of the first size in each earlier table (one visit, with
  the default `SIZES`) may include round 0's inflation (Node's own first use, about 5 ms); see
  « The cold first request, measured fairly ».*
- **The recap card polls from every admin page** (`GET /api/admin/recap`, docs/api.md › The
  recap card): 240 requests an hour per visible admin tab (ADR-0010), paused on a hidden one.
  Each call reads about the day's received visits plus the `users` rows, so the cost grows
  through the day: an estimate, not a measurement, of 240 × 8 h × ~100 rows ≈ 200,000 rows a
  day for one tab open all day on a 100-visit day. « Actifs aujourd'hui » adds a third
  statement (`agentsStartedOn`): one index probe on `tournees_agent_day_started_idx` per active user,
  a handful of rows, which does not grow through the day. If D1 reads ever get tight, lengthen this
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
  200 visits, then the server's accept limit, to 200 distinct prospects, with the same shim as
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
  runs; the second in brackets), signed in through `DEV_USER_EMAIL`. A pass that also carries field
  prospects (up to `SYNC_PROSPECTS_PER_REQUEST`) or visits with notes and answers costs more, and is
  measured in the next entry:

  | visits | warm median ms | warm max ms | cold ms (3 rounds × 2 runs) |
  |---|---|---|---|
  | 1 | 1.18 (1.16) | 4.21 (3.61) | 7.6–14.3 |
  | 25 | 1.91 (1.88) | 4.18 (4.73) | 9.5–12.1 |
  | 50 | 2.50 (2.53) | 4.48 (5.14) | 11.7–16.2 |
  | 100 | 3.97 (4.02) | 7.63 (8.22) | 14.9–25.9 |
  | 200 | 6.70 (6.68) | 10.77 (11.68) | 19.8–25.4 |

  50 keeps the warm worst near 5 ms, where 100's reached 8.2 ms; 25 buys little and doubles the
  passes. So the phone sends `SYNC_VISITS_PER_BATCH` (50). Since GH #451 the server accepts no more
  either: 200 cost what the table says, and the session run below confirmed it over 10 ms. A build
  from before then gets 426 and updates with its outbox kept (INVARIANT 5). **A cold isolate's first request can run past 10 ms at any size, one visit included**
  (14.3 ms above): that is compile cost, the dashboard's thin case below, and no batch size fixes
  it, so #404's cold case stays open.
- **Sync through the session, with heavy visits and field prospects** (GH #415, #449, #450, 2026-10-18).
  `node scripts/measure-sync-cpu.mjs` now signs in as production does: a seeded `sessions` row, its
  `__Host-cp_session` cookie and `AUTH_PEPPER`, with `DEV_USER_EMAIL` unset. Every timed request answers
  200 and has stored what it sent. Ryzen 9 7900 (`lscpu`: AMD Ryzen 9 7900 12-Core), local seed (313
  prospects, 1,690 visits), 3 alternating rounds of 50 warm runs, two runs (the second in brackets), D1's
  time taken out. `PAYLOAD=full` is a 2,000-character accented note, the active script's id and 50 mixed
  answers (10 each of yes/no, number, short text, 2,000-character text, 30 options); `PAYLOAD=max` is the
  heaviest body the server accepts (50 answers of `LONG_TEXT_MAX`, keys at their cap), as many visits as
  fit `MAX_REQUEST_BYTES`. Bytes are the request body (the 2 MiB cap is 2,048 KiB):

  | command | visits | KiB | warm median ms | warm max ms | cold ms (3 rounds) |
  |---|---|---|---|---|---|
  | `SIZES=1,50,200` | 1 | 0.2 | 1.54 (1.46) | 2.98 (3.07) | 9.2–16.0 (9.7–16.0) |
  | | 50 | 8.7 | 3.04 (2.95) | 5.58 (5.05) | 12.9–14.7 (12.9–13.3) |
  | | 200 | 34.8 | 7.50 (7.26) | 11.06 (10.82) | 23.4–26.9 (22.5–26.1) |
  | `SLIDE=1 SIZES=50` | 50 | 8.7 | 3.11 (3.22) | 5.72 (5.42) | 14.1–21.6 (14.1–21.6) |
  | `PAYLOAD=full SIZES=50` | 50 | 1,673 | 10.04 (9.89) | 39.48 (40.08) | 30.1–53.8 (34.4–54.5) |
  | `PAYLOAD=max` | 19 | 1,995 | 6.55 (6.60) | 35.79 (35.74) | 17.8–21.0 (18.0–23.1) |
  | `PROSPECTS=100 SIZES=50` | 50 | 33.7 | 6.80 (7.11) | 14.48 (13.42) | 21.4–35.7 (22.0–32.6) |
  | `PROSPECTS=100 PAYLOAD=full TOURNEE=swipe SIZES=50` | 50 | 1,734 | 17.54 (18.09) | 52.82 (60.28) | 54.9–70.3 (48.6–66.2) |

  What it says. The session path costs about 0.2–0.3 ms warm against the 2026-10-16 run (bare 50 visits:
  2.7 ms signed in as the dev user, 3.0 through the session), not a same-session comparison; a slid
  session adds a negligible amount (0.1–0.3 ms, within run-to-run noise, `SLIDE=1`). The phone's
  50-visit batch of bare visits stays well under 10 ms warm, but **50 visits with full notes and answers
  do not**: the median sits at 10 ms, because the batch is 1.7 MB of JSON to parse and validate and
  `SYNC_VISITS_PER_BATCH` bounds the count, not the bytes (`PAYLOAD=max` fits only 19 visits under the
  cap and still has a 6.6 ms median). The 35–60 ms warm tails on the multi-MB payloads are garbage collection of earlier requests' garbage
  landing in the timed window (see the byte-budget entry below, which also corrects the full-`gc()` probe
  first recorded here). A local run cannot say how
  Cloudflare's meter counts any of it. 100 field prospects ride on 50 bare visits at 7 ms median and
  13–14.5 ms worst, and the morning pass (100 prospects, full visits, the swipe's 200 stops) is 18 ms
  median. **A cold first request runs past 10 ms in most rounds at every size**: one visit is 9.2–16.0
  ms. The dedupe lookup of GH #449 is `chunk(keys, 1)`, which is 100 keys a statement (`chunk` takes
  columns per row), so 100 field prospects are one lookup statement, not 100. Where their cost went,
  and what fixed it, is in « Field prospects in a sync » below; the 100-prospect rows of this table are
  the figures from before that fix.
  The 200-visit row, over 10 ms warm at its worst and 22–27 ms cold, is why the server's accept limit fell
  to `SYNC_VISITS_PER_BATCH` (GH #451); the script now refuses `SIZES` above 50, as the server does.
- **Field prospects in a sync** (GH #449, 2026-10-18). The issue assumed the dedupe lookup was the
  cost; it is one statement for 100 keys. Profiling `PROSPECTS=100 SIZES=50` by phase put the ~4 ms
  that 100 field prospects add (6.8 ms median against 3.0 ms for the same 50 visits bare) in **the
  prospect insert, ~2.9 ms**, of which ~2.1 ms was Drizzle's builder assembling 25 statements of 4 rows
  by 23 columns (~1 µs per bound value). `foldForSearch` plus `dedupeKey` cost 0.13 ms, the lookup
  0.22 ms, zod about 0.17 ms more and the larger pull about 0.2 ms. The fix is a cheaper insert, not a
  smaller cap: `insertOrIgnore` (`src/worker/db/client.ts`) builds one `insert ... on conflict do
  nothing` per 5 rows of the 18 columns the route sets (90 bound parameters, INVARIANT 7), typed from
  the schema, and sends them in one `d1.batch`. Same machine and method as the entry above (Ryzen 9
  7900, local seed, 3 alternating rounds of 50 warm runs, D1's time taken out), two runs, the second in
  brackets, measured back to back on the same checkout:

  | command | build | warm median ms | warm max ms | cold ms (3 rounds) |
  |---|---|---|---|---|
  | `PROSPECTS=100 SIZES=50` | before | 6.99 (7.42) | 14.02 (18.06) | 22.6–37.9 (25.3–36.7) |
  | | after | 4.70 (4.70) | 7.74 (7.07) | 17.0–32.6 (18.8–30.4) |
  | `SIZES=50` | after | 3.17 (3.33) | 5.19 (6.88) | 13.6–22.6 (14.4–21.9) |

  The warm worst of 100 field prospects on 50 bare visits falls from 13.4–14.5 ms (GH #563) to
  7.1–7.7 ms, inside 10 ms; the median to 4.7 ms. Bare visits alone are unchanged (the `SIZES=50` row
  is the same work as before; its 3.2 ms against the 3.0 ms above is run-to-run noise). The cold first
  request stays past 10 ms (GH #404), and the visit insert is the same builder: its cost is a
  follow-up, not part of this entry. A local run cannot say how Cloudflare meters it.
- **The cold first request, measured fairly** (GH #404, 2026-10-19). Every earlier cold figure above came
  from `scripts/measure-sync-cpu.mjs`, whose round 0 of the first size was also the Node process's
  first `Request` body read, first WebCrypto HMAC and first call into the shim: Node compiles its own
  JS `Request`, streams and WebCrypto, which workerd implements natively, so a Cloudflare isolate does
  not pay it. Later sizes ran in an already-warm process (and `TOURNEE=pull` was warmed by its seed
  request), so the fix changes only the first size's round-0 cold sample: about 5 ms in the table
  below (one visit, 16.7 to 11.8), about 6–7 ms in the fresh-process harness (18.6 against 11.7). The
  script now imports the bundle once under `?warmup` and
  runs 3 untimed requests first (after the `TOURNEE=pull` seed), so every timed cold round is a fresh
  import's first request in a warm process. Ryzen 9 7900 (`lscpu`: AMD Ryzen 9 7900 12-Core), Node v24.21.0 (a fresh Node import is a proxy for workerd's cold request, not the same thing), local
  seed (303 prospects, 1,689 visits, plus the script's 200 assigned ones), D1's time taken out,
  `SIZES=1,25,50 ROUNDS=5` (5 cold rounds, 5 x 50 warm runs a size), two runs, the second in brackets,
  and the same command on the script before the fix, on the same checkout:

  | visits | warm median ms | warm max ms | cold ms (5 rounds), fixed | cold ms (5 rounds), before |
  |---|---|---|---|---|
  | 1 | 1.48 (1.50) | 4.20 (2.92) | 9.2–11.8 (9.4–11.7) | 9.5–16.7 |
  | 25 | 2.33 (2.27) | 4.29 (4.71) | 9.2–11.1 (10.3–11.3) | 10.8–12.9 |
  | 50 | 3.09 (3.01) | 5.42 (5.61) | 13.0–16.5 (13.6–15.9) | 13.4–15.2 |

  `SIZES=1,50 ROUNDS=5` gives 9.2–11.5 and 13.7–15.0. No cold round is more than 3 ms above its size's
  cold median. The warm figures are those of the earlier entries (same seed, 200 assigned prospects,
  same flags). The cold excess over warm is 8–10 ms at one visit and 10–13 ms at 50, local, once per
  isolate.

  What the investigation found (a throwaway harness, not committed, running this script's request and
  shim: one fresh Node process per sample, an untimed import plus 3 requests to warm Node and the shim,
  then a second import as the cold isolate; 8 samples per cell, builds alternated as in GH #341):

  | build | cold 1 visit | cold 50 visits | warm median 1 / 50 |
  |---|---|---|---|
  | `main` | 11.7 ms (10.6–12.5) | 15.8 (14.6–16.6) | 1.6 / 3.3 |
  | pull selects the 14 wire columns | 11.2 (10.7–12.1) | 14.6 (12.8–16.0) | 1.5 / 3.3 |
  | pull read raw (`toSQL` + `D1.raw()`) | 9.3 (8.3–10.3) | 15.1 (14.5–16.3) | 1.3 / 3.1 |

  - **Node's share.** A truly fresh process measures 18.6 ms for one visit (8 samples): about 6 ms of it
    is Node compiling its own JS `Request`, streams and WebCrypto, which is why the script warms first.
  - **No GH #341-style fixed cost.** Hono's router, `getDb`, the session HMAC key and zod's JIT are each
    under 0.3 ms or absent: zod/mini objects never JIT. Re-importing the same source does not reuse
    compiled code (same-source and distinct-source re-imports give equal figures), so the script's
    fresh imports are honest cold samples.
  - **The excess is the sync's own code running once in V8's interpreter.** Profiled, that is Drizzle's
    SQL builder and `is()` checks (about 40 %, mostly the 50-row visit insert, GH #565), the pull's row
    mapping (about 1.9 ms at 272 rows), then zod and Hono.
  - **Two measured options, not shipped.** Selecting only the 14 columns `toWireProspect` keeps, instead
    of `openAssignedProspects`' 23 (`src/worker/round.ts`, also used by `routes/admin.ts`), moves the
    cold medians by about 0.5 ms at one visit and 1.2 ms at 50. Reading the pull raw (`toSQL` +
    `D1.raw()`) by about 2.4 ms at one visit and 0.7 ms at 50. Only the raw read at one visit (8.3–10.3
    against `main`'s 10.6–12.5) separates from `main`; the other three differences are inside the 8-sample
    ranges' overlap. ADR-0005 makes Drizzle the access layer and allows the exception only for a hot
    multi-row insert (`insertOrIgnore`), so the raw read needs an amendment first.
  - **Cloudflare's limits page** says: "Each isolate has some built-in flexibility to allow for cases
    where your Worker infrequently runs over the configured limit."
    (https://developers.cloudflare.com/workers/platform/limits/#cpu-time, read 2026-10-18.) How often
    this app's isolates start cold has not been measured, and the quote does not exempt cold starts.

  **GH #404 stays open until Cloudflare's p50, p99 and max CPU time for `POST /api/agent/sync` are
  pasted here**: no production figure exists, and a local run cannot say how Cloudflare meters it.
  `scripts/measure-dashboard-cpu.mjs` gates on a cold sample that is its process's first request, with
  the same inflation; it is tracked apart (GH #568).
- **A byte budget per pass** (GH #450, 2026-10-18). `SYNC_VISITS_PER_BATCH` bounds the count, so
  `SYNC_BYTES_PER_BATCH` (384 KiB, `src/shared/constants.ts`) bounds the bytes: `serializeWithinCap`
  (`src/client/field/sync.ts`) fills a pass with as many visits as fit, always sends the first visit
  whatever its size (INVARIANT 5), and never drops field prospects. `MAX_REQUEST_BYTES` stays 2 MiB: one
  worst-case visit is ~105 KiB, so the server cap never binds a current phone. A phone-side budget, so no
  contract change and no version bump. Same machine, seed and script as « Sync through the session ». `PAYLOAD=full`, warm, 3 rounds × 50 runs. Two ways to keep the harness's
  garbage out of the timed window, because **the probe recorded in « Sync through the session » was wrong**: a full
  `gc()` before each request (`node --expose-gc` as first used) adds ~3.5 ms to *every* request, a one-visit
  one included (bare 1 / 50 visits: 5.1 / 8.3 ms median against 1.5 / 3.0 without), since it leaves the next
  request cold. So « still over 10 ms with GC taken out » at 50 full visits was partly the probe.
  `node --expose-gc` now runs a *minor* collection before each request; `SETTLE=1` also runs a full
  collection and one untimed request of the same size first, which is the cleanest worst case. Medians
  from two runs (the second in brackets); worst is `SETTLE=1`, max of two runs:

  | visits | KiB | median ms, minor GC | median ms, `SETTLE=1` | warm worst ms, `SETTLE=1` |
  |---|---|---|---|---|
  | 1 | 33.5 | 1.80 (1.66) | 2.29 (2.19) | 4.5 |
  | 5 | 167 | 2.48 (2.29) | 2.85 (2.77) | 13.8 |
  | 10 | 335 | 3.31 (3.06) | 3.57 (3.52) | 5.6 |
  | 11 | 368 | 3.13 (3.26) | 3.72 (3.66) | 5.4 |
  | 12 | 402 | 3.41 (3.63) | 3.92 (3.80) | 7.1 |
  | 15 | 502 | 3.75 (3.88) | 4.50 (4.53) | 7.2 |
  | 20 | 669 | 4.51 (4.72) | 5.16 (5.22) | 8.6 |
  | 30 | 1,004 | 6.03 (6.01) | 5.97 (6.41) | 10.8 |
  | 50 | 1,673 | 8.80 (8.67) | 9.83 (9.57) | 57.4 |

  384 KiB is 11 of these visits (368 KiB; 12 are 402 KiB): median 3.1–3.7 ms and worst 5.3–5.4 ms,
  where 12 reach 6.1–7.1 ms. That is the largest whole number of visits under ~6 ms warm worst; the 5-visit
  13.8 ms worst is one outlier in a run of 40 that neither neighbouring size repeats. `PAYLOAD=max` (105
  KiB a visit) at the budget is 3 visits, 315 KiB: 2.6–2.7 ms median, 4.7 ms worst, one `SETTLE=1` run
  and one minor-GC run, not two. Bare visits are unchanged (50 visits, 8.7 KiB, 3.0 ms median). **The
  morning pass is not a byte problem**: `PROSPECTS=100 PAYLOAD=full TOURNEE=swipe`, after GH #449's fix
  (2026-10-19), is 6.3–6.4 ms median at 1 visit and 7.8 at 9 (363 KiB) with minor GC, two runs, and
  9.0 / 10.4 ms with `SETTLE=1`, one run; its worst is 11–15 ms with `SETTLE=1`. 1 visit costs almost as
  much as 9, so the 100 field prospects and the swipe's 200 stops cost it, not the visits' bytes (GH #577). The cold first request is
  « The cold first request, measured fairly »'s, which the budget does not change. The phone now drains heavy visits 11 a pass:
  `MAX_DRAIN_PASSES` comes from the count, so 1,200 of them take more than one trigger and the rest wait
  for the next heartbeat. Local hardware is not Cloudflare's meter: keep headroom.
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
- **After ADR-0036's door-days** (story 1.10, #506: six statements read `doorDaysBetween`, a
  window over agent, prospect and day, instead of `visits` directly; still 13 statements, the
  largest now 20 bound parameters). `measure-dashboard-cpu.mjs` on the local seed (303 prospects,
  1,689 visits), 200 warm requests a period: Worker medians 0.62, 0.64 and 0.75 ms and worst
  1.8 ms at 7, 30 and 90 days; one cold first request 7.62 ms. The window work runs in D1, which
  Workers do not bill: its time per request rose to a median 2.4, 6.8 and 14.9 ms at 7, 30 and
  90 days on this machine (the script prints it, "not billed"). The rows read are the same range
  reads as before, so the D1 daily read quota is unchanged; the extra is query time, and the
  dashboard still is not polled.
- **The Visites feed reads door-days** (ADR-0036 R13, #507: `doorDaysTouched`, two statements,
  the largest with 5 bound parameters; the second reads every visit of up to 500 door-days through
  `json_each` over one bound JSON array, each door-day a `visits_prospect_visited_idx` search).
  Timed with `worker-cpu-shim.mjs` as above, on the local seed (303 prospects, 1,690 visits), an
  unscoped `GET /api/admin/visits` (500 visits, 499 door-days over 36 Brussels days, a 325 KB
  answer), alternating the pre-change build (64a718c) and this one seven times: cold first request
  median 9.01 ms after vs 8.62 ms before (8.72–9.47 vs 8.29–10.18), warm median 2.2 ms vs 0.81 ms,
  warm worst 6.0 ms vs 4.0 ms. A 30- or 90-day seed is 2.1–2.2 ms warm median, and a poll with
  nothing new 0.09 ms. The warm extra is the larger answer (every visit of each door-day) and the
  Brussels day of each visit, computed in the Worker. Inside the budget, but the cold first request
  leaves about 1 ms of headroom on local hardware, as on other routes (GH #404).
- **Tableau de bord's query plans** (GH #113, `EXPLAIN=1` on the same script). Ten statements at
  GH #113, eleven since GH #177, the
  largest with 11 bound parameters (20 since ADR-0036; the plans below are the pre-door-day ones, each range read
  is still one `visits_visited_idx` search, now feeding a window in a `USE TEMP B-TREE FOR ORDER BY`). Every range read on `visits` — Visites and its previous period,
  Visites dans le temps, Convertis and the rate, the Convertis series, the agents' visits and
  Convertis — is a `SEARCH visits USING INDEX visits_visited_idx (visited_at>? AND visited_at<?)`
  (a covering index for Visites), with each joined prospect found by primary key. Prospects
  ouverts and Relances dues search `prospects_status_idx`; the pipeline and the agents'
  assignments search `prospects_merged_idx`. GH #177 adds one statement, `agentsActiveToday`,
  which searched `visits_received_idx (received_at>? AND received_at<?)`; ADR-0036 replaced it with
  `agentsStartedOn`, an `EXISTS` into `tournees_agent_day_started_idx` per active user (read from the code, not
  re-run with `EXPLAIN=1`). GH #308 adds one statement
  (thirteen in all), `inactiveAgentProspects`, which searches `prospects_merged_idx
  (merged_into=?)` with a correlated subquery that searches `users` by primary key
  (`sqlite_autoindex_users_1 (email=?)`).
- **Tableau de bord through the session** (GH #415, 2026-10-18). `measure-dashboard-cpu.mjs` now signs in
  as production does (a seeded `sessions` row, its cookie, `AUTH_PEPPER`; `DEV_USER_EMAIL` unset), so the
  HMAC and the session lookup are in the figures. On the local seed of 313 prospects and 1,690 visits (the door-days entry above used 303 and 1,689), 200 warm
  requests a period, Ryzen 9 7900, two runs (the second in brackets): Worker medians 0.79 (0.68), 0.69
  (0.71) and 0.77 (0.80) ms and worst 4.63 (3.92), 1.57 (1.54) and 1.40 (1.65) ms at 7, 30 and 90 days; one
  cold first request 8.92 ms (9.30). Against the door-days entry above (0.62, 0.64, 0.75 ms; cold
  7.62 ms) the warm medians barely move and the cold first request is about 1.3–1.7 ms higher: the
  headroom on a cold dashboard request is now about 0.7–1.1 ms on local hardware. D1's time, not billed, is a
  median 14.0 (14.1) ms at 90 days.
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
