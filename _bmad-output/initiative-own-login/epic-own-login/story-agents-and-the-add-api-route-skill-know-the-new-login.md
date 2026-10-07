---
tracker_id: "312"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/312"
tracker_status: backlog
id: 15
type: story
title: "Agents and the add-api-route skill know the new login"
parent: epic-own-login
covers: [CAP-14]
after: [4]
risk: low
---

# Agents and the add-api-route skill know the new login

## Description

Updates the api-engineer and security-reviewer agents and the add-api-route skill to stub a D1 session with entry 3's helper instead of Access identity, and to apply entry 4's Origin check and the auth rules.

## Acceptance Criteria

Verify: A grep of .claude/agents and .claude/skills finds no instruction to stub Access identity or trust Cf-Access headers.

## References

- parent — _bmad-output/initiative-own-login/epic-own-login/epic-own-login.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
