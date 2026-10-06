---
title: 'GH #38: preview URLs disabled by repo config, asserted in CI'
type: 'chore'
created: '2026-10-06'
status: 'done'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: [quick]
review_loop_iteration: 0
baseline_commit: 'f49d89db6be94b44058a50a8445e7e51f7bafbf5'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `docs/security.md` lists "preview URLs disabled or protected" as half of the Access-bypass mitigation, but it is only a manual dashboard step (`docs/deployment.md` step 7), so a preview deployment outside the Access policy, a Worker reached without Access, could appear with no signal.

**Approach:** Set `preview_urls: false` in `wrangler.jsonc` so every `wrangler deploy` turns previews off, and assert it in `config.test.ts` beside `run_worker_first`. Update `docs/security.md` and `docs/deployment.md` to say the repo now enforces it. Scope is `preview_urls` only: the `permissions:` blocks in the workflows, which #38 raises as a "minor" aside, go to a separate found-in-passing issue (owner decision, 2026-10-06), and #7 is deferred to its own run.

</frozen-after-approval>

## Implementation Notes

Oneshot: three small edits (config, one test, two doc lines), well under 100 lines. `workers_dev` stays at its default `true` because the production URL is the workers.dev host protected by Access (`docs/deployment.md` step 4); only the `<version>-<name>` preview host is switched off.

## Review Triage Log

- medium, patch: the `permissions:` issue was not yet opened. Opened as GH #290 (found-in-passing).
- low, rejected: `docs/adr/0012-workers-dev-hostname.md:10` ("disabled or also protected") is still true, and an ADR line is not worth an edit for a looser phrase.
- low, patched: the `wrangler.jsonc` comment was five lines; cut to two.

## Verification

**Commands:**
- `pnpm test -- config.test.ts` -- expected: the new preview-URL test passes, and fails when `preview_urls` is removed or `true`
- `pnpm typecheck` -- expected: no errors
- `pnpm lint` -- expected: passes
