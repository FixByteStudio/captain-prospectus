import { useRef, useState } from "react";
import { InboxIcon } from "lucide-react";
import type { AdminVisit } from "../../../shared/schemas";
import { OUTCOME_TO_STATUS } from "../../../shared/constants";
import { OUTCOME_LABELS, REFUSAL_REASON_LABELS, copy } from "../../copy";
import { formatDateTime } from "../../format";
import { cn } from "../../lib/utils";
import { Skeleton } from "../../ui/skeleton";
import { EmptyTile } from "../EmptyTile";
import { ScreenState } from "../ScreenState";
import { Surface } from "../Surface";
import { Pager } from "../Pager";
import { STATUS_EDGE, STATUS_TEXT } from "../status";
import type { useVisitsFeed } from "../queries";
import { PAGE_SIZE, pageCount, pageSlice } from "../pagination";

/**
 * The ledger half of Visites — ADR-0010, docs/design.md › "The live feed".
 *
 * Reads the feed as `VisitsScreenBody` holds it: that parent is remounted
 * (keyed by period and refusal reason) whenever either changes, since
 * `useVisitsFeed` keeps its cursor in a ref and the only clean way to reseed
 * it from `since=0` under a new window is a fresh mount — which is also what
 * the I/O matrix asks for ("no wash/announcement for the reseed": `seeded` starts false
 * again, so the opening page under the new filter is not news).
 */
export function VisitsLedger({
  feed,
  empty = copy.visits.empty,
}: {
  feed: ReturnType<typeof useVisitsFeed>;
  /** A filtered feed's empty copy: visits arrived, none matched (GH #249). */
  empty?: string;
}) {
  const { visits, arrived, isPending, isError, isFetching, refetch, answeredAt } = feed;
  const [page, setPage] = useState(1);
  const top = useRef<HTMLDivElement>(null);
  const total = pageCount(visits.length, PAGE_SIZE);
  // An arrival while paged in keeps the page (I/O matrix, "arrival while on
  // page 2"); only a feed that shrank under the current page number is
  // clamped back, computed for render rather than through a second effect-only
  // render.
  const current = Math.min(page, total);

  const shown = pageSlice(visits, current, PAGE_SIZE);

  // A page change leaves the click at the bottom pager; without this the
  // admin lands on row 26 with no idea it followed a jump to page 2.
  // Optional-chained: happy-dom has no `scrollIntoView`.
  function changePage(next: number) {
    setPage(next);
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
        data={visits.length === 0 && isPending ? undefined : visits}
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
          visits.length === 0 ? (
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
                  {shown.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} isNew={arrived.includes(visit.id)} />
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
 * The leading edge is the outcome's *consequence*, not the outcome: the column
 * scans as "what does this leave me to do". The French label sits in its own
 * column, because colour never carries the information alone (design.md).
 */
function VisitRow({ visit, isNew }: { visit: AdminVisit; isNew: boolean }) {
  const status = OUTCOME_TO_STATUS[visit.outcome];

  return (
    <li
      className={cn(
        "px-3.5 py-2.5",
        STATUS_EDGE[status],
        // #162: the transition lives on the base classes, not only while the
        // wash is on, so it also plays when the wash is released — a row that
        // only ever gained `transition-colors` while `bg-accent` was present
        // snapped back to the card colour instead of fading.
        "transition-colors duration-700",
        isNew && "bg-accent",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Read down as a sequence, so time is left and tabular — unlike the
            prospect ledger, where numbers are quantities and sit right. */}
        <span className="text-muted-foreground tnum shrink-0">
          {formatDateTime(visit.receivedAt)}
        </span>
        <span className="min-w-0 flex-1 font-medium">{visit.prospectName}</span>
        <span className={cn("shrink-0", STATUS_TEXT[status])}>{OUTCOME_LABELS[visit.outcome]}</span>
        {visit.refusalReason && (
          <span className="text-muted-foreground shrink-0">
            {REFUSAL_REASON_LABELS[visit.refusalReason]}
          </span>
        )}
        {visit.flyerGiven && (
          <span className="text-muted-foreground shrink-0 text-xs">{copy.visits.flyer}</span>
        )}
        <span className="text-muted-foreground shrink-0 text-xs">{visit.agentEmail}</span>
      </div>
      {visit.notes && <p className="text-muted-foreground mt-1 text-xs">« {visit.notes} »</p>}
    </li>
  );
}
