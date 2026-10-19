# API

Base path `/api`. JSON in, JSON out. Any request other than `GET` or `HEAD` whose `Origin` header is missing or is not the request URL's own origin gets **403** `forbidden_origin`, on every route including `/api/auth/*` and `/api/dev/*`. It runs right after the body cap, so an oversized cross-site body still gets 413 (CAP-8, `src/worker/origin.ts`). Every route except `/api/auth/*` and `/api/dev/*` requires an identity: a session cookie, or `DEV_USER_EMAIL` on a local host ([identity-access](domains/identity-access.md)). Bodies are validated with zod schemas from `src/shared/schemas.ts`; a validation failure returns `400 {error: "validation", issues}`, where `issues` is the first 20 of `[{path, code}]`.

## Common
| Route | Role | Purpose |
|---|---|---|
| `GET /api/me` | any | `{email, role}` |

## Sign-in
Mounted before the identity gate ([ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md)). Nothing on these routes is logged: not the passphrase, the code, the token or a hash.

| Route | Purpose |
|---|---|
| `POST /api/auth/login` | `loginRequestSchema`, a `zod/mini` union on `kind`. **`{kind: "code", code}`**: `code` (1–200 characters, sent as typed) is normalised on the server (`normaliseCredential`: uppercase, spaces and hyphens dropped, I/L read as 1, O as 0) and spent by one conditional `UPDATE` — unused, unexpired, its user active. Success opens a session with the user's own role and lifetime and answers **200** `{email, role}` with the cookie below. A wrong, expired, used or superseded code, or one whose user was deactivated, is **401** `unauthorized`; of two logins racing on one code only one succeeds. **`{kind: "passphrase", email, passphrase}`** is break-glass first: `email` (trimmed, lowercased) equal to `OWNER_EMAIL` and `passphrase` (as typed) equal to `BREAK_GLASS`, compared as HMAC digests with `timingSafeEqual`. Success creates or reactivates `OWNER_EMAIL` as an active admin, opens a session and answers **200** `{email, role}` (`MeResponse`) with `Set-Cookie: __Host-cp_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=<lifetime>` — 30 days for an admin, 90 for an agent, sliding as [identity-access](domains/identity-access.md) describes. Otherwise (or without `OWNER_EMAIL` or `BREAK_GLASS`) it is an admin's generated passphrase: `normaliseCredential(passphrase)` is HMACed and compared with `timingSafeEqual` to the user's `passphrase_hash`; an active admin whose hash matches gets a session and the same **200**, the session inserted only if the row still matches when the insert runs. An unknown email, no passphrase, a deactivated user, an agent and a wrong passphrase all get the same **401** `unauthorized` after the same work. Any other `kind`, a missing field or a non-JSON body is **400**. No `AUTH_PEPPER` is **500** `misconfigured`. Throttled per IP (`CF-Connecting-IP`, an IPv6 address by its /64; without the header, one shared `unknown` bucket): every 400 or 401 counts as a failure in a fixed 15-minute window, a success does not reset the count, and from the 10th failure on every login from that IP, valid or not, gets **429** `too_many_attempts` with `Retry-After` (seconds until the window ends). The lock is checked before the body and the credential |
| `POST /api/auth/logout` | Deletes the cookie's session if there is one, clears the cookie (`Max-Age=0`), **204**. Works without a session |

## Local development only
| Route | Purpose |
|---|---|
| `POST /api/dev/seed` | Fills the local database with sample prospects, a script and each assigned prospect's visit history over the last 180 Brussels days, validated by `devSeedSchema` → `devSeedResultSchema` `{seeded, inserted: {prospects, visits, orphans, users}}`. First inserts the two local `users` rows `DEV_USER_EMAIL` may name, `admin@example.com` (admin) and `agent@example.com` (agent), both active; a row that already exists is left as it is, so a second run reports `users: 0`. Visits go to the prospect's assignee only and status is derived as sync derives it. Optional per prospect: `manualStatus` (set once, as an admin would, unless `status_set_at` is already set) and `mergeInto`, the `name` of another prospect in the same body (merged once, unless `merged_into` is already set; a name not in the body is **400**). Also quarantines one visit of each reason, unless `orphans` is `false`. Optional `positions` (up to 10 `{email, lat, lng, accuracy}`) are stored as readings taken now, through the sync's writer, so a re-seed on the same day moves the dot rather than adding a row and the admin round view has a position to show; unlike sync, it does not refuse an admin's email. Every id is hashed from stable input, so a second run inserts nothing and derives no status while the seeded prospects are unedited, and an orphan repaired since is not quarantined again. A prospect an admin has since assigned or reassigned can gain visits, and one they have unmerged is merged again. The dates stay anchored to the first run, so the 7-day figures empty out after a week; to get fresh ones, delete `.wrangler/state`, then run `pnpm db:migrate:local` and `pnpm db:seed:local:full` (never `--remote`). Answers 404 unless the request host is localhost **and** `DEV_USER_EMAIL` is set — on localhost the 404 says which is missing. Run through `pnpm db:seed:local` (10 blank prospects) or `pnpm db:seed:local:full` |

## Agent
| Route | Purpose |
|---|---|
| `POST /api/agent/sync` | Push outbox, pull today list + active script. A visit the server cannot take — unknown prospect, or a prospect not assigned to the sender — is quarantined and still reported in `accepted` ([ADR-0022](adr/0022-quarantine-visits-the-server-cannot-take.md)). A visit may carry an optional `refusalReason` ([prospecting](domains/prospecting.md#refusal-reasons)). An optional `position` `{lat, lng, accuracy, capturedAt}` is stored for an assignable agent, newest wins, and an invalid one is dropped without failing the sync; the response never carries it ([ADR-0028](adr/0028-agent-position-at-sync.md)). Optional `tournees` `[{id, startedAt}]` and `stops` `[{id, tourneeId, prospectId, number, addedAt}]` carry the morning swipe, insert-only; a tournée's id is listed in `accepted.tournees` (every tournée is stored; the earliest `startedAt` of the day is the one returned), and a stop's in `accepted.stops` once stored or drained as unplaceable. A stop whose field prospect has not arrived yet is **not** listed while its tournée's Brussels day lasts, so the phone resends it; from the next day it is accepted and not stored; a joiner whose number another prospect already holds in that tournée (or holds earlier in the same request) is accepted and not stored, the first stored keeps the number; a phone sends a stop only in the same request as its tournée or after that tournée is accepted. If the tournée write throws, the sync still answers 200 with its visits and prospects accepted, and none of the request's tournées or stops is listed, so the phone resends them; every insert ignores a conflict, so a partial write is harmless. The response returns `tournee` (today's Brussels day, `{id, dayStart, startedAt, clientStartedAt, stops: [{id, prospectId, number, addedAt, left, joiner}]}` in number order, or `null` before the first swipe) and `visitedStops` (today's door-days: `{prospectId, outcome, visitedAt, flyerGiven, visitIds, name, type, address}`, closed prospects included). `left` and `joiner` are derived, never stored, and `joiner` means the stop's phone `addedAt` differs from the tournée's `clientStartedAt`, which the phone also uses to judge stops still queued ([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)). See [field-operations](domains/field-operations.md#protocol) |
| `GET /api/agent/prospects/:id/visits` | Last `VISIT_HISTORY_LIMIT` (20) visits of a prospect, newest first, `visitHistoryResponseSchema`. Agent: only if assigned to them; a non-UUID `:id` is 400, an unknown one 404. Narrower than the row — `clientVisitedAt`, `receivedAt` and `clientVersion` are clock-skew and upgrade diagnostics, not shown to an agent at a doorstep. Cached in Dexie `visitHistory` so the visit form still shows it offline |

## Admin
| Route | Purpose |
|---|---|
| `GET /api/admin/dashboard?period=7\|30\|90` | Tableau de bord's figures, `dashboardResponseSchema`: `{period, from, to, visits: {value, previous, delta, byDay}, openProspects, openProspectsByStatus: {new, assigned, follow_up}, converted: {value, previous, delta, byDay}, conversionRate: {value, previous, delta, visitedProspects: {value, previous}}, visitsByDay: [{date, counts: {<outcome>: n}}], pipeline: {<status>: n}, agents: [{email, visits, converted, followUp, openProspects}], followUpsDue, flyersGiven, agentsActiveToday, followUpsDueSoon: {value, dueBefore}, inactiveAgentProspects}`. `period` defaults to 30; any other value is **400**. Read-only. See [The dashboard](#the-dashboard) |
| `GET /api/admin/agents/:email/round` | `agentRoundResponseSchema` `{tournee, position}`: `tournee` is `{startedAt, stops: [{number, prospect}]}` or `null` before the agent's swipe today. `stops` are today's tournée stops still to do, in number order with the swipe's numbers and gaps left as gaps: those with no visit today (a door-day) that `isStopLeft` does not mark left (reassigned, closed or merged), each with its wire prospect. `position` is the latest reading `{lat, lng, accuracy, capturedAt}` (`capturedAt` clamped to receipt) or `null` when none from today; it only places the marker and the distances, never the order ([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md), [ADR-0028](adr/0028-agent-position-at-sync.md)). `tournee: null` has no fallback to open prospects. An admin's email answers 200 with `position: null`, since admins' positions are never stored. **404** for an email that is not assignable, **400** for a malformed one. `Cache-Control: no-store` ([ADR-0028](adr/0028-agent-position-at-sync.md)) |
| `GET /api/admin/agents` | `{agents: [{email, role}]}` — everyone a prospect can be assigned to |
| `GET /api/admin/recap` | The sidebar's recap card, `recapResponseSchema` `{date, activeAgents, rosterSize, visitsToday, lastReceivedAt, serverTime}`: today's Brussels date and what arrived since its midnight. `lastReceivedAt` is `null` on a day with no visit. Read-only, `no-store`, polled every 15 s. See [The recap card](#the-recap-card) |
| `GET /api/admin/users` | `usersResponseSchema` `{users: [{email, name, role, active, sessions, openProspects, devices}]}` — every user, active or not, ordered by name then email; names compare ignoring case and accents (French collation), unnamed rows last. `sessions` counts unexpired sessions; `openProspects` counts prospects assigned to them with status `new`, `assigned` or `follow_up` and not merged. `devices` `[{id, label, createdAt, lastSeenAt, current}]` lists the unexpired sessions, newest `lastSeenAt` first; `label` is null when the User-Agent gave no summary, `current` marks the caller's own session. The token hash is never sent ([ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md)) |
| `POST /api/admin/users` | `userCreateSchema` `{email, name, role}` → **201** with the list row (`devices` is empty). The email is trimmed and lowercased, the name required. Created active, with no passphrase. **409** `email_taken` for an existing email, active or not |
| `PATCH /api/admin/users/:email` | `userUpdateSchema` `{role?, active?}`, at least one → **204**. What is absent stays. Deactivating deletes the user's sessions and unused codes in the same batch; reactivating leaves none. `role: "agent"` or `active: false` also clears `passphrase_hash` in the same `UPDATE`. **404** for an unknown email. **409** `last_admin` when the change would leave no active admin, decided inside the write and counting active admin `users` rows; nothing is written. No user is ever deleted |
| `DELETE /api/admin/sessions/:id` | Signs one device out: deletes the session whose public `id` this is → **204**; its next request is a **401**. **404** `not_found` for an unknown id, **400** for a malformed id (not 32 lowercase hex). The admin's own current session may be revoked too; only the Agents page hides that button |
| `POST /api/admin/users/:email/code` | No body → **201** `loginCodeResponseSchema` `{code, expiresAt}`: a one-time code of 8 Crockford base32 characters for the user's next device, valid 15 minutes (`expiresAt` = now + 15 min) and once. The only time the code is ever returned, with `Cache-Control: no-store`; only its HMAC is stored and nothing logs it. The user's older unused codes are deleted in the same batch. Works on the signed-in admin's own row. **404** `not_found` for an unknown email, **409** `user_inactive` for a deactivated user; nothing is written |
| `POST /api/admin/me/passphrase` | No body → **200** `passphraseResponseSchema` `{passphrase}`: 20 Crockford base32 characters (100 bits) for the signed-in admin's own row, and no one else's. The only time it is ever returned; only the HMAC of the passphrase is stored in `users.passphrase_hash`, replacing the previous one at once, and nothing logs either. Sessions are left as they are. **404** `not_found` when the caller's row stopped being an active admin's during the request, **500** `misconfigured` without `AUTH_PEPPER`; nothing is written |
| `GET /api/admin/prospects?status=&dueBefore=&assignedTo=&source=&q=&outOfTarget=&inactiveAgent=&limit=&offset=` | `{prospects[], total}`, newest edit first. `status` takes one value or several comma-separated (`status=new,assigned,follow_up`), duplicates collapsed; an unknown or empty item is **400**. `dueBefore` (epoch ms) keeps `next_visit_at < dueBefore`, a null date never due — with `status=follow_up` and the dashboard's `to`, exactly `followUpsDue`; with the dashboard's `followUpsDueSoon.dueBefore`, exactly `followUpsDueSoon.value`. `q` is a substring of `name`, accents and case ignored. `outOfTarget=true` (the only accepted value, anything else is **400**) keeps the prospects flagged Hors cible: the latest visit carries `out_of_target` and `out_of_target_reviewed_at` is null or not after that visit's `visited_at` ([prospecting](domains/prospecting.md#refusal-reasons)). `inactiveAgent=true` (likewise the only accepted value) keeps the prospects whose `assigned_to` has no active `users` row — a deactivated user, or an email with no row at all; it leaves status to `status`, so with `status=new,assigned,follow_up` it is exactly the dashboard's `inactiveAgentProspects`. `total` counts that combined set |
| `POST /api/admin/prospects/batch` | Upsert `{source: "csv" \| "osm" \| "google", rows[], importLog?}` by dedupe key → `{created, updated}`. The optional `importLog` `{importId (uuid), batchIndex, batchCount, rejected, fileName?, zoneVertices?, zoneRadiusM?}` logs the batch ([ADR-0030](adr/0030-the-server-keeps-an-import-log.md)): `batchIndex < batchCount ≤ 10 000`, counts non-negative and capped, else **400** and nothing written. Without it nothing is logged. The log is written after the prospects, so a failed log write fails the request and a re-send is safe; a re-sent `(importId, batchIndex)` is counted once with its first counts, though the response still carries the live `{created, updated}` |
| `GET /api/admin/imports` | `{imports[]}`: the five newest settled imports, newest `startedAt` first, each `{id, source, fileName, zoneVertices, zoneRadiusM, created, updated, rejected, createdBy, startedAt, status: "done" \| "interrupted"}` ([ADR-0030](adr/0030-the-server-keeps-an-import-log.md)). `created`/`updated` are summed over the import's batches. Read from the 20 newest imports; one still running (batches missing, newest received within `IMPORT_STALE_MS`, 5 min) is not listed. `fileName` and `createdBy` are null after `RETENTION_DAYS` |
| `PATCH /api/admin/prospects/:id` | Edit fields, `assignedTo`, `status`, `nextVisitAt` → the updated prospect. A `status` set here holds until a visit made after it ([prospecting](domains/prospecting.md#prospect-lifecycle)). Any PATCH also stamps `out_of_target_reviewed_at`, the only writer of that column ([Hors cible](domains/prospecting.md#refusal-reasons)) |
| `POST /api/admin/prospects/assign` | Bulk `{ids[], assignedTo}` → `{assigned}`; `assignedTo: null` unassigns |
| `GET /api/admin/prospects/export.csv?status=&dueBefore=&assignedTo=&source=&q=&outOfTarget=&inactiveAgent=` | The ledger as CSV, the same filters as the list — same rows, up to the cap — merged prospects excluded. `text/csv` attachment, max 500 rows, `x-truncated: true` when capped |
| `GET /api/admin/prospects/duplicates` | `{pairs[], truncated}` — prospects that are probably the same place. `aVisits` and `bVisits` count each side's door-days (one agent, one Brussels day), its own visits only, never folded to a survivor |
| `POST /api/admin/prospects/merge` | `{survivorId, mergedId}` → `{survivorId, mergedId, dedupeKeyUpdated}` |
| `POST /api/admin/prospects/:id/unmerge` | Undo a merge → the restored prospect |
| `POST /api/admin/import/overpass` | `{polygon: [lat,lng][]}` → `{candidates[], truncated, cached, cachedAt?}`. Nothing is saved: the candidates go through the same preview and the same `POST /prospects/batch` as a CSV |
| `POST /api/admin/import/places` | `{center: [lat,lng], radius}` → the same `{candidates[], truncated, cached, cachedAt?}`. Google Places (ADR-0020); a circle because Nearby Search has no polygon search. **503** when no key is configured |
| `GET /api/admin/visits?since=<ms>&from=<ms>&to=<ms>&reason=&limit=` | `{doorDays[], truncated, serverTime}` — one row per door-day (agent, prospect, Brussels day) with a visit whose feed clock (`coalesce(repaired_at, received_at)`) is `> since` and, if given, whose `received_at` is within `[from, to]`; all bounds apply together, and each door-day arrives whole (see [The live feed](#the-live-feed)). With `reason`, the door-days whose latest visit has it. Each row is `{key, prospectId, prospectName, agentEmail, dayStart}`, the latest visit's `visitedAt, outcome, refusalReason, notes, followUpAt`, the greatest `receivedAt`, `listedAt` (the greatest feed clock, the cursor), `flyerGiven` when any visit gave one, and `visits[]` oldest first, each `{id, visitedAt, receivedAt, outcome, refusalReason, flyerGiven, followUpAt, notes, answerCount}`. Newest `listedAt` first, max 500; `truncated` when more than `limit` visits matched. A poll with `since` reads the oldest `limit` arrivals after it, and the whole tie group at the cut, so the page may exceed `limit`. **400** when `from > to` or `reason` is unknown or empty |
| `GET /api/admin/visits/orphaned` | `{visits[], remaining}` — the repair queue, newest quarantined first, max 200. Each row carries its `reason`, the `prospectName` when the id still resolves, `hasPosition` (whether the visit recorded where it happened), and up to 5 `candidates` ranked by distance from there. `candidates` is also empty when the visit has a position but no live prospect has one |
| `POST /api/admin/visits/orphaned/:id/repair` | `{prospectId}` → `{visitId, prospectId, repaired}`. Inserts the visit into `visits`, removes the queue row, derives status. Follows `mergedInto`, so the returned `prospectId` is where it actually landed. `repaired: false` means it was already done (INVARIANT 4). **400** `unknown_prospect` if the target is gone, and the queue row survives |
| `POST /api/admin/visits/orphaned/:id/discard` | Deletes the row for good → `{discarded}`. Idempotent. The one place a visit is deliberately lost, behind a confirmation in the UI |
| `GET /api/admin/visits/export.csv?from=<ms>&to=<ms>&reason=` | Visits as CSV for a range, defaulting to the last 30 days. Filtered on `received_at`, not `visited_at`; `reason` narrows it exactly as it narrows the feed. A `refusal_reason` column follows `outcome` (the English value, empty when none). **400** when `from > to` or `reason` is unknown or empty. Max 500 rows, `x-truncated` when capped |
| `GET /api/admin/scripts` | `{scripts[]}` — all versions, newest first, max 100. At most one has `isActive` |
| `POST /api/admin/scripts` | `{name, questions[]}` → **201** with the created script. Writes version N+1 of that name and makes it the only active one |

## Status codes
| Code | Meaning |
|---|---|
| 400 | Invalid body |
| 401 | No valid session. Also a refused sign-in |
| 403 | Authenticated but wrong role, or a request other than `GET` or `HEAD` whose `Origin` is missing or foreign (`forbidden_origin`) |
| 404 | Unknown resource |
| 409 | A conflict with current data: `email_taken` (the email already has a `users` row) or `last_admin` (the change would leave no active admin) |
| 413 | Body over `MAX_REQUEST_BYTES`, refused before it is parsed — so before the 426 check and before validation. `error: "too_large"` |
| 426 | `clientVersion` no longer supported: update the app. Checked **before** body validation, so an old build is told to update rather than that its data is invalid |
| 429 | Too many failed logins from this IP (`too_many_attempts`); `Retry-After` says when to try again |
| 501 | Route declared but not implemented yet (see the roadmap) |
| 503 | Either D1's daily free-tier limit (`quota`) or a map provider with no key (`places_unconfigured`). Nothing was lost; the `error` code says which |
| 502 | A map provider failed or timed out — `overpass_failed` or `places_failed` |

## Payload caps
Every array is bounded, because one request must stay inside the Workers Free
10 ms CPU budget (`docs/free-tier-budget.md`). The limits live in
`src/shared/constants.ts`: 250 import rows, 200 visits, 100 field prospects, 7 tournées and 250 stops
per sync (the server's accept limit; a current phone sends at most 50 visits a
pass, and an older build up to 200 — GH #404). A stop's `number` is at most 10,000.
Also 50 answers per visit (a script's own question ceiling), 500 ids per bulk assign,
500 visits per live-feed page, 200 prospects per list page and 1000 candidates per
Overpass import. A Google import is capped at 20 by Google itself.

Those cap **rows**. `MAX_REQUEST_BYTES` (2 MiB) caps **bytes**, Worker-wide, and is
checked before any body is parsed — the two are not the same thing, because 200
visits of 50 long answers each is schema-valid and about 20 MiB. The field client trims
a sync batch that would exceed it rather than sending one the server must refuse; see
`docs/security.md`.

`GET /api/admin/prospects` returns at most `PROSPECTS_PAGE_SIZE` rows; `total`
counts every row matching the filters, so the list header can say "412
prospects" while holding one page. Several statuses are one comma-separated
key, not a repeated one: the query validator hands a plain schema a repeated
key's last value, so `status=a&status=b` would silently mean `b`. D1's free tier bills *scanned* rows, which is
why the page size is a cap and not just a default.

`q` matches a substring of the name with accents and case ignored: `?q=cafe`,
`?q=café` and `?q=CAFÉ` all match "Café du Port" and "CAFÉ DU MIDI",
`?q=boeuf` matches "Le Bœuf" and `?q=pho` matches "Phở". The needle is folded
by `foldForSearch` and matched against the stored `name_search`
([ADR-0032](adr/0032-a-stored-folded-name-for-search.md)); a row whose
`name_search` is still null matches the raw needle against `name`, ASCII case
folded only, until the nightly sweep folds it. `q` is trimmed and 1–200 characters; shorter or longer is
**400**. A literal `%` or `_` in `q` is escaped, so it matches itself rather
than acting as a wildcard. `name_search` has no index, so a search scans the
merge-filtered set, once for the rows and once for `total`'s `count()`;
accepted at this project's scale, and why `q` is not offered on the 500-row
visits feed (`docs/free-tier-budget.md`).

`GET /api/admin/prospects/export.csv` takes the same filters as the list —
including `q` — so the same query string returns the same rows on both, up to
the export cap. It has no `limit` or `offset`: an export is not paged, it
always exports the whole filtered set up to the cap, so a URL copied from
page 2 of the list is not read as "page 2 of the export".

`GET /api/admin/visits` filters `from`/`to` on `received_at` (when a visit
reached the server), the same column the export uses — never
`visited_at` (INVARIANT 12): a phone can sync days late, and a range read
against its own clock would silently drop exactly the visits worth looking at.
`from`/`to` are inclusive at both ends; `since` stays exclusive, because it is
a paging cursor ("give me what I haven't seen yet") on the feed's own clock, not a range boundary.
Like `dueBefore`, `from` and `to` are non-negative integers, decimal digits
only — `1e3` or `0x10` is **400**, not a silent 0.

`GET /api/admin/prospects/duplicates` compares at most `DUPLICATES_SCAN_LIMIT`
(5000) live prospects and returns at most `DUPLICATES_PAGE_SIZE` (100) pairs,
setting `truncated` when it hit either. Comparing pairs is CPU, which is the
scarce thing in a Worker; prospects are bucketed into ~110 m cells so each one is
only compared with its own cell and the eight around it.

`POST /api/admin/prospects/merge` returns 400 `already_merged` when either side
has already been absorbed, and 404 when either id is unknown. Repeating a merge
that already happened is a 200 no-op (INVARIANT 4).

## CSV exports

Two endpoints, one serialiser (`src/shared/csv.ts`, unit-tested away from D1)
and one cap-and-respond tail (`capExport` and `csvResponse` in
`src/worker/routes/admin.ts`).

- **Timestamps are ISO-8601 UTC**, not the epoch milliseconds every other
  response uses. A spreadsheet shows epoch ms as a 13-digit number and makes the
  reader write a formula. This is the one place the convention is deliberately
  broken, and only on the way out.
- Headers are **snake_case**, like the columns — the reader is a spreadsheet, not
  the client.
- A field containing `,`, `"` or a newline is quoted and embedded quotes are
  doubled, so a visit note written outdoors still parses as one record. A null is
  an empty field, never the text `null`.
- The last line is `# © OpenStreetMap contributors` (INVARIANT 11), a comment
  rather than a data row so a parser does not read it as a prospect.
- Capped at `EXPORT_ROWS` (500) with `x-truncated: true` when hit. That is a CPU
  and rows-scanned cap (INVARIANT 13), not a page: an export is not paged.
- A leading `=` is **not** escaped. Excel reads it as a formula; changing that is
  a decision about who the reader is, not a fix, and a test pins the current
  behaviour so the decision stays visible.

## The dashboard

`GET /api/admin/dashboard` backs Tableau de bord at `/admin`. The Worker computes
every figure, and this section is where each one is defined; a new figure joins
the same response, additively.

- **Periods are Europe/Brussels calendar days.** A period of N days runs from
  Brussels midnight N − 1 days ago to Brussels midnight tomorrow, exclusive —
  `[from, to)` in the response. The previous period is the N days before it,
  `[previousFrom, from)`. A day that changes the clocks is 23 h or 25 h, so a
  period is never `N × 24 h` across one. `brusselsPeriod` in
  `src/shared/period.ts` is the one place this is computed.
- **Delta** = (value − previous) ÷ previous, as a ratio (`0.124` is +12,4 %).
  It is `null` when previous is 0, and the screen shows "—". Taux de
  conversion is the one exception, below.
- **Door-days** ([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)).
  Every visit figure below counts one unit: a door-day, meaning one agent, one
  prospect (the visit's own `prospect_id`, merged or not) and one Brussels
  calendar day of the clamped `visited_at` (INVARIANT 12). Its outcome and
  refusal reason are the **latest** visit's (`visited_at`, then `received_at`,
  then `id`, all descending), so a correction replaces the earlier answer: a
  Personne sur place at 10:00 then a Converti at 16:00 is one Converti. Its flyer
  is given if **any** of its visits gave one. Two agents at one door are two
  door-days. `doorDaysBetween` in `src/worker/door-days.ts` is the one SQL
  fragment; the statements below read through it, and the visits themselves stay
  as they are. The Visites ledger lists door-days too, through `doorDaysTouched`
  ([The live feed](#the-live-feed)); only the CSV export stays one row per visit.
  No dashboard figure counts refusal reasons yet.
- **Visites** (`visits`): door-days whose day falls in the period. Door-days of
  merged prospects count, because they still happened; quarantined visits do
  not, because they are in `visits_orphaned` until repaired. `previous` is the
  same count over the previous period, and both come from one range read on
  `visits_visited_idx`. A door-day sits on one Brussels day and a period starts
  at a midnight, so no door-day straddles the two periods.
- **Prospects ouverts** (`openProspects`): live prospects (`merged_into IS NULL`)
  whose status is in `OPEN_STATUSES` (new, assigned, follow_up). A snapshot of
  now: it ignores the period and has no delta.
- **Convertis** (`converted`): distinct prospects converted in the period. A
  prospect converted when it has a door-day in the period whose latest outcome is
  `converted` (so a `converted` visit a later visit the same day took back is no
  conversion; quarantined visits out), or when its status is
  `converted` with `status_set_at` in the period — a manual change. It counts
  once however many times either happens, and still counts if it was reopened
  on a later day: a conversion is an event, so a past period never shrinks. Every
  door-day and manual change is keyed by `coalesce(merged_into, id)`, so an absorbed
  prospect counts as its survivor (one hop; A→B→C counts A under B). Its delta
  follows the rule above. An `interested` prospect is never a conversion
  ([ADR-0027](adr/0027-interested-is-its-own-closed-status.md)).
  *Limitation:* `status_set_at` keeps only the latest manual change, and a
  later visit replaces the status without touching it. So a manual status
  counts only while it is still in force (`last_visit_at` null or not after
  `status_set_at`): a manual conversion a later visit or edit overrode is not
  counted, and a visit's conversion is never mistaken for a manual one dated
  at an earlier manual change.
- **Taux de conversion** (`conversionRate`): Convertis ÷ distinct prospects
  with a door-day in the period (`visitedProspects`, keyed the same way), as a
  ratio (`0.106` is 10,6 %). `null` when nothing was visited, shown "—". A
  prospect converted by hand with no visit in the period is in the numerator
  only, so the rate can in theory exceed 1. Its `delta` is in percentage
  points, `value − previous` (`0.012` is +1,2 pt), and `null` when either rate
  is `null`. Convertis and both denominators come from one statement: the
  door-days of both periods joined to `prospects`, `UNION ALL` the manual
  conversions read on `prospects_status_idx`.
- **Visites dans le temps** (`visitsByDay`): the period's door-days — the same
  rows as Visites — per Brussels calendar day and latest outcome. Exactly `period`
  entries, oldest first; `date` is the Brussels date `YYYY-MM-DD` and
  `counts` has all five outcomes, zeros included, so the entries of a period
  sum to `visits.value`. The door-days' day is
  `(visited_at + offset) / 86 400 000`, the Brussels day number: the offset
  changes at most once in a period (`periodOffsets` in `src/shared/period.ts`),
  so a statement binds a handful of parameters whatever the period. A statement
  that spans both periods builds one key per period (current days `0…`,
  previous days `−period…−1`), because the two can hold a clock change each.
- **The KPI cards' series** (GH #111). Each has `period` entries on the days of
  `visitsByDay` and sums to its card's figure. `visits.byDay` is
  `visitsByDay` summed over outcomes. `converted.byDay` counts each Convertis
  prospect once, on the Brussels day of its **first** conversion event in the
  period (a converted door-day counts on its day), meaning the same events and
  key as `converted`. A prospect converted twice
  counts on the earlier day only. `openProspectsByStatus` splits
  `openProspects` into `new`, `assigned` and `follow_up` with the same filter,
  and `openProspects` is its sum.
- **Pipeline par statut** (`pipeline`, GH #112): live prospects
  (`merged_into IS NULL`) per status, all six `STATUSES` with zeros. A
  snapshot of now like `openProspects`, so it ignores the period, and
  `new + assigned + follow_up` equals `openProspects`. The screen computes each
  share from the pipeline's own total, and shows 0 % when that total is 0.
- **Activité par agent** (`agents`, GH #112): one row for each email on the
  roster (the active `users` rows), zeros included; a deactivated user has no
  row, though their visits stay in the totals; sorted
  by `visits` descending, then `email`. `visits` is that agent's door-days among
  Visites, so the column sums to `visits.value` less the door-days of anyone off
  the roster (no active `users` row: deactivated). `converted` is the distinct prospects
  (`coalesce(merged_into, id)`) with a door-day of theirs whose latest outcome is
  `converted` in the period. Its column can differ from Convertis either way: a manual
  conversion has no visitor and is credited to nobody, an off-the-roster visitor
  has no row, and one prospect
  converted by two agents counts for both. `followUp` and `openProspects` are the live `follow_up` and
  `OPEN_STATUSES` prospects assigned to them now, snapshots like
  `openProspects`; a prospect unassigned or assigned off the roster is in no row. Each figure is one
  grouped statement.
- **Relances dues** (`followUpsDue`, GH #113): live `follow_up` prospects
  whose `next_visit_at` is before `to`, Brussels midnight tomorrow — due today
  or overdue, however long ago. A null `next_visit_at` is not due. A snapshot
  like `openProspects`, so it ignores the period. One count on
  `prospects_status_idx`. À traiter's other two counts are not in this
  response: they are the queues' own endpoints, `visits.length + remaining`
  on `GET /api/admin/visits/orphaned` and `pairs.length` on
  `GET /api/admin/prospects/duplicates`.
- **Flyers remis** (`flyersGiven`, GH #177): the period's door-days — same rows
  as `visits.value` — with a flyer given on any of their visits. Folded into that statement's `sum`,
  so it follows `period` and costs no extra statement.
- **Agents en tournée** (`agentsActiveToday`, ADR-0036): roster members (active
  `users`) with a `tournees` row whose `day_start` is today's Brussels midnight.
  The swipe alone counts, with no visit needed; a visit without a swipe, a
  yesterday's tournée and a deactivated user's tournée do not. A snapshot of now,
  like `openProspects`; it ignores `period`. One Worker helper (`agentsStartedOn`)
  serves it and the recap's `activeAgents`, so they are the same figure. It
  drives from the active `users` rows through an `EXISTS` into
  `tournees_agent_day_started_idx`, never a scan of `tournees`.
- **Relances dues sous 7 jours** (`followUpsDueSoon`, GH #177): live
  `follow_up` prospects whose `next_visit_at` is before `dueBefore`, the
  Brussels midnight seven days from today (today's midnight + 7 days,
  `brusselsMidnightDaysFromNow` in `src/shared/period.ts`) — so today and the
  six days after it, overdue included; a null `next_visit_at` is not due.
  `dueBefore` links to `GET /api/admin/prospects?status=follow_up&dueBefore=…`
  the same way `followUpsDue` links with `to`. A snapshot, ignores `period`,
  folded into `followUpsDue`'s statement as a second `sum` on the same rows.
- **Prospects sans agent actif** (`inactiveAgentProspects`, GH #308): live
  prospects whose status is in `OPEN_STATUSES` and whose `assigned_to` is not
  null and has no `users` row with `active = 1` — a deactivated user. A snapshot like
  `openProspects`; it ignores `period`. The condition is one SQL fragment
  (`NO_ACTIVE_AGENT`) shared with the prospects list's `inactiveAgent=true`,
  so `GET /api/admin/prospects?status=new,assigned,follow_up&inactiveAgent=true`
  totals it. One count; the subselect is a primary-key lookup on `users`.
- **Cost** (as of ADR-0036's door-days). Thirteen statements run in parallel; the
  largest binds 20 parameters (INVARIANT 7), and every range read on `visits` uses
  `visits_visited_idx` or `visits_received_idx`. The six door-day statements
  each read the range once and window it by agent, prospect and day. The plans and the Worker's
  CPU per request are in [free-tier-budget](free-tier-budget.md#watch-outs);
  re-check both with `scripts/measure-dashboard-cpu.mjs` when a figure is
  added. The screen does not poll this endpoint: each call reads several
  thousand rows on the seed, so every 15 s from one open tab would spend the
  D1 daily read quota within hours.

## The recap card

`GET /api/admin/recap` feeds the card at the foot of the admin sidebar
([design](design.md#layout)). An admin has no outbox, so it reports what the
agents sent rather than a sync. Every figure reads `received_at` over one
Brussels day, midnight to midnight tomorrow (`brusselsMidnightDaysFromNow`),
so a visit made offline yesterday and synced this morning counts as seen today
by `lastReceivedAt`, though not in `visitsToday`. `activeAgents` reads `tournees.day_start`
instead (below).

- `date`: that day, `YYYY-MM-DD`. The client never works out which day it is.
- `rosterSize`: the roster, the active `users` rows, admins included.
- `activeAgents`: roster members who started that day's tournée (ADR-0036), the
  dashboard's `agentsActiveToday` figure from the same helper. A swipe with no
  visit counts; a visit with no swipe does not; a user off the roster
  (deactivated) is left out, so it never exceeds `rosterSize`.
- `visitsToday`: today's door-days (ADR-0036), off-roster senders included: one
  per agent, prospect and visit made that Brussels day (`visited_at`), among the
  visits received so far (the clamp gives `visited_at ≤ received_at`). It equals
  the dashboard's one-day Visites once every phone has synced. A visit made before
  midnight and synced after it is the earlier day's door-day and counts in no recap.
- `lastReceivedAt`: the latest `received_at` that day, or `null`.
- `serverTime`: the Worker's clock. The card's age is `serverTime −
  lastReceivedAt`, never the device's clock.
- **Cost.** Three statements: the roster, one grouped read of the day's
  visits on `visits_received_idx`, one row per sender, whose count is distinct
  prospects among the rows made today, and `agentsStartedOn` (a count over the
  active `users` rows, each probing `tournees_agent_day_started_idx`). Each call reads about the
  day's visits plus the `users` rows; polled every 15 s from each visible admin
  tab (ADR-0010), see [free-tier-budget](free-tier-budget.md#watch-outs).

## The repair queue

A visit the server cannot take is written to `visits_orphaned` and still reported in
`accepted` — the rule and its reasons are in
[field-operations](domains/field-operations.md#rules).

- Two reasons: `unknown_prospect` (the id resolves to nothing) and `not_assigned` (it is
  somebody else's prospect). They differ only in what the admin has to decide — a
  `not_assigned` row is approved by repairing it against the prospect it already names.
- A quarantined visit is **not** in the prospect's history or the live feed. It has no
  settled prospect to belong to until it is repaired.
- Candidates are ranked by distance from the visit's own position, and are empty when the
  visit recorded none — an arbitrary ranking would be worse than offering nothing.
- An empty queue is the healthy state. `remaining` is a smoke alarm: non-zero means look
  upstream, not at the page size.

## The live feed

`GET /api/admin/visits` backs the admin's live feed, polled every 15 s while the
tab is visible (ADR-0010). Its unit is the **door-day**: one agent, one prospect
(the visit's own `prospect_id`) and one Brussels day of the clamped `visited_at`
([ADR-0036](adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md) R13), the
same unit every dashboard figure counts.

- **A row is the door-day's latest visit**, by the one rule in
  `src/worker/door-days.ts` (`visited_at`, then `received_at`, then `id`): its
  `visitedAt`, `outcome`, `refusalReason`, `notes` and `followUpAt`. `flyerGiven`
  is true when any visit of the day gave one. `visits[]` is the whole day, oldest
  first, so its last entry is the row's own; `answerCount` counts each visit's
  answers. `key` is the door-day's identity, joined by the server, for the client
  to key and merge rows on.
- **Ordered by the greatest feed clock** among the door-day's visits, `coalesce(repaired_at, received_at)`
  and sent as `listedAt`, not `visited_at`. The feed answers "what has reached me": a phone that syncs a
  three-day-old visit this minute is news, listed under the day it was made, and
  `visited_at` comes from a clock that can be wrong (INVARIANT 12).
  `repaired_at` is null on every synced visit and set only when an orphan's repair
  inserts it, so a repaired visit, received days ago, is listed from the repair on
  while `received_at` (« Reçue », `from`/`to`, export) never moves.
  `visits_listed_idx` exists for this ordering.
- **`since` is exclusive.** The client passes back the highest `listedAt` it
  holds and gets only the door-days touched since, which is what makes a 15 s
  poll cheap. Omitted, it returns the most recent page — a freshly opened tab is
  not empty.
- **A poll with `since` reads the oldest arrivals first.** Cut at `limit`, it
  answers the oldest `limit` visits after `since`, so the next poll, from the
  highest `listedAt` held, picks up the rest with no gap. The visits that share
  the cut's feed clock are all taken, because the exclusive `since` would skip
  the ones left out; one sync stamps one `received_at`, so that group is
  usually one sync's visits, and the page may exceed `limit` by it. The answer is
  still sorted newest first. The seed (`since` omitted or 0) reads the newest
  page, and `truncated` there is what the screen announces.
- **A door-day always arrives whole.** It is listed when any of its visits falls
  in `since`, `from` and `to`, and then with all its visits, those outside the
  bounds included, up to the newest visit the request touched: one synced
  while the request runs comes with the next poll, so the cursor never passes
  a door-day the request did not read. A second visit to a door-day the client
  holds returns it again under the same `key`, and the client replaces the row.
- **`truncated`** says more than `limit` visits matched the bounds. `limit` caps
  those visits (bar a tie group at a delta poll's cut), so it caps the door-days
  too; the client then reads its count as "500 visites ou plus".
- **Visits of merged prospects are included**, unlike every other admin list,
  which filters `merged_into IS NULL`. This one records what agents did, no
  visit is ever repointed on a merge (`prospecting.md`), and filtering here
  would make history disappear from the feed because an admin tidied a
  duplicate. The name shown is the one the visit was made against.
- `serverTime` is the server's clock as it answered, so a client never has to
  derive a cursor from its own.
- **`reason=`** narrows to one refusal reason (a `REFUSAL_REASONS` value): the
  door-days whose latest visit has it, the one a refusal count reads (R12).
  Absent, nothing changes; empty or unknown is **400**. A poll only adds or
  replaces rows, so a door-day already held whose later visit no longer has the
  reason stays as held until the next reseed (a period or reason change, or a
  reload). The export takes the same parameter and keeps the *visits* that have
  it, one row per visit, as it always did.
- **Cost.** Two statements: the touched visits (`limit + 1`, at most 5 bound
  parameters), then every visit of those door-days in one statement driven by
  `json_each` over one bound JSON array (2 parameters with the newest touched
  `received_at`, each door-day found through `visits_prospect_visited_idx`). The Brussels day is computed in the
  Worker, `Intl` running about twice a distinct day. The measured CPU is in
  [free-tier-budget](free-tier-budget.md#watch-outs).

## The map import

Two providers, one shape of answer. `POST /api/admin/import/overpass` proxies the
public Overpass API (ADR-0008) and `POST /api/admin/import/places` proxies Google
Places (ADR-0020). The browser never calls either directly (INVARIANT 11), which is
what makes the cache possible — and, for Google, what keeps the API key out of the
page.

- A polygon has 3–200 vertices. Coordinates are rounded to **5 decimals**
  (~1 m) before hashing, so nudging a vertex between two searches still hits the
  same cache entry rather than costing another request.
- Answers are cached in `overpass_cache` for `OVERPASS_CACHE_TTL_MS` (7 days),
  keyed by SHA-256 of the query version plus the rounded polygon. The response
  says `cached: true` when it was served from there, because an answer may be a
  week old and the screen has to be able to say so. `cachedAt` — epoch ms,
  `overpass_cache.created_at` on that same hit, sent by both this route and
  `POST /import/places` — is additive, optional, admin-only (not part of the
  sync contract), so the screen can say how old, not only that it is cached.
- At most `OVERPASS_CANDIDATES_LIMIT` (1000) candidates, with `truncated` set
  when the polygon held more. That is a CPU cap, not a payload one: waiting on
  Overpass is free, `JSON.parse` and tag mapping are not.
- A candidate is **not** an import row. `name` may be empty and `named` says so:
  OSM has many unnamed amenities, they are worth showing, and `importRowSchema`
  will not accept one. `sourceRef` is always present and is always
  `<type>/<id>` — tier 1 of the dedupe key.
- `likelyDuplicateOf` is `{id, name}` of the live prospect a candidate probably
  already is under another source's id, or `null`. It is computed on every answer,
  cached or not, and never stored ([ingestion](domains/ingestion.md#duplicates-across-providers)).
- **502** on a timeout, a 429, a 5xx, or a 200 whose body is not the provider's
  answer (a rate-limit notice arrives as HTML). There is no retry loop on either
  side; the screen offers the admin a retry. For Google a retry is also another
  billable call, so it stays their decision.

### Google Places only
- The request is a **circle**, `{center: [lat, lng], radius}` in metres, 50–2000.
  Nearby Search has no polygon search, which is the only reason the two providers
  take different shapes.
- **At most 20 candidates**, with `truncated` set when the circle held more. That is
  Google's own ceiling — `maxResultCount` caps at 20 and there are no page tokens —
  not a payload cap of ours. Results are ranked by distance from the centre, so a
  truncated answer is a ring around the pin.
- `phone` and `website` are always `null`: both are Enterprise-tier fields, and
  requesting them would bill every search at the higher rate (ADR-0020).
- **503 `places_unconfigured`** when the Worker has no `GOOGLE_PLACES_KEY`. Answered
  before D1 or Google is touched, so a deployment without a billing account costs
  nothing and keeps working. Google's own error bodies are never forwarded.
- The cache is shared with Overpass; hashes carry a per-provider query version, so
  the two cannot read each other's rows.

## Who can be assigned
The roster is the active `users` rows (ADR-0029), managed through
`/api/admin/users` (above). `GET /api/admin/agents` returns them, each with its
own role, sorted by email; admins are included since an admin may walk a round.
The same rows decide who `PATCH /prospects/:id` and `POST /prospects/assign`
accept (**400** `unknown_assignee` for a deactivated or unknown email;
`assignedTo: null` is always allowed), whose round `GET /agents/:email/round`
serves (**404** otherwise), the dashboard's agent rows, and whose position a
sync stores. Deactivating a user leaves their prospects assigned to them.

## Conventions
- Timestamps: epoch ms integers.
- IDs created on phones: UUIDv4 (`crypto.randomUUID()`).
- Field names: camelCase in JSON, snake_case in SQL (Drizzle maps them).
- Adding a field is non-breaking. Once the data stage is `protected`, removing or renaming one in the sync contract requires bumping the minimum `clientVersion` in a later release, after all phones have updated. While it is `disposable`, both sides change at once and both versions rise together ([ADR-0033](adr/0033-rollout-rules-wait-for-protected-data.md)).
