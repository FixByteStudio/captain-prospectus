import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { MoreHorizontalIcon, XIcon } from "lucide-react";
import { STATUSES } from "../../shared/constants";
import type { Source, Status } from "../../shared/constants";
import type { Prospect } from "../../shared/schemas";
import { SOURCE_LABELS, STATUS_LABELS, TYPE_LABELS, copy } from "../copy";
import { formatBrusselsDate, formatDate } from "../format";
import { ApiError } from "../api";
import { cn } from "../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { STATUS_EDGE, STATUS_TEXT } from "./status";
import {
  parseProspectFilters,
  toQueryString,
  useAgents,
  useAssign,
  usePatchProspect,
  useProspects,
} from "./queries";
import type { ProspectFilters } from "./queries";

/** Radix cannot hold an empty string as a value, so "any" stands for no filter. */
const ANY = "any";

const SOURCES: readonly Source[] = ["csv", "osm", "field"];

/** Never mutated: every update builds a new set. */
const NO_SELECTION: Set<string> = new Set();

/** An empty cell is a dash, never a blank — a blank reads as a rendering bug. */
function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

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
  // The selection belongs to the list it was made on. Tied to the query, so a
  // URL change from outside writeFilters (the sidebar link, Back) empties it
  // too, and a bulk assign never reaches rows the new filter hides.
  const query = searchParams.toString();
  const [selection, setSelection] = useState(() => ({ query, ids: NO_SELECTION }));
  const selected = selection.query === query ? selection.ids : NO_SELECTION;
  function setSelected(update: Set<string> | ((current: Set<string>) => Set<string>)) {
    setSelection((current) => {
      const ids = current.query === query ? current.ids : NO_SELECTION;
      return { query, ids: typeof update === "function" ? update(ids) : update };
    });
  }
  // Undefined, not the ANY sentinel: a value Radix cannot find among the items
  // renders a blank trigger instead of the placeholder, and nothing tells the
  // admin what the control wants.
  const [assignee, setAssignee] = useState<string | undefined>(undefined);

  const prospects = useProspects(filters);
  const agents = useAgents();
  const assign = useAssign();
  const patch = usePatchProspect();

  const rows = useMemo(() => prospects.data?.prospects ?? [], [prospects.data]);
  const agentList = agents.data?.agents ?? [];
  const filtered = Boolean(
    filters.status || filters.dueBefore !== undefined || filters.assignedTo || filters.source,
  );

  /** Replace, not push: a filter tweak is not a page Back should step through. */
  function writeFilters(next: ProspectFilters) {
    setSearchParams(new URLSearchParams(toQueryString(next)), { replace: true });
  }

  function setFilter(key: "status" | "assignedTo" | "source", value: string) {
    const next = { ...filters };
    if (value === ANY) delete next[key];
    else if (key === "status") next.status = [value as Status];
    else if (key === "source") next.source = value as Source;
    else next.assignedTo = value;
    writeFilters(next);
  }

  function dropFilter(key: keyof ProspectFilters) {
    const next = { ...filters };
    delete next[key];
    writeFilters(next);
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
    setSelected((current) => {
      const next = new Set(current);
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

  if (prospects.isError) {
    return <p className="text-destructive">{copy.prospects.loadFailed}</p>;
  }

  return (
    <section>
      <div className="mb-4 flex items-baseline gap-4">
        <h2 className="text-xl font-semibold tracking-[-0.005em]">{copy.prospects.title}</h2>
        <Button asChild className="ml-auto">
          <Link to="/admin/import">{copy.prospects.importCta}</Link>
        </Button>
      </div>

      {/*
        One slot. It holds the filters, and the moment anything is selected it
        is replaced in place by the actions — same position, same height, no
        floating bar and no layout shift (docs/design.md).
      */}
      <div
        className={cn(
          "border-border bg-card flex min-h-11 flex-wrap items-center gap-2 rounded-t-md border border-b-0 px-3",
          // A gold wash, not gold text: the fill is what the brand colour is
          // allowed to do, and navy ink still reads at ~12:1 over it.
          selected.size > 0 && "border-primary-edge/45 bg-primary/12",
        )}
      >
        {selected.size === 0 ? (
          <>
            <Filter
              label={copy.prospects.filters.status}
              // Several statuses: "" shows the placeholder, and their chip says
              // which. Not ANY, or choosing "Tous les statuts" would not fire.
              value={
                filters.status === undefined
                  ? ANY
                  : filters.status.length === 1
                    ? (filters.status[0] ?? ANY)
                    : ""
              }
              placeholder={copy.prospects.filters.someStatuses}
              onChange={(v) => setFilter("status", v)}
              anyLabel={copy.prospects.filters.anyStatus}
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
            <Filter
              label={copy.prospects.filters.agent}
              value={filters.assignedTo ?? ANY}
              onChange={(v) => setFilter("assignedTo", v)}
              anyLabel={copy.prospects.filters.anyAgent}
              options={agentList.map((a) => ({ value: a.email, label: a.email }))}
            />
            <Filter
              label={copy.prospects.filters.source}
              value={filters.source ?? ANY}
              onChange={(v) => setFilter("source", v)}
              anyLabel={copy.prospects.filters.anySource}
              options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
            />
            {chips.map((chip) => (
              <Badge
                key={chip.key}
                variant="secondary"
                className="max-w-full gap-0.5 py-0 pr-0.5 whitespace-normal"
              >
                {chip.label}
                <Button
                  variant="ghost"
                  size="icon"
                  // Inset: the badge clips overflow, and with it an outer ring.
                  className="size-6 focus-visible:ring-inset"
                  aria-label={copy.prospects.filters.remove(chip.label)}
                  onClick={() => dropFilter(chip.key)}
                >
                  <XIcon />
                </Button>
              </Badge>
            ))}
            <span className="text-muted-foreground tnum ml-auto">
              {copy.prospects.count(prospects.data?.total ?? 0)}
            </span>
          </>
        ) : (
          <>
            <span className="tnum font-semibold">
              {copy.prospects.selection.count(selected.size)}
            </span>
            <label className="text-muted-foreground" htmlFor="assign-to">
              {copy.prospects.selection.assignTo}
            </label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger id="assign-to" size="sm" className="w-56">
                <SelectValue placeholder={copy.prospects.selection.chooseAgent} />
              </SelectTrigger>
              <SelectContent>
                {agentList.map((a) => (
                  <SelectItem key={a.email} value={a.email}>
                    {a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!assignee || assign.isPending}
              onClick={() => assignee && runAssign(assignee, [...selected])}
            >
              {copy.prospects.selection.assign}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={assign.isPending}
              onClick={() => runAssign(null, [...selected])}
            >
              {copy.prospects.selection.unassign}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {copy.prospects.selection.cancel}
            </Button>
          </>
        )}
      </div>

      <div className="border-border bg-card overflow-hidden rounded-b-md border">
        {/* shadcn pads cells for a roomy table; a ledger is dense by design, so
            the row height comes from --spacing-row and the cells give it back. */}
        <Table className="[&_td]:h-row [&_td]:py-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-3.5">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  disabled={rows.length === 0}
                  aria-label={copy.prospects.selection.selectAll}
                />
              </TableHead>
              <TableHead className="w-full min-w-48">{copy.prospects.columns.name}</TableHead>
              <TableHead>{copy.prospects.columns.type}</TableHead>
              <TableHead>{copy.prospects.columns.address}</TableHead>
              <TableHead>{copy.prospects.columns.status}</TableHead>
              <TableHead>{copy.prospects.columns.agent}</TableHead>
              <TableHead className="text-right">{copy.prospects.columns.lastVisit}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((prospect) => (
              <TableRow
                key={prospect.id}
                data-state={selected.has(prospect.id) ? "selected" : undefined}
                // Selection is gold throughout — the toolbar and the rows it
                // refers to. shadcn's default paints selected rows muted grey,
                // which reads as unrelated to the gold bar above them.
                className="data-[state=selected]:bg-primary/10"
              >
                <TableCell className={cn("pl-3.5", STATUS_EDGE[prospect.status])}>
                  <Checkbox
                    checked={selected.has(prospect.id)}
                    onCheckedChange={() => toggle(prospect.id)}
                    aria-label={copy.prospects.selection.selectOne(prospect.name)}
                  />
                </TableCell>
                <TableCell className="font-medium">{prospect.name}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {TYPE_LABELS[prospect.type]}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {prospect.address ?? <Empty />}
                </TableCell>
                <TableCell className={cn("whitespace-nowrap", STATUS_TEXT[prospect.status])}>
                  {STATUS_LABELS[prospect.status]}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {prospect.assignedTo ?? <Empty />}
                </TableCell>
                <TableCell className="text-muted-foreground tnum text-right whitespace-nowrap">
                  {prospect.lastVisitAt ? formatDate(prospect.lastVisitAt) : <Empty />}
                </TableCell>
                <TableCell>
                  <RowMenu
                    prospect={prospect}
                    agents={agentList.map((a) => a.email)}
                    onAssign={(email) => runAssign(email, [prospect.id])}
                    onStatus={(status) => changeStatus(prospect, status)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length === 0 && !prospects.isPending && (
          <div className="text-muted-foreground flex flex-col items-start gap-3 px-3.5 py-10">
            {filtered ? (
              <>
                <p>{copy.prospects.noMatch}</p>
                <Button variant="outline" size="sm" onClick={() => writeFilters({})}>
                  {copy.prospects.clearFilters}
                </Button>
              </>
            ) : (
              <>
                <p>{copy.prospects.empty}</p>
                <Button asChild size="sm">
                  <Link to="/admin/import">{copy.prospects.importCta}</Link>
                </Button>
              </>
            )}
          </div>
        )}

        {prospects.isPending && (
          <p className="text-muted-foreground px-3.5 py-10" aria-busy="true">
            {copy.prospects.loading}
          </p>
        )}
      </div>
    </section>
  );
}

function Filter({
  label,
  value,
  onChange,
  anyLabel,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  anyLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <>
      <label className="text-muted-foreground" htmlFor={`filter-${label}`}>
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`filter-${label}`} size="sm" className="w-44">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function RowMenu({
  prospect,
  agents,
  onAssign,
  onStatus,
}: {
  prospect: Prospect;
  agents: string[];
  onAssign: (email: string | null) => void;
  onStatus: (status: Status) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={copy.prospects.row.menu(prospect.name)}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{copy.prospects.row.assignTo}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {agents.map((email) => (
              <DropdownMenuItem key={email} onSelect={() => onAssign(email)}>
                {email}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {prospect.assignedTo && (
          <DropdownMenuItem onSelect={() => onAssign(null)}>
            {copy.prospects.row.unassign}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{copy.prospects.row.changeStatus}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STATUSES.map((status) => (
              <DropdownMenuItem
                key={status}
                disabled={status === prospect.status}
                onSelect={() => onStatus(status)}
              >
                {STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
