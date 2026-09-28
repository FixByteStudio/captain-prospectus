---
title: 'The sync strip and update banner ask before discarding a field form draft'
type: 'bugfix'
created: '2026-09-28'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: '53933884457db2e3808494a3c197dd0a43fc72cc'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the field route, "Se reconnecter" and "Mettre à jour" (sync strip) and "Mettre à jour" (update banner) navigate or reload the page. With a visit or add-prospect form open, whatever the agent typed but did not save is lost without warning (#74). The tab bar already asks first (#66); these buttons skip that check.

**Approach:** Move the leave confirmation from `FieldTabs` into `LeaveGuardProvider`. The provider then renders the one AlertDialog and exposes `leave(proceed)`: run `proceed` now when clean, or hold it and open the dialog when dirty. The tab bar, the strip and the field's update banner all go through it. Outside the provider (the admin side) `leave` runs `proceed` straight away, so admin behaviour does not change.

## Boundaries & Constraints

**Always:** Reuse the existing `copy.nav.leaveGuard` strings and the dialog exactly as #66 built it. "Annuler" leaves the draft as it was. A save's own `navigate()` never goes through `leave`. Outbox rows are never touched (INVARIANT 5).

**Never:** Keeping drafts in Dexie. Guarding admin forms. Guarding the 426 forced update (`applyUpdateNow`, the sync engine forces it when the server refuses the build). Any new dependency or copy string.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean form, strip button | not dirty, tap "Se reconnecter" or "Mettre à jour" | acts at once, as today | none |
| Dirty form, strip reconnect | dirty, online, tap "Se reconnecter" | dialog opens; "Quitter" navigates to `reconnectUrl`, "Annuler" does nothing | none |
| Dirty form, reconnect offline | dirty, `navigator.onLine` false | no dialog and no navigation: the tap was already a no-op offline | none |
| Dirty form, strip update | dirty, tap "Mettre à jour" (upgrade state) | dialog opens; "Quitter" runs `pwa.update()` or reloads, per `stripEffect` | none |
| Dirty form, update banner | dirty, `needRefresh`, tap the banner's "Mettre à jour" | dialog opens; "Quitter" runs `pwa.update()`. "Plus tard" (dismiss) never asks | none |
| Dirty form, other tab | dirty, tap another tab | unchanged from #66: dialog, "Quitter" navigates | none |
| Dirty form, current tab | dirty, tap the current tab | unchanged: never asks, never navigates | none |
| Admin update banner | no provider, tap "Mettre à jour" | updates at once, as today | none |

</frozen-after-approval>

## Code Map

- `src/client/field/leave-guard.tsx` -- `LeaveGuardProvider`, `useRegisterDirty`, `useLeaveGuard`, pure `shouldAsk`. The provider gains the pending-action state and the AlertDialog. The context gains `leave(proceed: () => void)`. The default context's `leave` calls `proceed()`.
- `src/client/field/FieldTabs.tsx` -- currently owns `pendingTo` and the AlertDialog (lines ~48-56 and ~137-163). Keep `shouldAsk` and `event.preventDefault()`, then call `leave(() => navigate(tab.path))`. Delete its local dialog and imports.
- `src/client/field/SyncIndicator.tsx` -- `SyncStrip.runAction`: compute `stripEffect` first, return early on offline `navigate`, then run the effect through `leave(...)`.
- `src/client/Band.tsx` -- `UpdatePrompt` apply button calls `leave(update)` via `useLeaveGuard`. It is shared with the admin shell (`App.tsx:414`), which has no provider, so admin falls through to the default.
- `src/client/App.tsx:144-182` -- the field shell already wraps the band, `UpdatePrompt`, `SyncStrip` and `<Outlet/>` in `LeaveGuardProvider`. No change expected.
- `src/client/field/sync-view.ts:189` -- `stripEffect` is pure. Reuse it and do not change it.
- `src/client/copy/shared.ts:53` -- `nav.leaveGuard` strings. Reuse them.
- Tests: `SyncIndicator.test.tsx` (mocks `useSyncState`, stubs `window.location`), `leave-guard.test.tsx` (minimal `Form` + `Screen` harness), `FieldTabs.test.tsx`. All run in the `dom` vitest project.

## Tasks & Acceptance

**Execution:**
- [ ] `src/client/field/leave-guard.tsx` -- add `leave` to the context and render the dialog from the provider. Update the header comment.
- [ ] `src/client/field/FieldTabs.tsx` -- route the tab tap through `leave`, drop the local dialog, and trim the header comment to point at the provider.
- [ ] `src/client/field/SyncIndicator.tsx` -- guard `runAction` as the matrix says.
- [ ] `src/client/Band.tsx` -- guard the `UpdatePrompt` apply button only.
- [ ] `src/client/field/leave-guard.test.tsx` -- `leave` runs at once when clean. When dirty it opens the dialog, "Quitter" runs `proceed` and "Annuler" does not. Outside a provider it runs at once.
- [ ] `src/client/field/SyncIndicator.test.tsx` -- render inside `LeaveGuardProvider` with a dirty form. Reconnect asks, then navigates on "Quitter". Offline reconnect neither asks nor navigates. Update asks, then calls `update` on "Quitter". Existing clean cases still pass.
- [ ] `src/client/field/FieldTabs.test.tsx` -- existing leave-guard cases stay green (adjust the render wrapper only if it needs the provider).
- [ ] `docs/design.md` (~line 1823) -- widen the "#74" paragraph: the strip's two buttons and the update banner ask the same way; the 426 forced update does not.

**Acceptance Criteria:**
- Given a dirty visit form, when the agent taps a strip button and then "Annuler", then the form keeps every value and nothing navigates or reloads.
- Given the admin shell with an update waiting, when "Mettre à jour" is tapped, then it updates with no dialog.

## Implementation Notes

- `leave-guard.test.ts` was deleted and its `shouldAsk` cases moved into `leave-guard.test.tsx`. The module now imports the vendored AlertDialog, which only the `dom` vitest project can load.
- The spec's test list had no `UpdatePrompt` coverage for the banner rows of the matrix. Added `src/client/Band.test.tsx`: a dirty form asks, dismissing never asks, and the admin side (no provider) updates at once. Also added a strip test for the `reload` effect.
- Verified: typecheck, lint, 79 files / 1,915 tests, build, and a precache of 923.93 KiB against the 1,000 KiB ceiling.

## Spec Change Log

## Review Triage Log

**Pass 1** (blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: high 0, medium 1, low 8, false 3, maybe-false 0.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | Network drops while the dialog is open; "Quitter" then sends the agent to the browser's offline page (blind, edge) | medium | patch | `onLine` was read only at tap time. Now re-checked inside `proceed`, with a new test. |
| 2 | The `leave` comment claims "not at render time" (blind, intent) | low | patch | The comment was corrected: `leave` reads the latest committed flag. |
| 3 | The `SyncIndicator.test.tsx` header says every case is dirty (blind) | low | patch | Reworded. |
| 4 | The reload test stubs `location` inline instead of using `stubLocation` (blind) | low | patch | `stubLocation` now takes an optional `reload`. |
| 5 | A pending action goes stale if the strip changes while the dialog is open (blind, edge) | low | reject | The agent has already confirmed leaving, and fixing it needs new state tracking. |
| 6 | `needRefresh` flips while a reload is pending, so a plain reload runs (edge) | low | reject | Rare. The strip offers the update again after the reload. |
| 7 | The form turns clean while the dialog is open (edge) | false | reject | The dialog is modal, so the form cannot be saved or reset under it. |
| 8 | The pure `shouldAsk` tests moved into the dom project (blind) | low | reject | Keeping them separate means splitting the module, and nobody meets this in everyday use. |
| 9 | `Band.tsx` now imports a field module into the admin graph (blind) | low | reject | `Band.tsx` already imported `./copy/field`. The precache is quoted (923.95 KiB). |
| 10 | Cancel is untested on the strip and banner, and the banner has no clean-provider case (blind) | low | reject | The generic `leave` tests cover both paths, and the callers only pass `proceed`. |
| 11 | The `FieldTabs.test.tsx` header is stale (blind) | false | reject | The header still describes the code: FieldTabs calls `shouldAsk` and `preventDefault`, and navigates on confirm. |
| 12 | No composed-shell test for the real forms (intent) | low | reject | The wiring in `App.tsx:144-182` is unchanged, and a source assertion pins the forms' `useRegisterDirty` calls. |
| 13 | The dialog copy was written for tabs (intent) | false | reject | The body ("… sera perdu") holds for reconnect and update too. It is raised with the owner as a wording choice. |
| 14 | No verification gaps (verification-gap) | — | none | Every matrix row is covered by a passing test. |

## Design Notes

A single dialog in the provider replaces one dialog per caller. That way the three callers cannot drift in copy or in button variants, and only one can be pending at a time. `leave` reads `dirty` when it is called, not when the component rendered, because the #66 rule is "read at the moment of the tap".

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test` -- expected: all green, including the new `dom` cases
- `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: both succeed, and the precache total stays under 1,000 KiB (quote the total in the PR)
