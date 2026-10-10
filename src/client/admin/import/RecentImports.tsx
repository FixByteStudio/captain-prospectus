import { useId } from "react";
import { FileSpreadsheet, History, Map as MapIcon } from "lucide-react";
import { copy } from "../../copy";
import { formatDateTime } from "../../format";
import { cn } from "../../lib/utils";
import type { ImportLogEntry, ImportsResponse } from "../../../shared/schemas";
import { Badge } from "../../ui/badge";
import { Skeleton } from "../../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { useImports } from "../queries";
import { ScreenState } from "../ScreenState";
import { BADGE_SHAPE } from "../status";
import { Surface } from "../Surface";

/**
 * Status reads as a 4px leading edge and as a word (docs/design.md › Tables).
 * The edge sits on the first cell in the table and on the row once the table
 * has become two-line rows. The class strings are spelled out whole so
 * Tailwind sees them.
 */
const STATUS_LOOK: Readonly<
  Record<ImportLogEntry["status"], { row: string; cell: string; badge: string }>
> = {
  done: {
    row: "shadow-[inset_4px_0_0_0_var(--color-success)] md:shadow-none",
    cell: "md:shadow-[inset_4px_0_0_0_var(--color-success)]",
    badge: "bg-tint-success text-success",
  },
  interrupted: {
    row: "shadow-[inset_4px_0_0_0_var(--color-warn)] md:shadow-none",
    cell: "md:shadow-[inset_4px_0_0_0_var(--color-warn)]",
    badge: "bg-tint-warn text-warn",
  },
};

/** The empty cell of DESIGN.md › Tables: a redacted file or admin (ADR-0023). */
function Dash() {
  return (
    <span className="text-muted-foreground" aria-hidden="true">
      —
    </span>
  );
}

function sourceLabel(source: string): string {
  const labels = copy.import.recent.sources;
  return Object.hasOwn(labels, source) ? (labels[source] ?? source) : source;
}

/** The file's name, else the zone's size; null once the file was redacted or for a field source. */
function targetLabel(entry: ImportLogEntry): string | null {
  if (entry.fileName !== null) return entry.fileName;
  if (entry.zoneVertices !== null) return copy.map.vertices(entry.zoneVertices);
  if (entry.zoneRadiusM !== null) return copy.map.circle.radius(entry.zoneRadiusM);
  return null;
}

/**
 * Derniers imports on Source (GH #390): the server's import log, read-only
 * (ADR-0030, docs/design.md › Import). No row action, no paging, no polling —
 * the end of a run invalidates it (`useImportBatches`).
 *
 * The head stays outside `ScreenState`, so loading, empty and failed all sit
 * under the title. Below `md` each import is two lines: date · source · file,
 * then volume · statut, without Par.
 */
export function RecentImports() {
  const imports = useImports();
  const titleId = useId();

  return (
    <Surface className="mt-6 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <History aria-hidden="true" className="size-5" />
        <h2 id={titleId} className="text-heading">
          {copy.import.recent.title}
        </h2>
      </div>

      {/* The Alert is ScreenState's own: give it the panel's gutter. */}
      <div className="[&>[data-slot=alert]]:mx-5">
        <ScreenState<ImportsResponse>
          data={imports.data}
          isPending={imports.isPending}
          isError={imports.isError}
          isFetching={imports.isFetching}
          onRetry={() => void imports.refetch()}
          loadFailed={copy.import.recent.loadFailed}
          loading={copy.import.recent.loading}
          skeleton={
            <div className="space-y-3 px-5 pb-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          }
        >
          {(data) =>
            data.imports.length === 0 ? (
              <p className="text-muted-foreground px-5 pb-4">{copy.import.recent.empty}</p>
            ) : (
              <Table aria-labelledby={titleId}>
                <TableHeader className="bg-secondary hidden md:table-header-group">
                  <TableRow>
                    <TableHead className="pl-5">{copy.import.recent.head.date}</TableHead>
                    <TableHead>{copy.import.recent.head.source}</TableHead>
                    <TableHead>{copy.import.recent.head.target}</TableHead>
                    <TableHead className="text-right">{copy.import.recent.head.volume}</TableHead>
                    <TableHead>{copy.import.recent.head.by}</TableHead>
                    <TableHead className="pr-5">{copy.import.recent.head.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.imports.map((entry) => (
                    <ImportRow key={entry.id} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            )
          }
        </ScreenState>
      </div>
    </Surface>
  );
}

function ImportRow({ entry }: { entry: ImportLogEntry }) {
  const look = STATUS_LOOK[entry.status];
  const target = targetLabel(entry);
  const Icon = entry.source === "csv" ? FileSpreadsheet : MapIcon;

  return (
    <TableRow
      className={cn(
        // Below md: a flex-wrap row whose ::before is the line break between
        // « date · source · file » (order 1-3) and « volume · statut » (5-6).
        "flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 before:order-4 before:basis-full",
        "md:table-row md:p-0 md:before:hidden",
        look.row,
      )}
    >
      <TableCell className={cn("tnum order-1 max-md:p-0 md:order-none md:pl-5", look.cell)}>
        {formatDateTime(entry.startedAt)}
      </TableCell>
      <TableCell className="order-2 max-md:p-0 md:order-none">
        <span className="inline-flex items-center gap-2">
          <Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          {sourceLabel(entry.source)}
        </span>
      </TableCell>
      <TableCell className="tnum order-3 min-w-0 flex-1 max-md:p-0 md:order-none">
        {/* The ellipsis lives on the span: a cell ignores max-width in auto table layout. */}
        <span className="block truncate md:max-w-56" title={target ?? undefined}>
          {target ?? <Dash />}
        </span>
      </TableCell>
      <TableCell className="tnum order-5 max-md:p-0 md:order-none md:text-right">
        {copy.import.recent.volume(entry.created, entry.updated, entry.rejected)}
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">
        {entry.createdBy ?? <Dash />}
      </TableCell>
      <TableCell className="order-6 max-md:p-0 md:order-none md:pr-5">
        <Badge variant="ghost" className={cn(BADGE_SHAPE, look.badge)}>
          {copy.import.recent.status[entry.status]}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
