---
title: 'Midnight brings the gates back (story 1.9, #505)'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '864d02014ce2e0d9645ab9affe0329a108fe7d1e'
context:
  - '{project-root}/docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-496-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The field app's "today" is `lastSyncAt ?? openedAt`, so a phone left open across Brussels midnight keeps showing yesterday's tournée, numbers and Carnet until the next sync. ADR-0036 › The gates says the gates come back at midnight, and that a visit form open at midnight saves first.

**Approach:** Build `docs/design.md` › Midnight. One shared field clock moves "now" to the new day at Brussels midnight, so the gate, Tournée, Carte, Carnet and the start screen all turn over together. A visit or add-prospect form that was open when the gate closed stays mounted until the agent saves it or leaves it. The start screen it lands on opens its location dialog with the save's confirmation line.

## Boundaries & Constraints

**Always:** One clock for every field reader of "today", which today means `useTourneeGate`, `useRound` and the start screen. "Now" is the later of `lastSyncAt ?? openedAt` and the last Brussels midnight the phone crossed while open. Never read the clock during render. The clock fires on a timer set for the next Brussels midnight (`brusselsMidnightDaysFromNow`, `src/shared/period.ts`). It also re-checks when the page becomes visible, because a sleeping phone can hold the timer back. On Tournée, Carte or Carnet, the screen gives way to the new day's first gate with no message of its own, and the tab bar goes. The hold applies only to a form route (`/tournee/:id`, `/tournee/nouveau`) that was entered while the gate was open. While held, the frame and the form behave as before: tabs, leave guard, save summary. Saving writes to the outbox as usual, with `visitedAt` taken at « Enregistrer », and only then navigates. A visit saved at 00:01 is a door-day of the new day, and Carnet shows it as a numberless row (design.md › Carnet, owner's decision of 2026-10-14). After midnight, an add-prospect save queues the place and no stop, because the new day has no tournée yet. The start screen remounts for the new day, so its date and its location gate are fresh. When the agent lands there from a save, the dialog shows « Visite enregistrée. Elle partira à la prochaine synchronisation. » above its title, or `copy.add.saved` after Ajouter. The line comes from the router state the save already sets. The sync is never gated. Copy goes in `copy/field.ts`. The precache stays under 1,000 KiB, and the PR quotes the total.

**Never:** Any change to the server, the sync contract, `CLIENT_VERSION`, Dexie's schema, or `visitedAt`. No `watchPosition`. No message on a screen that gives way. No guard on the back link, since design.md › #74 guards tab taps, the strip and the banner only. No days before today on any screen. Admin screens are out of scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Tournée at midnight | swiped on D, on Tournée, fake clock D 23:59:59 → D+1 00:00 | start screen for D+1 (its date), location dialog, no tabs |
| Carte or Carnet at midnight | same, on `/tournee/carte` or `/tournee/carnet` | same start screen, no « Carte » or « Carnet » subtitle |
| Visit form across midnight | form open at 23:59, saved at 00:01 | outbox row with `visitedAt` 00:01 before the start screen renders, then the dialog shows the saved line once |
| Save summary open at midnight | « Continuer » sheet open | stays, and saving behaves as above |
| Leave the held form by a tab | dirty form, tab tap after midnight | leave guard asks, and « Quitter » lands on the start screen |
| Ajouter across midnight | add form open, saved at 00:01 | `outboxProspects` row, no `outboxStops` row, start screen with `copy.add.saved`, and the place is in D+1's snapshot |
| Deep link while gated | `/tournee/:id` opened on the start screen | start screen, no hold |
| Nothing for D+1 | no open work after midnight | « nothing assigned » message |
| Phone asleep over midnight | timer late, page becomes visible at 07:00 | new day on visibility |
| Sync at 00:05 | `lastSyncAt` moves forward | stays on D+1 |
| Start screen at midnight | not swiped on D, start screen open | remounts with D+1's date and a fresh location dialog |

</frozen-after-approval>

## Code Map

- `src/client/field/field-clock.ts` (new) -- module-level external store: `subscribe` starts one `setTimeout` to the next Brussels midnight and a `visibilitychange` listener, `getSnapshot` returns the last crossed midnight's tick (`Date.now()` at the time) or `0`. Re-arm after each fire, and clear and reset on the last unsubscribe, which keeps tests isolated. Export `useFieldNow()`: `useSyncState().lastSyncAt`, a `useState(() => Date.now())` mount time, and `useSyncExternalStore`, combined with `Math.max`. Move the "deliberately stale now" doc comment from `useRound.ts:47-55` here.
- `src/client/field/useRound.ts:44-56` and `useTourneeGate.ts:15-21,37` -- replace their own `openedAt` and `lastSyncAt ?? openedAt` with `useFieldNow()`. Drop the "Midnight timers are entry 9" line.
- `src/client/field/tournee-gate.ts` -- add a pure `holdGate(live: TourneeGate, onForm: boolean, wasOpen: boolean): { gate; wasOpen }`. `wasOpen` becomes true once `live` is open, stays true while `onForm`, and resets to `live.kind === "open"` off a form. The gate is `{ kind: "open" }` when `!open && onForm && wasOpen`. Fix the stale header line about entry 4.
- `src/client/field/useTourneeGate.ts` -- `useTourneeGate(identity, onForm)` applies `holdGate`, keeping `wasOpen` with React's adjust-state-during-render pattern, as `VisitScreen.tsx:552` does.
- `src/client/App.tsx:170-198` (`FieldFrame`) -- compute `onForm` = `/tournee/:id` matched and not `carte`, `carnet` or `nouveau`, or `/tournee/nouveau`, and pass it in. `FieldRoutes:120` gives `<StartScreen key={brusselsPeriod(now, 1).from} …>`, so it needs `now` from `useFieldNow()`, or `FieldContext` carries it.
- `src/client/field/StartScreen.tsx:38` -- replace `useState(() => Date.now())` with `useFieldNow()` for the overline. Read `useLocation().state` (`saved` or `added`) and pass `notice` to `LocationDialog`.
- `src/client/field/LocationDialog.tsx` -- optional `notice?: string`, rendered above `AlertDialogTitle` (design.md › Midnight). Reuse `copy.today.saved` (`copy/field.ts:125`) and `copy.add.saved` (`:206`), with no new strings.
- Tests: `field-clock.test.ts` (fake timers: fires at 00:00 Brussels across a DST night, re-arms, the visibility re-check, reset), `tournee-gate.test.ts` (`holdGate` table), and `App.test.tsx` › « The tournée gate » for the matrix rows above, seeded as the existing cases are. Where Dexie must keep resolving, prefer `vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })` and `vi.advanceTimersByTimeAsync`. Read the outbox before asserting the start screen renders. `LocationDialog.test.tsx` covers the notice.
- Docs: `docs/domains/field-operations.md:10` and `:115` replace « Midnight is not watched yet » with the rule. `docs/design.md:2056` says it shipped, as Carnet's slot line did. EXPERIENCE.md:209 already matches.

## Tasks & Acceptance

**Execution:**
- [ ] `field-clock.ts` + test, `useRound.ts`, `useTourneeGate.ts` -- one midnight clock -- R5.
- [ ] `tournee-gate.ts` + test, `useTourneeGate.ts`, `App.tsx` -- the hold on an open form, and the start screen keyed by day -- R5.
- [ ] `StartScreen.tsx`, `LocationDialog.tsx` + test -- the date from the clock, and the saved notice -- R5.
- [ ] `App.test.tsx` -- the matrix with a fake clock -- R5.
- [ ] `field-operations.md`, `design.md` -- R16.

**Acceptance Criteria:**
- Given a tournée swiped on day D, when the fake clock reaches D+1 00:00, then the start screen shows D+1's date under the location dialog, with no tab bar.
- Given a visit form open at D 23:59, when it is submitted at D+1 00:01, then its row is in `outboxVisits` with `visitedAt` at 00:01 before the start screen renders, and the dialog reads « Visite enregistrée… ».

## Implementation Notes

- A Sonnet `pwa-engineer` subagent implemented this from the spec, and the main session then read the diff. The main session passed the frame's `now` into `useTourneeGate(identity, now, onForm)`, so the gate and the start screen's key read one mount time, not two.
- Copy deviation: `copy.today.saved` and `copy.add.saved` do not exist. The notice reuses the same lines under their real keys, `copy.visit.saved` and `copy.fieldProspect.saved`. No new string.
- Fake clock: most `App.test` midnight cases fake only `Date` and wake the clock as a page becoming visible does, because faking `setTimeout` hangs Testing Library's settling. The Tournée case runs the real timer end to end. `field-clock.test.ts` covers the timer itself, including a DST night.
- Verification: typecheck and lint are green, with 2954/2954 tests passing. The build is green, and `check:precache` reads 25 entries and 999.61 KiB of 1,000 KiB (998.68 KiB before). The `pnpm dev` manual check with the device clock at 23:58 has not been run.
- Review pass 1 patches, by the same subagent: `useFieldNow` takes the latest of the sync, the mount and the tick. The start screen's notice is kept only for a save of its own day, read once, and the router state is then cleared (the forms add `savedAt` and `addedAt`). The notice joins the dialog's `aria-describedby`, and the Carnet wording in field-operations.md is fixed. The new clock moved tests that mock a past `lastSyncAt` onto a faked `Date` (`setPhoneClockToTourneeDay`, `tournee-test-helpers.ts`).
- After the patches, typecheck, lint and build are green, with 2956/2956 tests passing. `check:precache` reads 25 entries and 999.91 KiB of 1,000 KiB, leaving 0.09 KiB of headroom. The baseline was re-stamped at PR time from the merge-base with `origin/main`.

## Spec Change Log

## Review Triage Log

### Pass 1

Lenses: blind-hunter and verification-gap ran on Sonnet (the owner asked for Sonnet on routine work), and edge-case-hunter and intent-alignment ran on the session's model. duplication-map was skipped, since this is not a refactor sweep.

Counts: high 0 · medium 2 · low 10 · false 3 · maybe-false 0. Routes: patch 4 · defer 0 · rejected 11 · noted 2.

| Finding | Verdict | Route | Evidence / action |
|---|---|---|---|
| The tick resets when FieldFrame unmounts (admin round trip), and `lastSyncAt ?? openedAt` then reads yesterday until the next sync (intent, blind) | medium | patch | `useFieldNow` returns `max(lastSyncAt ?? 0, openedAt, crossed)`, with a test |
| The start screen shows « Visite enregistrée » for a save made before midnight, and again on a reload (edge ×3, verification-gap other, intent, blind) | medium | patch | The save puts its time in router state. StartScreen keeps the notice only for a save of its own Brussels day, captures it once and clears the state |
| The notice is outside the alertdialog's accessible description (blind) | low | patch | `aria-describedby` names the notice and the description |
| field-operations.md says every post-midnight visit is numberless in Carnet (intent) | low | patch | Reworded to match design.md › Carnet: numberless only when its prospect is not in the new day's tournée |
| A held visit form lets the agent tap Ajouter and open a new form while gated (edge) | low | rejected | A deliberate tab tap after midnight. The leave guard asks if the form is dirty, and Ajouter writes no stop after midnight. Fixing it means tracking the held path |
| The notice is lost when the new day's gate is « nothing assigned » (edge) | low | rejected | The visited prospect stays open in the cache until a pull, so the new snapshot is rarely empty. The fix adds a second notice surface |
| VisitSidePane's map (tablet) loses its pin at midnight under a held form (edge) | low | rejected | The form itself does not move. The pane is information only and tablet-only, and freezing it adds a second clock |
| A swipe in flight at 23:59:59 is remounted by the day key (edge) | low | rejected | A one-second window. The queued tournée is the eve's, and the new day asks for its swipe, as design.md says |
| Each `useFieldNow` caller keeps its own `openedAt` (edge claim, blind) | low | rejected | They can disagree only if mounts straddle midnight with no tick, and the frame's subscription covers that. The `max` patch also helps |
| StrictMode's double subscribe resets the tick (blind) | false | rejected | It happens at mount, when the tick is 0 anyway |
| Any open form is held, not only a dirty one (blind) | false | rejected | design.md › Midnight: "In an open visit form … nothing moves" |
| `onForm` holds any future `/tournee/x` route (blind) | false | rejected | Speculative. Today's routes are index, carte, carnet, nouveau and `:id` |
| No `pageshow`/`focus` re-check (blind) | low | rejected | A bfcache restore fires `visibilitychange` too. A manual clock change is not a case the design covers |
| Untested: a Carnet-origin save, leaving a held visit form, a Carnet look after a post-midnight save (blind, intent) | low | rejected | verification-gap found no gap. These paths reuse the tested hold and save, and the Carnet case is the PR's manual check |
| Test scaffolding (`jest` stub, the `weekdayOf` alias, the mock toggle) (blind) | low | rejected | Documented in the test. It works and is local to one describe |
| The hold is generic, not only midnight (intent) | — | noted | Design Notes chose this on purpose |
| Real-device timer behaviour is only argued for (intent) | — | noted | The PR's manual check |

## Design Notes

The hold is generic: any open-to-gated change under an open form waits, not only midnight. That is invariant 5's spirit, and `VisitScreen` already keeps a prospect's name through a dropped cache. The tick is a timestamp, not a counter, so `max` keeps "now" monotone and a sync after midnight cannot pull it back to yesterday.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test` -- expected: green.
- `pnpm lint && pnpm build && pnpm check:precache` -- expected: green, under 1,000 KiB (998.68 KiB before).

**Manual checks:**
- `pnpm dev` with the device clock set to 23:58: swipe, open a stop, wait past midnight, then save. The start screen shows the new date and the dialog with the saved line. Carnet, after the next swipe, lists the visit with a dash.
