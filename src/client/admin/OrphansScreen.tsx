import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router";
import { Check, CheckCheck, Trash2 } from "lucide-react";
import type { OrphanedVisit, OrphansResponse } from "../../shared/schemas";
import { OUTCOME_TO_STATUS } from "../../shared/constants";
import { OUTCOME_LABELS, copy } from "../copy";
import { formatDateTime, formatDistance } from "../format";
import { cn } from "../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { EmptyTile } from "./EmptyTile";
import { orphanTotal } from "./nav";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenState } from "./ScreenState";
import { Surface } from "./Surface";
import { OUTCOME_BADGE } from "./outcome-badge";
import { BADGE_SHAPE, STATUS_EDGE } from "./status";
import { useDiscardOrphan, useOrphans, useRepairOrphan } from "./queries";

/**
 * Visits the server took but could not place — ADR-0022, design.md "The repair
 * queue".
 *
 * One question per row: where does this visit belong? Everything else on the
 * row is evidence for answering it, which is why the actions are inline rather
 * than behind a dialog — a queue of five decisions should not be five journeys.
 *
 * The leading edge forecasts what repairing would do, using the same
 * STATUS_EDGE the live feed uses. That is the one thing here that could
 * mislead, because the outcome has *not* taken effect yet, so the header count
 * and the lede carry the correction once for every row rather than as a badge
 * on each.
 */
export function OrphansScreen() {
  const orphans = useOrphans();
  const [confirming, setConfirming] = useState<OrphanedVisit | null>(null);
  const discard = useDiscardOrphan();

  // From whatever rows are on screen, kept ones under a failed refetch included:
  // the count carries the "not yet" correction for exactly those rows.
  const total = orphans.data ? orphanTotal(orphans.data) : 0;

  function confirmDiscard() {
    if (!confirming) return;
    discard.mutate(confirming.id, {
      onSuccess: () => toast.success(copy.orphans.discarded),
      onError: () => toast.error(copy.orphans.discardFailed),
      onSettled: () => setConfirming(null),
    });
  }

  return (
    <section>
      <ScreenHeader
        className="mb-4"
        title={copy.orphans.title}
        subtitle={copy.orphans.lede}
        actions={
          total > 0 && (
            <span className="text-muted-foreground tnum">{copy.orphans.count(total)}</span>
          )
        }
      />

      <ScreenState<OrphansResponse>
        data={orphans.data}
        isPending={orphans.isPending}
        isError={orphans.isError}
        isFetching={orphans.isFetching}
        onRetry={() => void orphans.refetch()}
        loadFailed={copy.orphans.loadFailed}
        loading={copy.orphans.loading}
        skeleton={
          <Surface className="space-y-3 p-3.5">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </Surface>
        }
      >
        {(data) => (
          <>
            <Surface className="overflow-hidden">
              {data.visits.length === 0 ? (
                <EmptyTile icon={<CheckCheck aria-hidden="true" />}>
                  <p className="text-foreground font-medium">{copy.orphans.empty}</p>
                  <p>{copy.orphans.emptyHint}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/visites">{copy.orphans.emptyCta}</Link>
                  </Button>
                </EmptyTile>
              ) : (
                <ul className="divide-border divide-y">
                  {data.visits.map((visit) => (
                    <OrphanRow
                      key={visit.id}
                      visit={visit}
                      // The mutation's own record, not the dialog's: the row
                      // stays locked for as long as its delete is in flight.
                      discarding={discard.isPending && discard.variables === visit.id}
                      onDiscard={() => setConfirming(visit)}
                    />
                  ))}
                </ul>
              )}
            </Surface>

            {/* Non-zero means something upstream is wrong, not that the page is small. */}
            {data.remaining > 0 && (
              <p className="text-muted-foreground mt-3 text-xs">
                {copy.orphans.overflow(data.remaining)}
              </p>
            )}
          </>
        )}
      </ScreenState>

      {/* Cannot be dismissed while the delete is in flight: closing it would
          free the dialog for a second discard on the one shared mutation. */}
      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && !discard.isPending && setConfirming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.orphans.confirm.title}</DialogTitle>
            <DialogDescription>{copy.orphans.confirm.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={discard.isPending}
              onClick={() => setConfirming(null)}
            >
              {copy.orphans.confirm.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmDiscard} disabled={discard.isPending}>
              {copy.orphans.confirm.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** One place the visit could go, with the distance that argues for it. */
type Target = { id: string; name: string; distanceM: number | null };

/**
 * The two reasons ask different things — a choice between candidates, or a nod
 * to the prospect the visit already names — but in one row shape: the same
 * « Rattacher à » line, holding one button or several. A `not_assigned` visit
 * whose prospect the server could not name (`prospectName: null`, e.g. merged
 * away since) has nothing to nod to, so it gets the candidates instead.
 */
function targetsFor(visit: OrphanedVisit): Target[] {
  if (visit.reason === "not_assigned" && visit.prospectName !== null) {
    const named = visit.candidates.find((c) => c.id === visit.prospectId);
    return [
      { id: visit.prospectId, name: visit.prospectName, distanceM: named?.distanceM ?? null },
    ];
  }
  // Server order is nearest first (orphanedVisitSchema); never re-sorted here.
  return visit.candidates;
}

/**
 * Its own `useRepairOrphan`, on purpose: the pending state belongs to the row,
 * so repairing one visit leaves every other row live, and this row's
 * « Supprimer » waits for its own repair. One screen-level mutation only
 * tracks its latest call, so two quick repairs would clobber each other.
 */
function OrphanRow({
  visit,
  discarding,
  onDiscard,
}: {
  visit: OrphanedVisit;
  discarding: boolean;
  onDiscard: () => void;
}) {
  const repair = useRepairOrphan();
  const targets = targetsFor(visit);
  const when = formatDateTime(visit.visitedAt);
  const busy = repair.isPending || discarding;

  function attach(target: Target) {
    repair.mutate(
      { visitId: visit.id, prospectId: target.id },
      {
        // The server may have followed a merge, or found the visit already
        // repaired (orphanRepairResultSchema): the toast says what happened.
        onSuccess: (result) =>
          toast.success(
            !result.repaired
              ? copy.orphans.alreadyAttached
              : result.prospectId === target.id
                ? copy.orphans.attached(target.name)
                : copy.orphans.attachedToSurvivor(target.name),
          ),
        onError: () => toast.error(copy.orphans.attachFailed),
      },
    );
  }

  return (
    <li
      aria-label={copy.orphans.rowAria(when, visit.agentEmail)}
      className={cn("px-3.5 py-2.5", STATUS_EDGE[OUTCOME_TO_STATUS[visit.outcome]])}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-muted-foreground tnum shrink-0">{when}</span>
        <Badge variant="ghost" className={cn(BADGE_SHAPE, OUTCOME_BADGE[visit.outcome])}>
          {OUTCOME_LABELS[visit.outcome]}
        </Badge>
        {visit.flyerGiven && (
          <Badge variant="ghost" className={cn(BADGE_SHAPE, "bg-secondary text-foreground")}>
            <Check aria-hidden="true" />
            {copy.orphans.flyer}
          </Badge>
        )}
        <span className="text-muted-foreground min-w-0 text-xs break-words">
          {visit.agentEmail}
        </span>
        <Badge variant="outline" className={cn(BADGE_SHAPE, "ml-auto")}>
          {copy.orphans.reason[visit.reason]}
        </Badge>
      </div>

      {visit.notes && (
        <p className="text-muted-foreground mt-1 text-xs break-words">« {visit.notes} »</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {targets.length > 0 ? (
          <>
            <span className="text-muted-foreground shrink-0 text-xs">{copy.orphans.attachTo}</span>
            {targets.map((target) => (
              <TargetButton
                key={target.id}
                target={target}
                disabled={busy}
                onAttach={() => attach(target)}
              />
            ))}
          </>
        ) : (
          <p className="text-muted-foreground min-w-0 flex-1 text-xs">
            {visit.hasPosition ? copy.orphans.noCandidates : copy.orphans.noPosition}
          </p>
        )}

        {/* Far right, away from the attach buttons: a misclick here cannot be
            undone, which the confirmation then says in words. */}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive ml-auto"
          aria-label={copy.orphans.discardAria(when)}
          disabled={busy}
          onClick={onDiscard}
        >
          <Trash2 aria-hidden="true" />
          {copy.orphans.discard}
        </Button>
      </div>
    </li>
  );
}

/** Distance sits inside the target, because it is the reason to press it. */
function TargetButton({
  target,
  disabled,
  onAttach,
}: {
  target: Target;
  disabled: boolean;
  onAttach: () => void;
}) {
  const distance = target.distanceM === null ? null : formatDistance(target.distanceM);

  return (
    <Button
      variant="secondary"
      size="sm"
      // A long name wraps inside the button rather than pushing the row past
      // a phone's width.
      className="h-auto min-h-8 max-w-full py-1 text-left whitespace-normal"
      disabled={disabled}
      onClick={onAttach}
      aria-label={copy.orphans.attachAria(target.name, distance)}
    >
      <span className="min-w-0 break-words">{target.name}</span>
      {distance && (
        <span className="text-muted-foreground tnum shrink-0 text-xs">· {distance}</span>
      )}
    </Button>
  );
}
