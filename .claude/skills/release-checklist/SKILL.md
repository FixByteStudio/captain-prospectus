---
name: release-checklist
description: Pre-merge and post-deploy checklist for a Captain Prospectus release. Use when preparing a PR for merge to main or verifying a production deploy.
---

# Release checklist

## Before merge
Merging deploys: the `Deploy` workflow starts by itself once CI passes on `main` (`docs/deployment.md`).
- [ ] CI green (typecheck, tests, build).
- [ ] Migration reviewed by `migration-guard`; when the data stage is protected, safe for the deployed Worker.
- [ ] Sync contract change? Followed `sync-contract-change`.
- [ ] Security-relevant? Reviewed by `security-reviewer`.
- [ ] Changes what the phone sends about an agent's location? The owner has told the agents
      first ([ADR-0028](../../../docs/adr/0028-agent-position-at-sync.md), `docs/security.md`).
- [ ] Docs and ADRs updated; roadmap ticked.
- [ ] No new paid service or dependency (ADR-0002).
- [ ] `wrangler.jsonc`: `assets.run_worker_first` is still `["/api/*"]`, never `true` — `true` bills
      every app-shell request against the 100,000/day Worker quota (`free-tier-budget.md`).
- [ ] Service worker still excludes `/api/*` from caching.

## After deploy (CI does migrate → deploy → smoke test)
- [ ] The `Deploy` run the merge started is green.
- [ ] App loads on the production URL (`docs/deployment.md`) and `/login` signs in.
- [ ] `/api/me` returns the right role.
- [ ] A phone completes a sync; admin feed shows the visit.
- [ ] Workers logs show no new errors for 15 minutes.

## If broken
- Code: `wrangler rollback` (run by the owner, not an agent), then a revert on `main`, or the next merge ships it again.
- Data: D1 Time Travel, see `docs/deployment.md`.
