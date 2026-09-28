import { SearchIcon, XIcon } from "lucide-react";
import { STATUSES } from "../../../shared/constants";
import type { Source } from "../../../shared/constants";
import { SOURCE_LABELS, STATUS_LABELS, copy } from "../../copy";
import { cn } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import type { ProspectFilters } from "../queries";
import { ANY, Filter } from "./Filter";

const SOURCES: readonly Source[] = ["csv", "osm", "field"];

/** `searchQuerySchema`'s own cap (`shortText`'s `maxLength(200)`, src/shared/schemas.ts) — kept
 * here too so a search past it is refused at the keyboard rather than silently
 * dropped once `parseProspectFilters` rejects it. */
const SEARCH_MAX_LENGTH = 200;

/**
 * The one toolbar slot (docs/design.md): the filters and the search box, or —
 * the moment a row is ticked — the selection's actions, same position, same
 * height. Search sits first in the slot (docs/design.md rewrite for #179).
 */
export function Toolbar({
  filters,
  chips,
  selectedCount,
  total,
  searchValue,
  onSearchChange,
  onFilterChange,
  onDropFilter,
  agentList,
  assignee,
  onAssigneeChange,
  onAssign,
  onUnassign,
  onCancelSelection,
  assignPending,
}: {
  filters: ProspectFilters;
  chips: { key: keyof ProspectFilters; label: string }[];
  selectedCount: number;
  total: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: "status" | "assignedTo" | "source", value: string) => void;
  onDropFilter: (key: keyof ProspectFilters) => void;
  agentList: string[];
  assignee: string | undefined;
  onAssigneeChange: (value: string) => void;
  onAssign: () => void;
  onUnassign: () => void;
  onCancelSelection: () => void;
  assignPending: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border flex min-h-11 flex-wrap items-center gap-2 border-b px-3",
        // A gold wash, not gold text: the fill is what the brand colour is
        // allowed to do, and navy ink still reads at ~12:1 over it.
        selectedCount > 0 && "border-primary-edge/45 bg-primary/12",
      )}
    >
      {selectedCount === 0 ? (
        <>
          <label className="sr-only" htmlFor="prospects-search">
            {copy.prospects.search.label}
          </label>
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            />
            <Input
              id="prospects-search"
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={copy.prospects.search.placeholder}
              maxLength={SEARCH_MAX_LENGTH}
              className="h-8 w-48 pl-8"
            />
          </div>
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
            onChange={(v) => onFilterChange("status", v)}
            anyLabel={copy.prospects.filters.anyStatus}
            options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
          <Filter
            label={copy.prospects.filters.agent}
            value={filters.assignedTo ?? ANY}
            onChange={(v) => onFilterChange("assignedTo", v)}
            anyLabel={copy.prospects.filters.anyAgent}
            options={agentList.map((email) => ({ value: email, label: email }))}
          />
          <Filter
            label={copy.prospects.filters.source}
            value={filters.source ?? ANY}
            onChange={(v) => onFilterChange("source", v)}
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
                onClick={() => onDropFilter(chip.key)}
              >
                <XIcon />
              </Button>
            </Badge>
          ))}
          <span className="text-muted-foreground tnum ml-auto">{copy.prospects.count(total)}</span>
        </>
      ) : (
        <>
          <span className="tnum font-semibold">
            {copy.prospects.selection.count(selectedCount)}
          </span>
          <label className="text-muted-foreground" htmlFor="assign-to">
            {copy.prospects.selection.assignTo}
          </label>
          <Select value={assignee} onValueChange={onAssigneeChange}>
            <SelectTrigger id="assign-to" size="sm" className="w-56">
              <SelectValue placeholder={copy.prospects.selection.chooseAgent} />
            </SelectTrigger>
            <SelectContent>
              {agentList.map((email) => (
                <SelectItem key={email} value={email}>
                  {email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!assignee || assignPending} onClick={onAssign}>
            {copy.prospects.selection.assign}
          </Button>
          <Button size="sm" variant="outline" disabled={assignPending} onClick={onUnassign}>
            {copy.prospects.selection.unassign}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelSelection}>
            {copy.prospects.selection.cancel}
          </Button>
        </>
      )}
    </div>
  );
}
