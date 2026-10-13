---
title: 'Deployment, budget and agent rules describe one login'
type: 'chore'
created: '2026-10-13'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0034-launch-on-our-own-login-alone.md'
baseline_commit: '852ce8cce1129f4e11bda1b4f1a3c74e718e9490'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entries 1 to 4 of epic-access-removed deleted the Access fallback from the Worker and both clients (GH #472, entry 6, CAP-14), but docs, `CLAUDE.md` and two agent files still describe it: the First sign-in paragraph of `deployment.md`, the JWKS watch-out of `free-tier-budget.md`, the opening paragraph of `identity-access.md`, `design.md`'s "phase 2 of the cutover", the stack line and invariants 10 and 13 of `CLAUDE.md`, and the identity rules of `security-reviewer` and `api-engineer`.

**Approach:** Rewrite each to the end state: one login, a D1 session. Keep ADR links; drop every sentence that only exists to say a fallback, a token or a cutover phase is absent or pending.

Acceptance: a grep for Access, JWT, jose, phase 1 to 3, ADMIN_EMAILS, AGENT_EMAILS, reconnect=1 and cdn-cgi across `docs` (outside `docs/adr`, the roadmap's checked history and done `docs/backlog` files), `CLAUDE.md`, `.claude/agents` and `.claude/skills` returns no line that describes a fallback or a cutover phase.

## Boundaries & Constraints

**Always:** Docs and agent rules only; the rule keeps its one home (ADR-0024).

**Never:** Code, tests, ADRs, the roadmap's checked history, the spec under `_bmad-output/specs`. New login behaviour.

</frozen-after-approval>

## Implementation Notes

Oneshot: about twelve one-line prose edits across eight Markdown files, no code. The invariant-13 JWKS clause is replaced by the session HMAC key cached in module scope (`hmacKey`, `src/worker/session.ts`), which `free-tier-budget.md` already says.

## Spec Change Log

## Review Triage Log

- medium, patched: `deployment.md:7` and `architecture.md:23` kept "no Cloudflare Access in front", a sentence that only says Access is absent. Trimmed to the ADR link.
- low, patched: `design.md` rewrap left a ragged line after the "phase 2" clause. Rejoined.
- false: `free-tier-budget.md:40` "No Access application stands in front of the hostname" is the live reason anonymous `/api/auth/*` requests count against the daily quota, not a fallback. Kept.
- low, rejected: First sign-in paragraph cites ADR-0029 and not ADR-0034. ADR-0034 is linked from `deployment.md:7` and `identity-access.md`; a second link would only repeat it.

## Verification

**Commands:**
- `pnpm lint` -- expected: passes (Markdown formatting)
- `grep -rnE 'Access|JWT|jose|JWKS|phase [123]|ADMIN_EMAILS|AGENT_EMAILS|reconnect=1|cdn-cgi' docs CLAUDE.md .claude/agents .claude/skills` -- expected: no line describing a fallback or cutover phase outside the excluded files
