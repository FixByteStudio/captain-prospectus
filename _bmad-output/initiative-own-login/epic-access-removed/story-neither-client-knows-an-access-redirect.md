---
tracker_id: "469"
remote: "https://github.com/FixByteStudio/captain-prospectus/issues/469"
tracker_status: backlog
id: 3
type: story
title: "Neither client knows an Access redirect"
parent: epic-access-removed
covers: [CAP-12, CAP-14]
after: [2]
risk: medium
---

# Neither client knows an Access redirect

## Description

Removes the access_redirect error code and every branch on it (api.ts, field/identity.ts, admin/query-client.ts, admin/queries.ts, auth/LoginScreen.tsx and their tests), keeps redirect: "manual" as a guard so an opaque redirect is an ordinary failure and never a lost session, makes the identity-error screen's Se reconnecter open /login as a Worker 401 does, which leaves the marker module unused for entry 4 to delete, and updates the 401 section of identity-access.md.

## Acceptance Criteria

Verify: api.test.ts shows an opaque redirect raises an ordinary error, App.test.tsx shows the identity-error screen's button opens /login, pnpm test is green, and a grep of src/client finds no access_redirect.

## References

- parent — _bmad-output/initiative-own-login/epic-access-removed/epic-access-removed.md

## Plan

<!-- Filled in by the coding agent; never sent to a tracker. -->
