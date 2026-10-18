---
title: 'Measure sync CPU through the session path, with heavy visits and field prospects'
type: 'chore'
created: '2026-10-18'
status: 'done'
baseline_commit: 'a605114f34e3b94754fca2ec253bfe81d80dd94e'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/docs/free-tier-budget.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** #404, #449, #450, #451 and #415 keep being deferred for one reason: nobody has measured the sync CPU that production pays. `scripts/measure-sync-cpu.mjs` signs in through `DEV_USER_EMAIL`, not the session cookie (#415), and sends only bare visits with no field prospects (#449, #450). So the 10 ms figures in `docs/free-tier-budget.md` are a floor, not the real cost.

**Approach:** This is the enabler story (retro epic #59). Extend the existing script so it authenticates the way production does: a seeded `sessions` row, its `__Host-cp_session` cookie and `AUTH_PEPPER`, with `DEV_USER_EMAIL` unset. Add knobs for the payloads that were never measured. Run it, record the numbers against 10 ms in `docs/free-tier-budget.md`, then state which of #404 and #451 the numbers settle and which need a fix story. Measure only: no change to `src/`.

## Boundaries & Constraints

**Always:** reuse `scripts/worker-cpu-shim.mjs` (real Vite-bundled Worker, D1's CPU taken out, temp copy of local D1); every timed request is a 200 *and* asserts it stored what it sent (visits, field prospects; a slide moved `last_seen_at`), so a quarantine or 401 path can never be timed by mistake; rows a request wrote are reset outside the timing; the defaults (no new knobs set) reproduce today's bare-visit run, apart from auth.

**Decisions:** #415 is closed here: `measure-dashboard-cpu.mjs` also authenticates through `seedSession` (no `DEV_USER_EMAIL`), and its warm and cold baseline is re-recorded. The spec is kept whole despite its size (owner, 2026-10-18).

**Never:** change anything under `src/`, any constant, cap or schema; optimise; lower the server's 200; bump `CLIENT_VERSION`; write to the live dev D1 (copy only); run anything `--remote`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default run | no new env | session-authenticated sync, bare visits, SIZES 1,25,50,100,200; table as today | — |
| Sliding session | `SLIDE=1` | `last_seen_at` set back past `SESSION_SLIDE_MS` before each request (untimed); each timed request slides | throw if `last_seen_at` did not move |
| Full notes and answers | `PAYLOAD=full` | each visit: 2,000-char accented notes, `scriptId` of the active script, 50 mixed answers (bool, number, short and long strings, option arrays at their caps) | throw if the server answers non-200 |
| Byte-cap worst case | `PAYLOAD=max` | every answer a `LONG_TEXT_MAX` string; visit count capped to the most that fit `MAX_REQUEST_BYTES` (UTF-8), and the table says the count actually sent | throw if a size asked exceeds what fits, naming the fitted count |
| Field prospects | `PROSPECTS=100` | 100 unique field prospects ride along with each request's visits; assert 100 stored, then delete them and their rows | throw if the count stored ≠ sent |
| Bad knob | `PAYLOAD=foo`, `PROSPECTS=101` | refuse before building | throw a clear message |

</frozen-after-approval>

## Code Map

- `scripts/measure-sync-cpu.mjs` -- the script to extend. It already seeds 200 assigned prospects, resets them, asserts the visits were stored, and runs `TOURNEE=pull|swipe`. Keep its structure and its comment style.
- `scripts/worker-cpu-shim.mjs` -- `copyLocalD1`, `buildWorker`, `d1Shim`, `timeRequest`, `at`. Add a `seedSession(sqlite, email, pepper)` here that returns `{ cookie, token }`, so the dashboard script can reuse it.
- `src/worker/auth.ts:100` `identityFromSession`: reads the cookie, then `hmacHex(AUTH_PEPPER, token)`, then a `sessions`⋈`users` select (`expires_at > now`, active user). Past `SESSION_SLIDE_MS` (1 h) it also runs an UPDATE … RETURNING.
- `src/worker/session.ts` -- `SESSION_COOKIE = "__Host-cp_session"`. `hmacHex` is lowercase-hex HMAC-SHA-256, equal to Node's `createHmac("sha256", pepper).update(token).digest("hex")`. `newSessionId` gives 32 lowercase hex characters.
- `src/worker/db/schema.ts:344` `sessions` -- `token_hash` PK, `user_email`, `created_at`, `last_seen_at`, `expires_at`, `id` (unique), `device_label`.
- `src/shared/schemas.ts:224` `answersSchema` (key ≤ `QUESTION_KEY_MAX` 60; value bool | string ≤ 2000 | number | string[] ≤ 30 × 200; ≤ 50 keys), `:647` `fieldProspectSchema`, `:660` `visitSchema` (`notes` ≤ `LONG_TEXT_MAX`).
- `src/shared/constants.ts` -- `MAX_REQUEST_BYTES` 2 MiB, `SYNC_PROSPECTS_PER_REQUEST` 100, `SYNC_VISITS_PER_BATCH` 50. The script hard-codes these numbers the way it already hard-codes 200; add a comment naming the constant.
- `src/client/field/sync.ts:109` `serializeWithinCap` -- trims visits by halving until the UTF-8 bytes fit. A real phone can send any count that fits, so `max` uses the largest count that fits.
- `src/worker/routes/agent.ts:112` -- the dedupe lookup is `chunk(keys, 1)`, which is **100 keys per statement** (`chunk` takes columns per row), not one statement per prospect as #449 says. Report this; don't change it.
- `docs/free-tier-budget.md` -- the budget table row "Worker CPU per request" (line 8), § Own login › CPU (line 36), and the Watch-outs entries « So the phone sends 50 visits a pass » and « The sync pull also reads… ». The new figures go here.
- Local D1 with the full seed: `D1_SQLITE=/home/m0/PROJECTs/captain-prospectus/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/10eb2a0f1e79505128ed29bb4a1c92c383b94742e655277f14d8083aaf02e7a2.sqlite` (313 prospects, 1,690 visits, an active script). The worktree has no `.wrangler`.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/worker-cpu-shim.mjs` -- add `seedSession` (random token, HMAC hash, `id`, `last_seen_at = now`, `expires_at = now + 90 d`) -- one home for production auth in every measurement
- [ ] `scripts/measure-sync-cpu.mjs` -- switch to the session (`AUTH_PEPPER`, no `DEV_USER_EMAIL`); add `SLIDE`, `PAYLOAD=bare|full|max`, `PROSPECTS`; validate the knobs; assert and reset as in the Matrix; print the knobs, the bytes per request and the count sent with the table; update the header -- the measurement #415, #449 and #450 ask for
- [ ] `scripts/measure-dashboard-cpu.mjs` -- authenticate through `seedSession` + `AUTH_PEPPER` instead of `DEV_USER_EMAIL`, for the timed and the `EXPLAIN=1` paths; header says so -- #415
- [ ] `docs/free-tier-budget.md` -- record the runs (machine, date, two runs, warm median/max, cold) for: bare 1/50/200 through the session; `SLIDE=1` at 50; `PAYLOAD=full` at 50; `PAYLOAD=max`; `PROSPECTS=100` with 50 visits; and the morning case `PROSPECTS=100 PAYLOAD=full TOURNEE=swipe` at 50; plus the dashboard's re-run through the session (one new entry after the existing dashboard entries). Replace the "not measured" wording, update the budget table row and § Own login › CPU -- figures have one home

**Acceptance Criteria:**
- Given the full local seed, when each documented command runs, then it exits 0 and prints a table whose every timed request authenticated through a session cookie.
- Given the recorded numbers, when the PR is opened, then its description says, for #404 (warm and cold) and #451, either "settled: close" or "needs a fix story: <one line>", plus the #449 premise correction. It refers to #404, #449, #450, #451 and #415 without auto-closing #404 or #451.
- Given the diff, then nothing under `src/` changed.

## Implementation Notes

- Implemented by a Sonnet subagent. Files touched: `scripts/worker-cpu-shim.mjs`, `scripts/measure-sync-cpu.mjs`, `scripts/measure-dashboard-cpu.mjs`, `docs/free-tier-budget.md`. Nothing under `src/` changed against the baseline.
- `seedSession` returns `{ cookie, token, tokenHash }`; the spec named only `{ cookie, token }`. `SLIDE` needs `tokenHash` to set `last_seen_at` back.
- `PAYLOAD=full`'s multi answers are 30 options (the count cap) of 20 characters, not 200. At 200 characters, 50 visits exceed `MAX_REQUEST_BYTES` and the run throws. Answer text is ASCII; only the notes are accented.
- `PAYLOAD=max` fits 19 visits (1,995 KiB). With `SIZES` unset it sends that count.
- Matrix coverage is the script's own runtime assertions, not unit tests. A measurement against a local D1 has no Vitest home. Every row was run: the four bad-knob guards throw before the build, and a short `PROSPECTS=100 PAYLOAD=full SLIDE=1 TOURNEE=swipe SIZES=50` run passed every assertion (re-run by the orchestrator).
- Findings (headline numbers, warm median / max): 50 bare visits 3.0 / 5.6 ms; 200 bare visits 7.5 / 11.1 ms; `full` at 50 10.0 / 39.5 ms; `max` 6.6 / 35.8 ms; 100 field prospects + 50 visits 6.8 / 14.5 ms; morning case 17.5 / 52.8 ms. Cold first request is over 10 ms at every size. Dashboard cold 8.9–9.3 ms through the session. Full tables are in `docs/free-tier-budget.md`.
- Unexplained: the 35–60 ms warm tails on multi-MB bodies. A larger semi-space did not move them. The doc does not claim a cause.

## Spec Change Log

## Review Triage Log

**Pass 1** (blind-hunter, edge-case-hunter, verification-gap, intent-alignment; Sonnet per the owner). Verdicts: high 0, medium 4, low 9, false 6, maybe-false 0. Verification-gap: one gap (constants unpinned), filed defer.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | blind, edge | "Cold over 10 ms at every size" vs 9.2 ms in the table | low | patch | Table's own 1-visit range is 9.2–16.0. Reworded. |
| 2 | blind, edge | Dashboard "headroom under 1 ms" from one of two runs | low | patch | 8.92 → 1.08, 9.30 → 0.70. Range quoted. |
| 3 | blind, edge | "next-but-one entry" points at the wrong entry | low | patch | The session entry is ~80 lines further. Named instead. |
| 4 | edge | Earlier "INVARIANT 13 holds for the warm case" contradicted by heavy rows | medium | patch | `full` at 50: 10 ms median. Qualified to bare visits. |
| 5 | blind | "Same seed" false for the dashboard comparison | low | patch | Door-days entry: 303 / 1,689; now 313 / 1,690. Both named. |
| 6 | blind | Session 0.2–0.3 ms and slide 0.1 ms stated as fact; cost attribution to insert / foldForSearch unprofiled | low | patch | Cross-day comparison, within noise, no ablation. Reworded as approximate / hypothesis. |
| 7 | edge | Budget row's ≤5.6 ms ignores the slide's 5.72 | low | patch | Now ≤5.7. |
| 8 | blind, edge | Warm-tail claim unreproducible; harness GC may land in the timed window | medium | patch | Orchestrator probe: with `gc()` before each request, `full` at 50 is 12.1 median / 14.9 worst vs 10.0 / 34.4. Tails are GC; still over 10 ms. Script calls `globalThis.gc?.()` under `--expose-gc`; doc records both. |
| 9 | blind, edge | `assertContent` passes with answers dropped | medium | patch | Only `answers != '{}'` was checked. Now asserts 50 keys. |
| 10 | verif, blind, edge | `seedSession` comment says the 90-day TTL is unchanged by a slide; false for the admin | low | patch | Admin TTL is 30 d (`session.ts:18-21`); the dashboard never slides. Comment corrected. |
| 11 | verif, blind | Copied constants not pinned to `src/`; a loosened limit drifts silently | medium | defer | Tightening fails loudly (non-200 / assertions); loosening does not. Constants-parity test → deferred-work. |
| 12 | edge | `max` 19 visits ≠ what a 50-visit outbox sends (halving gives 12) | false | reject | An outbox holding ≤19 such visits sends all 19; `max` is the byte-cap bound, as the doc says. |
| 13 | blind, intent | #451 not explained in the doc | false | reject | Spec AC puts the per-issue verdict in the PR description; the doc keeps figures. |
| 14 | edge | `fits` = 1 when even one visit is over the cap | false | reject | Fails loudly with a 413 in `timeRequest`; one visit is ~105 KiB today. |
| 15 | edge | `PROSPECTS=""` reads as 0 | low | reject | Unlikely typo in a dev tool; the knobs line prints PROSPECTS=0. |
| 16 | edge | Duplicate SIZES collapse | low | reject | Pre-existing behaviour, unchanged here. |
| 17 | edge | Throw before `reset` leaves rows | false | reject | The script aborts and deletes the temp copy. |
| 18 | blind | Non-slide run could slide after 1 h | low | reject | Runs take minutes; the fix adds a branch. |
| 19 | blind | Dedupe-hit path untimed | low | reject | The hit path does less work (insert no-ops). |
| 20 | intent | Local proxy, not Cloudflare's meter | false | reject | The intent names the existing local script; the doc states the hardware caveat. |
| 21 | edge | Implementation note says answer text is ASCII; short texts and options are accented | low | reject | Fix would edit this build's spec (rule); recorded here instead. |

## Design Notes

`PAYLOAD=full` stands for a realistic heavy visit: a long note and every question answered. `PAYLOAD=max` stands for the heaviest body the server accepts. The two answer different questions. `full` shows whether the 50-visit batch survives real content. `max` shows whether the byte cap, not the visit count, is what bounds CPU (#450's suggestion). Accented text (e.g. `"é"` repeated) makes notes cost 2 bytes a character, as the field does.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint && pnpm build` -- expected: all pass
- `D1_SQLITE=… node scripts/measure-sync-cpu.mjs` plus each knob combination recorded in the doc -- expected: exit 0, tables in the doc match
- `D1_SQLITE=… node scripts/measure-dashboard-cpu.mjs` -- expected: exit 0 (worst < 10 ms) or the doc records that it is over
- `git diff --stat origin/main -- src/` -- expected: empty

