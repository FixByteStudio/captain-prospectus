---
title: '/login shows the waiting visits and the update prompt'
type: 'feature'
created: '2026-10-11'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
baseline_commit: '9a7e84771d87b7b33ace172a9358ca19c26c9a1d'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/login` leaves out two of design.md's rules (› The login page). A phone sent there by a 401 does not say that its unsent visits are safe. A 426 on sign-in shows the generic "Connexion impossible pour le moment" Alert instead of the update prompt (GH #339, epic-own-login entry 19).

**Approach:** On mount, `LoginScreen` reads how many rows `outboxVisits` holds. When there is at least one, a meta line under the lede says so in the singular or plural copy. A 426 answer to `POST /api/auth/login` raises the shared `UpdatePrompt` banner at the top of the page and sets no refusal.

## Boundaries & Constraints

**Always:** The outbox is only read (`count()`), never written or cleared (INVARIANT 5). The line counts every row in `outboxVisits` on this device, since there is no identity on `/login` to filter by. It is absent while the read is pending, when it rejects, and when the count is 0. The strings live in `copy/field` under `copy.login` and use the exact wording in design.md, with ` ` where the copy module's conventions need it. The update prompt reuses `UpdatePrompt` from `Band.tsx` with `copy.update`, and adds no new prompt component. After a 426, "Mettre à jour" applies a waiting build when `pwa.needRefresh` is true and otherwise reloads the page, the same choice `stripEffect` makes. "Plus tard" hides the prompt until the next 426. The field rules hold: native elements, `text-meta` / `text-muted-foreground` tokens, and the precache stays ≤ 1,000 KiB.

**Never:** No change to the Worker: the login route does not answer 426 today, and the client is ready for when it does. No automatic `applyUpdateNow()` on the login page, because design.md says the page asks first. The prompt does not appear on `/login` just because a build is waiting, only after a 426. The outbox line does not refresh live. `UpdatePrompt`, `pwa.ts` and `sync-view.ts` behave the same as before for their existing callers.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Two waiting | `outboxVisits` holds 2 rows | "2 visites non envoyées sont gardées sur ce téléphone. Elles partiront après la connexion." under the lede; still 2 rows after | — |
| One waiting | 1 row | "1 visite non envoyée est gardée sur ce téléphone. Elle partira après la connexion." | — |
| Empty | 0 rows | no line | — |
| Read fails | `count()` rejects | no line, form usable | swallowed |
| Both forms | swap to admin form | line stays under the admin lede | — |
| 426, build waiting | login → 426, `needRefresh` true | `UpdatePrompt` shows, no destructive Alert; "Mettre à jour" calls `pwa.update` | — |
| 426, none waiting | login → 426, `needRefresh` false | prompt shows; "Mettre à jour" reloads the page | — |
| Dismiss | "Plus tard" after a 426 | prompt goes; next 426 shows it again | — |

</frozen-after-approval>

## Code Map

- `src/client/auth/LoginScreen.tsx`: the screen. `signIn` catch at L141-150: add a 426 branch before `setRefusal`. Lede is in `CardHeader` L226-228; put the meta line right after it. The mount effect at L93-108 shows the cancelled-flag pattern to reuse for the count read. Update the header comment ("The outbox line comes with a later entry…").
- `src/client/App.tsx` L266: `<Route path="/login" element={<LoginScreen />} />` → pass `pwa={pwa}` (`usePwa()` is already called at L262 in `App`).
- `src/client/Band.tsx` L55 `UpdatePrompt({ pwa })`: renders only when `pwa.needRefresh`. `useLeaveGuard` falls back to running the action straight away outside a provider, and `/login` sits outside `LeaveGuardProvider`. Reuse it by passing a derived `PwaState` (`needRefresh: true`, `update` = `pwa.needRefresh ? pwa.update : reload`, `dismiss` = clear the 426 state). Do not edit `Band.tsx`.
- `src/client/field/db.ts`: `fieldDb` and its `outboxVisits` table. A plain `fieldDb.outboxVisits.count()` is enough. Add no helper unless a test needs one.
- `src/client/copy/field.ts` L191-217 `login`: add the plural function in the style of `copy.sync.heldBack` (L180).
- `src/client/auth/LoginScreen.test.tsx`: stubs `fetch` and wraps the screen in a `MemoryRouter`. It is a "dom" project test (happy-dom), and Dexie there needs `fake-indexeddb`: check how `App.test.tsx` or `TodayScreen.test.tsx` seeds `fieldDb`, or mock `../field/db`. `Band.test.tsx` L22 `waitingBuild()` builds a `PwaState` fixture.
- `docs/design.md` L1460-1462 (426 sentence): add that, with no build waiting yet, "Mettre à jour" reloads the page.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/copy/field.ts`: add `login.outboxWaiting(count)` with the singular and plural design.md wording.
- [ ] `src/client/auth/LoginScreen.tsx`: take a `pwa: PwaState` prop. Read the outbox count once on mount and render the meta line. Add the 426 branch and the derived `UpdatePrompt`. Refresh the header comment.
- [ ] `src/client/App.tsx`: pass `pwa` to `LoginScreen`.
- [ ] `src/client/auth/LoginScreen.test.tsx`: cover every row of the matrix, including that the outbox row count is unchanged and that a 426 renders no `role="alert"` refusal.
- [ ] `docs/design.md`: the one-clause addition above.

**Acceptance Criteria:**
- Given the existing LoginScreen and App suites, when they run, then only setup changes (the new `pwa` prop) are needed in them.
- Given `pnpm build`, when `pnpm check:precache` runs, then it passes and the PR quotes the total against 1,000 KiB.

## Implementation Notes

- Implemented by a pwa-engineer subagent, which also applied the pass-1 patches.
- `outdated` gates the prompt and `waiting` holds the count (null while pending or after a failure). `signIn` resets `outdated` before each attempt.
- Verification after the patches: `pnpm typecheck`, `lint`, `test` (101 files, 2,662 tests), `build` green; precache 981.61 KiB of 1,000 KiB. The manual `pnpm dev` check was not run here.
- Baseline `9a7e84771d87b7b33ace172a9358ca19c26c9a1d` is the merge-base with `origin/main` at branch time; re-stamp at PR time.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough; blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 0, low 7, false 5, maybe-false 0. verification-gap found no gaps.

| # | Lens | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | blind, edge, intent | The 426 branch is unreachable: `POST /api/auth/login` never answers 426 | false | reject: the intent asks for client readiness and the spec's Never excludes a Worker change; design.md already states the 426 rule |
| 2 | blind, intent | The 426 test fixture's `error: "upgrade_required"` is not the Worker's `client_too_old` | low | patch: use the real code |
| 3 | blind, edge, intent | The line promises "partiront après la connexion", but another identity's rows or an admin sign-in will not send them | low | reject: shared phones are rare, and the fix needs an identity `/login` does not have; the intent counts every row and the wording is design.md's |
| 4 | blind | The read-fails test seeds no rows, so it proves nothing | low | patch: queue rows before the rejection |
| 5 | blind | The empty-outbox test asserts absence after one `act` flush | low | patch: wait for `count()` to settle |
| 6 | blind, edge | `outboxProspects` is not counted | false | reject: the intent and design.md both say visits |
| 7 | blind | design.md does not place the `/login` prompt, and the leave-guard paragraph omits it | low | patch: two short clauses |
| 8 | blind | "Plus tard" on `/login` does not call `pwa.dismiss`, so the shell banner can show after sign-in | false | reject: that is the usual banner doing its job once a build is waiting |
| 9 | edge | `/api/me` answering 426 on mount shows no prompt | false | reject: `/api/me` has no version check |
| 10 | blind | No tests for a 426 from the admin form, a 426 then a 401, or the line's DOM position | low | reject: same code path for both forms; `signIn` resets `outdated` before each attempt; position is cosmetic |
| 11 | intent | Tests are component-level; no `pnpm dev` run | false | reject: descriptive; the manual check is listed in Verification and the PR |
| 12 | intent | The line is read once and may flash before a live identity redirects | low | reject: read-once is in the spec; the redirect replaces the page within one request |

## Design Notes

The prompt is the "usual" one so that a 426 looks the same on `/login` as in the band. It is gated on the 426 rather than on `needRefresh` alone, because the page has no band and design.md asks for the prompt only on a 426. The reload fallback follows `stripEffect`: in "prompt" mode, a reload is what lets the browser notice the new build so that the next attempt can apply it.

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: pass, total ≤ 1,000 KiB

**Manual checks (if no CLI):**
- On `pnpm dev`: queue two visits, open `/login`, read the plural line, check that the outbox still holds 2 rows. Stub `/api/auth/login` to 426 and check that the update prompt shows instead of an error Alert.
