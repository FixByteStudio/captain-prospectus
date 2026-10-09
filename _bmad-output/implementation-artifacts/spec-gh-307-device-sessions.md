---
title: "Each device's session can be seen and revoked"
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '83cb02dea72fb9eb5abca0b1df6a6ecc1b01ba97'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An admin cannot see which devices a user is signed in on or sign out just one of them, and a session dies 30/90 days after login however often it is used (GH #307, CAP-5, CAP-1).

**Approach:** Expand-only migration adds `sessions.id` (random public id, backfilled, unique) and `sessions.device_label`; logins store a label parsed from the User-Agent; the identity middleware slides expiry at most hourly and re-sends the cookie; `GET /api/admin/users` rows gain an additive `devices` array; `DELETE /api/admin/sessions/:id` revokes one; the Agents page rows expand to their device lines per design.md.

## Boundaries & Constraints

**Always:**
- Migration: `id` and `device_label` both nullable text; backfill `id = lower(hex(randomblob(16)))` where null; unique index on `id`. New ids are 32 lowercase hex from `crypto.getRandomValues`. The token hash never leaves the Worker.
- Label: pure parser, no dependency, `"<family> · <browser>"`, either half alone when the other is unknown, null when neither. Families: iPhone, iPad, Android, Mac, Windows, Linux, ChromeOS. Browsers: Edge, Opera, Samsung Internet, Firefox, Chrome, Safari (checked in that order; `CriOS`/`FxiOS`/`EdgiOS` count). All three login paths (code, passphrase, break-glass) store it. The raw User-Agent is never stored or logged.
- Slide: in `identityFromSession`, when `now - last_seen_at >= 1 h` (or `id` is null), one conditional `UPDATE … SET last_seen_at = now, expires_at = now + SESSION_TTL_MS[current role], id = coalesce(id, newId) WHERE token_hash = ? AND (last_seen_at <= now - 1 h OR id IS NULL) RETURNING`. Only when a row comes back does the response carry `Set-Cookie` with the same token and Max-Age = the new TTL, appended after `next()` so it survives any handler response. Within the hour: no write, no cookie.
- The middleware exposes the session's `id` as a context variable (`sessionId`, unset for dev-user/Access callers).
- `userSchema.devices: [{id, label: string|null, createdAt, lastSeenAt, current}]`, unexpired sessions with a non-null id only, newest `lastSeenAt` first; `current` = id equals the caller's `sessionId`. POST /users returns `devices: []`. Additive: no `clientVersion` bump.
- `DELETE /api/admin/sessions/:id` (admin, Origin check as every non-GET): deletes by `id`, 204; no row → 404 `not_found`. Admin may revoke their own current session server-side; only the UI hides it.
- UI per design.md "The row expands to its devices" and "Below 768px": chevron button (`aria-expanded`) before the name on active rows only; one line per device with label (or "Appareil inconnu"), "Inscrit le {dd/mm/yyyy}", "Vu le {dd/mm/yyyy HH:mm}" in meta, ghost "Révoquer" or "Cet appareil"; "Aucun appareil inscrit." when empty. Revoke: no confirmation, toast "Appareil déconnecté.", users query invalidated; failure toasts the existing generic `toast.failed`. Strings in `copy/admin.ts`.
- Docs in the same PR: `docs/api.md`, `docs/data-model.md` (columns, index, the "later entries" sentence), session lines in `docs/domains/identity-access.md`.

- Decision (2026-10-09, owner): spec kept whole above 1,600 tokens.

**Never:** no new dependency; no change to the sync contract or the field route; no free-tier figures (entry 16), no expired-session sweep (entry 13), no client handling of the 401 (entry 12); no sliding write on every request; no NOT NULL on `id` in this release (contract step is later); no logging of User-Agent, token or hash.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Fresh use | last_seen 10 min ago | no UPDATE, no Set-Cookie | — |
| Stale use | last_seen 2 h ago, agent | last_seen=now, expires=now+90 d, Set-Cookie same token Max-Age 7776000 | — |
| Role changed | admin demoted to agent, stale | expires = now+90 d | — |
| Null id row | written by old Worker | first request assigns id and slides | — |
| Revoke | DELETE other device's id | 204; that cookie → 401; other session 200 | unknown id → 404 |
| Devices | one live, one expired, caller's | expired absent; caller's `current: true` | — |
| Label | iPhone Safari UA / empty or bot UA | "iPhone · Safari" / null | — |
| Expand | user with no session | "Aucun appareil inscrit." | — |

</frozen-after-approval>

## Code Map

- `src/worker/db/schema.ts` L285-297 `sessions` -- add `id: text("id")`, `deviceLabel: text("device_label")` at the end, `uniqueIndex("sessions_id_idx").on(t.id)`. Then `pnpm db:generate`; hand-add the backfill `UPDATE` before the index in the new (unmerged) migration file.
- **Positional SQL inserts** -- `src/worker/routes/auth.ts` L94 (code) and L165 (passphrase) use `insert(sessions).select(sql\`SELECT …\`)`; drizzle lists every schema column, so the SELECT must add `id` and `device_label` values in schema order. Break-glass uses `newSession()` L48 -- add `id`, `deviceLabel` to its row (signature gains the label).
- `src/worker/session.ts` -- add `newSessionId()`, `SESSION_SLIDE_MS = 60*60*1000`; update the `SESSION_TTL_MS` comment (sliding is now here). Reuse `sessionCookie(token, ttl)` for the re-sent cookie.
- `src/worker/device-label.ts` (new) + `device-label.test.ts` -- `deviceLabel(ua: string | null | undefined): string | null`.
- `src/worker/auth.ts` `identityFromSession` (only caller: `requireIdentity`) -- select also `sessions.id`, `lastSeenAt`, `token`; return `{identity, sessionId, cookie: string | null}`; `requireIdentity` sets `identity` and `sessionId`, `await next()`, then `c.header("Set-Cookie", cookie, { append: true })`. Header comment.
- `src/worker/types.ts` `AppEnv.Variables` -- `sessionId?: string`.
- `src/shared/schemas.ts` L475 -- `deviceSchema`, `userSchema.devices`; `sessionIdParamSchema` (`z.string()` length 1..64) for the DELETE param.
- `src/worker/routes/identity.ts` `userRows(db, email?)` -- second query over live sessions (`expires_at > now`, `id IS NOT NULL`) grouped onto rows; takes the caller's `sessionId`. Add `identityRoutes.delete("/sessions/:id", …)`; header comment.
- `test/session.ts` `testSessionCookie` -- write `id`, accept `lastSeenAt`/`deviceLabel` opts and return the id too (keep the string return for existing callers: e.g. a second exported helper `testSession` returning `{cookie, id}`).
- Tests: `src/worker/users.test.ts` (devices, DELETE, response holds no `token_hash`/64-hex), `src/worker/auth.test.ts` (labels per login path, null label, slide/no-slide, role TTL, console spy for UA).
- `src/client/format.ts` -- `formatShortDate` ("24/09/2026"); reuse `formatDateTime` for "Vu le".
- `src/client/admin/queries.ts` ~L208 -- `useRevokeSession()` DELETE `/api/admin/sessions/${id}`, invalidate like `useUpdateUser`.
- `src/client/admin/agents/DeviceLines.tsx` (new) -- lines for one user, `variant: "table" | "list"`; `UsersTable.tsx` (expanded `TableRow` with a `colSpan` cell under the row) and `UsersList.tsx` (lines under the `li` content) gain the chevron; `UsersActions` gains `expanded: Set<string>`, `onToggleExpand(email)`, `onRevoke(device)`; state and the mutation live in `AgentsScreen.tsx`.
- `src/client/copy/admin.ts` `agents` -- `devices: {expand(name), unknown, none, enrolledOn(d), seenOn(dt), revoke, current}`, `toast.revoked: "Appareil déconnecté."`.
- `src/client/admin/agents/AgentsScreen.test.tsx` -- fixtures gain `devices`; expand, revoke toast, current line, none, unknown label, mobile.
- Docs: `docs/api.md` L35 row (+ new DELETE row), `docs/data-model.md` L126-132 and the sessions ERD/columns + index table L228, `docs/domains/identity-access.md` L10 session step.

## Tasks & Acceptance

**Execution:**
- [x] `src/worker/db/schema.ts` + `drizzle/0012_*.sql` -- columns, backfill, unique index.
- [x] `src/worker/device-label.ts` + test -- parser.
- [x] `src/worker/session.ts`, `auth.ts`, `types.ts`, `routes/auth.ts`, `test/session.ts` + `auth.test.ts` -- ids, labels, slide.
- [x] `src/shared/schemas.ts`, `routes/identity.ts` + `users.test.ts` -- devices and DELETE.
- [x] `src/client/format.ts`, `copy/admin.ts`, `admin/queries.ts`, `admin/agents/*` + `AgentsScreen.test.tsx` -- device lines.
- [x] `docs/api.md`, `docs/data-model.md`, `docs/domains/identity-access.md`.

**Acceptance Criteria:**
- Given `pnpm db:migrate:local` on a database with sessions, when it runs, then every existing row has a distinct 32-hex `id`.
- Given `pnpm build`, when the precache check runs, then it passes and the PR quotes the total against 1,000 KiB.
- Given the existing suites, when they run, then only tests whose expectations this story changes are edited.
- Given the PR, when it is opened, then it asks for the migration-guard and security-reviewer agents' review before merge.

## Implementation Notes

- Implemented by a general-purpose subagent, which also applied the pass-1 patches.
- Migration is `drizzle/0012_great_the_phantom.sql`; the backfill `UPDATE` was added by hand before the unique index and checked on a scratch SQLite file (three pre-existing sessions got distinct 32-hex ids).
- `test/session.ts` gains `testSession()` returning `{cookie, id, tokenHash}`; `testSessionCookie` is unchanged for existing callers.
- Verification after the patches: `pnpm typecheck`, `lint`, `test` (96 files, 2,484 tests) and `build` green; precache 941.04 KiB of 1,000 KiB. The manual `pnpm dev` checks were not run here.
- Baseline `83cb02dea72fb9eb5abca0b1df6a6ecc1b01ba97` is the merge-base with `origin/main` at branch time.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment; plus migration-guard and security-reviewer, which the story asks for). Verdicts: high 0, medium 0, low 13, false 4, maybe-false 0.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | vgap, blind | No test slides an admin session by 30 days | low | patch: admin slide test |
| 2 | vgap | Migration 0012's backfill never runs against a real row | low | defer (lens's filed disposition): no migration-upgrade harness; checked by hand on a scratch DB; deferred-work.md |
| 3 | edge, blind | Révoquer has no pending state; a 404 (double click, already revoked) toasts failure and the line stays | low | patch: disable while pending, invalidate on settled, 404 counts as done |
| 4 | blind | Every Révoquer button has the same accessible name | low | patch: aria-label naming the device |
| 5 | security, blind | `sessionIdParamSchema` accepts any 1–64 chars though ids are 32 hex | low | patch: regex |
| 6 | blind | POST /users runs the devices query and then overwrites it | low | patch: drop the override |
| 7 | blind | docs/security.md is cited for the User-Agent rule but does not state it | low | patch: one bullet |
| 8 | edge, blind, intent | Appareils count includes null-id rows that have no line | low | reject: deploy-window only, filled on the row's next request; documented in data-model.md and tested |
| 9 | blind | The contract step (id NOT NULL) is not scheduled | low | defer: deferred-work.md |
| 10 | edge, blind, vgap | Self-revoke on a sliding request re-sends a cookie for a deleted row | low | reject: next request is a 401 as intended; a guard adds a branch for a rare harmless case |
| 11 | blind | Device dates use the browser zone, not Brussels | low | reject: the admin lists' existing `formatDateTime` convention; Brussels pinning is for the code's server-set expiry |
| 12 | blind | iPadOS 13+ is labelled "Mac" | low | reject: inherent to the UA (Safari reports desktop); cosmetic |
| 13 | blind | Expanded state survives deactivate/reactivate | low | reject: cosmetic, needs pruning logic |
| 14 | edge | Dates carry the year, unlike the mock | false | design.md text says "Inscrit le 24/09/2026" and "Vu le 07/10/2026 15:24" |
| 15 | intent | `devices` required in the zod schema breaks a new SPA on an old Worker | false | SPA and Worker ship in one deploy (one Worker serves the assets) |
| 16 | intent | Access/dev-user admin sees no "Cet appareil" | false | they have no session to mark; the issue's "current" is the session making the request |
| 17 | blind | Promoted agent / expired / deactivated not slid untested | false | expired and deactivated are refused by the unchanged SELECT, covered by existing tests; promotion uses the same `SESSION_TTL_MS[row.role]` as #1 |
| — | intent | Precache total not in the diff; UI checks are manual | — | PR quotes the total; manual `pnpm dev` checks noted in the PR |
| — | migration-guard | Safe: additive, NULLs distinct in the unique index, backfill before index | — | no finding |

## Design Notes

Migrations run before the new Worker deploys, so the old Worker can insert a session with a null `id` in that window. Rather than a NOT NULL that would break it, the slide assigns an id on that session's first request, and `devices` skips null ids until then.

The cookie is appended after `next()` rather than set before it, so a handler that returns its own `Response` or throws an `HTTPException` still carries the refreshed Max-Age.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- all green; precache under 1,000 KiB.

**Manual checks:**
- On `pnpm dev`: the issue's Verify list (two browsers, Cet appareil, Révoquer → toast and 401, Aucun appareil inscrit., <768px layout).
