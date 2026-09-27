import { useRef, useState } from "react";
import type { AdminVisit } from "../../../shared/schemas";
import { OUTCOME_TO_STATUS } from "../../../shared/constants";
import { OUTCOME_LABELS, copy } from "../../copy";
import { formatDateTime } from "../../format";
import { cn } from "../../lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../ui/pagination";
import { Surface } from "../Surface";
import { STATUS_EDGE, STATUS_TEXT } from "../status";
import type { useVisitsFeed } from "../queries";
import { PAGE_SIZE, pageCount, pageItems, pageSlice } from "../pagination";

/**
 * The ledger half of Visites — ADR-0010, docs/design.md › "The live feed".
 *
 * Reads the feed as `VisitsScreenBody` holds it: that parent is remounted
 * (`key={period}`) whenever the period changes, since `useVisitsFeed` keeps
 * its cursor in a ref and the only clean way to reseed it from `since=0`
 * under a new window is a fresh mount — which is also what the I/O matrix
 * asks for ("no wash/announcement for the reseed": `seeded` starts false
 * again, so the opening page under the new period is not news).
 */
export function VisitsLedger({ feed }: { feed: ReturnType<typeof useVisitsFeed> }) {
  const { visits, arrived, isPending, isError, answeredAt } = feed;
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

      {isError && <p className="text-destructive">{copy.visits.loadFailed}</p>}

      {!isError && visits.length === 0 && (
        <p className="text-muted-foreground">
          {isPending ? copy.visits.loading : copy.visits.empty}
        </p>
      )}

      {visits.length > 0 && (
        <>
          <Surface>
            <ul className="divide-border divide-y">
              {shown.map((visit) => (
                <VisitRow key={visit.id} visit={visit} isNew={arrived.includes(visit.id)} />
              ))}
            </ul>
          </Surface>
          {total > 1 && <VisitsPager page={current} total={total} onChange={changePage} />}
        </>
      )}
    </div>
  );
}

function VisitsPager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const t = copy.visits.pager;
  return (
    <Pagination aria-label={t.nav} className="mt-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            label={t.previous}
            disabled={page <= 1}
            onClick={() => onChange(Math.max(1, page - 1))}
          />
        </PaginationItem>
        {pageItems(page, total).map((item, i) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis label={t.morePages} />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                isActive={item === page}
                aria-label={t.pageLabel(item)}
                onClick={() => onChange(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            label={t.next}
            disabled={page >= total}
            onClick={() => onChange(Math.min(total, page + 1))}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
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
        {visit.flyerGiven && (
          <span className="text-muted-foreground shrink-0 text-xs">{copy.visits.flyer}</span>
        )}
        <span className="text-muted-foreground shrink-0 text-xs">{visit.agentEmail}</span>
      </div>
      {visit.notes && <p className="text-muted-foreground mt-1 text-xs">« {visit.notes} »</p>}
    </li>
  );
}
