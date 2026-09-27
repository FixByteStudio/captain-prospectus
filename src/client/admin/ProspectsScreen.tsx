import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { EXPORT_ROWS } from "../../shared/constants";
import type { Status } from "../../shared/constants";
import type { Prospect } from "../../shared/schemas";
import { STATUS_LABELS, copy } from "../copy";
import { formatBrusselsDate } from "../format";
import { ApiError } from "../api";
import { useIsMobile } from "../hooks/use-mobile";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenState } from "./ScreenState";
import { Surface } from "./Surface";
import { Pager } from "./Pager";
import { PAGE_SIZE, pageCount } from "./pagination";
import { EmptyState } from "./prospects/EmptyState";
import { ProspectsList } from "./prospects/ProspectsList";
import { ProspectsTable } from "./prospects/ProspectsTable";
import { Toolbar } from "./prospects/Toolbar";
import { ANY } from "./prospects/Filter";
import type { ProspectsResponse } from "../../shared/schemas";
import {
  downloadCsv,
  parseProspectFilters,
  toQueryString,
  useAgents,
  useAssign,
  usePatchProspect,
  useProspects,
} from "./queries";
import type { ProspectFilters } from "./queries";

/** Never mutated: every update builds a new set. */
const NO_SELECTION: Set<string> = new Set();

/** How long after the last keystroke the search box writes the URL (Design Notes). */
const SEARCH_DEBOUNCE_MS = 300;

function failureMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.code === "unknown_assignee") {
    return copy.prospects.unknownAssignee;
  }
  return fallback;
}

export function ProspectsScreen() {
  // The URL holds the filters, so a reload or a shared link (and the
  // dashboard's cards, GH #114) opens the same list.
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseProspectFilters(searchParams), [searchParams]);
  const query = searchParams.toString();
  const isMobile = useIsMobile();

  // Page is component state, not a URL param (Design Notes): the API reads
  // offset, not page, and the URL contract this screen must not disturb
  // (GH #114) never named one. Keyed by the query, same trick as `selection`
  // below: a filter (including a search) change reads back as page 1 without
  // an effect-only extra render.
  const [pageState, setPageState] = useState(() => ({ query, page: 1 }));
  const page = pageState.query === query ? pageState.page : 1;
  function setPage(next: number) {
    setPageState({ query, page: next });
  }

  const prospects = useProspects(filters, page);
  const total = prospects.data?.total ?? 0;
  const totalPages = pageCount(total, PAGE_SIZE);
  // A mutation that empties the current page (last row re-statused out)
  // clamps back to the last page that still exists — adjusted here, during
  // render, rather than through a second effect-only render (same call as
  // VisitsLedger's own `current`).
  // Only against an answer: with no data yet `total` reads 0, which would
  // throw page 2 back to 1 before its own request had answered.
  const current = prospects.data ? Math.min(page, totalPages) : page;
  if (current !== page) setPage(current);

  // The selection belongs to the list it was made on: query and page. A URL
  // change from outside (the sidebar link, Back, a filter) or a page turn
  // empties it, and a bulk assign never reaches rows the new page hides.
  const selectionKey = `${query}#${current}`;
  const [selection, setSelection] = useState(() => ({ key: selectionKey, ids: NO_SELECTION }));
  const selected = selection.key === selectionKey ? selection.ids : NO_SELECTION;
  function setSelected(update: Set<string> | ((current: Set<string>) => Set<string>)) {
    setSelection((state) => {
      const ids = state.key === selectionKey ? state.ids : NO_SELECTION;
      return { key: selectionKey, ids: typeof update === "function" ? update(ids) : update };
    });
  }

  // The search box holds its own text and writes the URL ~300ms after the
  // last keystroke; an outside URL change (Effacer les filtres, Back, the
  // sidebar, a dashboard link) resets it from the URL instead (Design Notes).
  const [searchText, setSearchText] = useState(filters.q ?? "");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The timer reads the filters as they are when it fires, not as they were at
  // the keystroke: a select changed inside the debounce window must survive.
  const latestFilters = useRef(filters);
  useEffect(() => {
    latestFilters.current = filters;
  }, [filters]);
  // What `query` reads right after our own last `writeFilters` call — so the
  // effect below can tell "the URL changed because we wrote it" (the search
  // box keeps its own, possibly untrimmed, text) apart from "the URL changed
  // from outside" (status=undefined here on the very first render, matching
  // the initial `query`, so mount itself is never treated as an outside
  // change).
  const lastWrittenQuery = useRef(query);
  useEffect(() => {
    if (query !== lastWrittenQuery.current) {
      // An outside URL change (Back, the sidebar, a dashboard link, Effacer
      // les filtres) must win over a debounce still in flight, or its write
      // would land after and undo it.
      lastWrittenQuery.current = query;
      clearTimeout(debounceTimer.current);
      setSearchText(filters.q ?? "");
    }
  }, [query, filters.q]);
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // Undefined, not the ANY sentinel: a value Radix cannot find among the items
  // renders a blank trigger instead of the placeholder, and nothing tells the
  // admin what the control wants.
  const [assignee, setAssignee] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const agents = useAgents();
  const assign = useAssign();
  const patch = usePatchProspect();

  const rows = useMemo(() => prospects.data?.prospects ?? [], [prospects.data]);
  const agentList = agents.data?.agents ?? [];
  const filtered = Boolean(
    filters.status ||
    filters.dueBefore !== undefined ||
    filters.assignedTo ||
    filters.source ||
    filters.q,
  );

  /** Replace, not push: a filter tweak is not a page Back should step through. */
  function writeFilters(next: ProspectFilters) {
    const nextQuery = toQueryString(next).replace(/^\?/, "");
    // Recorded before the URL actually updates, so the effect that resets the
    // search box for an *outside* change never mistakes this write for one.
    lastWrittenQuery.current = nextQuery;
    setSearchParams(new URLSearchParams(nextQuery), { replace: true });
  }

  function setFilter(key: "status" | "assignedTo" | "source", value: string) {
    const next = { ...filters };
    if (value === ANY) delete next[key];
    else if (key === "status") next.status = [value as Status];
    else if (key === "source") next.source = value as ProspectFilters["source"];
    else next.assignedTo = value;
    writeFilters(next);
  }

  function dropFilter(key: keyof ProspectFilters) {
    const next = { ...filters };
    delete next[key];
    writeFilters(next);
  }

  /** "Effacer les filtres": also empties the search box and any pending write,
   * since a blank URL with a stale "zzz" still showing would misdescribe it. */
  function clearFilters() {
    clearTimeout(debounceTimer.current);
    setSearchText("");
    writeFilters({});
  }

  function handleSearchChange(value: string) {
    setSearchText(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const trimmed = value.trim();
      const next = { ...latestFilters.current };
      if (trimmed) next.q = trimmed;
      else delete next.q;
      writeFilters(next);
    }, SEARCH_DEBOUNCE_MS);
  }

  // Filters the selects cannot show stay visible, and removable, as chips.
  const chips: { key: keyof ProspectFilters; label: string }[] = [];
  if (filters.status && filters.status.length > 1) {
    chips.push({
      key: "status",
      label: copy.prospects.filters.severalStatuses(filters.status.map((s) => STATUS_LABELS[s])),
    });
  }
  if (filters.dueBefore !== undefined) {
    chips.push({
      key: "dueBefore",
      label: copy.prospects.filters.dueBefore(formatBrusselsDate(filters.dueBefore)),
    });
  }

  function toggle(id: string) {
    setSelected((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((p) => p.id)));
  }

  function runAssign(assignedTo: string | null, ids: string[]) {
    assign.mutate(
      { ids, assignedTo },
      {
        onSuccess: (result) => {
          toast.success(
            assignedTo
              ? copy.prospects.assigned(result.assigned)
              : copy.prospects.unassigned(result.assigned),
          );
          setSelected(new Set());
        },
        onError: (error) => toast.error(failureMessage(error, copy.prospects.assignFailed)),
      },
    );
  }

  function changeStatus(prospect: Prospect, status: Status) {
    patch.mutate(
      { id: prospect.id, status },
      {
        onSuccess: () => toast.success(copy.prospects.statusChanged),
        onError: (error) => toast.error(failureMessage(error, copy.prospects.updateFailed)),
      },
    );
  }

  async function handleExport() {
    setExporting(true);
    try {
      const truncated = await downloadCsv(
        `/api/admin/prospects/export.csv${toQueryString(filters)}`,
        "prospects.csv",
        copy.prospects.export.failed,
      );
      if (truncated) toast.warning(copy.prospects.export.truncated(EXPORT_ROWS));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : copy.prospects.export.failed);
    } finally {
      setExporting(false);
    }
  }

  const from = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, total);

  const toolbar = (
    <Toolbar
      filters={filters}
      chips={chips}
      selectedCount={selected.size}
      total={total}
      searchValue={searchText}
      onSearchChange={handleSearchChange}
      onFilterChange={setFilter}
      onDropFilter={dropFilter}
      agentList={agentList.map((a) => a.email)}
      assignee={assignee}
      onAssigneeChange={setAssignee}
      onAssign={() => assignee && runAssign(assignee, [...selected])}
      onUnassign={() => runAssign(null, [...selected])}
      onCancelSelection={() => setSelected(new Set())}
      assignPending={assign.isPending}
    />
  );

  return (
    <section>
      <ScreenHeader
        className="mb-4"
        title={copy.prospects.title}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? copy.prospects.export.exporting : copy.prospects.export.button}
            </Button>
            <Button asChild>
              <Link to="/admin/import">{copy.prospects.importCta}</Link>
            </Button>
          </div>
        }
      />

      <ScreenState<ProspectsResponse>
        data={prospects.data}
        isPending={prospects.isPending}
        isError={prospects.isError}
        isFetching={prospects.isFetching}
        onRetry={() => void prospects.refetch()}
        loadFailed={copy.prospects.loadFailed}
        loading={copy.prospects.loading}
        skeleton={
          <Surface className="overflow-hidden">
            {toolbar}
            <div className="space-y-3 p-3.5">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          </Surface>
        }
      >
        {() => (
          <>
            {/*
              The toolbar and the rows live in one Surface (docs/design.md):
              the toolbar gets its own border-b instead of the two-box chrome
              a hand-spelled split panel used to need.
            */}
            <Surface className="overflow-hidden">
              {toolbar}
              {isMobile ? (
                <ProspectsList
                  rows={rows}
                  selected={selected}
                  onToggle={toggle}
                  agentList={agentList.map((a) => a.email)}
                  onAssign={(email, ids) => runAssign(email, ids)}
                  onStatus={changeStatus}
                />
              ) : (
                <ProspectsTable
                  rows={rows}
                  selected={selected}
                  allSelected={allSelected}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  agentList={agentList.map((a) => a.email)}
                  onAssign={(email, ids) => runAssign(email, ids)}
                  onStatus={changeStatus}
                />
              )}

              {total === 0 && (
                <EmptyState filtered={filtered} q={filters.q} onClear={clearFilters} />
              )}
            </Surface>

            {totalPages > 1 && rows.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground tnum">
                  {copy.prospects.range(from, to, total)}
                </span>
                <Pager
                  page={current}
                  total={totalPages}
                  onChange={setPage}
                  labels={copy.prospects.pager}
                  className="mx-0 w-auto justify-end"
                />
              </div>
            )}
          </>
        )}
      </ScreenState>
    </section>
  );
}
