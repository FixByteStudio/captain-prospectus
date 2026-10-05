---
title: 'ADR-0028: agent position at sync'
type: 'chore'
created: '2026-10-05'
status: 'done'
baseline_commit: 'd25cd14a8795aec5323474c95a2c9ed0bbf429f8'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context:
  - '{project-root}/docs/adr/0024-adrs-only-for-hard-to-reverse-decisions.md'
  - '{project-root}/docs/adr/0023-retention-by-redaction.md'
  - '{project-root}/.claude/skills/new-adr/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 5's admin round view orders an agent's stops from where the phone is, but the server has never held an agent's position: `docs/security.md` promises the round-ordering reading "is never persisted or sent", `docs/vision.md` says position is "captured at check-in only", and field-operations.md calls agent-position retention undecided. Storing it is new personal data and a sync-contract change, so it needs an ADR before any code (ADR-0024).

**Approach:** Write ADR-0028 recording the decision already taken with the owner (epic Notes, 2026-10-05), get a security-reviewer verdict on it, and change every doc that states the old rule, so stories 5.2–5.6 build against one written rule.

## Boundaries & Constraints

**Always:**
- The ADR's decision, in the epic's words: the phone sends the last reading `useAgentPosition` already took today (Brussels) as an optional sync field; sync never calls geolocation; no reading from today → no field. The server keeps one row per agent, a newer `capturedAt` overwrites and an older one never does; `capturedAt` is clamped to `received_at` (invariant 12); a row not from today is served as null and deleted by the daily retention sweep. Only admins see it, only in Terrain › Tournée du jour; never in exports.
- The ADR shows how this fits vision.md's no-continuous-tracking non-goal (no `watchPosition`, no background reading, no history kept), invariant 2 (the row is the agent's own, not shared prospect data; the server upsert is not an agent-side update of shared data), invariant 4 (the write is idempotent by key and `capturedAt` order), invariant 9 (optional field, no `clientVersion` bump) and invariant 12.
- Follow the `new-adr` skill: template sections, ≥2 alternatives each with a concrete reason, consequences including what gets harder, `Status: proposed` until the owner approves in the PR, then `accepted` before merge; README row.
- Each changed doc gets one line linking ADR-0028, not a copy of its reasoning (ADR-0024: one home per rule).
- Decision (owner, 2026-10-05): the admin map shows the exact position dot with its age beside it, as the mockup and DESIGN.md › Map draw it; no coarsening.
- Decision (owner, 2026-10-05): the owner tells both agents before 5.3 ships; the ADR records it as a consequence, and `.claude/skills/release-checklist/SKILL.md` gains one check for it. No field-app disclosure.

**Never:**
- No code, schema, migration or `src/` change — that is 5.2 and 5.3.
- Do not re-open the decision the owner already took (what is sent, retention, visibility); the ADR records it.
- Do not edit an accepted ADR other than to mark it superseded (none is superseded here; ADR-0023 is amended by reference only, not edited).

</frozen-after-approval>

## Code Map

- `docs/adr/0000-template.md` -- the shape to copy; ADR-0023 is the house style (Context facts with bold lead-ins, a "We will" decision, alternatives table, consequences bullets).
- `docs/adr/0023-retention-by-redaction.md` -- precedent: location is personal data, `received_at` is the clock, the sweep in `src/worker/retention.ts` is daily and logged. ADR-0028 extends that sweep; cite it, don't restate it.
- `docs/adr/README.md` -- add row 0028 after 0027.
- `docs/security.md:37-41` -- "Agent location" bullet says the today-list reading is never persisted or sent: rewrite to say the last reading of the day is sent at sync and kept until the overnight sweep, per ADR-0028; add the retention of `agent_positions` to the Retention bullet.
- `docs/vision.md:30` -- "Position is captured at check-in only." → one sentence: no continuous tracking; the last reading of the day goes with a sync (ADR-0028).
- `docs/domains/field-operations.md:5` (round ordered from the phone's position) and `:199` ("whose retention is still undecided") -- state the rule and link ADR-0028; exports still exclude positions.
- `docs/glossary.md` table -- add **Agent position** | Position | the last reading the phone took today, sent at sync, one per agent, gone overnight | location history, tracking.
- Reading sources the ADR names: `src/client/field/useAgentPosition.ts` (`getCurrentPosition`, `maximumAge` 2 min, used by `useRound.ts`, `VisitScreen.tsx`, `AddProspectScreen.tsx`). Do not change them.
- Shape 5.2 builds: `agent_positions(agent_email PK, lat, lng, accuracy, captured_at, received_at)`; `GET /api/admin/agents/:email/round` → `position: {lat,lng,accuracy,capturedAt} | null`.

## Tasks & Acceptance

**Execution:**
- [ ] `docs/adr/0028-agent-position-at-sync.md` -- write the ADR per Boundaries; Deciders: owner; Date 2026-10-05; Status proposed -- the decision record 5.2–5.6 cite.
- [ ] `docs/adr/README.md` -- add the 0028 row -- index.
- [ ] `docs/security.md`, `docs/vision.md`, `docs/domains/field-operations.md`, `docs/glossary.md` -- replace the old rule with one line linking ADR-0028 -- no doc contradicts the ADR.
- [ ] `.claude/skills/release-checklist/SKILL.md` -- add one check: before the release carrying 5.3, the owner has told both agents their last reading of the day goes with each sync -- Decision 2.
- [ ] Run the `security-reviewer` subagent on the ADR and the doc diff; record its verdict in Implementation Notes for the PR -- the epic's Done when 1.

**Acceptance Criteria:**
- Given the branch, when `grep -rn "check-in only\|never persisted or sent\|still undecided" docs/` runs, then nothing about agent position matches.
- Given ADR-0028, when read alone, then it names what is sent, when, what the server keeps, for how long, who sees it, and why that is not tracking, with each invariant it touches cited.
- Given the PR, when the owner approves, then ADR-0028 and its README row say `accepted` before merge, and the PR links the security-reviewer verdict.

## Implementation Notes

- Implemented directly in the session (the owner declined the implementation subagent).
- Files: `docs/adr/0028-agent-position-at-sync.md` (new), `docs/adr/README.md`, `docs/security.md`, `docs/vision.md`, `docs/domains/field-operations.md`, `docs/domains/identity-access.md` (Permissions row, added at review), `docs/glossary.md`, `.claude/skills/release-checklist/SKILL.md`.
- The first AC's grep still matches two lines in ADR-0028 itself, where its Context quotes the old wording; no other doc matches.
- **security-reviewer verdict (2026-10-05): APPROVED WITH CHANGES.** All five changes were applied in the ADR: (1) the reading lives in module memory, stamped with its identity, never sent under a cache-sourced or different identity, dropped by `clearAgentCache`; (2) a bad `position` is dropped on its own and never fails a sync; (3) the server-side Brussels "today" rule for write, read and sweep, the single-statement strict-newer upsert, and `capturedAt` = fix timestamp; (4) "one day" and "no history" are qualified for Time Travel and the R2 backup; (5) the endpoint contract (`requireAdmin`, lowercased email, `no-store`, no echo in sync), admins' own positions not stored, and the identity-access.md Permissions row. Link this verdict in the PR.
- ADR status stays `proposed` until the owner approves in the PR; then ADR and README row go to `accepted` before merge.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-05): high 2, medium 6, low 8, false 6, maybe-false 0. No intent_gap or bad_spec; patches applied in place, one deferral.

| # | Lens | Finding | Verdict | Route | Evidence / action |
|---|---|---|---|---|---|
| 1 | security, blind | Where the phone keeps the reading is unsaid; shared phone could send A's reading under B | high | patch | ADR: module memory, identity-stamped, dropped on switch/`clearAgentCache` |
| 2 | security | Invalid `position` could 400 every sync and stall the outbox | high | patch | ADR: field parsed alone, dropped on failure (INVARIANT 5) |
| 3 | security, blind, edge | Server never checks "today"; phone clock decides | medium | patch | ADR: write/read/sweep rules on clamped time, Brussels, DST-aware |
| 4 | edge | Resend from a fast-clock phone re-clamps and resets the age | medium | patch | ADR: compare the phone's `capturedAt` as sent; clamp on read |
| 5 | edge, security | Tie rule and race unspecified | medium | patch | ADR: one statement, strict `>`, equal is a no-op |
| 6 | edge, blind, security, intent | "Lives one Brussels day at most" / "no history" overstate storage | medium | patch | Reworded; Time Travel and R2 windows named |
| 7 | security | Endpoint contract and admins' own positions undecided; Permissions row missing | medium | patch | ADR section "Who sees it"; identity-access.md row |
| 8 | blind, intent | Docs state the rule as already in force; security.md tense | medium | patch | security.md, field-operations.md say "once/with epic 5" |
| 9 | edge, security | `capturedAt` source unspecified (2-min cached fix) | low | patch | ADR: `GeolocationPosition.timestamp` |
| 10 | blind, edge | `accuracy` has no unit or bound | low | patch | ADR: metres, finite, non-negative, capped |
| 11 | blind | Invariant 4 upsert not named as the permitting doc | low | patch | ADR says so |
| 12 | blind | Release-checklist item names a story | low | patch | Generalised |
| 13 | blind | Glossary: "admin's Tournée du jour" collides with Today list | low | patch | Wording says "admin round view" |
| 14 | security | Logging of positions unspecified | low | patch | ADR: counts only; own try/catch |
| 15 | intent | security.md/vision.md read as "only the final reading" | low | patch | "latest reading taken today" everywhere |
| 16 | blind | "Removing the field later would also be additive" is wrong | low | patch | Claim removed |
| 17 | blind | CLAUDE.md invariant 2 may need a carve-out line | low | defer | Agent-context file; deferred-work.md |
| 18 | blind | Does sync fire with an empty outbox? | false | reject | `sync.ts:255`: app start, online, after each visit, every 60 s |
| 19 | edge | Removed agent's row still readable | false | reject | Endpoint refuses non-assignable emails (ADR, entry 2) |
| 20 | blind | ADR-0023 needs an "Amended by" back-link | false | reject | Accepted ADRs are only edited for status (README, ADR-0024); "Amends:" on the new ADR is the convention |
| 21 | blind | free-tier-budget lacks the per-sync write | false | reject | The sync already writes; one bounded upsert, no new quota line (ADR-0002 unaffected) |
| 22 | edge, intent | `docs/backlog/002` and EXPERIENCE.md still say undecided | false | reject | Done backlog task and a dated planning artifact are history, not rule homes (ADR-0024) |
| 23 | edge, intent, security | `useAgentPosition` comment, design.md:1304, data-model.md drift | false | reject | Code facts that change with 5.2/5.3; the ADR's follow-up names each |

## Verification

**Commands:**
- `pnpm lint` -- expected: passes (Prettier on Markdown).

**Manual checks (if no CLI):**
- Every ADR-0028 link resolves; the grep in the first AC returns nothing about position.
