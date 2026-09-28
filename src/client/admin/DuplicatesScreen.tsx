import { toast } from "sonner";
import { CopyCheckIcon } from "lucide-react";
import { Link } from "react-router";
import type { DuplicatePair, DuplicatesResponse, Prospect } from "../../shared/schemas";
import { STATUS_LABELS, copy } from "../copy";
import { formatDistance } from "../format";
import { cn } from "../lib/utils";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { EmptyTile } from "./EmptyTile";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenState } from "./ScreenState";
import { Surface } from "./Surface";
import { BADGE_SHAPE, STATUS_BADGE, STATUS_EDGE } from "./status";
import { useDuplicates, useMerge } from "./queries";

/**
 * Candidate duplicates, for a person to judge — docs/domains/prospecting.md.
 *
 * The machine cannot tell a rename from a takeover, so it only ever proposes.
 * Each side shows what it carries — status, assignee, how many visits — so the
 * admin is choosing between two known things rather than guessing which one it
 * would be safe to lose. A pair reads as one list item (docs/design.md ›
 * Doublons): two stacked rows, the distance shown once.
 */
export function DuplicatesScreen() {
  const duplicates = useDuplicates();
  const merge = useMerge();

  function keep(survivor: Prospect, merged: Prospect) {
    merge.mutate(
      { survivorId: survivor.id, mergedId: merged.id },
      {
        // The response's dedupeKeyUpdated flag conflates "the key was already
        // right" with "the new key was taken", so it is not something to
        // report. A key that is still contested reappears in the next sweep.
        onSuccess: () => toast.success(copy.duplicates.merged(survivor.name)),
        onError: () => toast.error(copy.duplicates.mergeFailed),
      },
    );
  }

  // `null` while nothing has arrived: a count of 0 under the skeleton would
  // announce a healthy queue before the sweep has answered.
  const toolbar = (count: number | null) => (
    <div className="border-border flex min-h-11 flex-wrap items-center gap-2 border-b px-3">
      {count !== null && (
        <span className="text-muted-foreground tnum">{copy.duplicates.count(count)}</span>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="ml-auto"
        disabled={duplicates.isFetching}
        onClick={() => void duplicates.refetch()}
      >
        {duplicates.isFetching ? copy.duplicates.relaunching : copy.duplicates.relaunch}
      </Button>
    </div>
  );

  return (
    <section>
      <ScreenHeader
        className="mb-4"
        title={copy.duplicates.title}
        subtitle={<p className="text-muted-foreground mt-0.5">{copy.duplicates.lede}</p>}
      />

      <ScreenState<DuplicatesResponse>
        data={duplicates.data}
        isPending={duplicates.isPending}
        isError={duplicates.isError}
        isFetching={duplicates.isFetching}
        onRetry={() => void duplicates.refetch()}
        loadFailed={copy.duplicates.loadFailed}
        loading={copy.duplicates.loading}
        skeleton={
          <Surface className="overflow-hidden">
            {toolbar(null)}
            <div className="space-y-3 p-3.5">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          </Surface>
        }
      >
        {(data) => (
          <>
            <Surface className="overflow-hidden">
              {toolbar(data.pairs.length)}

              {data.pairs.length === 0 ? (
                <EmptyTile icon={<CopyCheckIcon aria-hidden="true" />}>
                  <p className="text-foreground font-medium">{copy.duplicates.empty}</p>
                  <p>{copy.duplicates.emptyHint}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/prospects">{copy.duplicates.emptyCta}</Link>
                  </Button>
                </EmptyTile>
              ) : (
                <ul className="divide-border divide-y">
                  {data.pairs.map((pair) => (
                    <Pair
                      key={`${pair.a.id}|${pair.b.id}`}
                      pair={pair}
                      // A stale pair from a sweep still in flight must not be
                      // mergeable, or a fresh answer could contradict a click
                      // that already landed.
                      disabled={merge.isPending || duplicates.isFetching}
                      onKeep={keep}
                    />
                  ))}
                </ul>
              )}
            </Surface>

            {data.truncated && (
              <Alert className="mt-4 max-w-2xl">
                <AlertDescription>{copy.duplicates.truncated}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </ScreenState>
    </section>
  );
}

function Pair({
  pair,
  disabled,
  onKeep,
}: {
  pair: DuplicatePair;
  disabled: boolean;
  onKeep: (survivor: Prospect, merged: Prospect) => void;
}) {
  const distance =
    pair.distanceM === null ? copy.duplicates.distanceUnknown : formatDistance(pair.distanceM);

  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto]"
      aria-label={copy.duplicates.pairAria(pair.a.name, pair.b.name)}
    >
      <div>
        <Side
          prospect={pair.a}
          visits={pair.aVisits}
          disabled={disabled}
          onKeep={() => onKeep(pair.a, pair.b)}
        />
        <Side
          prospect={pair.b}
          visits={pair.bVisits}
          disabled={disabled}
          onKeep={() => onKeep(pair.b, pair.a)}
        />
      </div>
      <div className="tnum text-muted-foreground border-border flex items-center justify-end border-l px-3.5 text-sm whitespace-nowrap">
        {distance}
      </div>
    </li>
  );
}

function Side({
  prospect,
  visits,
  disabled,
  onKeep,
}: {
  prospect: Prospect;
  visits: number;
  disabled: boolean;
  onKeep: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-3.5 py-2.5",
        STATUS_EDGE[prospect.status],
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{prospect.name}</p>
        {prospect.address && (
          <p className="text-muted-foreground text-xs break-words">{prospect.address}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="ghost" className={cn(BADGE_SHAPE, STATUS_BADGE[prospect.status])}>
          {STATUS_LABELS[prospect.status]}
        </Badge>
        <span className="text-muted-foreground text-xs break-words">
          {prospect.assignedTo ?? "—"}
        </span>
        <span
          className={cn(
            "text-xs",
            visits > 0 ? "text-foreground font-semibold" : "text-muted-foreground",
          )}
        >
          {copy.duplicates.visits(visits)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-label={copy.duplicates.keepAria(prospect.name)}
          onClick={onKeep}
        >
          {copy.duplicates.keep}
        </Button>
      </div>
    </div>
  );
}
