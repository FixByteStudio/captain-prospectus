import { useState } from "react";
import type { ImportRow } from "../../../shared/schemas";
import { TYPE_LABELS, copy } from "../../copy";
import { formatCoordinate, formatCount } from "../../format";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { cn } from "../../lib/utils";
import { Surface } from "../Surface";
import { STATUS_EDGE } from "../status";
import { ImportBottomBar } from "./ImportBottomBar";
import { ImportProgressCard } from "./ImportProgressCard";
import type { MappedRow } from "./csv";

/** Enough to judge the file by; the full list is the import itself. */
const SHOWN = 50;

/** The filter's two items look alike: a pill on the `secondary` track. */
const FILTER_ITEM =
  "text-muted-foreground hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground rounded-md px-3 first:rounded-md last:rounded-md hover:bg-transparent data-[state=on]:shadow-sm";

/**
 * Step three: see what will happen, then decide.
 *
 * Rejected lines come first with their reason, so the problems are the first
 * thing read rather than something to scroll for. A line without coordinates is
 * kept and flagged, not rejected — it belongs on the round, just without
 * distance ordering (ingestion.md).
 */
export function PreviewStep({
  ready,
  rejected,
  progress,
  isRunning,
  error,
  delimiter,
  onBack,
  onStart,
}: {
  ready: ImportRow[];
  rejected: MappedRow[];
  progress: { done: number; total: number };
  isRunning: boolean;
  error: string | null;
  delimiter: string;
  onBack: () => void;
  onStart: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "errors">("all");
  const total = ready.length + rejected.length;
  const share = (n: number) => Math.round((n / total) * 100);
  const showReady = filter === "all";
  const shown = showReady ? ready.slice(0, SHOWN) : [];

  return (
    <div>
      <div className="bg-secondary mb-4 flex flex-wrap items-center gap-3 rounded-lg px-5 py-3.5">
        <strong className="font-semibold">
          {copy.import.preview.summary(ready.length, total)}
        </strong>
        <Badge variant="outline" className="bg-card">
          {copy.import.preview.separator(delimiter)}
        </Badge>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Surface className="flex items-center justify-between gap-3 px-5 py-4">
          <span>
            <strong className="text-display tnum block font-semibold">
              {formatCount(ready.length)}
            </strong>
            <span className="text-muted-foreground">{copy.import.preview.ready(ready.length)}</span>
          </span>
          <Badge variant="tint-success" className="tnum">
            {copy.import.preview.share(share(ready.length))}
          </Badge>
        </Surface>
        <Surface className="flex items-center justify-between gap-3 px-5 py-4">
          <span>
            <strong
              className={cn(
                "text-display tnum block font-semibold",
                rejected.length > 0 && "text-destructive",
              )}
            >
              {formatCount(rejected.length)}
            </strong>
            <span className="text-muted-foreground">
              {copy.import.preview.rejected(rejected.length)}
            </span>
          </span>
          <Badge variant={rejected.length > 0 ? "tint-destructive" : "secondary"} className="tnum">
            {copy.import.preview.share(share(rejected.length))}
          </Badge>
        </Surface>
      </div>

      <ToggleGroup
        type="single"
        size="sm"
        value={filter}
        onValueChange={(next) => {
          // Pressing the pressed item sends ""; a filter is never unset.
          if (next === "all" || next === "errors") setFilter(next);
        }}
        aria-label={copy.import.preview.filterLabel}
        className="bg-secondary mb-3 w-fit rounded-lg p-0.5"
      >
        <ToggleGroupItem value="all" className={FILTER_ITEM}>
          {copy.import.preview.all}
        </ToggleGroupItem>
        <ToggleGroupItem value="errors" disabled={rejected.length === 0} className={FILTER_ITEM}>
          {copy.import.preview.errors(rejected.length)}
        </ToggleGroupItem>
      </ToggleGroup>

      <Surface className="overflow-hidden">
        <Table className="[&_td]:h-row [&_td]:py-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-full min-w-48 pl-3.5">
                {copy.import.columns.fields.name}
              </TableHead>
              <TableHead>{copy.import.columns.fields.type}</TableHead>
              <TableHead>{copy.import.columns.fields.address}</TableHead>
              <TableHead className="text-right">{copy.import.preview.coordinates}</TableHead>
              <TableHead>{copy.import.preview.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rejected.map((row) =>
              row.ok ? null : (
                <TableRow key={`rejected-${row.line}`}>
                  <TableCell className={cn("text-muted-foreground pl-3.5", STATUS_EDGE.rejected)}>
                    <span className="line-through decoration-border">
                      {row.name ?? copy.import.preview.line(row.line)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="text-muted-foreground">{row.address ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-right">—</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="tint-destructive">{row.reason}</Badge>
                  </TableCell>
                </TableRow>
              ),
            )}

            {shown.map((row, index) => (
              <TableRow key={`ready-${index}`}>
                <TableCell className={cn("pl-3.5 font-medium", STATUS_EDGE.new)}>
                  {row.name}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {TYPE_LABELS[row.type]}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.address ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground tnum text-right whitespace-nowrap">
                  {typeof row.lat === "number" && typeof row.lng === "number"
                    ? copy.fieldProspect.positionSet(
                        formatCoordinate(row.lat),
                        formatCoordinate(row.lng),
                      )
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {typeof row.lat === "number" && typeof row.lng === "number" ? (
                    <Badge variant="tint-success">{copy.import.preview.readyChip}</Badge>
                  ) : (
                    <Badge className="bg-tint-warn text-warn" variant="secondary">
                      {copy.import.preview.noCoordinates}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Surface>

      {showReady && ready.length > SHOWN && (
        <p className="text-muted-foreground mt-2 text-xs">
          {copy.import.preview.showingFirst(SHOWN)}
        </p>
      )}

      {isRunning && <ImportProgressCard progress={progress} />}

      {error && !isRunning && (
        <Alert variant="destructive" className="mt-5 max-w-2xl">
          <AlertDescription>{copy.import.failedAfter(progress.done)}</AlertDescription>
        </Alert>
      )}

      {ready.length === 0 && (
        <p className="text-muted-foreground mt-3">{copy.import.preview.nothingToImport}</p>
      )}

      <ImportBottomBar
        step={3}
        total={3}
        onBack={onBack}
        backDisabled={isRunning}
        action={
          <Button onClick={onStart} disabled={isRunning || ready.length === 0}>
            {error ? copy.import.actions.retry : copy.import.actions.start(ready.length)}
          </Button>
        }
      />
    </div>
  );
}
