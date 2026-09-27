---
title: 'Tableau de bord tab follows the network (GH #115, fixes #93, covers #85)'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
baseline_commit: 'acfb094d994fb732bd5eee45325e8f6c011a0eb3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The shell decides "admin with a network" once, when identity resolves (`App.tsx:309`, `isAdmin = me.role === "admin" && !offline`), and nothing listens afterwards. An admin who loses the network keeps the Tableau de bord tab and taps it into an admin chunk that is not precached (ADR-0019), so the screen never loads; an admin who opened the app offline never gets the tab or the admin screens back when the network returns, until a reload. The tab and `/` also still point at `/admin/prospects`, not at `/admin`, Tableau de bord's home since #107.

**Approach:** Split the one signal into two. Admin *screens* stay gated on a server-confirmed admin in this session (invariant 10, unchanged). The tab and the `/` redirect additionally require a live network, read from the browser's `online`/`offline` events rather than from the identity snapshot. A session whose identity came from the Dexie cache re-asks `/api/me` when the network returns, so a confirmed admin regains the tab and the admin screens with no reload. Both now lead to `/admin`.

**Decisions (2026-09-26, user):** when the network returns in a session that started offline, the app re-checks the identity with the server; a confirmed admin gets the tab and the admin screens back without a reload. Losing the network hides only the tab — an admin already on an `/admin` screen keeps it, since admin offline states are #97's to design. The tab and the `/` redirect both land an admin on `/admin`. #85's offline-admin half is covered here; its identity-error-screen half stays open on #85.

## Boundaries & Constraints

**Always:** A cached identity alone never unlocks the tab or the admin routes — only a live `/api/me` answer does (invariant 10, `docs/domains/identity-access.md`). The re-check goes through the existing `resolveIdentity` branches, so a 401 still revokes and clears the agent cache (invariant 5 keeps the outbox). The online/offline signal is the same one `useSync`'s trigger 2 uses: `window` events, with `navigator.onLine` only as the initial value. The rule "which of the two admin gates is open" lives in one pure function, tested in the `unit` project. No new French string is needed — `copy.nav.tabs.dashboard` already exists.

**Never:** No re-check for a session whose identity the server already confirmed — going offline and back must not cost an extra `/api/me`. No change to `resolveIdentity`'s decision table, to the sync engine, to the outbox, or to `writtenBy` (backlog 013 is `needs-decision` and stays open; this narrows its window, it does not close it). No offline admin screen, no error boundary or retry around the admin `Suspense` (ADR-0019's accepted gap, #97's to design). No new dependency, no service-worker or precache-config change, no Carte tab.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Live admin, network drops | `/api/me` answered admin; `offline` event | Tab gone, no reload; admin routes still mounted | — |
| …and returns | `online` event | Tab back; no second `/api/me` | — |
| Admin on `/admin`, network drops | `offline` event | Stays on the admin frame | — |
| Cache-started admin | `/api/me` unreachable, admin identity cached | No tab; `/` → `/tournee`; `/admin` → forbidden | — |
| …network returns, server confirms admin | `online` event, `/api/me` → admin | Re-check runs; tab and admin routes available, no reload | — |
| …re-check unreachable again | `online` event, `/api/me` fails | Unchanged: no tab, `/admin` forbidden | falls back to cache |
| …re-check answers agent | `online` event, `/api/me` → agent | No tab, `/admin` forbidden | — |
| …re-check answers 401 | `online` event, `/api/me` → 401 | Identity-error frame, agent cache cleared, outbox intact | existing `revoked` path |
| Agent, online | role agent | No tab; `/` → `/tournee`; `/admin` → forbidden | — |
| Admin entry target | verified admin, online, `/` or tab tap | `/admin` | — |

</frozen-after-approval>

## Code Map

- `src/client/field/identity.ts` -- add one pure `adminAccess({ role, fromCache, online })` returning `{ screens, entry }`: `screens = role === "admin" && !fromCache` (today's rule, the one that gates the admin routes), `entry = screens && online` (the tab and the `/` redirect). This file already owns "what the shell does with `/api/me`" and is `unit`-tested; `resolveIdentity` itself does not change.
- `src/client/hooks/use-online.ts` (new) -- `useOnline()`: `useState(() => navigator.onLine !== false)`, then `online`/`offline` window listeners. It never re-reads `navigator` after mount, so a DOM test drives it by dispatching events alone. Same shape as `use-mobile.ts`.
- `src/client/App.tsx` -- `App()` keeps `me`/`offline`/`error` and gains `useOnline()`. Replace `isAdmin` (line 309) with `adminAccess(...)`; the `/` redirect (318) becomes `entry ? "/admin" : "/tournee"`, `FieldFrame`/`FieldTabs` take `entry`, and the forbidden (325) and `AdminApp` (350) routes take `screens`. Rename the `isAdmin` prop on `FieldFrame` to `adminOnline` — the conflation of the two facts is the bug, and the name must not invite it back.
- `src/client/App.tsx` identity effect (238–277) -- make it re-runnable: keep `settle` and the `cancelled` cleanup, add a `recheck` counter to the dep array, and a second effect that registers an `online` listener **only while `offline` is true** and bumps the counter. Trigger 2 in `useSync.tsx:121-125` is the precedent for the listener.
- `src/client/field/tabs.ts`, `FieldTabs.tsx:40,44` -- the dashboard tab's `path` becomes `/admin` (`end` stays `false`, so `isCurrentTab`'s subtree rule and `NavLink`'s matcher still agree); the `isAdmin` parameter and prop become `adminOnline`, and the doc comment, which quotes the old one-signal rule, is reworded.
- `src/client/App.test.tsx` -- the real coverage. Helpers already there: hoisted `stub` (`me`, `identityPending`, `identityUnreachable`), `renderApp(path)`, `fieldBand()`, the `admin-frame` mock, and the `beforeEach`/`afterEach` that clear `fieldDb.meta`. A cache-started admin needs `await setMeta(fieldDb, "identity", ADMIN)` before render plus `stub.identityUnreachable = true`; flipping that flag back mid-test is what a successful re-check looks like. Wrap `window.dispatchEvent(new Event("online"))` in `act`.
- `docs/design.md` § Tab bar, "Four possible slots" -- its last two sentences document today's bug as the rule ("`offline` itself is decided once … there is no live online/offline listener"). Replace with the two gates, the re-check, and the `/admin` target.
- `docs/domains/identity-access.md` § Offline and session expiry -- one paragraph: the cached identity opens the field side only, and the network returning re-asks `/api/me` rather than waiting for a reload.
- `docs/backlog/010-offline-admin-dom-test.md` + `docs/backlog/README.md` -- that queued task's whole goal is inside AC "no tab for a cache-started admin"; set `status: done` and mark the README row done (superseded by #115), or the night shift opens a duplicate PR.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/identity.ts`, `identity.test.ts` -- `adminAccess` plus its matrix: role × `fromCache` × `online`, including that deleting `&& online` or `&& !fromCache` fails
- [ ] `src/client/hooks/use-online.ts` -- the hook; covered through `App.test.tsx` rather than a test of its own
- [ ] `src/client/field/tabs.ts`, `tabs.test.ts` -- `/admin`, the parameter rename, the reworded comment
- [ ] `src/client/field/FieldTabs.tsx`, `FieldTabs.test.tsx` -- prop rename, `href` now `/admin`
- [ ] `src/client/App.tsx` -- the two gates, the `/` target, the re-runnable identity effect and the conditional `online` listener
- [ ] `src/client/App.test.tsx` (dom) -- one case per matrix row that needs a DOM: the live admin's tab following both events, the admin staying on `/admin` through `offline`, the cache-started admin's three re-check outcomes (confirmed / unreachable / agent), `/` → `/admin`, and the cache-started admin's `/admin` deep link showing forbidden in the field frame
- [ ] `docs/design.md`, `docs/domains/identity-access.md` -- DoD
- [ ] `docs/backlog/010-offline-admin-dom-test.md`, `docs/backlog/README.md` -- retire the superseded task

**Acceptance Criteria:**
- Given `pnpm vitest run --project dom src/client/App.test.tsx`, when `App.tsx`'s `&& online` is deleted by hand, then at least one new case fails; same for `&& !fromCache` and for the `online` listener effect. Quote the three mutation results in the PR and commit none of them.
- Given `pnpm build && pnpm check:precache`, then it passes and the PR quotes the total and the entry chunk against the 1,000 KiB ceiling (ADR-0026). Baseline at `acfb094`: 686.44 KiB total, `assets/index-*.js` 505.29 KiB.
- Given `pnpm dev` as an admin with devtools Offline, when the network is toggled off and on from `/tournee`, then the tab disappears and returns with no reload; reloading offline and then going online brings the tab and `/admin` back with no reload.

## Implementation Notes

- Implemented by a subagent from this spec, then patched by the same one from the review's 10 patch groups. All
  Verification commands re-run by the orchestrator after the patches: 53 files / 1159 tests, typecheck and lint
  clean, `App.test.tsx` 20/20 three times, `check:precache` **686.93 KiB of 1,000** (baseline at `acfb094`:
  686.44) with the entry chunk at **505.79 KiB** (baseline 505.29) — +0.49 KiB total, +0.50 KiB entry.
- `baseline_commit` re-checked at hand-over: the merge-base of `fix/115-admin-tab-offline` and `main` is still
  `acfb094d994fb732bd5eee45325e8f6c011a0eb3`, so the stamp did not move (epic #59 retro, action 6).
- Matrix audit: every row has a passing covering test. Two rows were **not** covered by the first
  implementation and were closed before review — the 401 re-check (error frame + cleared cache) had no test at
  all, and the "admin routes available" half of the confirmed-re-check row was asserted only as the tab
  returning. The agent-role row's `/admin` half rests on the pre-existing forbidden case plus
  `identity.test.ts`'s agent matrix, since `screens` is false for an agent by either term.
- Deviation from the Code Map: the re-check is **not** the `online`-listener-while-`offline` the Code Map
  described. Review found that form drops an event firing during the first fetch and never fires at all for the
  cache-branch failures that leave `navigator.onLine` true. It is now a state-driven effect on
  `[identityFromCache, online]`. A plain derived boolean was considered and rejected: it fires a spurious third
  `/api/me` when a successful re-check flips the condition back off, which the counter does not. The effect
  carries this repo's first `eslint-disable` (`react-hooks/set-state-in-effect`), scoped to one line with its
  reason.
- `App.tsx`'s `offline` state is renamed `identityFromCache`. It never meant "no network" — a Worker 500 or a
  captive portal reaches the same branch — and reading it as such is the conflation this bug is.
- Mutation checks, re-run by the orchestrator against the final tree and reverted (both files then verified
  byte-identical to their pre-mutation copies): deleting `&& online` from `entry` → 4 failures; deleting
  `&& !fromCache` from `screens` → 5; removing the re-check effect → 4; substituting `screens` for `entry` at
  the `/` redirect → 1.
- Closes GH #135 (`/` sent an admin to `/admin/prospects`) as AC5's side effect, and retires backlog task 010
  as superseded so the night shift cannot open a duplicate PR.
- Found in passing, already tracked: `src/client/api.ts:27` inlines a French string that is not in `copy.ts`
  (GH #101). Nothing else new — five review findings were deferred to `deferred-work.md` instead.
- Not run here: the manual six-step reproduction in `pnpm dev`, which needs a browser and an admin
  `.dev.vars`. The DOM cases drive the same event sequence, but the browser check itself is outstanding.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). 31 findings.
Verdicts: 0 high, 6 medium, 12 low, 8 false, 0 maybe-false, 5 pre-existing. Routed: 10 patch groups, 5 defer,
13 rejected. No intent_gap and no bad_spec: the frozen **Always** already pins the signal to `window`
`online`/`offline` events, so the reachability-vs-event question the lenses raised is settled inside the intent,
and the patch below closes the reachable cases without leaving that constraint.

**G1 `medium` / patch — the re-check's trigger was an event, not a state.** verification-gap (other findings),
blind-hunter x2, edge-case-hunter, intent-alignment D1, converging. The listener was armed only once `offline`
was true, and `offline` is set after an `await` inside `settle`, so an `online` event during the first `/api/me`
was dropped; worse, `resolveIdentity` funnels *any* non-401 failure to the cache branch, so a Worker 500, a
captive portal or a DNS failure leaves `offline` true with `navigator.onLine` still true and no `online` event
ever fires — the "until a reload" this spec exists to remove. Verified: `App.tsx:286` is the only client
`/api/me` call site and `setRecheck` had one caller. Fix: drive the re-check from `if (offline && online)` on
`[offline, online]`. One attempt per transition, no loop, and it incidentally dedupes repeated `online` events.

**G2 `medium` / patch — the `/` redirect's gate was unpinned.** verification-gap (pre-verified, demonstrated:
substituting `screens` for `entry` at that `Navigate` passed 55/55), blind-hunter, intent-alignment D2. Every
case started online and dispatched events afterwards, so nothing covered a session that *starts* with the
browser reporting offline, and nothing observed `useOnline`'s `navigator.onLine` seed. Fix: one case that seeds
the getter false at mount, which pins both.

**G3 `low` / patch — one test asserted before its promise chain resolved.** blind-hunter. In "leaves a
cache-started admin unchanged", the negative assertions ran after a synchronous `act`, so they would also have
passed had the re-check wrongly granted the tab. Fix: `await act(async () => ...)`.

**G4 `medium` / patch — the docs stated the old rule and the new one.** edge-case-hunter x2, blind-hunter x2.
Verified by reading `docs/design.md:1086-1088`: the paragraph still said "`me.role === \"admin\" && !offline`,
the one signal `App.tsx` already computes, never a second one" two sentences before the new text contradicted
it. Both paragraphs also claimed `useSync`'s trigger 2 uses the `online`/`offline` pair (it listens to `online`
only) and promised recovery "once the network returns" without saying how the return is detected.

**G5 `medium` / patch — the ADR-0019 note claimed a consequence this change did not cause.** intent-alignment
D5, edge-case-hunter, blind-hunter. Correct and conceded: the old `offline` was a one-shot snapshot, so a
server-confirmed admin already kept the admin routes after the network dropped. The note (written by the
orchestrator, not the implementer) is cut to the part this change did cause — the rule's new name — and its
mechanism claim goes with it.

**G6 `low` / patch — stale `isAdmin` comments.** edge-case-hunter, blind-hunter, intent-alignment D7.
`App.test.tsx:5,149` still named the deleted identifier; verified.

**G7 `low` / patch — naming conflation.** blind-hunter. `adminAccess({ role, fromCache: offline, online })` put
`offline` and `online` side by side meaning different things — the very conflation this spec undoes. The state
becomes `identityFromCache`.

**G8 `low` / patch — `use-online.ts`'s comment claimed `use-mobile.ts`'s shape**, which guards
`typeof window`; this reads `navigator` unguarded. The claim is dropped, not the idiom: unguarded `navigator` is
what the repo already does (`SyncIndicator.tsx:132`), and no node-project test imports this module.

**G9 `low` / patch (comment) — `end` divergence undocumented.** blind-hunter. The field tab keeps `end: false`
where `admin/nav.ts` uses `end: true` for `/admin`. The paired claim that no test covers
`isCurrentTab("/admin/prospects", "/admin")` is **false**: `entry` implies `screens`, and a screens-true admin
gets `AdminApp` at `/admin/*`, so the dashboard tab can never render on an `/admin` path and `end` is
unobservable there. A comment records that instead of a test for an unreachable state.

**G10 `low` / patch — backlog 010's banner.** blind-hunter. Its kept criteria read as live while naming deleted
code. The paired claim that `status: done` is premature before merge is **rejected**: backlog 005 was flipped in
its own implementing PR (`acfb094` touches that file), which is this repo's precedent.

**defer** — EC5: a re-check answering 401 mid-session swaps the shell for the error frame and discards a dirty
visit draft with no confirm. The error path itself is frozen AC3; the draft loss is the #74/#75 class, now
reachable by one more path.

**defer** — EC6 + intent-alignment D4: a re-check answering a *different* email clears the cached round and
visit history under a live, already-rendered screen, and swaps `SyncProvider`'s identity; neither is asserted.
Backlog 013 (`needs-decision`) owns this territory.

**defer** — EC2 + EC7: with `navigator.onLine` stuck true on a dead uplink the tab stays and tapping it fetches
the un-precached chunk; and a rejected lazy import throws past `Suspense` rather than hanging as ADR-0019's
Consequences describe. Pre-existing and accepted there; #97 owns the offline-admin screen.

**defer** — intent-alignment D6: the client now carries four distinct notions of "offline" (sync reachability,
identity cache-sourcing, `useOnline`'s events, and a raw `navigator.onLine` read).

**defer** — blind-hunter: `docs/vision.md`'s recorded figures (782 KiB precache, 164.71 kB entry) are stale
against today's 686.44 KiB baseline, and ADR-0019 names vision.md as their home.

- **rejected** (`low`, unlikely, and the repo's own `use-mobile.ts` has the identical window): edge-case-hunter.
  An `online`/`offline` event landing between `useOnline`'s render and its effect commit is lost.
- **rejected** (`low`; the G1 patch dedupes no-op `online` events, and an `inFlight` ref would add state):
  edge-case-hunter. A flapping link stacking `/api/me` fetches.
- **rejected** (frozen intent): blind-hunter. "A confirmed admin who hits `/` while offline is left with no
  entry point." AC5 says a user who is not a verified admin *with a network* lands on `/tournee`. The
  documentation half of the finding is folded into G4.
- **rejected** (out-of-scope rejection requires the *intent* to exclude it; this intent includes it):
  blind-hunter. The `/admin/prospects` → `/admin` retarget is AC5 and closes GH #135.
- **rejected** (not a defect of the diff): blind-hunter. The precache total is quoted in the PR description,
  which is where ADR-0026 asks for it; the figures are 687.03 KiB / 505.88 KiB entry.
- **rejected** (`false`): blind-hunter. That no test covers `isCurrentTab("/admin/prospects", "/admin")` — see
  G9's refutation: the state is unreachable.
- **rejected** (descriptive): intent-alignment D3. `tabs.test.ts` and `FieldTabs.test.tsx` are rename-only. True,
  and correct: the behaviour they cover did not change.
- **rejected** (descriptive, and confirmed): intent-alignment's "not divergent, checked" set and
  verification-gap's clean list — `screens` is byte-for-byte the old rule, `entry` can never open wider,
  `/admin` resolves to `AdminApp`'s index, no stale `/admin/prospects` consumer survives, and a confirmed
  session pays no extra `/api/me`.

## Design Notes

**Two gates, not one.** `screens` is the security decision and keeps today's definition, so invariant 10 is untouched. `entry` is usability layered on top — do not show a door that cannot open (ADR-0019: the admin chunk is a network fetch whose failure is a blank `aria-busy` hang). Keeping them apart is what lets an admin already on `/admin` stay there when the network drops (#97 owns what that screen then says).

**The re-check is conditional on purpose.** Only a session running on a cached identity gains from re-asking `/api/me`; `offline` is exactly that condition, so the listener lives while it is true and goes when it turns false.

## Verification

**Commands:**
- `pnpm test` -- expected: all three projects pass
- `pnpm typecheck` -- expected: clean
- `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0; total and entry chunk quoted
- `pnpm vitest run --project dom src/client/App.test.tsx` -- run three times, expected: green each time (the identity effect's unawaited `meta.identity` write makes this suite order-sensitive, per its own `beforeEach`)

**Manual checks:**
- `pnpm dev` with `.dev.vars` naming an admin: the reproduction's six steps, at 390 px and 1280 px.
