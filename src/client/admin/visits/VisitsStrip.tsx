import type { ReactNode } from "react";
import { Link } from "react-router";
import type { DashboardPeriod } from "../../../shared/constants";
import { copy } from "../../copy";
import { formatCount, formatDate, formatPercent } from "../../format";
import { cn } from "../../lib/utils";
import { Card } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { ScreenState } from "../ScreenState";
import { prospectsHref, useDashboard } from "../queries";

/**
 * The four-card KPI strip — docs/design.md › The live feed, GH #178.
 *
 * Reads the *same* period-scoped aggregate as Tableau de bord
 * (`useDashboard(period)`), so the strip and the ledger beside it describe one
 * window without a second endpoint. No icon tile, no sparkline (design.md's
 * "one row with no icon tile and no sparkline"): overline label, display
 * figure, one meta line.
 */
export function VisitsStrip({ period }: { period: DashboardPeriod }) {
  const dashboard = useDashboard(period);

  return (
    <ScreenState
      data={dashboard.data}
      isPending={dashboard.isPending}
      isError={dashboard.isError}
      isFetching={dashboard.isFetching}
      onRetry={() => void dashboard.refetch()}
      loadFailed={copy.visits.strip.loadFailed}
      loading={copy.visits.strip.loading}
      skeleton={
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StripCardSkeleton />
          <StripCardSkeleton />
          <StripCardSkeleton />
          <StripCardSkeleton />
        </div>
      }
    >
      {(data) => (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StripCard
            label={copy.visits.strip.followUpsDueSoon}
            value={formatCount(data.followUpsDueSoon.value)}
            meta={copy.visits.strip.followUpsDueSoonMeta(
              formatDate(data.followUpsDueSoon.dueBefore),
            )}
            to={prospectsHref({
              status: ["follow_up"],
              dueBefore: data.followUpsDueSoon.dueBefore,
            })}
          />
          <StripCard
            label={copy.dashboard.conversionRate}
            value={formatPercent(data.conversionRate.value)}
            meta={
              data.conversionRate.visitedProspects.value === 0
                ? copy.dashboard.kpiFooter.noneVisited
                : copy.dashboard.kpiFooter.conversionCaption(
                    data.converted.value,
                    data.conversionRate.visitedProspects.value,
                  )
            }
            to={prospectsHref({ status: ["converted"] })}
          />
          <StripCard
            label={copy.visits.strip.flyersGiven}
            value={formatCount(data.flyersGiven)}
            meta={copy.visits.strip.flyersGivenMeta}
          />
          <StripCard
            label={copy.visits.strip.agentsActiveToday}
            value={formatCount(data.agentsActiveToday)}
            meta={copy.visits.strip.agentsActiveTodayMeta}
          />
        </div>
      )}
    </ScreenState>
  );
}

function StripCard({
  label,
  value,
  meta,
  to,
}: {
  label: string;
  value: string;
  meta: ReactNode;
  to?: string;
}) {
  const card = (
    <Card
      className={cn(
        "min-w-0 gap-1 p-4.5 pb-4",
        to && "group-hover:bg-accent/50 h-full transition-colors",
      )}
    >
      <h3 className="text-overline text-muted-foreground uppercase">{label}</h3>
      <p className="text-display tnum">{value}</p>
      <p className="text-meta text-muted-foreground mt-1.5">{meta}</p>
    </Card>
  );
  if (!to) return card;
  return (
    <Link
      to={to}
      aria-label={copy.dashboard.openList(label, value)}
      className="group focus-visible:ring-ring/50 block min-w-0 rounded-xl outline-none focus-visible:ring-[3px]"
    >
      {card}
    </Link>
  );
}

function StripCardSkeleton() {
  return (
    <Card className="min-w-0 gap-1 p-4.5 pb-4" aria-hidden="true">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="mt-1.5 h-4 w-32" />
    </Card>
  );
}
