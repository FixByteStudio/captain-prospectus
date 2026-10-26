---
title: 'The code dialog shows the day and the login forms read a 400 as a refusal'
type: 'bugfix'
created: '2026-10-26'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
baseline_commit: 'd647ac238a58add38ab9595685f016ecfc19463b'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-580-retro-2026-10-24.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An agent code lasts 24 hours, but the code dialog shows only « jusqu'à 15:39 », which reads as already expired the same afternoon (580/3, D-1). A 400 on either login form (a pasted value over the cap) shows « Réessayez dans un instant », and the retry cannot pass (D-2). The #306 deferral at `deferred-work.md:333-336` leaves the code route's guarded insert with no issue (R-7).

**Approach:** The dialog names the Brussels day with the time, for every code, so no device clock is read. `refusalFor` maps a 400 to the existing refusal lines. The #306 entry is closed with the test that already pins the guard. The owner reviews the day format and the 400 line.

</frozen-after-approval>

## Implementation Notes

Oneshot: three small client edits, a doc line and a deferral entry, about 140 lines with the tests.

## Verification

**Commands:**
- `pnpm typecheck && pnpm test && pnpm lint` -- expected: green
- `pnpm build && pnpm check:precache` -- expected: the `check:precache` line, quoted in the PR

## Review Triage Log

- medium, patched: `it.each` title filled `%s` from the wrong columns; rows are now named objects (`$role`, `$issued`, `$hours`).
- low, patched: the test comment overstated role coverage; it now says the dialog reads only the server's `expiresAt`.
- low, patched: `design.md` now says the form's own checks stop most 400-causing values first.
- medium, deferred to #656: an over-cap value never reaches the server (the resolver stops it) and shows « Saisissez votre code. ». The 400 mapping is defensive for cap drift or a rejected body.
- false: the `closed_by` mutation was run (dropping `AND users.active = 1` fails two tests in `users.test.ts`).
- false: the build and `check:precache` were run: 25 entries (975.17 KiB) against a 1000 KiB ceiling.
