/**
 * Admin data access. TanStack Query lives on this side only (ADR-0013): the
 * field client's source of truth is Dexie, and a second cache over the outbox
 * is how visits get lost.
 */
import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../api";
import { copy } from "../copy";
import { ADMIN_VISITS_PAGE_SIZE, IMPORT_ROWS_PER_REQUEST } from "../../shared/constants";
import { brusselsPeriod } from "../../shared/period";
import {
  dueBeforeSchema,
  emailSchema,
  prospectFiltersSchema,
  searchQuerySchema,
  sourceSchema,
  statusListSchema,
} from "../../shared/schemas";
import { arrivedIds, mergeVisits, nextSince } from "./visits/feed";
import { batched } from "./import/csv";
import { PAGE_SIZE } from "./pagination";
import type {
  AdminVisit,
  AdminVisitsResponse,
  AgentRoundResponse,
  AgentsResponse,
  AssignResult,
  DashboardResponse,
  DuplicatesResponse,
  ImportResult,
  ImportRow,
  MergeResult,
  AreaSearchResponse,
  Prospect,
  ProspectsResponse,
  Question,
  Script,
  ScriptsResponse,
  LoginCodeResponse,
  User,
  UserCreate,
  UserUpdate,
  UsersResponse,
  OrphansResponse,
  OrphanRepairResult,
} from "../../shared/schemas";
import type { DashboardPeriod, RefusalReason, Source, Status } from "../../shared/constants";

export type ProspectFilters = {
  /** Any of these. The API reads them comma-separated (docs/api.md). */
  status?: Status[];
  /** `next_visit_at < dueBefore`, epoch ms — Relances dues' own boundary. */
  dueBefore?: number;
  assignedTo?: string;
  source?: Source;
  /** Name substring search (G4, #176) — trimmed, 1–200 chars; blank never sent. */
  q?: string;
  /** Hors cible signalé (GH #250): only ever `true`; absent means no filter. */
  outOfTarget?: true;
};

/** One factory, so an invalidation can never miss a key by spelling it differently. */
export const adminKeys = {
  /** Every period's entry at once — what a mutation invalidates (query-client.ts). */
  dashboards: () => ["admin", "dashboard"] as const,
  dashboard: (period: DashboardPeriod) => ["admin", "dashboard", period] as const,
  prospects: (filters: ProspectFilters) => ["admin", "prospects", filters] as const,
  agents: () => ["admin", "agents"] as const,
  users: () => ["admin", "users"] as const,
  duplicates: () => ["admin", "duplicates"] as const,
  visitsFeed: () => ["admin", "visits", "feed"] as const,
  scripts: () => ["admin", "scripts"] as const,
  orphans: () => ["admin", "visits", "orphans"] as const,
  agentRound: (email: string) => ["admin", "agents", email, "round"] as const,
};

/**
 * Tableau de bord's figures for one period (GH #107).
 *
 * No polling in this story. `keepPreviousData` keeps the last period's cards on
 * screen while another period loads, instead of flashing back to skeletons.
 * Every mutation marks it stale (query-client.ts), so it refetches as soon as
 * it is on screen, whatever staleTime a later story sets.
 */
export function useDashboard(period: DashboardPeriod) {
  return useQuery({
    queryKey: adminKeys.dashboard(period),
    queryFn: () => apiFetch<DashboardResponse>(`/api/admin/dashboard?period=${period}`),
    placeholderData: keepPreviousData,
  });
}

/**
 * The one spelling of Prospects' filters, shared by the API request, the
 * screen's own URL and the dashboard's links — so a link and the list it opens
 * can never parse two formats.
 */
export function toQueryString(filters: ProspectFilters): string {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.dueBefore !== undefined) params.set("dueBefore", String(filters.dueBefore));
  if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
  if (filters.source) params.set("source", filters.source);
  if (filters.q) params.set("q", filters.q);
  if (filters.outOfTarget) params.set("outOfTarget", "true");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Where Prospects opens with these filters. */
export function prospectsHref(filters: ProspectFilters): string {
  return `/admin/prospects${toQueryString(filters)}`;
}

/** Where Visites opens for this period — the dashboard's Visites card (GH #178). */
export function visitsHref(period: DashboardPeriod): string {
  return `/admin/visites?period=${period}`;
}

/**
 * The inverse of `toQueryString`, through the API's own schemas. A value the
 * API would 400 on is dropped rather than thrown: a hand-edited URL should show
 * the list, less that filter, not an error screen.
 */
export function parseProspectFilters(params: URLSearchParams): ProspectFilters {
  const filters: ProspectFilters = {};
  const status = statusListSchema.safeParse(params.get("status") ?? undefined);
  if (status.success) filters.status = status.data;
  const dueBefore = dueBeforeSchema.safeParse(params.get("dueBefore") ?? undefined);
  if (dueBefore.success) filters.dueBefore = dueBefore.data;
  const assignedTo = emailSchema.safeParse(params.get("assignedTo") ?? undefined);
  if (assignedTo.success) filters.assignedTo = assignedTo.data;
  const source = sourceSchema.safeParse(params.get("source") ?? undefined);
  if (source.success) filters.source = source.data;
  const q = searchQuerySchema.safeParse(params.get("q") ?? undefined);
  if (q.success) filters.q = q.data;
  const outOfTarget = prospectFiltersSchema.shape.outOfTarget.safeParse(
    params.get("outOfTarget") ?? undefined,
  );
  if (outOfTarget.success && outOfTarget.data) filters.outOfTarget = true;
  return filters;
}

/**
 * Server-side paging (#179): the list endpoint already returns `total`, and
 * holding 200 rows to show 25 would bill scanned rows for nothing. `page` is
 * the last segment of the query key, after `adminKeys.prospects(filters)`, so
 * a page change gets its own cache entry while an invalidation against the
 * shorter `["admin", "prospects"]` prefix still reaches every page.
 */
export function useProspects(filters: ProspectFilters, page: number) {
  return useQuery({
    queryKey: [...adminKeys.prospects(filters), page],
    queryFn: () => {
      const offset = (page - 1) * PAGE_SIZE;
      const params = new URLSearchParams(toQueryString(filters).slice(1));
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      return apiFetch<ProspectsResponse>(`/api/admin/prospects?${params}`);
    },
    placeholderData: keepPreviousData,
  });
}

export function useAgents() {
  return useQuery({
    queryKey: adminKeys.agents(),
    queryFn: () => apiFetch<AgentsResponse>("/api/admin/agents"),
    // The roster comes from a Worker variable, not a table. It cannot change
    // while the page is open.
    staleTime: Infinity,
  });
}

/** Every user, active or not (ADR-0029). The deactivation count is kept fresh by DeactivateDialog's own refetch(), not by this query. */
export function useUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => apiFetch<UsersResponse>("/api/admin/users"),
  });
}

/** The users list and the assign menu's roster both read `users`, so both follow a change. */
function useInvalidateUsers() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: adminKeys.users() }),
      client.invalidateQueries({ queryKey: adminKeys.agents() }),
    ]);
  };
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: UserCreate) =>
      apiFetch<User>("/api/admin/users", { method: "POST", body: JSON.stringify(input) }),
    // Not awaited (query-client.ts): after a self-demotion the refetch would 403 and flash the failed state.
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: { email: string; update: UserUpdate }) =>
      apiFetch<void>(`/api/admin/users/${encodeURIComponent(input.email)}`, {
        method: "PATCH",
        body: JSON.stringify(input.update),
      }),
    onSuccess: () => {
      void invalidate();
    },
  });
}

/**
 * A one-time code for a user's next device. The list does not change, so
 * nothing is invalidated; gcTime 0 drops the code from the cache once the
 * dialog is done with it, since it is shown once.
 */
export function useGenerateCode() {
  return useMutation({
    gcTime: 0,
    mutationFn: (email: string) =>
      apiFetch<LoginCodeResponse>(`/api/admin/users/${encodeURIComponent(email)}/code`, {
        method: "POST",
      }),
  });
}

/** One agent's round and last position (ADR-0028). Idle until an agent is chosen; no polling. */
export function useAgentRound(email: string | null) {
  return useQuery({
    queryKey: adminKeys.agentRound(email ?? ""),
    queryFn: () =>
      apiFetch<AgentRoundResponse>(`/api/admin/agents/${encodeURIComponent(email ?? "")}/round`),
    enabled: email !== null,
  });
}

function useInvalidateProspects() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["admin", "prospects"] });
}

export function useDuplicates() {
  return useQuery({
    queryKey: adminKeys.duplicates(),
    queryFn: () => apiFetch<DuplicatesResponse>("/api/admin/prospects/duplicates"),
    // A sweep compares thousands of rows; it is not something to redo on a whim.
    staleTime: 60_000,
  });
}

export function useMerge() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { survivorId: string; mergedId: string }) =>
      apiFetch<MergeResult>("/api/admin/prospects/merge", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      // Both: one prospect left the list, and this pair left the sweep.
      await client.invalidateQueries({ queryKey: ["admin", "prospects"] });
      await client.invalidateQueries({ queryKey: adminKeys.duplicates() });
    },
  });
}

export function useAssign() {
  const invalidate = useInvalidateProspects();
  return useMutation({
    mutationFn: (input: { ids: string[]; assignedTo: string | null }) =>
      apiFetch<AssignResult>("/api/admin/prospects/assign", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

/**
 * Send an import one request at a time.
 *
 * Not a plain mutation: a file is many requests (250 rows each, the Worker's
 * cap), they have to go in order, and the admin needs to see how far it got if
 * one fails. Resending the whole file afterwards is safe — the upsert is keyed
 * on the dedupe key — which is what the failure copy tells them.
 */
export function useImportBatches(source: Source = "csv") {
  const client = useQueryClient();
  const invalidate = useInvalidateProspects();
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function start(rows: ImportRow[]) {
    setIsRunning(true);
    setError(null);
    setResult(null);

    const batches = batched(rows, IMPORT_ROWS_PER_REQUEST);
    const totals = { created: 0, updated: 0 };
    let done = 0;
    setProgress({ done: 0, total: rows.length });

    try {
      for (const batch of batches) {
        const outcome = await apiFetch<ImportResult>("/api/admin/prospects/batch", {
          method: "POST",
          body: JSON.stringify({ source, rows: batch }),
        });
        totals.created += outcome.created;
        totals.updated += outcome.updated;
        done += batch.length;
        setProgress({ done, total: rows.length });
      }
      setResult(totals);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : copy.import.failed);
    } finally {
      setIsRunning(false);
      // Not a useMutation, so the MutationCache in query-client.ts never sees
      // it: an import adds open prospects, so the dashboard is stale too.
      await Promise.all([
        invalidate(),
        client.invalidateQueries({ queryKey: adminKeys.dashboards() }),
      ]);
    }
  }

  function reset() {
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setError(null);
  }

  return { start, reset, progress, result, error, isRunning };
}

/**
 * Search an area for places — ADR-0008.
 *
 * A mutation rather than a query: it is an action the admin takes by pressing a
 * button, not state the screen reads. That also means no automatic retry — the
 * screen offers the admin one, because Overpass is a shared public service and
 * a client that retries on its own is how an app gets rate-limited.
 */
export function useOverpassImport() {
  return useMutation({
    mutationFn: (polygon: [number, number][]) =>
      apiFetch<AreaSearchResponse>("/api/admin/import/overpass", {
        method: "POST",
        body: JSON.stringify({ polygon }),
      }),
    retry: false,
  });
}

/**
 * Search a circle for places — ADR-0020.
 *
 * The same mutation-not-query reasoning as above, with one more: a search here
 * is billable, so it must never happen because a component remounted or a
 * window regained focus. `retry: false` matters twice over — an automatic
 * retry would be a second charge for the same failure.
 */
export function usePlacesImport() {
  return useMutation({
    mutationFn: (circle: { center: [number, number]; radius: number }) =>
      apiFetch<AreaSearchResponse>("/api/admin/import/places", {
        method: "POST",
        body: JSON.stringify(circle),
      }),
    retry: false,
  });
}

/** How often the feed asks, while the tab is visible (ADR-0010). */
const FEED_POLL_MS = 15_000;

/**
 * Visits as they arrive — ADR-0010.
 *
 * The cursor lives in a ref, not in the query key. Putting a moving `since` in
 * the key would mint a fresh cache entry every 15 s and grow without bound; a
 * stable key means one entry that is refetched, which is what TanStack's
 * interval is for.
 *
 * `refetchIntervalInBackground` stays at its default of false, which is what
 * pauses the poll on a hidden tab. `refetchOnWindowFocus` is overridden to
 * true: AdminApp turns it off globally, and coming back to the tab is exactly
 * when the feed should catch up rather than wait out the interval.
 *
 * `period` scopes the feed to a 7/30/90-day window (GH #178): the request adds
 * `from`/`to` from `brusselsPeriod`, sent as `to − 1` because the feed's bounds
 * are inclusive. Dernières visites' call leaves it out and reads the unscoped
 * cache entry; Visites reads a period-scoped one, under the same
 * `adminKeys.visitsFeed()` prefix, so an invalidation elsewhere still reaches
 * every period's entry. A period change is a fresh mount of this hook
 * (`VisitsScreenBody` is keyed by `period`), so the cursor, `seeded` and
 * `held` all start over rather than carry state across a re-seed.
 *
 * `reason` narrows it to one refusal reason (GH #249) the same way: sent on
 * every poll, part of the scoped key, and a change is a fresh mount.
 */
export function useVisitsFeed(period?: DashboardPeriod, reason?: RefusalReason) {
  const since = useRef(0);
  /**
   * Whether a first answer has landed. Without this the opening page arrives
   * all at once and every row highlights — the screen announces eighteen new
   * visits when nothing is new, which is precisely the noise the ambient rule
   * exists to avoid. A visit arriving into an empty feed while it is open is
   * still new; a feed being filled for the first time is not.
   */
  const seeded = useRef(false);
  /** The list as the effect last folded it, so the fold never reads stale state. */
  const held = useRef<AdminVisit[]>([]);
  const [visits, setVisits] = useState<AdminVisit[]>([]);
  const [arrived, setArrived] = useState<string[]>([]);
  /** The opening page filled the server's cap, so the window may hold more than we do. */
  const [capped, setCapped] = useState(false);
  /**
   * `seeded`, but as state: set in the same render as the first `visits`, so
   * `isPending` never drops a render before the rows land — which flashed the
   * empty copy between the skeleton and the rows (GH #223).
   */
  const [taken, setTaken] = useState(false);
  /**
   * Answers older than this mount are skipped. The cache entry outlives this
   * mount — Dernières visites' unscoped entry outlives every Visites visit,
   * and a period-scoped one outlives a period change that later returns to
   * it — so on a return it holds the last *delta* page; seeding from it would
   * turn the `since=0` refetch into a wash and an announcement for every
   * visit (GH #113).
   */
  const [mountedAt] = useState(() => Date.now());

  const query = useQuery({
    queryKey:
      period !== undefined || reason !== undefined
        ? [...adminKeys.visitsFeed(), period ?? null, reason ?? null]
        : adminKeys.visitsFeed(),
    queryFn: () => {
      const params = new URLSearchParams({ since: String(since.current) });
      if (period !== undefined) {
        // Bounds recomputed every poll, not once at mount: a poll that
        // straddles Brussels midnight must ask with that instant's own window.
        const bounds = brusselsPeriod(Date.now(), period);
        params.set("from", String(bounds.from));
        params.set("to", String(bounds.to - 1));
      }
      if (reason !== undefined) params.set("reason", reason);
      return apiFetch<AdminVisitsResponse>(`/api/admin/visits?${params}`);
    },
    refetchInterval: FEED_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const page = query.data;
  const answeredAt = query.dataUpdatedAt;
  const fresh = page !== undefined && answeredAt >= mountedAt;
  useEffect(() => {
    if (!page || !fresh) return;

    /**
     * Folded here rather than inside a `setVisits` updater, with the list
     * mirrored in a ref.
     *
     * An updater must be pure, and StrictMode double-invokes it in development
     * to prove it: doing this work in there ran the merge twice against the
     * same stale list and marked the whole opening page as new. Running it in
     * the effect body is safe under the same double-invocation because
     * `mergeVisits` is idempotent — a second pass over the same answer is a
     * no-op, which `feed.test.ts` pins.
     */
    const merged = mergeVisits(held.current, page.visits);
    // A scoped window's `from` moves at Brussels midnight while the tab stays
    // open, so a row this poll would no longer ask for is trimmed out here —
    // otherwise a visit received the day the window rolled past it would sit
    // in the ledger for ever, since `since` only ever grows.
    const inWindow =
      period !== undefined
        ? merged.filter((visit) => visit.receivedAt >= brusselsPeriod(Date.now(), period).from)
        : merged;
    setArrived(seeded.current ? arrivedIds(held.current, page.visits) : []);
    if (!seeded.current) setCapped(page.visits.length >= ADMIN_VISITS_PAGE_SIZE);
    held.current = inWindow;
    seeded.current = true;
    setTaken(true);
    // Advance from what we actually hold, never from the server clock: a visit
    // written between the query and its answer is then delivered next poll
    // rather than skipped for good.
    since.current = nextSince(inWindow);
    setVisits(inWindow);
    // `answeredAt` too: a refetch whose answer is unchanged keeps `page`'s
    // reference (structural sharing) but may be this mount's first.
  }, [page, fresh, answeredAt]);

  return {
    visits,
    arrived,
    // Still pending while only an older mount's answer is cached, or until
    // the effect has taken this mount's first answer in.
    isPending: !taken && !query.isError,
    isError: query.isError,
    // For `ScreenState`'s retry, disabled while a poll is already out.
    isFetching: query.isFetching,
    refetch: query.refetch,
    capped,
    // GH #160: a poll whose text is unchanged from the last one (e.g. two
    // arrivals in a row) still needs announcing. A consumer keys its
    // `role="status"` element by this so React remounts it every poll rather
    // than leave identical text in place, which some screen readers do not
    // re-announce.
    answeredAt,
  };
}

/**
 * Downloads a CSV export and saves it — the visits export (GH #178, `from`/`to`
 * inclusive) and, by the same helper, Prospects' (#179).
 *
 * Not `apiFetch`: that parses JSON, and this response is a file. The auth
 * failure it recognises is the same one (ADR-0006's opaque redirect), so it is
 * thrown as the same `ApiError` for a caller to handle identically.
 *
 * Resolves to whether the server flagged `x-truncated`, so the caller can warn
 * about the row cap without re-parsing headers itself.
 *
 * `failed` is the caller's own French string for a failed request — Visites'
 * and Prospects' (#179) exports each read differently — so this helper never
 * hardcodes one screen's copy.
 */
export async function downloadCsv(
  path: string,
  filenameFallback: string,
  failed: string,
): Promise<boolean> {
  const response = await fetch(path, { redirect: "manual" });

  if (response.type === "opaqueredirect" || response.status === 401) {
    throw new ApiError(401, "auth", copy.errors.sessionExpired);
  }
  if (!response.ok) {
    throw new ApiError(response.status, "error", failed);
  }

  const truncated = response.headers.get("x-truncated") === "true";
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? filenameFallback;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  // Appended to the document before the click and removed after: a detached
  // anchor's click can be silently cancelled by Safari and Firefox. Revoking
  // the object URL on the same tick as the click can do the same to the
  // download it just started, so that happens a tick later instead.
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return truncated;
}

export function usePatchProspect() {
  const invalidate = useInvalidateProspects();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<Prospect>) =>
      apiFetch<Prospect>(`/api/admin/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

/** Every version, newest first — docs/domains/scripts.md. At most one `isActive`. */
export function useScripts() {
  return useQuery({
    queryKey: adminKeys.scripts(),
    queryFn: () => apiFetch<ScriptsResponse>("/api/admin/scripts"),
  });
}

/**
 * Saving a script is never an edit — it writes version N+1 of that name and
 * activates it (docs/domains/scripts.md). The screen's confirmation dialog is
 * what makes that unmistakable before this fires.
 */
export function useCreateScript() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; questions: Question[] }) =>
      apiFetch<Script>("/api/admin/scripts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.scripts() }),
  });
}

/**
 * The repair queue (ADR-0022).
 *
 * No polling, unlike the live feed: a visit lands here when a sync fails to
 * place it, which is rare and is not something the admin sits watching. It is
 * refetched when the tab regains focus and after every repair or discard.
 */
export function useOrphans() {
  return useQuery({
    queryKey: adminKeys.orphans(),
    queryFn: () => apiFetch<OrphansResponse>("/api/admin/visits/orphaned"),
    refetchOnWindowFocus: true,
  });
}

/** Invalidates the queue and the prospect list — a repair moves a status. */
function useInvalidateAfterRepair() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: adminKeys.orphans() });
    await client.invalidateQueries({ queryKey: ["admin", "prospects"] });
  };
}

export function useRepairOrphan() {
  const invalidate = useInvalidateAfterRepair();
  return useMutation({
    mutationFn: (input: { visitId: string; prospectId: string }) =>
      apiFetch<OrphanRepairResult>(`/api/admin/visits/orphaned/${input.visitId}/repair`, {
        method: "POST",
        body: JSON.stringify({ prospectId: input.prospectId }),
      }),
    onSuccess: invalidate,
  });
}

export function useDiscardOrphan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (visitId: string) =>
      apiFetch<{ discarded: string }>(`/api/admin/visits/orphaned/${visitId}/discard`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    // Only the queue: a discarded visit never counted, so no status moved.
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.orphans() }),
  });
}
