# Cutover, touchpoints and follow-ups

## Phases (expand/contract)

| Phase | Ships | Owner action | Exit |
|---|---|---|---|
| 1 | Login, `users`, `sessions`, codes, break-glass, Agents page. The Worker accepts a session and falls back to the Access JWT. Access still fronts the hostname. | Signs in through break-glass, creates the agents. | Owner has an admin session. |
| 2 | — | Gives each agent a code. Agents enrol. Once the Agents page shows every active user as "Inscrit", the owner revokes Access tokens and deletes the Access application. | Every active user has at least one live session. |
| 3 | A PR removes the JWT check, `jose`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` and `AGENT_EMAILS`. | Before it merges: WAF rate-limit check on `/api/auth/*`, or the residual risk recorded in `free-tier-budget.md`. | Access is gone from code, config and CI. |

## Code touchpoints today

| Where | What changes |
|---|---|
| `src/worker/auth.ts` | JWT check plus `roleFor(ADMIN_EMAILS)` → session lookup (JWT fallback until phase 3) |
| `src/worker/routes/admin.ts:184` | Assign-menu roster from vars → `users` |
| `src/worker/routes/agent.ts:292` | ADR-0028 position gate on `AGENT_EMAILS` → `users.role` |
| `src/worker/routes/dev.ts`, `src/worker/types.ts` | `DEV_USER_EMAIL` role from `users`. Env types gain the new secrets and lose the Access vars in phase 3 |
| `src/worker/retention.ts` | The daily sweep gains the auth tables |
| `src/client/admin/access-logout.ts`, `AccountMenu.tsx` | Access logout → session sign-out |
| `src/client/field/reconnect-marker.ts`, `vite.config.ts` denylist | `?reconnect=1` and `/cdn-cgi/` removed. A 401 opens `/login` |
| Worker tests that stub Access identity | Stub a D1 session instead |

## Follow-ups (each in its own change)

- `docs/domains/identity-access.md`: the login, the roles, and 401 handling. The cache-sourced "unconfirmed" identity rules still apply.
- `docs/security.md`: rewrite the Access-bypass, header-spoofing and stolen-phone rows. Add rows for CSRF, brute force, secret handling and log hygiene.
- `docs/api.md`: `/api/auth/*` and the Agents page routes.
- `docs/data-model.md`: the four tables.
- `docs/deployment.md`: the secrets, the phases, and the removal of Access.
- `docs/free-tier-budget.md`: one D1 read per request, one write per session an hour, and the exposed request quota.
- `docs/design.md`: the login page, the Agents page, and the fourth À traiter row ("Prospects sans agent actif"), which ends its three-row rule. The UX run's `EXPERIENCE.md` (ux-captain-prospectus-2026-09-24) states the same rule; its owner updates it.
- The `api-engineer` and `security-reviewer` agents and the `add-api-route` skill.
