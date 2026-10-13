---
tracker_id: "467"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/467"
tracker_status: done
id: 1
type: story
title: "The Worker accepts a session and nothing else"
parent: epic-access-removed
covers: [CAP-13, CAP-14]
after: [1.2]
risk: medium
---

# The Worker accepts a session and nothing else

## Description

Tracer bullet: deletes identityFromAccess, the JWKS cache, roleFor, jose and the four Access and roster vars (types.ts, wrangler.jsonc, worker-configuration.d.ts through pnpm cf-typegen, .dev.vars.example, vitest.config.ts, scripts/measure-*.mjs), test/access-jwt.ts with every test that stubs Access, and the two branches kept for a caller with no users row (the position gate in routes/agent.ts, the own-passphrase route in routes/identity.ts), and in the same PR rewrites the caller list of identity-access.md and the fallback lines of api.md, data-model.md, field-operations.md and security.md (closes GH #457); entry 6 takes identity-access.md's opening paragraph.

## Acceptance Criteria

Verify: pnpm test is green with no test sending Cf-Access-Jwt-Assertion, a Worker test shows a request carrying that header and no session gets 401, and a grep of src/worker, test, scripts, package.json, wrangler.jsonc, worker-configuration.d.ts, vitest.config.ts and .dev.vars.example finds no jose, ACCESS_TEAM_DOMAIN, ACCESS_AUD, ADMIN_EMAILS or AGENT_EMAILS.

## References

- parent — _bmad-output/initiative-own-login/epic-access-removed/epic-access-removed.md

## Notes

- Open question: Whether pnpm cf-typegen regenerates worker-configuration.d.ts cleanly: the file is already stale (it lacks AGENT_EMAILS), so its diff may carry changes this entry did not cause.

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
