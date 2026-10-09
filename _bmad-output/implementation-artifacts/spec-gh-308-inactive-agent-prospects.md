---
title: 'Tableau de bord lists prospects with no active agent'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_commit: 'e6e6ffcaa20e003c7b9e23ead124defe85a37fa4'
context:
  - '{project-root}/docs/design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Deactivating an agent leaves their open prospects assigned to someone who can no longer visit them, and nothing shows the admin those prospects (GH #308, CAP-1).

**Approach:** An additive dashboard figure `inactiveAgentProspects`, a shared prospect filter `inactiveAgent=true` used by both the list and the CSV export, a fourth À traiter row "Prospects sans agent actif" whose Réassigner opens Prospects at `status=new,assigned,follow_up&inactiveAgent=true`, and a chip plus Agent select state for that filter on Prospects.

## Boundaries & Constraints

**Always:**
- "No active agent" = `assigned_to` is not null and has no `users` row with `active = 1`, so a deactivated user and an email with no row (left over from ADMIN_EMAILS/AGENT_EMAILS) both count.
- Count = that set ∩ not merged ∩ status in `OPEN_STATUSES`; it ignores `period`. The filter adds the no-active-agent condition only. Status stays the job of `status`, and `prospectFilters` already drops merged rows.
- The filter's SQL is written once and shared by the dashboard count and `prospectFilters`, so the list, the export and the count cannot diverge.
- `inactiveAgent` takes `z.optional(z.literal("true"))` in `prospectFiltersSchema` (zod/mini), as `outOfTarget` does. Any other value gets 400.
- Copy goes in `src/client/copy/admin.ts`: "Prospects sans agent actif", "Assignés à un agent désactivé", "Réassigner", chip "Agent : désactivé" (with ` ` before the colon, as elsewhere), and select text "Agent désactivé".
- docs/api.md (dashboard table row, The dashboard prose, list and export rows) changes in this PR.

**Never:**
- No change to deactivation or its dialog count (story 7), and no schema migration.
- `assignedTo` gets no keyword. It stays an email.
- No `Cf-Access-*` reads, no new dependency, no new request from the dashboard. The figure rides on GET /api/admin/dashboard.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Deactivated assignee | open prospect assigned to `users.active = 0` | counted; listed with `inactiveAgent=true` | — |
| No users row | open prospect assigned to an email absent from `users` | counted; listed | — |
| Active assignee / unassigned / merged | — | neither counted nor listed | — |
| Won or lost | `converted`/`rejected`/`interested`, deactivated assignee | not counted; listed only when `status` does not exclude it | — |
| Export | `export.csv?inactiveAgent=true` | same rows as the list | — |
| Bad value | `inactiveAgent=1`, `=false`, `=` | — | 400, on list and export |
| Row states | count 0, loading or failed | muted figure ("—" when unknown), button disabled | — |

</frozen-after-approval>

## Code Map

- `src/shared/schemas.ts:345-358` -- `prospectFiltersSchema`: add `inactiveAgent` beside `outOfTarget`, with a doc comment. `:740-846` `dashboardResponseSchema`: add `inactiveAgentProspects: countSchema` at the end.
- `src/worker/routes/admin.ts:634-681` -- add a `NO_ACTIVE_AGENT` SQL const next to `OUT_OF_TARGET_FLAGGED`: `assigned_to is not null and not exists (select 1 from users where email = assigned_to and active = 1)`. Wire it into `prospectFilters`. The export at `:888-894` already calls `prospectFilters`.
- `src/worker/routes/admin.ts:221-380` -- dashboard: add one statement to the `Promise.all` (`count()` where not merged ∧ `OPEN_STATUSES` ∧ `NO_ACTIVE_AGENT`) and return `inactiveAgentProspects`.
- `src/client/admin/queries.ts:50-143` -- `ProspectFilters.inactiveAgent?: true`, `toQueryString` and `parseProspectFilters`, built like `outOfTarget`.
- `src/client/admin/ProspectsScreen.tsx:133-200` -- `filtered` includes it. `setFilter("assignedTo", …)` deletes `inactiveAgent` for any value, ANY included. Push the chip `{key: "inactiveAgent", label}`. `dropFilter` already works by key.
- `src/client/admin/prospects/Toolbar.tsx:105-111` -- Agent `Filter`: while `filters.inactiveAgent` is on, value `""` with placeholder "Agent désactivé", the same trick Statut uses for several statuses.
- `src/client/admin/dashboard/TodoPanel.tsx` -- a 4th row with `UserX`, prop `inactiveAgentProspects`, and `to: prospectsHref({status: [...OPEN_STATUSES], inactiveAgent: true})`. The skeleton gets a 4th line.
- `src/client/admin/dashboard/DashboardScreen.tsx:174-183` -- pass `data.inactiveAgentProspects`.
- `src/client/copy/admin.ts:206-219, 274-292` -- `todo` and `prospects.filters` strings.
- Tests to extend: `src/worker/dashboard.test.ts` (see the `followUpsDueSoon` block ~994 for the list-total-equals-figure pattern), `src/worker/admin.test.ts` (the outOfTarget filter and export tests), `src/client/admin/ProspectsScreen.test.tsx`, `src/client/admin/dashboard/DashboardScreen.test.tsx`, `src/client/admin/queries.test.tsx`.
- `docs/api.md:32,41,45` and § The dashboard (~157-262).

## Tasks & Acceptance

**Execution:**
- [x] `src/shared/schemas.ts` -- add the filter key and the dashboard field -- one contract for both sides
- [x] `src/worker/routes/admin.ts` -- `NO_ACTIVE_AGENT`, the filter, the dashboard count -- shared SQL keeps the count and the list equal
- [x] `src/worker/dashboard.test.ts`, `src/worker/admin.test.ts` -- the I/O matrix: the count equals the list total at `status=new,assigned,follow_up&inactiveAgent=true`; the export rows equal the list rows; three bad values each get 400
- [x] `src/client/copy/admin.ts` -- French strings
- [x] `src/client/admin/queries.ts` (+ test) -- round-trip `inactiveAgent`; a bad value is dropped
- [x] `src/client/admin/prospects/Toolbar.tsx`, `src/client/admin/ProspectsScreen.tsx` (+ test) -- chip, select text, clearing by ×, by another agent, by Effacer les filtres
- [x] `src/client/admin/dashboard/TodoPanel.tsx`, `DashboardScreen.tsx` (+ test) -- 4th row, its href, its disabled state at 0
- [x] `docs/api.md` -- dashboard field and filter on the list and export rows

**Acceptance Criteria:**
- Given an admin deactivated a seeded agent with open prospects, when Tableau de bord loads, then "Prospects sans agent actif" shows their count and Réassigner opens Prospects listing exactly those, with chip "Agent : désactivé" and "Agent désactivé" in the Agent select.
- Given that list, when the admin assigns all of them to another agent from the selection bar, then the list empties and the dashboard row reads 0 with its button disabled.
- Given the filter is on, when the admin clicks the chip's ×, picks an agent, or clicks Effacer les filtres, then `inactiveAgent` leaves the URL.

## Implementation Notes

- One SQL fragment, `NO_ACTIVE_AGENT` (`src/worker/routes/admin.ts`), serves the dashboard count and `prospectFilters`, so the list, the export and the figure share it.
- `docs/api.md`'s Cost line said "Eleven statements (as of GH #177)", one behind already; it now says thirteen as of GH #308.
- Dashboard CPU re-measured as `docs/free-tier-budget.md` asks: no measurable change. The baseline's cold first request already reaches about 11 ms locally (GH #341, found in passing).

## Spec Change Log

## Review Triage Log

Pass 1 (iteration 0): high 0 · medium 1 · low 3 · false 5 · maybe-false 0. Routes: 3 patch, 1 defer (GH #341), 0 loopback; 6 rejected.

| # | Lens | Finding | Verdict | Route | Evidence |
|---|------|---------|---------|-------|----------|
| 1 | blind, edge-case | free-tier-budget.md not re-measured or updated for a 13th dashboard statement | medium | patch | The doc asks for a re-measure. 14 alternating cold runs gave a median of 9.28 ms (new) vs 9.27 ms (base). The plan searches `prospects_merged_idx` with a PK lookup on `users`. Bullet added. |
| 2 | verification-gap | No test that changing Statut or Source keeps `inactiveAgent` | low | patch | Pre-verified gap. Test added: "keeps the filter when Statut changes". |
| 3 | blind | Deactivation only seeded, never through `PATCH /users/:email` | low | patch | Test added: deactivate gives 1, reactivate gives 0. |
| 4 | blind, edge-case | `?assignedTo=x&inactiveAgent=true` applies `assignedTo` with nothing on screen showing it | low | reject | Only a hand-edited URL reaches it, since the UI clears one when setting the other. The fix adds a branch. |
| 5 | blind | Access-only agents with no `users` row are labelled "désactivé" | false | reject | Settled by the ticket's 2026-10-09 decision that no users row counts. The copy is mandated by design.md. |
| 6 | blind | Story file's tracker_status and Plan not updated | false | reject | Earlier story PRs (#337) leave story files to ticketing. |
| 7 | blind | No glossary or domain-doc home for the rule | false | reject | Deactivation behaviour is unchanged. The figure is defined in api.md › The dashboard, and design.md owns the UI. |
| 8 | blind | Minor client tests: undefined count, hard-coded href order | false | reject | The count is never undefined while `data` exists. The literal href is the contract. |
| 9 | blind | Clearing the status chip shows won/lost rows | false | reject | By design: the filter "does not filter status by itself" (ticket). |
| 10 | intent | Manual ACs not run; the selection-bar reassign isn't client-tested | low | reject | It reuses the assign mutation, whose prospects and dashboard invalidation is already tested. The ACs are walked at presentation. |
| 11 | own measurement | Baseline cold first request reaches about 11 ms, beyond 10 ms | — | defer | Pre-existing; GH #341. |

## Verification

**Commands:**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: all pass

**Manual checks:**
- On `pnpm dev`, follow the three Acceptance Criteria by hand.
