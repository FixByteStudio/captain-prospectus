# Review log: own-login-oq

Target: `_bmad-output/specs/spec-own-login/` (SPEC.md open questions)

<!--
Append-only record of outcomes/decisions.
Main purpose: persisted context for resuming or analyzing
the review process. You're writing this log for consumption
by another LLM session.

Record decisions and their reasons, user constraints, unresolved
findings, and references needed to recover evidence. Link to large
results rather than copying them here.
This is NOT a transcript or internal deliberation.
The review narrative (the human-facing file) owns review blocks
and their statuses.

Log entry:
Use format below. Omit empty fields. In Result, give each finding's
disposition: fixed, accepted as-is, deferred, or open. When a
disposition changes, append a new entry; do not edit earlier ones.
Record the actual session ID supplied by the environment and an ISO
8601 timestamp with local timezone for each entry. If the session ID
is unavailable, write "unavailable" rather than inventing one.

Token budget: up to 150 tokens per entry.
The smaller the better, but do not sacrifice precision.
-->

## 1 — Orientation — started

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: review of the 7 open questions in the spec distilled from ADR-0029
- Result: answers go back into the spec memlog via bmad-spec, and to ADR-0029 if the user agrees
- Evidence: SPEC.md › Open Questions

## 2 — Intent — accepted

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: reviewer review of Intent block (SPEC.md context)
- Result: reviewer accepted intent and skipped broad strokes

## 3 — Q1 passphrase format — decided

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: decision on Q1 passphrase format and entropy
- Result: option A, 20 Crockford base32 chars in 5 groups of 4 (100 bits), shared alphabet and normaliser with agent codes; rejected diceware (60 KB English wordlist) and base64url (hard to type)
- Evidence: decision appended to `_bmad-output/specs/spec-own-login/.memlog.md`
- Open: SPEC.md re-derived at wrap-up

## 4 — Q2 passphrase form — decided

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: decision on Q2 passphrase form (email inclusion)
- Result: option A, email + passphrase; lookup by users.email then hash compare; break-glass is OWNER_EMAIL + BREAK_GLASS in the same form; generic error for wrong email or passphrase; reason: password managers autofill reliably only with a username field; rejected passphrase-only (needs unique hash index, field doubles as break-glass)
- Evidence: `_bmad-output/specs/spec-own-login/.memlog.md`

## 5 — Q3 device label — decided

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: decision on Q3 device label source
- Result: option C plus created_at: label is a parsed User-Agent summary only (device family + browser, never raw UA); sessions gains created_at; Agents page shows label, enrolled date and last seen per user. Reviewer reasoning: sessions are listed per user, so enrol time and last seen tell same-model devices apart; recommendation A (admin-typed name) rejected as unnecessary.
- Evidence: `_bmad-output/specs/spec-own-login/.memlog.md`
- Open: auth-data.md sessions row to gain created_at at re-derive

## 6 — Q4 code reuse — decided

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: decision on Q4 code reuse (new code voids unused codes)
- Result: option A, one live code per user; a new code deletes that user's unused codes; two devices enrol one after the other; reason: the code on screen is always the working one, a lost code dies at once
- Evidence: `_bmad-output/specs/spec-own-login/.memlog.md`

## 7 — Q5 deactivated agent's prospects — decided

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: decision on Q5 deactivated agent's prospects handling
- Result: option A, fourth À traiter row "Prospects sans agent actif {n}" → Réassigner (Prospects filtered to inactive agents; existing `?assignedTo=` filter in src/client/admin/prospect-filters.ts:126 covers one agent, an "inactive agents" filter is new); deactivation dialog states the count; deactivated users leave the assign menu.
- Open: EXPERIENCE.md (ux-captain-prospectus-2026-09-24, owned by the UX run) and docs/design.md say À traiter has three rows — both need updating

## 8 — Q6 lockout message — decided

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: decision on Q6 lockout message display
- Result: option A, 429 + Retry-After; /login shows "Trop de tentatives depuis cette connexion. Réessayez à {heure}, ou changez de réseau." and disables submit until then; rejected generic error (valid code would look broken, admin regenerates codes in vain)
- Evidence: `_bmad-output/specs/spec-own-login/.memlog.md`

## 9 — Q7 phase-2 exit — decided

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: decision on Q7 phase 2 exit condition
- Result: option A, phase 2 ends when every active user has ≥1 live session, shown as Inscrit / Pas encore inscrit on the Agents page; rejected a JWT-fallback counter (temporary scaffolding) and no rule (agent stranded mid-round)
- Evidence: `_bmad-output/specs/spec-own-login/.memlog.md`

## 10 — Review — wrap-up proposed

Session: 653aca43-483e-4e7f-8158-7c9be577f00b · Timestamp: 2026-10-07T13:58:32+02:00

- Action: review wrap-up
- Result: all 7 open questions resolved and appended to the spec memlog
- Open: re-derive SPEC.md/auth-data.md/cutover.md, optionally amend ADR-0029 (status proposed), EXPERIENCE.md + docs/design.md four-row À traiter, commit
