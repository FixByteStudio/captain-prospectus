import { Link } from "react-router";
import { Check, ChevronRight } from "lucide-react";
import { OUTCOME_TO_STATUS } from "../../../shared/constants";
import type { AdminVisit } from "../../../shared/schemas";
import { OUTCOME_LABELS, copy } from "../../copy";
import { formatDateTime } from "../../format";
import { cn } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Card } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { useVisitsFeed } from "../queries";
import { ScreenState } from "../ScreenState";
import { OUTCOME_BADGE } from "../outcome-badge";
import { BADGE_SHAPE, STATUS_EDGE } from "../status";

/** EXPERIENCE.md › Dernières visites: the last 5 by `received_at`. */
const SHOWN = 5;

const HEAD = "text-overline text-muted-foreground h-auto px-3 py-2.5 uppercase";

/**
 * Dernières visites — docs/design.md › Tableau de bord, GH #113.
 *
 * The same 15 s poll as Visites (ADR-0010), through `useVisitsFeed`'s own
 * unscoped call — Visites (GH #178) reads a period-scoped one instead, its own
 * cache entry under the same key prefix. Cut to its newest rows; only arrivals
 * among the rows shown wash and are announced: a visit that lands sixth is not
 * news on this screen.
 */
export function RecentVisits() {
  const { visits, arrived, isPending, isError, isFetching, refetch, answeredAt } = useVisitsFeed();
  const t = copy.dashboard.recent;
  const shown = visits.slice(0, SHOWN);
  const fresh = new Set(arrived);
  const arrivedShown = shown.filter((v) => fresh.has(v.id)).length;

  return (
    <Card className="min-w-0 gap-3 overflow-hidden pt-4.5 pb-1.5">
      <div className="flex items-baseline justify-between gap-4 px-4.5">
        <h3 className="text-heading">{t.title}</h3>
        <Link
          to="/admin/visites"
          className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          {t.seeAll}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {/* The wash is decoration; this is what a screen reader is told, once per
          poll. Keyed by the poll's own timestamp (#160): two polls in a row
          with the same count of arrivals must still each get their own
          announcement, which an unchanged live-region text does not always get. */}
      <p key={answeredAt} role="status" aria-live="polite" className="sr-only">
        {arrivedShown > 0 ? copy.visits.arrived(arrivedShown) : ""}
      </p>

      {/* As on Visites (#224): a skeleton until the first rows, then the
          shared Alert with « Réessayer » above any rows already held. Its own
          `loading`, since the screen's region only speaks for the dashboard's
          query, and this feed can still be out after that has answered. */}
      <div className="px-4.5 empty:hidden">
        <ScreenState
          data={shown.length === 0 && isPending ? undefined : shown}
          isPending={isPending}
          isError={isError}
          isFetching={isFetching}
          onRetry={() => void refetch()}
          loadFailed={copy.visits.loadFailed}
          loading={copy.visits.loading}
          skeleton={
            <ul aria-hidden="true" className="pb-3">
              {Array.from({ length: SHOWN }, (_, i) => (
                <li key={i} className="h-row flex items-center">
                  <Skeleton className="h-5 w-full" />
                </li>
              ))}
            </ul>
          }
        >
          {(rows) =>
            // A failed first load has nothing to be empty of: the Alert says it all.
            rows.length === 0 &&
            !isError && <p className="text-muted-foreground pb-3">{copy.visits.empty}</p>
          }
        </ScreenState>
      </div>

      {/* Full-bleed, so outside the padded state above; the rows held under
          a failed poll's Alert. */}
      {shown.length > 0 && (
        <Table>
          <TableHeader className="bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className={HEAD}>
                {t.time}
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                {t.prospect}
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                {t.outcome}
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                {t.flyer}
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                {t.agent}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((visit) => (
              <RecentVisitRow key={visit.id} visit={visit} isNew={fresh.has(visit.id)} />
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

/**
 * The row's edge is the outcome's consequence, as on Visites; the badge says
 * the outcome itself.
 */
function RecentVisitRow({ visit, isNew }: { visit: AdminVisit; isNew: boolean }) {
  const t = copy.dashboard.recent;
  return (
    <TableRow
      data-new={isNew || undefined}
      className={cn(
        // The transition stays on, so the wash fades out when the next poll
        // clears it; app.css's reduced-motion block drops it, and the live
        // region says it anyway.
        "h-row transition-colors duration-700 hover:bg-transparent",
        isNew && "bg-accent hover:bg-accent",
      )}
    >
      <TableCell className={cn("tnum px-3", STATUS_EDGE[OUTCOME_TO_STATUS[visit.outcome]])}>
        {formatDateTime(visit.receivedAt)}
      </TableCell>
      <TableHead scope="row" className="px-3 font-medium">
        {visit.prospectName}
      </TableHead>
      <TableCell className="px-3">
        <Badge variant="ghost" className={cn(BADGE_SHAPE, OUTCOME_BADGE[visit.outcome])}>
          {OUTCOME_LABELS[visit.outcome]}
        </Badge>
      </TableCell>
      <TableCell className="px-3">
        {visit.flyerGiven ? (
          <Badge variant="ghost" className={cn(BADGE_SHAPE, "bg-secondary text-foreground")}>
            <Check aria-hidden="true" />
            {copy.visits.flyer}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{t.noFlyer}</span>
        )}
      </TableCell>
      <TableCell className="px-3">{visit.agentEmail}</TableCell>
    </TableRow>
  );
}
