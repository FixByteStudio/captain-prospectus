---
date: 2026-10-27
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospective: epic #632, the October 2026 retro actions are done, pinned and written down

## Epic summary

- Epic #632 (stories mode, folder `_bmad-output/initiative-retro-follow-ups-2026-10/epic-retro-follow-ups/`). Eleven stories, all `status: done` and `tracker_status: done`: #633, #634, #635, #636, #637, #638, #639, #640, #641, #642 and #562. `pending_stories`: none.
- Range: `211cdce` (tickets merged) to `3af9dff` (`main` HEAD, inferred). Per-story commits are named in the table below. `git_evidence.py` was not run (see Evidence).
- Criteria: declared, the epic's "Done when" 1 to 6.

### Evidence

| Available | Missing or narrowed |
|---|---|
| Epic and story files, the three retros' Action items, `slices.md` source trace, merged commits on `main`, `docs/`, `eslint.config.js`, `config.test.ts`, `gh` issue states | No `sprint-status.yaml` (stories mode). No session logs, so no process-lesson analysis. `git_evidence.py` and `bmad-review` were not run; aggregate views and the diff review were not done. Tests, lint, typecheck and build were not re-run in this retro, and production deploys were not checked, so Done-when 6 is unverified. |

## Findings

### Previous-retro follow-through (the user's ask)

"Landed" means a commit, file or issue state I opened. Source ids are `retro/action`.

| Action | Slice, story | Landed? | Source |
|---|---|---|---|
| 538/1 pin prospect drain | S3, #635 | Landed | `b47b4af`, `1ae11bb` (drain test, "Refs #635") |
| 538/2 docs sweep | S9, #640 | Landed | `docs/data-model.md:281` (`tournee_stops(tournee_id, number)` unique), `docs/glossary.md:30`, ADR-0036:140, `docs/api.md:28`, via `8dfc1cb` |
| 538/4 feed cursor, stamp order | S4, #636 | Landed | `bb5728f`; `deferred-work.md` entries closed_by GH #636 for the #540 and #528 deferrals |
| 538/5 which clock decides "today" | S11, #642 | **Decision landed, build not.** | `acc09d1`; `docs/domains/field-operations.md:13` "Which clock decides 'today'" (no ADR). Same file says "Not yet built". No issue exists for the implementation (`gh issue list --search "clock"`) |
| 538/6 finish R15 | S6, #638 | Landed | `4f51376`: `test/query-plan.ts`, `indexes.test.ts`, `door-days.test.ts`, `sync.test.ts:1692` (stops-insert failure), `docs/free-tier-budget.md:365-372` (`doorDayCounts` 0.9-1.05 ms). Sub-items V5, V6, V8 and the position-test clocks were not each opened |
| 538/10 process lines | S10, #641 | Landed | `d3e4d21`: `d1-migration` skill, `docs/deployment.md`, `_bmad/custom/bmad-build.toml` (midnight skew, bot comments) |
| 579/1 fix #627 | outside epic | Landed | `a1ed764`, #627 CLOSED |
| 579/2 F-A, F-G decisions | S1 + S9 | Landed | `47304c8` (break-glass refuses an agent row, test in `auth.test.ts`); ADR-0038:89-90 "an admin can mint a code for any active user... Nothing records who minted a code, and the owner accepted that" |
| 579/3 pin the removal | S2, #634 | Landed | `e59e432`: `eslint.config.js:30-51` bans an admin comparison on the field side; `auth.test.ts:316-351` (403 on sync and visits, DEV_USER_EMAIL unbound); `config.test.ts:243` keeps `passphrase` out of `src` (one allowed test); `auth.test.ts:627` TTL test with absolute times; manifest `start_url` test |
| 579/4 docs and comments | S9, #640 | Landed, with residue | 31 files in `8dfc1cb`. Residue: #659 (EXPERIENCE.md "Session expired · Admin" still says Access), #660 (`initiative-admin-field-separated.md` R4 and R8 stale) |
| 579/5 admin offline polish | S7, #562 | Landed | `b2e218b`: `AdminChunkBoundary.tsx`, `AdminOfflineScreen.tsx`; wording `unreached`; `deferred-work.md` closed_by GH #562. #562 CLOSED |
| 579/6 and 580/10 review-bot line | S10 | Landed | `release-checklist/SKILL.md:11` reworded to what the repo can meet |
| 579/7 and 580/9 process lines | S10 | Landed | `CLAUDE.md` Definition of done: `Refs #n` for `hitl`, `git push -u origin HEAD` |
| 579/9 and 580/8 one precache figure | S5, #637 | Landed | `492493b`: `package.json:12` build ends in `check-precache.mjs`; `.github/pull_request_template.md:8` |
| 580/1 F-G | S1 + S9 | Landed | as 579/2 |
| 580/2 F-A | S1 | Landed | as 579/2 |
| 580/3 day on a 24 h code, 400 as refusal | S8, #639 | Landed | `1150d96`: `CodeDialog.tsx`, `LoginScreen.tsx`, tests |
| 580/5 pin the sign-in tests | S2, #634 | Landed | as 579/3. Sub-items "two real admins" and "role flip between mint and spend" were not individually opened |
| 580/6 docs reconciliation | S9 | Landed, with residue | #619 and #621 CLOSED. #660 is the leftover |
| 580/7 the #306 half | S8 | Landed | `deferred-work.md` closed_by GH #639, "already tested since GH #355" |

### Deferred again or not landed

By the CLAUDE.md rule, a second deferral for the same reason schedules the enabler story.

1. **538/5, the day rule (N1): needs an enabler story.** It has been carried since the #496 far-behind-clock bullet, then #538, and this epic settled the decision and stopped there. The "Not yet built" line in `field-operations.md` is the third mention, and no issue or ticket holds the build (`useFieldNow` and `meta.lastSyncAt` unchanged). The epic's own note says the implementation stories are cut "outside this epic", but none is cut. This is the one item that is deferred again, and it is a sync-contract-adjacent change the next retro will find open.
2. **538/8 tracker chore and 538/9 pavement test, left out by the owner again.** 538/8 is flagged "open across three retros" and 538/9 is #496 action 1 carried; `slices.md` lists both as "left out (owner)". 579/8 (tracker hygiene) is the same. These are owner-held and were never in the epic's scope, so this is a standing deferral, not a miss. The rule would schedule them; the owner has so far chosen not to.
3. **580/4 production sign-in check, left out by the owner.** No evidence it was done or recorded on #580 (not checked: I did not read #580's comments).
4. **538/3 CodeRabbit replies, 538/7 spec reconciliation, 538/11 N4/N5 issue.** Left out or parked by the owner. The bot-line process rule (S10) removes the cause of 538/3 going forward.
5. **Not a deferral, but stale:** #646 ("SyncStatus comment says a 403 is only the cross-origin check") is still open, yet `src/client/field/sync.ts:43` was fixed by `8dfc1cb`. It should be closed.

### Found in passing, open

Each is an issue already filed by a story: #646 (stale, see above), #654 (a failed field lazy-screen load throws past Suspense), #656 (a code over its cap shows the « Saisissez … » message), #658 (DESIGN.md and stitch-handoff.md give admins a Tableau de bord tab), #659, #660, #652 (cold duplicates request over 10 ms CPU locally), #605, #597. None blocks the epic.

## Behavior verification

Not exercised. This retro read code, docs and issue states only. It did not run `pnpm test`, `lint`, `typecheck` or `build`, did not apply the epic's mutation list to confirm each one turns a check red, and did not check production.

## Action items

All proposed, none applied.

1. **Cut the day-rule implementation story from `field-operations.md` "Which clock decides today" (owner: m0hss, then api-engineer + pwa-engineer).** Treat it as the enabler under the deferral rule. Touches `useFieldNow`, `meta.lastSyncAt`, `api.md`, `data-model.md`.
2. **Close #646 (owner: m0hss).** Fixed by `8dfc1cb` at `sync.ts:43`.
3. **Run the Done-when 1 mutation list once (owner: m0hss or pwa-engineer).** It is the only way to confirm the pins fail, and this retro did not.
4. **Confirm Done-when 6 (owner: m0hss).** Check each code story reached production through CI.
5. **Owner decision on the standing left-outs (owner: m0hss):** 538/8, 538/9, 579/8, 580/4. Either schedule them or write "dropped" in the lineage's next spec, so the next retro stops listing them.
6. **Fold #659 and #660 into one docs chore (owner: docs-keeper).**

## Acceptance verdict

**Accepted-with-open-items** (criteria declared). All eleven stories are done, and the evidence supports Done-when 1 to 5: tests and lint pins exist, the feed cursor and the single precache line are in, the docs and process lines are written, and #562, #619 and #621 are closed. Open: the day-rule build (action 1), the unverified Done-when 6, and the owner's standing left-outs. Because this verdict rests on reading and not on re-running anything, it is not "accepted".

## Open questions

- Does the owner want the day-rule build cut now, or kept out until a reported field problem? (Changes action 1.)
- Was the production sign-in check (580/4) done? A comment on #580 would settle it.

## Assumptions

None recorded; interactive run. No going-in concerns were supplied beyond the invocation. No sprint-status write (stories mode).
