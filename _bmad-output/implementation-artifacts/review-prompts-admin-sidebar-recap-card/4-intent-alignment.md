You are an intent-alignment auditor. You have no other context about how this change was produced. Here is the verbatim intent this work started from:

**Problem:** The mockups (DESIGN.md:373) drew an admin sidebar footer with a "Synchronisé à l'instant" line. The shell (#63) shipped without it, and an admin has no sync to report, so that line would lie.

**Approach:** Add a small-font recap card at the bottom of the admin sidebar, on every admin page. It is headed with today's date, then shows « N / M agents actifs », « X visites » and the time since the last visit was received. It is fed by one new read-only admin route, polled every 15 s. The design is `mockup-admin-sidebar-recap-card.png` (variant B).

The diff is the unified diff inlined below. It is the change under review.

````diff
diff --git a/_bmad-output/implementation-artifacts/spec-admin-sidebar-recap-card.md b/_bmad-output/implementation-artifacts/spec-admin-sidebar-recap-card.md
new file mode 100644
index 0000000..fce6475
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-admin-sidebar-recap-card.md
@@ -0,0 +1,108 @@
+---
+title: 'Admin sidebar recap card'
+type: 'feature'
+created: '2026-10-14'
+status: 'in-review'
+route: 'full'
+route_source: 'auto'
+review: 'thorough'
+review_source: 'auto'
+lenses_ran: []
+review_loop_iteration: 0
+baseline_commit: 'b40077f7362778244147ccc9b20582e1dd46cc5f'
+context:
+  - '{project-root}/_bmad-output/forge/admin-sync-status-meaning/forged-idea.md'
+  - '{project-root}/_bmad-output/implementation-artifacts/mockup-admin-sidebar-recap-card.png'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** The mockups (DESIGN.md:373) drew an admin sidebar footer with a "Synchronisé à l'instant" line. The shell (#63) shipped without it, and an admin has no sync to report, so that line would lie.
+
+**Approach:** Add a small-font recap card at the bottom of the admin sidebar, on every admin page. It is headed with today's date, then shows « N / M agents actifs », « X visites » and the time since the last visit was received. It is fed by one new read-only admin route, polled every 15 s. The design is `mockup-admin-sidebar-recap-card.png` (variant B).
+
+## Boundaries & Constraints
+
+**Always:**
+- The day is the Brussels day, midnight to midnight, as the server reads it. The card is headed « Mardi 14 octobre » (the overline style) and the lines don't repeat « aujourd'hui ».
+- « Actif » means a roster member with a visit **received** that day, so N ≤ M. M is the active roster (`activeRoster`, admins included). « X visites » counts every visit received that day.
+- The age is computed from the server's clock: `serverTime − lastReceivedAt`. The client clock is never used.
+- The dot is `success` when N > 0 and `band-muted` when N = 0. The text carries the meaning.
+- In the icon rail, the card is a 32px tile with the lucide `Info` icon (no dot), and the date and three lines in a Tooltip and in its accessible name. In the phone drawer it is the full card.
+- Reads from `visits` use `visits_received_idx`. At most 2 statements, each with ≤ 100 bound parameters (INVARIANT 7).
+- French strings live only in `src/client/copy/admin.ts`, with plural agreement. Colours come only from `@theme` tokens.
+- `docs/design.md` (Layout) and `docs/api.md` change in the same commit as the code.
+
+**Never:**
+- No email, no avatar, no menu and no link on the card.
+- No agent-side change, sync contract change, migration or new dependency.
+- No amber or red verdict, and no working-hours rule.
+- Never more than the date and three lines.
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|---|---|---|---|
+| Working day | Roster of 2; Léa has 12 visits received today, the last one 4 min ago | « MARDI 14 OCTOBRE », « 1 / 2 agents actifs », « 12 visites », « Dernière visite reçue il y a 4 min »; green dot | — |
+| Nothing today | No visit received since Brussels midnight | « 0 / 2 agents actifs », « Aucune visite », no third line; muted dot | — |
+| Just now | Age < 60 s | « Dernière visite reçue à l'instant » | — |
+| Hours | Age 3 h 10 | « … il y a 3 h » | — |
+| Singular | M = 1, X = 1 | « 1 / 1 agent actif », « 1 visite » | — |
+| Off-roster visitor | A deactivated user's visit today | Counted in X, not in N | — |
+| Loading or failed | Query pending or error | No card: the sidebar ends after its nav | No toast, no retry button |
+| Offline | `useOnline()` false | The last answer stays (the offline banner says the data is frozen) | — |
+
+**Decisions (owner, 2026-10-14):** visits *received* today (1a); N counts roster members only (2a); green or muted dot (3a); variant B, with the date heading the card and no email or avatar; in the rail an `Info` icon replaces the dot.
+
+</frozen-after-approval>
+
+## Code Map
+
+- `src/worker/routes/admin.ts:205-316` -- the dashboard. Reuse its `brusselsMidnightDaysFromNow(now, 0|1)` bounds and the `agentsToday` statement's shape. Do NOT add to `/dashboard` (its cold CPU is near 10 ms, free-tier-budget.md).
+- `src/worker/auth.ts:47` `activeRoster(db)` -- M and the roster filter for N.
+- `src/shared/period.ts:153` `periodDates(todayStart, 1)[0]` -- the Brussels ISO day for the response's `date`.
+- `src/shared/schemas.ts:524` -- put the response schema next to `agentsResponseSchema` (zod/mini, `epochMsSchema`).
+- `src/worker/dashboard.test.ts:1-80,976` -- harness to copy: `workerFetch`, `seedUser`, `resetTestUsers`, `insertVisit(prospect, visitedAt, receivedAt, …, agentEmail)`.
+- `src/client/admin/queries.ts:71,477` -- `adminKeys` and `FEED_POLL_MS`. Set `refetchOnWindowFocus: true` as in `useVisitsFeed`; the background poll pauses by default.
+- `src/client/format.ts:68` `formatDay(isoDate)` → « mardi 14 octobre »; `formatCount`.
+- `src/client/ui/sidebar.tsx:183,327` -- mirror `SidebarHeader` as `SidebarFooter` (`data-slot="sidebar-footer"`, `border-t border-sidebar-border`) and export it.
+- `src/client/admin/AdminSidebar.tsx` -- `rail` is already computed. Mount `<RecapCard rail={rail} />` in a `SidebarFooter` after `SidebarContent`.
+- `src/client/ui/tooltip.tsx`; `SidebarMenuButton`'s `tooltip` usage in `AdminSidebar.tsx` is the precedent.
+- `src/client/admin/AdminApp.test.tsx:52-60` -- the per-URL fetch stub must serve `/api/admin/recap`.
+- `src/client/field/SyncIndicator.tsx:65` -- the dot classes (`size-2 rounded-full`, `bg-success` / `bg-band-muted`).
+
+## Tasks & Acceptance
+
+**Execution:**
+- [ ] `docs/design.md` -- add the recap card to Layout (232-252): the lines, the rail and drawer, the cap, and no identity. This is the design gate (ADR-0014), so it comes first.
+- [ ] `src/shared/schemas.ts` -- `recapResponseSchema` `{date, activeAgents, rosterSize, visitsToday, lastReceivedAt: epochMs|null, serverTime}` and the `RecapResponse` type.
+- [ ] `src/worker/routes/admin.ts` -- `GET /recap`: the roster, plus one grouped read of the day's visits (`agent_email`, `count`, `max(received_at)`). N is the roster ∩ those emails. `Cache-Control: no-store`.
+- [ ] `src/worker/recap.test.ts` -- the matrix's server rows: day bounds, N ≤ M, off-roster visitors, `null` when there are none, `date`, `serverTime`.
+- [ ] `src/client/admin/recap.ts` (+ `.test.ts`) -- a pure `receivedAgo(ageMs)` returning now / minutes / hours.
+- [ ] `src/client/copy/admin.ts` -- `recap.{agents(n,m), visits(x), none, receivedNow, receivedMinutes(n), receivedHours(n)}`.
+- [ ] `src/client/admin/queries.ts` -- `adminKeys.recap()` and `useRecap()` at `FEED_POLL_MS`.
+- [ ] `src/client/ui/sidebar.tsx` -- vendor `SidebarFooter`.
+- [ ] `src/client/admin/RecapCard.tsx` (+ test) -- full and rail variants; no card while loading or on error.
+- [ ] `src/client/admin/AdminSidebar.tsx`, `AdminApp.test.tsx` -- mount the card and stub the route.
+- [ ] `docs/api.md`, `docs/free-tier-budget.md` -- the route row and its request cost (ADR-0010's 240 requests/hour per visible tab).
+
+**Acceptance Criteria:**
+- Given any admin page at ≥ 1024px, when the recap has loaded, then the sidebar ends with the card, and nothing on it is focusable or clickable.
+- Given the rail (768–1023px), when hovering or focusing the `Info` tile, then a Tooltip shows the date and the three lines, and its accessible name reads them.
+- Given a hidden tab, then `/api/admin/recap` is not requested. Given focus returns, then it is requested.
+- Given `pnpm build`, then the card ships only in `AdminApp-*`, and the PR quotes the field precache total against 1,000 KiB.
+
+## Design Notes
+
+All three lines run on one clock, `received_at`: a visit made offline yesterday and synced this morning counts today, for its agent and in the total. N filters to the roster, unlike the dashboard's `agentsActiveToday`, so the fraction can't read « 3 / 2 ». The response carries `date`, so the client never has to work out which Brussels day it is.
+
+## Verification
+
+**Commands:**
+- `pnpm typecheck && pnpm lint && pnpm test` -- expected: all pass.
+- `pnpm build` -- expected: success; record the precache total.
+
+**Manual checks:**
+- `pnpm dev` at 1280, 820 and 390, light and dark, against the mockup.
diff --git a/docs/api.md b/docs/api.md
index bb43032..444e4fb 100644
--- a/docs/api.md
+++ b/docs/api.md
@@ -32,6 +32,7 @@ Mounted before the identity gate ([ADR-0029](adr/0029-own-login-instead-of-cloud
 | `GET /api/admin/dashboard?period=7\|30\|90` | Tableau de bord's figures, `dashboardResponseSchema`: `{period, from, to, visits: {value, previous, delta, byDay}, openProspects, openProspectsByStatus: {new, assigned, follow_up}, converted: {value, previous, delta, byDay}, conversionRate: {value, previous, delta, visitedProspects: {value, previous}}, visitsByDay: [{date, counts: {<outcome>: n}}], pipeline: {<status>: n}, agents: [{email, visits, converted, followUp, openProspects}], followUpsDue, flyersGiven, agentsActiveToday, followUpsDueSoon: {value, dueBefore}, inactiveAgentProspects}`. `period` defaults to 30; any other value is **400**. Read-only. See [The dashboard](#the-dashboard) |
 | `GET /api/admin/agents/:email/round` | `agentRoundResponseSchema` `{prospects, position}`: the agent's open prospects (the sync pull's query) and their latest reading `{lat, lng, accuracy, capturedAt}` (`capturedAt` clamped to receipt) or `null` when none from today. An admin's email answers 200 with `position: null`, since admins' positions are never stored. **404** for an email that is not assignable, **400** for a malformed one. `Cache-Control: no-store` ([ADR-0028](adr/0028-agent-position-at-sync.md)) |
 | `GET /api/admin/agents` | `{agents: [{email, role}]}` — everyone a prospect can be assigned to |
+| `GET /api/admin/recap` | The sidebar's recap card, `recapResponseSchema` `{date, activeAgents, rosterSize, visitsToday, lastReceivedAt, serverTime}`: today's Brussels date and what arrived since its midnight. `lastReceivedAt` is `null` on a day with no visit. Read-only, `no-store`, polled every 15 s. See [The recap card](#the-recap-card) |
 | `GET /api/admin/users` | `usersResponseSchema` `{users: [{email, name, role, active, sessions, openProspects, devices}]}` — every user, active or not, ordered by name then email; names compare ignoring case and accents (French collation), unnamed rows last. `sessions` counts unexpired sessions; `openProspects` counts prospects assigned to them with status `new`, `assigned` or `follow_up` and not merged. `devices` `[{id, label, createdAt, lastSeenAt, current}]` lists the unexpired sessions, newest `lastSeenAt` first; `label` is null when the User-Agent gave no summary, `current` marks the caller's own session. The token hash is never sent ([ADR-0029](adr/0029-own-login-instead-of-cloudflare-access.md)) |
 | `POST /api/admin/users` | `userCreateSchema` `{email, name, role}` → **201** with the list row (`devices` is empty). The email is trimmed and lowercased, the name required. Created active, with no passphrase. **409** `email_taken` for an existing email, active or not |
 | `PATCH /api/admin/users/:email` | `userUpdateSchema` `{role?, active?}`, at least one → **204**. What is absent stays. Deactivating deletes the user's sessions and unused codes in the same batch; reactivating leaves none. `role: "agent"` or `active: false` also clears `passphrase_hash` in the same `UPDATE`. **404** for an unknown email. **409** `last_admin` when the change would leave no active admin, decided inside the write and counting active admin `users` rows; nothing is written. No user is ever deleted |
@@ -278,6 +279,28 @@ the same response, additively.
   thousand rows on the seed, so every 15 s from one open tab would spend the
   D1 daily read quota within hours.
 
+## The recap card
+
+`GET /api/admin/recap` feeds the card at the foot of the admin sidebar
+([design](design.md#layout)). An admin has no outbox, so it reports what the
+agents sent rather than a sync. Every figure reads `received_at` over one
+Brussels day, midnight to midnight tomorrow (`brusselsMidnightDaysFromNow`),
+so a visit made offline yesterday and synced this morning counts today.
+
+- `date`: that day, `YYYY-MM-DD`. The client never works out which day it is.
+- `rosterSize`: the roster, the active `users` rows, admins included.
+- `activeAgents`: roster members with a visit received that day. Unlike
+  `agentsActiveToday` on the dashboard, a sender off the roster (deactivated)
+  is left out, so it never exceeds `rosterSize`.
+- `visitsToday`: every visit received that day, off-roster senders included.
+- `lastReceivedAt`: the latest `received_at` that day, or `null`.
+- `serverTime`: the Worker's clock. The card's age is `serverTime −
+  lastReceivedAt`, never the device's clock.
+- **Cost.** Two statements: the roster, and one grouped read of the day's
+  visits on `visits_received_idx`, one row per sender. Each call reads about the
+  day's visits plus the `users` rows; polled every 15 s from each visible admin
+  tab (ADR-0010), see [free-tier-budget](free-tier-budget.md#watch-outs).
+
 ## The repair queue
 
 A visit the server cannot take is written to `visits_orphaned` and still reported in
diff --git a/docs/design.md b/docs/design.md
index 1a47e53..bc7af94 100644
--- a/docs/design.md
+++ b/docs/design.md
@@ -251,6 +251,23 @@ share the band's look and tokens, but each owns its frame: the admin frame
 (sidebar and top bar) ships in the admin chunk, and the field band carries the
 sync state.
 
+The sidebar ends with the **recap card** in its footer, on every admin page: the
+day's story in small type, before the admin opens a screen. An admin has no sync
+of their own, so it never says "synchronisé"; it reports what the agents sent
+(forge `admin-sync-status-meaning`). The Brussels day heads it in the overline
+style ("MARDI 14 OCTOBRE"), then three `text-xs` lines on `band-accent`: a dot
+and "1 / 2 agents actifs", "12 visites", and in `band-muted` "Dernière visite
+reçue il y a 4 min". Actif means an agent on the roster with a visit received
+that day, so the figure never passes the roster; the visits are every visit
+received that day; all three read `received_at`, the server's clock. The dot is
+`success` while anyone is active and `band-muted` otherwise. It is not a verdict:
+there are no working hours, so no amber. With nothing yet, the lines read
+"0 / 2 agents actifs" and "Aucune visite". The card is capped at the date and
+those three lines, carries no email, avatar, menu or link, and is absent while
+its query loads or has failed. In the rail it shrinks to an `Info` icon tile
+whose Tooltip and accessible name carry the same four lines; the drawer shows it
+in full. See [`api.md`](api.md) for `GET /api/admin/recap`.
+
 The top bar (GH #64) sits beside the sidebar toggle, left to right: the
 breadcrumb, a flexible gap, search, the notifications bell, the theme toggle
 and the avatar menu. The breadcrumb reads "Captain Prospectus › {group} ›
diff --git a/docs/free-tier-budget.md b/docs/free-tier-budget.md
index f0da59e..012d716 100644
--- a/docs/free-tier-budget.md
+++ b/docs/free-tier-budget.md
@@ -4,11 +4,11 @@ Limits change. **Re-verify on the vendors' pricing pages before relying on them*
 
 | Service | Free limit (as understood) | Our expected usage | Headroom |
 |---|---|---|---|
-| Workers requests | 100,000 / day | ~2 agents × ~200 syncs + admin polling ~2,000 ≈ 3,000 / day | ~30× |
+| Workers requests | 100,000 / day | ~2 agents × ~200 syncs + admin polling ~4,000 (the live feed, and the recap card on every admin page) ≈ 5,000 / day | ~20× |
 | Worker CPU per request | **10 ms** (hard limit, free plan) | a phone's 50-visit sync batch of bare visits is ~5 ms at worst warm (field prospects, notes and answers not measured); an old build's 200-visit batch is over, and a cold isolate's first request can be (see watch-outs) | **over on an old build's full batch, and at times on a cold first request** (GH #404) |
 | Static asset requests | free and unlimited, *if the Worker is not invoked for them* | the whole PWA shell | n/a |
 | D1 storage | 5 GB | < 50 MB in year one | large |
-| D1 rows read | 5 M / day (**enforced**: queries fail past it) | low tens of thousands | large |
+| D1 rows read | 5 M / day (**enforced**: queries fail past it) | up to a few hundred thousand, most of it the recap card's poll (see watch-outs) | ~10× or more |
 | D1 rows written | 100 k / day (**enforced**) | imports up to a few thousand; visits ~100 | large |
 | Zone rate-limiting rules | 1 per zone on the Free plan, counted per IP | 1, in front of `/api/auth/*` ([ADR-0035](adr/0035-serve-the-app-on-a-domain-we-already-own.md)) | **none** |
 | Custom domain | `fixbyte.cloud`, already owned for other work | one subdomain | no added cost |
@@ -49,6 +49,12 @@ Each figure follows from a constant or query on `main`, named in brackets. The e
 
 ## Watch-outs
 
+- **The recap card polls from every admin page** (`GET /api/admin/recap`, docs/api.md › The
+  recap card): 240 requests an hour per visible admin tab (ADR-0010), paused on a hidden one.
+  Each call reads about the day's received visits plus the `users` rows, so the cost grows
+  through the day: an estimate, not a measurement, of 240 × 8 h × ~100 rows ≈ 200,000 rows a
+  day for one tab open all day on a 100-visit day. If D1 reads ever get tight, lengthen this
+  poll first; the card's figures do not need 15 s.
 - **Google Places is the one line here that can actually bill us** (ADR-0020), and the only
   one whose free allowance this file does not state a number for. Per-SKU allowances changed
   in March 2025 and the figures in circulation disagree; the authoritative number is in the
diff --git a/src/client/admin/AdminApp.test.tsx b/src/client/admin/AdminApp.test.tsx
index 15185cf..0e11e5c 100644
--- a/src/client/admin/AdminApp.test.tsx
+++ b/src/client/admin/AdminApp.test.tsx
@@ -11,7 +11,7 @@ import { onlineManager } from "@tanstack/react-query";
 import { MemoryRouter, Route, Routes } from "react-router";
 import { copy } from "../copy";
 import { ORPHANS_PAGE_SIZE } from "../../shared/constants";
-import type { DashboardResponse } from "../../shared/schemas";
+import type { DashboardResponse, RecapResponse } from "../../shared/schemas";
 import { AdminApp } from "./AdminApp";
 
 const DASHBOARD: DashboardResponse = {
@@ -40,6 +40,15 @@ const DASHBOARD: DashboardResponse = {
   inactiveAgentProspects: 0,
 };
 
+const RECAP: RecapResponse = {
+  date: "2026-10-14",
+  activeAgents: 1,
+  rosterSize: 2,
+  visitsToday: 12,
+  lastReceivedAt: 0,
+  serverTime: 4 * 60_000,
+};
+
 function json(body: unknown): Response {
   return new Response(JSON.stringify(body), {
     status: 200,
@@ -62,6 +71,7 @@ beforeEach(() => {
         return json({ pairs: [], truncated: false });
       if (url.startsWith("/api/admin/visits/orphaned")) return json(orphans);
       if (url.startsWith("/api/admin/visits?")) return json({ visits: [], serverTime: 0 });
+      if (url.startsWith("/api/admin/recap")) return json(RECAP);
       return new Response("{}", { status: 404 });
     }),
   );
@@ -132,6 +142,13 @@ describe("AdminApp", () => {
     expect(dashboardCalls().length).toBeGreaterThan(before);
   });
 
+  it("ends the sidebar with the recap card on every admin path", async () => {
+    renderAdmin("/admin/inconnu");
+
+    const line = await screen.findByText("1 / 2 agents actifs");
+    expect(line.closest("[data-slot=sidebar-footer]")).toBeTruthy();
+  });
+
   it("registers /admin/agents: the Agents screen opens", async () => {
     renderAdmin("/admin/agents");
 
diff --git a/src/client/admin/AdminSidebar.tsx b/src/client/admin/AdminSidebar.tsx
index 13570aa..3d2d0c8 100644
--- a/src/client/admin/AdminSidebar.tsx
+++ b/src/client/admin/AdminSidebar.tsx
@@ -24,6 +24,7 @@ import {
   type NavCountSource,
 } from "./nav";
 import { useDuplicates, useOrphans } from "./queries";
+import { RecapCard } from "./RecapCard";
 
 /**
  * The count behind each badge, `undefined` while its query is loading or has
@@ -102,6 +103,7 @@ export function AdminSidebar() {
           </SidebarGroup>
         ))}
       </SidebarContent>
+      <RecapCard rail={rail} />
     </Sidebar>
   );
 }
diff --git a/src/client/admin/RecapCard.test.tsx b/src/client/admin/RecapCard.test.tsx
new file mode 100644
index 0000000..e4b9fae
--- /dev/null
+++ b/src/client/admin/RecapCard.test.tsx
@@ -0,0 +1,134 @@
+/**
+ * The sidebar's recap card (docs/design.md › Layout). `recap.test.ts` pins the
+ * lines; this pins what the card shows around them: nothing to click, nothing
+ * while loading or after a failure, and the rail's Info button.
+ *
+ * Rendered without `AdminSidebar`: `SidebarFooter` is a plain div and
+ * `Tooltip` brings its own provider, so no Sidebar context is needed.
+ */
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { act, render, screen, waitFor } from "@testing-library/react";
+import { QueryClientProvider, onlineManager } from "@tanstack/react-query";
+import type { RecapResponse } from "../../shared/schemas";
+import { adminKeys } from "./queries";
+import { createAdminQueryClient } from "./query-client";
+import { RecapCard } from "./RecapCard";
+
+const NOW = Date.parse("2026-10-14T10:00:00.000Z");
+
+const WORKING_DAY: RecapResponse = {
+  date: "2026-10-14",
+  activeAgents: 1,
+  rosterSize: 2,
+  visitsToday: 12,
+  lastReceivedAt: NOW - 4 * 60_000,
+  serverTime: NOW,
+};
+
+function serve(response: () => Response) {
+  vi.stubGlobal(
+    "fetch",
+    vi.fn(async () => response()),
+  );
+}
+
+function json(body: unknown): Response {
+  return new Response(JSON.stringify(body), {
+    status: 200,
+    headers: { "Content-Type": "application/json" },
+  });
+}
+
+function renderCard(rail = false) {
+  const client = createAdminQueryClient();
+  const view = render(
+    <QueryClientProvider client={client}>
+      <RecapCard rail={rail} />
+    </QueryClientProvider>,
+  );
+  return { ...view, client };
+}
+
+afterEach(() => {
+  vi.unstubAllGlobals();
+});
+
+/** The dot beside the headline: decorative, so found through its line. */
+function dotOf(headline: string): HTMLElement {
+  const dot = screen.getByText(headline).querySelector("span[aria-hidden=true]");
+  if (!(dot instanceof HTMLElement)) throw new Error(`no dot beside ${headline}`);
+  return dot;
+}
+
+describe("RecapCard", () => {
+  it("tells the day in full, with nothing to focus or click", async () => {
+    serve(() => json(WORKING_DAY));
+    const { container } = renderCard();
+
+    expect(await screen.findByText("1 / 2 agents actifs")).toBeTruthy();
+    expect(screen.getByText("mercredi 14 octobre")).toBeTruthy();
+    expect(screen.getByText("12 visites")).toBeTruthy();
+    expect(screen.getByText("Dernière visite reçue il y a 4 min")).toBeTruthy();
+    expect(container.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
+    expect(dotOf("1 / 2 agents actifs").className).toContain("bg-success");
+  });
+
+  it("drops the age line on a day with no visit", async () => {
+    serve(() => json({ ...WORKING_DAY, activeAgents: 0, visitsToday: 0, lastReceivedAt: null }));
+    renderCard();
+
+    expect(await screen.findByText("Aucune visite")).toBeTruthy();
+    expect(screen.queryByText(/Dernière visite reçue/)).toBeNull();
+    expect(dotOf("0 / 2 agents actifs").className).toContain("bg-band-muted");
+  });
+
+  it("keeps the last answer while the browser is offline", async () => {
+    serve(() => json(WORKING_DAY));
+    renderCard();
+    await screen.findByText("12 visites");
+
+    try {
+      act(() => onlineManager.setOnline(false));
+      // The offline banner says the data is frozen; the card stays to match it.
+      expect(screen.getByText("12 visites")).toBeTruthy();
+    } finally {
+      act(() => onlineManager.setOnline(true));
+    }
+  });
+
+  it("shows no card while loading or once the poll has failed", async () => {
+    serve(() => new Response("{}", { status: 500 }));
+    const { container, client } = renderCard();
+
+    expect(container.querySelector("[data-slot=sidebar-footer]")).toBeNull();
+    // createAdminQueryClient retries once before the query settles as failed.
+    await waitFor(() => expect(client.getQueryState(adminKeys.recap())?.status).toBe("error"), {
+      timeout: 3000,
+    });
+    expect(container.querySelector("[data-slot=sidebar-footer]")).toBeNull();
+  });
+
+  it("is an Info button in the rail, named with every line", async () => {
+    serve(() => json(WORKING_DAY));
+    renderCard(true);
+
+    const button = await screen.findByRole("button", {
+      name: "Récapitulatif du jour : mercredi 14 octobre, 1 / 2 agents actifs, 12 visites, Dernière visite reçue il y a 4 min",
+    });
+    expect(button).toBeTruthy();
+    expect(screen.queryByText("12 visites")).toBeNull();
+  });
+
+  it("polls every 15 s on a visible tab only, and catches up on focus", async () => {
+    serve(() => json(WORKING_DAY));
+    const { client } = renderCard();
+    await screen.findByText("12 visites");
+
+    const options = client.getQueryCache().find({ queryKey: adminKeys.recap() })
+      ?.observers[0]?.options;
+    expect(options?.refetchInterval).toBe(15_000);
+    // TanStack's default, false, is what pauses the poll on a hidden tab.
+    expect(options?.refetchIntervalInBackground).toBeUndefined();
+    expect(options?.refetchOnWindowFocus).toBe(true);
+  });
+});
diff --git a/src/client/admin/RecapCard.tsx b/src/client/admin/RecapCard.tsx
new file mode 100644
index 0000000..f7f2220
--- /dev/null
+++ b/src/client/admin/RecapCard.tsx
@@ -0,0 +1,66 @@
+import { InfoIcon } from "lucide-react";
+import { copy } from "../copy";
+import { cn } from "../lib/utils";
+import { SidebarFooter } from "../ui/sidebar";
+import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
+import { useRecap } from "./queries";
+import { recapLines } from "./recap";
+
+/**
+ * The sidebar's recap card (docs/design.md › Layout): the day's story in small
+ * type. No identity and nothing to click; absent while loading or after a
+ * failed poll, like the nav badges (`queueCount`), rather than stale. In the
+ * rail it is an Info button whose Tooltip and name carry the same lines.
+ */
+export function RecapCard({ rail }: { rail: boolean }) {
+  const recap = useRecap();
+  if (!recap.isSuccess) return null;
+
+  const lines = recapLines(recap.data);
+  const active = recap.data.activeAgents > 0;
+
+  if (rail) {
+    const spoken = [lines.date, lines.agents, lines.visits, lines.received].filter(
+      (line): line is string => line !== null,
+    );
+    return (
+      <SidebarFooter className="items-center">
+        <Tooltip>
+          <TooltipTrigger asChild>
+            <button
+              type="button"
+              aria-label={copy.recap.summary(spoken)}
+              className="bg-band-accent ring-band-border text-band-foreground flex size-8 items-center justify-center rounded-md ring-1 ring-inset"
+            >
+              <InfoIcon aria-hidden="true" className="size-4" />
+            </button>
+          </TooltipTrigger>
+          <TooltipContent side="right" align="end">
+            <p className="first-letter:uppercase">{lines.date}</p>
+            <p className="tnum font-semibold">{lines.agents}</p>
+            <p className="tnum">{lines.visits}</p>
+            {lines.received && <p>{lines.received}</p>}
+          </TooltipContent>
+        </Tooltip>
+      </SidebarFooter>
+    );
+  }
+
+  return (
+    <SidebarFooter>
+      <div data-slot="recap-card" className="bg-band-accent rounded-md px-3 py-2.5 text-xs">
+        <p className="text-overline text-band-muted mb-1 uppercase">{lines.date}</p>
+        <p className="tnum text-band-foreground flex items-center gap-2 font-medium">
+          {/* Not a verdict, and never the only signal: the line beside it says it. */}
+          <span
+            aria-hidden="true"
+            className={cn("size-2 shrink-0 rounded-full", active ? "bg-success" : "bg-band-muted")}
+          />
+          {lines.agents}
+        </p>
+        <p className="tnum text-band-foreground pl-4">{lines.visits}</p>
+        {lines.received && <p className="text-band-muted pl-4">{lines.received}</p>}
+      </div>
+    </SidebarFooter>
+  );
+}
diff --git a/src/client/admin/queries.ts b/src/client/admin/queries.ts
index f6ffa2d..abf3f46 100644
--- a/src/client/admin/queries.ts
+++ b/src/client/admin/queries.ts
@@ -36,6 +36,7 @@ import type {
   Prospect,
   ProspectsResponse,
   Question,
+  RecapResponse,
   Script,
   ScriptsResponse,
   LoginCodeResponse,
@@ -81,6 +82,7 @@ export const adminKeys = {
   imports: () => ["admin", "imports"] as const,
   orphans: () => ["admin", "visits", "orphans"] as const,
   agentRound: (email: string) => ["admin", "agents", email, "round"] as const,
+  recap: () => ["admin", "recap"] as const,
 };
 
 /**
@@ -476,6 +478,20 @@ export function usePlacesImport() {
 /** How often the feed asks, while the tab is visible (ADR-0010). */
 const FEED_POLL_MS = 15_000;
 
+/**
+ * The sidebar's recap card (docs/api.md › The recap card), on the feed's
+ * cadence. Paused on a hidden tab like the feed, and refetched on focus,
+ * which AdminApp turns off globally.
+ */
+export function useRecap() {
+  return useQuery({
+    queryKey: adminKeys.recap(),
+    queryFn: () => apiFetch<RecapResponse>("/api/admin/recap"),
+    refetchInterval: FEED_POLL_MS,
+    refetchOnWindowFocus: true,
+  });
+}
+
 /**
  * Visits as they arrive — ADR-0010.
  *
diff --git a/src/client/admin/recap.test.ts b/src/client/admin/recap.test.ts
new file mode 100644
index 0000000..6aa8234
--- /dev/null
+++ b/src/client/admin/recap.test.ts
@@ -0,0 +1,65 @@
+import { describe, expect, it } from "vitest";
+import type { RecapResponse } from "../../shared/schemas";
+import { recapLines, receivedAgo } from "./recap";
+
+const NOW = Date.parse("2026-10-14T10:00:00.000Z");
+
+function recap(overrides: Partial<RecapResponse> = {}): RecapResponse {
+  return {
+    date: "2026-10-14",
+    activeAgents: 1,
+    rosterSize: 2,
+    visitsToday: 12,
+    lastReceivedAt: NOW - 4 * 60_000,
+    serverTime: NOW,
+    ...overrides,
+  };
+}
+
+describe("recapLines (spec I/O matrix)", () => {
+  it("tells a working day: the date, the fraction, the visits and the age", () => {
+    expect(recapLines(recap())).toEqual({
+      date: "mercredi 14 octobre",
+      agents: "1 / 2 agents actifs",
+      visits: "12 visites",
+      received: "Dernière visite reçue il y a 4 min",
+    });
+  });
+
+  it("says nothing arrived, with no age line, on an empty day", () => {
+    const lines = recapLines(recap({ activeAgents: 0, visitsToday: 0, lastReceivedAt: null }));
+    expect(lines.agents).toBe("0 / 2 agents actifs");
+    expect(lines.visits).toBe("Aucune visite");
+    expect(lines.received).toBeNull();
+  });
+
+  it("agrees in the singular", () => {
+    const lines = recapLines(recap({ rosterSize: 1, visitsToday: 1 }));
+    expect(lines.agents).toBe("1 / 1 agent actif");
+    expect(lines.visits).toBe("1 visite");
+  });
+
+  it("reads the age from the server's clock, not the device's", () => {
+    // The device's clock is never consulted: only serverTime − lastReceivedAt.
+    const lines = recapLines(recap({ serverTime: NOW + 3 * 3_600_000 + 10 * 60_000 }));
+    expect(lines.received).toBe("Dernière visite reçue il y a 3 h");
+  });
+});
+
+describe("receivedAgo", () => {
+  it.each([
+    [0, "Dernière visite reçue à l'instant"],
+    [59_999, "Dernière visite reçue à l'instant"],
+    [60_000, "Dernière visite reçue il y a 1 min"],
+    [59 * 60_000 + 59_999, "Dernière visite reçue il y a 59 min"],
+    [3_600_000, "Dernière visite reçue il y a 1 h"],
+    [3 * 3_600_000 + 10 * 60_000, "Dernière visite reçue il y a 3 h"],
+  ])("%i ms reads %s", (ageMs, expected) => {
+    expect(receivedAgo(ageMs)).toBe(expected);
+  });
+
+  it("treats a receipt stamped after the server's clock as just now", () => {
+    // Two isolates' clocks can disagree by a little.
+    expect(receivedAgo(-500)).toBe("Dernière visite reçue à l'instant");
+  });
+});
diff --git a/src/client/admin/recap.ts b/src/client/admin/recap.ts
new file mode 100644
index 0000000..c638df7
--- /dev/null
+++ b/src/client/admin/recap.ts
@@ -0,0 +1,33 @@
+import { HOUR_MS } from "../../shared/constants";
+import type { RecapResponse } from "../../shared/schemas";
+import { copy } from "../copy";
+import { formatDay } from "../format";
+
+const MINUTE_MS = 60_000;
+
+/**
+ * The recap card's four lines (docs/design.md › Layout), shared by the full
+ * card and the rail's Tooltip so the two can never say different things. The
+ * age reads the server's two clocks, never the device's.
+ */
+export function recapLines(data: RecapResponse): {
+  date: string;
+  agents: string;
+  visits: string;
+  received: string | null;
+} {
+  return {
+    date: formatDay(data.date),
+    agents: copy.recap.agents(data.activeAgents, data.rosterSize),
+    visits: copy.recap.visits(data.visitsToday),
+    received:
+      data.lastReceivedAt === null ? null : receivedAgo(data.serverTime - data.lastReceivedAt),
+  };
+}
+
+/** Under a minute is "à l'instant"; whole minutes below an hour, then whole hours. */
+export function receivedAgo(ageMs: number): string {
+  if (ageMs < MINUTE_MS) return copy.recap.receivedNow;
+  if (ageMs < HOUR_MS) return copy.recap.receivedMinutes(Math.floor(ageMs / MINUTE_MS));
+  return copy.recap.receivedHours(Math.floor(ageMs / HOUR_MS));
+}
diff --git a/src/client/copy/admin.ts b/src/client/copy/admin.ts
index 0a36392..d5662ec 100644
--- a/src/client/copy/admin.ts
+++ b/src/client/copy/admin.ts
@@ -152,6 +152,20 @@ export const adminCopy = {
     logout: "Se déconnecter",
   },
 
+  /** The sidebar's recap card (docs/design.md › Layout). The date heads it, so
+   * no line repeats « aujourd'hui »; agreement follows the roster's size. */
+  recap: {
+    /** The rail's Info button reads the whole card as its name. */
+    summary: (lines: string[]) => `Récapitulatif du jour : ${lines.join(", ")}`,
+    agents: (active: number, roster: number) =>
+      `${formatCount(active)} / ${formatCount(roster)} ${roster <= 1 ? "agent actif" : "agents actifs"}`,
+    visits: (n: number) =>
+      n === 0 ? "Aucune visite" : `${formatCount(n)} ${n === 1 ? "visite" : "visites"}`,
+    receivedNow: "Dernière visite reçue à l'instant",
+    receivedMinutes: (n: number) => `Dernière visite reçue il y a ${formatCount(n)} min`,
+    receivedHours: (n: number) => `Dernière visite reçue il y a ${formatCount(n)} h`,
+  },
+
   /** Tableau de bord at /admin (GH #107). */
   dashboard: {
     title: "Tableau de bord",
diff --git a/src/client/ui/sidebar.tsx b/src/client/ui/sidebar.tsx
index 7929ff1..c5eb7cd 100644
--- a/src/client/ui/sidebar.tsx
+++ b/src/client/ui/sidebar.tsx
@@ -193,6 +193,16 @@ function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
   );
 }
 
+function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
+  return (
+    <div
+      data-slot="sidebar-footer"
+      className={cn("flex shrink-0 flex-col gap-2 border-t border-sidebar-border p-2", className)}
+      {...props}
+    />
+  );
+}
+
 function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
   return (
     <div
@@ -327,6 +337,7 @@ function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"span">)
 export {
   Sidebar,
   SidebarContent,
+  SidebarFooter,
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
diff --git a/src/shared/schemas.ts b/src/shared/schemas.ts
index 33b9b6a..5fecf26 100644
--- a/src/shared/schemas.ts
+++ b/src/shared/schemas.ts
@@ -526,6 +526,23 @@ export const agentsResponseSchema = z.object({
 });
 export type AgentsResponse = z.infer<typeof agentsResponseSchema>;
 
+/**
+ * The admin sidebar's recap card — docs/api.md › The recap card. Every figure
+ * reads `received_at` over one Brussels day, `date`.
+ */
+export const recapResponseSchema = z.object({
+  /** The Brussels calendar date, `YYYY-MM-DD`. */
+  date: z.iso.date(),
+  /** Roster members with a visit received that day, so never above `rosterSize`. */
+  activeAgents: countSchema,
+  rosterSize: countSchema,
+  visitsToday: countSchema,
+  lastReceivedAt: z.nullable(epochMsSchema),
+  /** The server's clock, so the card's "il y a …" never reads the device's. */
+  serverTime: epochMsSchema,
+});
+export type RecapResponse = z.infer<typeof recapResponseSchema>;
+
 export const agentEmailParamSchema = z.object({ email: emailSchema });
 
 /* ------------------------------------------------------------ /api/admin/users */
diff --git a/src/worker/recap.test.ts b/src/worker/recap.test.ts
new file mode 100644
index 0000000..7e69db5
--- /dev/null
+++ b/src/worker/recap.test.ts
@@ -0,0 +1,135 @@
+import { env } from "cloudflare:test";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { getDb } from "./db/client";
+import { prospects, visits, visitsOrphaned } from "./db/schema";
+import { brusselsMidnightDaysFromNow } from "../shared/period";
+import type { RecapResponse } from "../shared/schemas";
+import { workerFetch } from "../../test/worker-fetch";
+import { TEST_ADMIN, TEST_AGENT, resetTestUsers, seedUser } from "../../test/users";
+
+/**
+ * `GET /api/admin/recap` against a real D1 — the sidebar's recap card
+ * (docs/api.md › The recap card). The roster is the two seeded users.
+ */
+
+/** Noon in Brussels on a plain June day, clear of midnight and of a DST switch. */
+const NOW = Date.parse("2026-06-17T10:00:00.000Z");
+
+async function recap(): Promise<{ status: number; cache: string | null; body: RecapResponse }> {
+  const response = await workerFetch("http://localhost/api/admin/recap");
+  return {
+    status: response.status,
+    cache: response.headers.get("Cache-Control"),
+    body: (await response.json()) as RecapResponse,
+  };
+}
+
+async function seedProspect(): Promise<string> {
+  const id = crypto.randomUUID();
+  await getDb(env.DB)
+    .insert(prospects)
+    .values({
+      id,
+      name: "Le Bistrot",
+      type: "restaurant",
+      source: "csv",
+      dedupeKey: `test:${id}`,
+      status: "assigned",
+      assignedTo: TEST_AGENT,
+      createdBy: TEST_ADMIN,
+      createdAt: NOW,
+      updatedAt: NOW,
+    });
+  return id;
+}
+
+/** A visit by `agentEmail`, received at `receivedAt` and made an hour before. */
+async function receive(prospectId: string, receivedAt: number, agentEmail = TEST_AGENT) {
+  await getDb(env.DB)
+    .insert(visits)
+    .values({
+      id: crypto.randomUUID(),
+      prospectId,
+      agentEmail,
+      visitedAt: receivedAt - 3_600_000,
+      clientVisitedAt: receivedAt - 3_600_000,
+      receivedAt,
+      outcome: "no_contact",
+      clientVersion: 1,
+    });
+}
+
+beforeEach(async () => {
+  vi.useFakeTimers({ toFake: ["Date"] });
+  vi.setSystemTime(NOW);
+  const db = getDb(env.DB);
+  await db.delete(visits);
+  await db.delete(visitsOrphaned);
+  await db.delete(prospects);
+  await resetTestUsers();
+});
+
+afterEach(() => {
+  vi.useRealTimers();
+});
+
+describe("GET /api/admin/recap", () => {
+  it("reports an empty day with the roster, the Brussels date and the server's clock", async () => {
+    const { status, cache, body } = await recap();
+
+    expect(status).toBe(200);
+    expect(cache).toBe("no-store");
+    expect(body).toEqual({
+      date: "2026-06-17",
+      activeAgents: 0,
+      rosterSize: 2,
+      visitsToday: 0,
+      lastReceivedAt: null,
+      serverTime: NOW,
+    });
+  });
+
+  it("counts visits received from Brussels midnight to the next, by received_at", async () => {
+    const dayStart = brusselsMidnightDaysFromNow(NOW, 0);
+    const prospectId = await seedProspect();
+    // Received yesterday, one millisecond before midnight: not today.
+    await receive(prospectId, dayStart - 1);
+    // Received today, though made yesterday (visitedAt is an hour earlier).
+    await receive(prospectId, dayStart);
+    await receive(prospectId, NOW - 4 * 60_000);
+
+    const { body } = await recap();
+
+    expect(body.visitsToday).toBe(2);
+    expect(body.activeAgents).toBe(1);
+    expect(body.lastReceivedAt).toBe(NOW - 4 * 60_000);
+  });
+
+  it("counts each roster member once, and a sender off the roster as a visit only", async () => {
+    const prospectId = await seedProspect();
+    await seedUser("gone@example.com", "agent", false);
+    await receive(prospectId, NOW - 60_000, TEST_AGENT);
+    await receive(prospectId, NOW - 30_000, TEST_AGENT);
+    await receive(prospectId, NOW - 10_000, "gone@example.com");
+
+    const { body } = await recap();
+
+    expect(body.activeAgents).toBe(1);
+    expect(body.rosterSize).toBe(2);
+    expect(body.visitsToday).toBe(3);
+    expect(body.lastReceivedAt).toBe(NOW - 10_000);
+  });
+
+  it("never reports more active agents than the roster holds", async () => {
+    const prospectId = await seedProspect();
+    await receive(prospectId, NOW - 60_000, TEST_AGENT);
+    await receive(prospectId, NOW - 50_000, TEST_ADMIN);
+    await seedUser("gone@example.com", "agent", false);
+    await receive(prospectId, NOW - 40_000, "gone@example.com");
+
+    const { body } = await recap();
+
+    expect(body.activeAgents).toBe(2);
+    expect(body.activeAgents).toBeLessThanOrEqual(body.rosterSize);
+  });
+});
diff --git a/src/worker/routes/admin.ts b/src/worker/routes/admin.ts
index e17febd..d111d0b 100644
--- a/src/worker/routes/admin.ts
+++ b/src/worker/routes/admin.ts
@@ -94,6 +94,7 @@ import type {
   MergeResult,
   AreaSearchResponse,
   ProspectsResponse,
+  RecapResponse,
   Script,
   ScriptsResponse,
 } from "../../shared/schemas";
@@ -194,6 +195,54 @@ async function unknownAssignee(email: string | null, db: Db): Promise<boolean> {
   return email !== null && !(await activeRosterMember(db, email));
 }
 
+/* -------------------------------------------------------------------- recap */
+
+/**
+ * The sidebar's recap card — docs/api.md › The recap card. Polled every 15 s
+ * from every admin page, so it stays two statements beside the dashboard's
+ * thirteen rather than a figure added to them (free-tier-budget.md).
+ */
+adminRoutes.get("/recap", async (c) => {
+  const now = Date.now();
+  const dayStart = brusselsMidnightDaysFromNow(now, 0);
+  const db = getDb(c.env.DB);
+  const [roster, byAgent] = await Promise.all([
+    activeRoster(db),
+    // One row per sender, on `visits_received_idx`: a day has a handful.
+    db
+      .select({
+        email: visits.agentEmail,
+        n: count(),
+        last: sql<number>`max(${visits.receivedAt})`.mapWith(Number),
+      })
+      .from(visits)
+      .where(
+        and(
+          gte(visits.receivedAt, dayStart),
+          lt(visits.receivedAt, brusselsMidnightDaysFromNow(now, 1)),
+        ),
+      )
+      .groupBy(visits.agentEmail),
+  ]);
+
+  // A sender off the roster still counts as a visit, never as an active
+  // agent, so the card cannot read "3 / 2".
+  const onRoster = new Set(roster.map((r) => r.email));
+  const lastReceivedAt = byAgent.length === 0 ? null : Math.max(...byAgent.map((r) => r.last));
+  // One day asked for, so exactly one date comes back.
+  const [date] = periodDates(dayStart, 1);
+  if (date === undefined) throw new Error("periodDates returned no day for one day");
+  c.header("Cache-Control", "no-store");
+  return c.json<RecapResponse>({
+    date,
+    activeAgents: byAgent.filter((r) => onRoster.has(r.email)).length,
+    rosterSize: roster.length,
+    visitsToday: byAgent.reduce((n, r) => n + r.n, 0),
+    lastReceivedAt,
+    serverTime: now,
+  });
+});
+
 /* ---------------------------------------------------------------- dashboard */
 
 /**
````

Your task is strictly descriptive — do not prescribe additional work. Report: (1) the defensible readings of the intent, enumerated; (2) which reading this diff implements; (3) where the readings and the diff diverge — specifically, which surface the intent's expectations live at versus which surface the diff's changes and its tests exercise.

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.
