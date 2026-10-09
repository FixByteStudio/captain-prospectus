---
tracker_id: "310"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/310"
tracker_status: backlog
id: 13
type: story
title: "The nightly sweep clears expired auth rows"
parent: epic-own-login
covers: [CAP-10]
after: [8]
risk: medium
refined: true
---

# The nightly sweep clears expired auth rows

## Description

Makes the daily retention run (ADR-0023) also delete the auth rows nothing can use any more. It deletes:
- **`login_codes`** whose `expires_at` has passed. A used code expires 15 minutes after it was made, so this covers used codes too.
- **`sessions`** whose `expires_at` has passed. A session that is still live is never touched, however long since it was last seen.
- **`login_attempts`** whose 15-minute window has ended. A row whose window is still open stays, so the sweep never lifts a lockout early.

Each table is bounded to a batch per run, like the visit redaction and the map-cache eviction, so a backlog drains over a few days. Each table runs in its own try/catch, as the position sweep does. A failure on one table does not stop the others or the visit redaction.

The log line adds the three deleted counts. It never carries an email, a hash, an IP or a token.

docs/data-model.md (the three "later entry" sentences) and the retention paragraph of docs/free-tier-budget.md change in the same PR.

Not here: any change to how sessions slide or how codes are spent, and no index for the sweep.

## Acceptance Criteria

Verify: Tests in retention.test.ts show:
- An expired code, a used and expired code, and an expired session are deleted. An unexpired code and a live session are kept, including a session last seen long ago.
- A `login_attempts` row whose window has ended is deleted. A row in the current window is kept, and its lockout still refuses the IP after the sweep.
- More expired rows than one batch leave the rest for the next run.
- A failing delete on one table still lets the other tables and the visit redaction run.
- The log line gives the three counts and contains no email, hash, IP or token.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md
- spec — _bmad-output/specs/spec-own-login/SPEC.md, section CAP-10
- data — _bmad-output/specs/spec-own-login/auth-data.md, section Tables
- adr — docs/adr/0029-own-login-instead-of-cloudflare-access.md, decision 11 (Sweep)
- adr — docs/adr/0023-retention-by-redaction.md
- budget — docs/free-tier-budget.md, section Cron Triggers and R2

## Notes

- Decision (2026-10-09): each table is bounded per run. A flood of failed logins from many IPs can write up to a day's request quota of `login_attempts` rows. Deleting them all in one run could use the whole D1 write quota and stop syncs that day.
- Decision (2026-10-09): no new index. The tables hold a few rows per user, so a scan costs a few reads. After a flood, `login_attempts` is read in full each night until it drains.
- Decision (2026-10-09): risk is medium, not low. A wrong comparison would delete live sessions, and every agent would then need a new code from an admin.
- Decision (2026-10-09): no new ADR. ADR-0029 decision 11 already puts these deletes in this cron.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
