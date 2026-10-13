---
tracker_id: "472"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/472"
tracker_status: done
id: 6
type: story
title: "Deployment, budget and agent rules describe one login"
parent: epic-access-removed
covers: [CAP-14]
after: [1, 4]
risk: low
---

# Deployment, budget and agent rules describe one login

## Description

Rewrites what still describes a fallback once entries 1 to 4 have removed it: the First sign-in paragraph of deployment.md, the JWKS watch-out of free-tier-budget.md, the opening paragraph of identity-access.md, design.md's mention of phase 2 of the cutover, the stack line and invariants 10 and 13 of CLAUDE.md, and the identity rules of the security-reviewer and api-engineer agents.

## Acceptance Criteria

Verify: A grep for Access, JWT, jose, phase 1 to 3, ADMIN_EMAILS, AGENT_EMAILS, reconnect=1 and cdn-cgi across docs (outside docs/adr, the roadmap's checked history and done docs/backlog files), CLAUDE.md, .claude/agents and .claude/skills returns no line that describes a fallback or a cutover phase.

## References

- parent — _bmad-output/initiative-own-login/epic-access-removed/epic-access-removed.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
