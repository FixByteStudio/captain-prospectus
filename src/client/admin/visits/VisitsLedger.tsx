import { useRef, useState } from "react";
import { ChevronDown, InboxIcon } from "lucide-react";
import type { AdminDoorDay, AdminDoorDayVisit } from "../../../shared/schemas";
import { OUTCOME_TO_STATUS } from "../../../shared/constants";
import { OUTCOME_LABELS, REFUSAL_REASON_LABELS, copy } from "../../copy";
import { formatDateTime } from "../../format";
import { cn } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { Skeleton } from "../../ui/skeleton";
import { EmptyTile } from "../EmptyTile";
import { ScreenState } from "../ScreenState";
import { Surface } from "../Surface";
import { Pager } from "../Pager";
import { OUTCOME_BADGE } from "../outcome-badge";
import { BADGE_SHAPE, STATUS_EDGE, STATUS_TEXT } from "../status";
import type { useVisitsFeed } from "../queries";
import { PAGE_SIZE, pageCount, pageSlice } from "../pagination";

/**
 * The ledger half of Visites — ADR-0010, ADR-0036 R13, docs/design.md › "The
 * live feed": one row per door-day, opening in place onto its visits.
 *
 * Reads the feed as `VisitsScreenBody` holds it: that parent is remounted
 * (keyed by period and refusal reason) whenever either changes, since
 * `useVisitsFeed` keeps its cursor in a ref and the only clean way to reseed
 * it from `since=0` under a new window is a fresh mount — which is also what
 * the I/O matrix asks for ("no wash/announcement for the reseed": `seeded` starts false
 * again, so the opening page under the new filter is not news). The same
 * remount closes an open row; a page change closes it here.
 */
export function VisitsLedger({
  feed,
  empty = copy.visits.empty,
}: {
  feed: ReturnType<typeof useVisitsFeed>;
  /** A filtered feed's empty copy: visits arrived, none matched (GH #249). */
  empty?: string;
}) {
  const { doorDays, arrived, isPending, isError, isFetching, refetch, answeredAt } = feed;
  const [page, setPage] = useState(1);
  /** The one open row, by door-day key: opening another closes it, like a stop row. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const total = pageCount(doorDays.length, PAGE_SIZE);
  // An arrival while paged in keeps the page (I/O matrix, "arrival while on
  // page 2"); only a feed that shrank under the current page number is
  // clamped back, computed for render rather than through a second effect-only
  // render.
  const current = Math.min(page, total);

  const shown = pageSlice(doorDays, current, PAGE_SIZE);

  // A page change leaves the click at the bottom pager; without this the
  // admin lands on row 26 with no idea it followed a jump to page 2.
  // Optional-chained: happy-dom has no `scrollIntoView`.
  function changePage(next: number) {
    setPage(next);
    setOpenKey(null);
    top.current?.scrollIntoView?.({ block: "start" });
  }

  return (
    <div ref={top}>
      {/* Keyed by the poll's own timestamp (#160): identical text two polls
          in a row still needs its own announcement, which some screen
          readers skip when a live region's text does not change. */}
      <p key={answeredAt} role="status" aria-live="polite" className="sr-only">
        {arrived.length > 0 ? copy.visits.arrived(arrived.length) : ""}
      </p>

      <ScreenState
        // Nothing held yet is the only state the skeleton stands in for; a
        // failed poll keeps the rows already held under the Alert (#208).
        data={doorDays.length === 0 && isPending ? undefined : doorDays}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        onRetry={() => void refetch()}
        loadFailed={copy.visits.loadFailed}
        loading={copy.visits.loading}
        skeleton={
          // 6–8 table rows: EXPERIENCE.md › State Patterns (#207).
          <Surface aria-hidden="true">
            <ul className="divide-border divide-y">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="px-3.5 py-2.5">
                  <Skeleton className="h-5 w-full" />
                </li>
              ))}
            </ul>
          </Surface>
        }
      >
        {() =>
          doorDays.length === 0 ? (
            // A failed first load has nothing to be empty of: the Alert says it all.
            !isError && (
              <Surface>
                <EmptyTile icon={<InboxIcon aria-hidden="true" />}>
                  <p>{empty}</p>
                </EmptyTile>
              </Surface>
            )
          ) : (
            <>
              <Surface>
                <ul className="divide-border divide-y">
                  {shown.map((row) => (
                    <DoorDayRow
                      key={row.key}
                      row={row}
                      isNew={arrived.includes(row.key)}
                      open={openKey === row.key}
                      onOpenChange={(open) => setOpenKey(open ? row.key : null)}
                    />
                  ))}
                </ul>
              </Surface>
              {total > 1 && (
                <Pager
                  page={current}
                  total={total}
                  onChange={changePage}
                  labels={copy.visits.pager}
                  className="mt-4"
                />
              )}
            </>
          )
        }
      </ScreenState>
    </div>
  );
}

/**
 * One door-day: the latest visit's answer, and a disclosure onto every visit.
 *
 * The leading edge is the latest outcome's *consequence*, not the outcome: the
 * column scans as "what does this leave me to do". The French label sits in its
 * own column, because colour never carries the information alone (design.md).
 * The whole row is the trigger, never a dialog: reading a history confirms
 * nothing (EXPERIENCE.md keeps dialogs for the three confirmations).
 */
function DoorDayRow({
  row,
  isNew,
  open,
  onOpenChange,
}: {
  row: AdminDoorDay;
  isNew: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const status = OUTCOME_TO_STATUS[row.outcome];
  const n = row.visits.length;

  return (
    <Collapsible asChild open={open} onOpenChange={onOpenChange}>
      <li
        className={cn(
          STATUS_EDGE[status],
          // #162: the transition lives on the base classes, not only while the
          // wash is on, so it also plays when the wash is released — a row that
          // only ever gained `transition-colors` while `bg-accent` was present
          // snapped back to the card colour instead of fading.
          "transition-colors duration-700",
          isNew && "bg-accent",
        )}
      >
        <CollapsibleTrigger
          aria-label={copy.visits.openRow(row.prospectName, OUTCOME_LABELS[row.outcome], n)}
          className="focus-visible:ring-ring/50 block w-full px-3.5 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
        >
          {/* Spans, not a div and a p: a button holds phrasing content only. */}
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {/* Read down as a sequence, so time is left and tabular — unlike the
                prospect ledger, where numbers are quantities and sit right. */}
            <span className="text-muted-foreground tnum shrink-0">
              {formatDateTime(row.receivedAt)}
            </span>
            <span className="min-w-0 flex-1 font-medium">{row.prospectName}</span>
            <span className={cn("shrink-0", STATUS_TEXT[status])}>
              {OUTCOME_LABELS[row.outcome]}
            </span>
            {row.refusalReason && (
              <span className="text-muted-foreground shrink-0">
                {REFUSAL_REASON_LABELS[row.refusalReason]}
              </span>
            )}
            {row.flyerGiven && (
              <span className="text-muted-foreground shrink-0 text-xs">{copy.visits.flyer}</span>
            )}
            <span className="text-muted-foreground shrink-0 text-xs">{row.agentEmail}</span>
            {n > 1 && (
              <span className="text-muted-foreground tnum shrink-0 text-xs">
                {copy.visits.visitCount(n)}
              </span>
            )}
            {/* `open` rather than a `group-data-*` variant: no new CSS rule in
                the stylesheet the field precaches at its ceiling (ADR-0026). */}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
          {row.notes && (
            <span className="text-muted-foreground mt-1 block text-xs">« {row.notes} »</span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="bg-secondary px-3.5 py-2.5">
          <p className="text-overline text-muted-foreground mb-2 uppercase">
            {copy.visits.history}
          </p>
          {/* Oldest first, as the server sends them: the day read in order. */}
          <ol className="flex flex-col gap-1.5">
            {row.visits.map((visit) => (
              <HistoryLine key={visit.id} visit={visit} />
            ))}
          </ol>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

/** One visit of the day: when the agent made it, its outcome, and what it carried. */
function HistoryLine({ visit }: { visit: AdminDoorDayVisit }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-muted-foreground tnum shrink-0">{formatDateTime(visit.visitedAt)}</span>
      <Badge variant="ghost" className={cn(BADGE_SHAPE, OUTCOME_BADGE[visit.outcome])}>
        {OUTCOME_LABELS[visit.outcome]}
      </Badge>
      {visit.flyerGiven && (
        <span className="text-muted-foreground shrink-0 text-xs">{copy.visits.flyer}</span>
      )}
      {visit.answerCount > 0 && (
        <span className="text-muted-foreground tnum shrink-0 text-xs">
          {copy.visits.answers(visit.answerCount)}
        </span>
      )}
      {visit.refusalReason && (
        <span className="text-muted-foreground shrink-0 text-xs">
          {REFUSAL_REASON_LABELS[visit.refusalReason]}
        </span>
      )}
      {visit.notes && <span className="text-muted-foreground text-xs">« {visit.notes} »</span>}
    </li>
  );
}
