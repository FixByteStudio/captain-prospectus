---
title: 'Pipeline par statut and Activité par agent (GH #112)'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
baseline_commit: 'ffdfac93cb725495b7d063fabdb0dfc9a1f922a5'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tableau de bord shows the period's totals but not where the live prospects stand, nor who did the work. The pipeline's third column is empty, and there is no Activité par agent panel.

**Approach:** `GET /api/admin/dashboard` gains two fields, additively. `pipeline` is the count of live prospects per status, a snapshot. `agents` has one row per agent: visits and Convertis in the period, plus the follow_up and open prospects assigned to them now. The screen fills the 2:1 row's third column with Pipeline par statut, a list of 6px bars as in `key-a1-dashboard.html`. It adds a row below that with Activité par agent, a shadcn table, in the left half; À traiter (story 9) will take the right half.

**Decisions (2026-09-26, user):**
1. The table lists the roster (`ADMIN_EMAILS` ∪ `AGENT_EMAILS`) with zeros, plus any other email with a visit in the period or a live prospect assigned now.
2. An agent's Convertis counts the distinct prospects (`coalesce(merged_into, id)`) they visited with outcome `converted` in the period. A manual conversion is credited to nobody, so the column may sum to less than the KPI, and `docs/api.md` says so.
3. The spec is kept whole despite running past 1,600 tokens.

## Boundaries & Constraints

**Always:** The pipeline uses the live filter (`merged_into IS NULL`), has all five `STATUSES` in their fixed order, zeros included, and its `new + assigned + follow_up` equals `openProspects`. The client computes the share from the pipeline's own total, and a total of 0 shows 0 % with empty bars. An agent's Visites are the rows in `visits` with that `agent_email` and a `visited_at` in the period, the same rows as the Visites KPI, so the column sums to `visits.value` when every visitor is listed. An agent's À relancer is the live `follow_up` prospects assigned to them, and their Prospects ouverts is the live `OPEN_STATUSES` prospects assigned to them. Both are snapshots, like `openProspects`. Each figure is one grouped statement with bound parameters, far below 100 (invariant 7). The contract is additive, in zod/mini, and `docs/api.md` defines each field. Colours come from tokens only: `status-new`, `status-assigned`, `warn`, `success`, `destructive`, `secondary`. French strings go in `copy.ts`. The panels are plain markup and shadcn `Table`, with no Recharts. `check:precache` passes, and the PR quotes the total. `docs/design.md` gets both panels in the same change.

**Never:** No schema change, migration or new dependency. No agent names, since there is no users table (ADR-0006): the row shows the email and its initial. No clickable row or link (story 10). No À traiter panel (story 9). No change to the field route.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pipeline sums | seed, period 7 / 30 / 90 | the same `pipeline` for every period; `new+assigned+follow_up` = `openProspects` | — |
| Merged | an absorbed `assigned` prospect | in neither `pipeline` nor any agent's open count | — |
| Idle agent | a roster agent with 0 visits in the period and 2 `follow_up` prospects | row `visits 0, converted 0, followUp 2, open 2` | — |
| Previous period | a visit at `from − 1` | in no agent's `visits` | — |
| Unassigned | an open prospect with `assigned_to` null | in `pipeline` and `openProspects`, in no agent row | — |
| Empty | no prospects, no visits | pipeline all 0, "0 prospect", 0 % bars; agents per decision 1 with zeros | — |

</frozen-after-approval>

## Code Map

- `src/worker/routes/admin.ts:202` -- the dashboard route. Three more statements go in the `Promise.all`:
  - pipeline: `select status, count(*) from prospects where merged_into is null group by status` (on `prospects_merged_idx`). The existing open-split query stays as it is. Deriving it from pipeline was considered and rejected: it would change #111's code for no gain.
  - agent visits: `select agent_email, count(*) from visits where visited_at in [from, to) group by agent_email` (on `visits_visited_idx`).
  - agent open and follow_up: `select assigned_to, sum(status = 'follow_up'), count(*) … where merged_into is null and assigned_to is not null and status in OPEN_STATUSES group by assigned_to` (on `prospects_assigned_status_idx`).
  - agent Convertis: `select agent_email, count(distinct coalesce(merged_into, id)) from visits join prospects … where visited_at in [from, to) and outcome = 'converted' group by agent_email`.
  Merge the rows in TS with the roster from `assignableEmails(c.env)` (`admin.ts:168`), as decision 1 says, sorted by visits descending, then by email.
- `src/shared/schemas.ts:504` -- `pipeline: z.object({ new, assigned, follow_up, converted, rejected })` of `countSchema`, and `agents: z.array(z.object({ email, visits, converted, followUp, openProspects }))`.
- `src/worker/dashboard.test.ts` -- a new `describe("Pipeline and Activité par agent (GH #112)")`, with one test per matrix row and `it.each(DASHBOARD_PERIODS)` for the per-period figures. Give `seedProspect` and `seedVisits` an optional `assignedTo` and `agentEmail`, defaulting to `AGENT`. The test roster is `admin@example.com` plus `agent@example.com` (`vitest.config.ts:47`).
- `src/client/admin/dashboard/PipelinePanel.tsx` (new) -- a `Card`, `h3` and "{n} prospects" meta. Each row has its label from `STATUS_LABELS` (`copy.ts:728`), a count tinted as in the mockup (muted-foreground on new, foreground on assigned, warn, success, destructive), its share through `formatPercent`, and a `h-1.5 bg-secondary` track with a status-coloured fill. A skeleton goes with it.
- `src/client/admin/dashboard/AgentActivityTable.tsx` (new) -- a `Card` with `ui/table`, `TableHeader` on `bg-secondary`, and overline heads. Numbers are right-aligned `tabular-nums`. Convertis is `text-success font-semibold` and À relancer is `text-warn font-semibold`. The avatar is a 26px `bg-secondary` circle with the uppercase initial. The table sits in `overflow-x-auto` for 390 px. It has an empty state and a skeleton.
- `src/client/admin/dashboard/DashboardScreen.tsx:163` -- the pipeline goes in the `lg:col-span-1` slot. A new `lg:grid-cols-2` row holds the table, with the same `aria-busy` and placeholder opacity.
- `src/client/copy.ts:125` -- `dashboard.pipeline` (title, `total(n)`) and `dashboard.agents` (title, five column heads, empty).
- `DashboardScreen.test.tsx`, `AdminApp.test.tsx` -- the stubs gain `pipeline` and `agents`. Assert the rows, the shares and an idle agent's zeros.
- `docs/api.md:24,107` -- the table row and two bullets. `docs/design.md` -- the dashboard section.

## Tasks & Acceptance

**Execution:**
- [ ] `src/shared/schemas.ts` -- the additive `pipeline` and `agents`
- [ ] `src/worker/routes/admin.ts`, `src/worker/dashboard.test.ts` -- the statements, the roster merge, and a test per matrix row at 7/30/90
- [ ] `src/client/admin/dashboard/PipelinePanel.tsx`, `AgentActivityTable.tsx`, `DashboardScreen.tsx`, `src/client/copy.ts` -- both panels, their skeletons, and the grid
- [ ] `DashboardScreen.test.tsx`, `AdminApp.test.tsx` -- the stubs and the assertions
- [ ] `docs/api.md`, `docs/design.md` -- the Definition of Done

**Acceptance Criteria:**
- Given the seed in `pnpm dev`, when `/admin` opens at 1280, 820 and 390 px in light and dark at 7, 30 and 90 jours, then both panels match `key-a1-dashboard.html`, and the pipeline's total and the agents' visits agree with the KPIs.
- Given `/admin` open in `pnpm dev`, when the admin assigns prospects in Prospects and returns to Tableau de bord, then Prospects ouverts and that agent's row have moved: the mutation invalidates `adminKeys.dashboards()` (`query-client.ts:18`).
- Given `pnpm build && pnpm check:precache`, then it passes, Recharts is only in `AdminApp-*`, and the PR quotes the precache total against 1,000 KiB.

## Implementation Notes

- Implemented by a subagent in the `feat/112-pipeline-activite` worktree. The spec lives in the main checkout's untracked `_bmad-output`.
- Worker: three statements join the dashboard's `Promise.all`: the pipeline, visits by agent, and live assignments by agent (`followUp` plus open counted conditionally, so any live assignee gets a row). `agentConversions()` is a fourth. `agentRows()` merges them with `assignableEmails`, sorted by visits descending then by email.
- Client: `PipelinePanel` (plain bars, share from its own total) and `AgentActivityTable` (shadcn `Table`, email initial avatar, headers wrap as in the mockup).
- Seeded `pnpm dev` (5173): at 7/30/90 the pipeline's open part is 135, equal to `openProspects`. The agents' Visites sum to the KPI (130/522/1191). Their Convertis sum to 8/36/67 against 9/37/68: manual conversions are credited to nobody. Assigning 3 Nouveau to agent@ through `POST /api/admin/prospects/assign` moved Nouveau 29→26, Assigné 41→44 and agent@'s Prospects ouverts 48→51. The client refetch comes from `query-client.ts:18`.
- Screenshots over CDP (headless Chromium) at 1280 (7/30/90), 820 and 390, light and dark. No horizontal page scroll. At 390 the table scrolls inside its card.
- Owner change after the screenshots (2026-09-26): at 1280 a half-width card (about 480 px) hid Prospects ouverts behind a sideways scroll. The user chose the mockup's 3:2 row (`lg:grid-cols-5`, table `lg:col-span-3`). This supersedes the frozen intent's "left half" and the Code Map's `lg:grid-cols-2`. `docs/design.md` says 3:2.
- Precache: 884.17 → 885.07 KiB of 1,000. The entry `index-*.js` is unchanged at 377.40 KiB. Recharts is only in `AdminApp-*`.
- Final: typecheck and lint clean, 62 files and 1476 tests pass, build and `check:precache` exit 0. Baseline re-stamped at PR time: merge-base with `origin/main` is still `ffdfac93cb725495b7d063fabdb0dfc9a1f922a5`.
- Headless artefact, not a defect: after the CDP viewport resize, a Recharts chart sometimes drew empty in a shot. The same chart rendered at the same widths in other shots.

## Spec Change Log

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment). Verdicts: 0 high, 0 medium, 8 low, 7 false, 0 maybe-false. 0 intent_gap, 0 bad_spec, 5 patched (8 findings), 0 deferred, 7 rejected (false) + 3 rejected (low).

- `low` / **patch**: edge-case-hunter, intent-alignment C1. Extra rows only covered live *open* assignees, while decision 1 says "a live prospect assigned now". Fix: agentOpen drops the status filter and counts open conditionally, and the docs follow.
- `low` / **patch**: blind-hunter. api.md's "when every visitor is listed" never happens, and it failed to say the agents' Convertis can also exceed the KPI (two agents on one prospect). Fix: reworded.
- `low` / **patch**: edge-case-hunter, blind-hunter. `initials()` returns "" for a local part with no letters, which gives an empty avatar. Fix: `email.charAt(0).toUpperCase()`, as design.md says.
- `low` / **patch**: verification-gap, blind-hunter, intent-alignment D. The merged keying and the two-agent overcount of the agents' Convertis were unexercised, and the pipeline ignoring the period was unpinned. Fix: three tests added.
- `low` / **patch**: edge-case-hunter. The merged, unassigned and empty rows ran at a single period, though the task says 7/30/90. Fix: `it.each(DASHBOARD_PERIODS)`.
- **rejected** (`false`): blind-hunter, edge-case-hunter. Email case splitting rows. `parseEmails` and the JWT/dev identity both lowercase (`auth.ts:72,89,117`), and assignees are validated against the roster.
- **rejected** (`false`): blind-hunter. There is no index for agentOpen. `prospects_assigned_status_idx` (`schema.ts:69`) covers `assigned_to`; the CPU budget is story 9's.
- **rejected** (`low`, and the #111 precedent): blind-hunter. The separate statements are not one snapshot. The next 15 s poll corrects any drift.
- **rejected** (`false`): blind-hunter. There is no client check that the pipeline matches Prospects ouverts. The server guarantees it, and a worker test pins it at 7/30/90.
- **rejected** (`low`, cosmetic): blind-hunter. The skeleton shapes differ slightly from the loaded panels.
- **rejected** (`false`): blind-hunter. The empty right half at ≥ lg is the spec's layout, and story 9 fills it.
- **rejected** (`false`): edge-case-hunter. An unknown status is dropped silently. `status` is a closed enum, and zod validates writes.
- **rejected** (`low`): blind-hunter. The sort's tie-break is only tested in passing. verification-gap confirms it is pinned.
- **rejected** (`false`, intent-alignment B/E): descriptive. The follow_up/open overlap is the Approach's own definition, and layout fidelity is checked in `pnpm dev`.

## Design Notes

**Why the share is computed on the client.** The count is the figure and the share is only presentation. Deriving the share from the same five counts keeps the displayed total and the shares consistent, with no rounding in the contract.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass
- `pnpm typecheck` and `pnpm lint` -- expected: clean
- `pnpm build && pnpm check:precache` -- expected: exit 0, with the total and `AdminApp-*` quoted

**Manual checks:**
- `pnpm db:seed:local` then `pnpm dev`: `/admin` at 1280, 820 and 390 px, light and dark, at 7, 30 and 90 jours; then assign prospects in Prospects and return.
