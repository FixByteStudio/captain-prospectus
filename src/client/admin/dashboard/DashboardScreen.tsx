import { useState, type ReactNode } from "react";
import { BadgeCheck, Building, MapPin, Percent } from "lucide-react";
import {
  DASHBOARD_DEFAULT_PERIOD,
  OPEN_STATUSES,
  type DashboardPeriod,
} from "../../../shared/constants";
import { copy } from "../../copy";
import { formatCount, formatPercent, formatPoints } from "../../format";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { PeriodToggle } from "../PeriodToggle";
import { orphanTotal, queueCount } from "../nav";
import { ScreenHeader } from "../ScreenHeader";
import { prospectsHref, useDashboard, useDuplicates, useOrphans, visitsHref } from "../queries";
import { AgentActivityTable, AgentActivityTableSkeleton } from "./AgentActivityTable";
import { ConversionBar } from "./ConversionBar";
import { KpiCard, KpiCardSkeleton } from "./KpiCard";
import { KpiSparkline } from "./KpiSparkline";
import { OpenProspectsBar } from "./OpenProspectsBar";
import { PipelinePanel, PipelinePanelSkeleton } from "./PipelinePanel";
import { RecentVisits } from "./RecentVisits";
import { TodoPanel, TodoPanelSkeleton } from "./TodoPanel";
import { VisitsChart, VisitsChartSkeleton } from "./VisitsChart";

/** One row of the grid: busy while fetching, dimmed while it shows another period's figures. */
function PanelRow({
  busy,
  dimmed,
  className,
  children,
}: {
  busy: boolean;
  dimmed: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <div aria-busy={busy} className={cn(className, dimmed && "opacity-60")}>
      {children}
    </div>
  );
}

/**
 * Tableau de bord at `/admin` — GH #107, docs/design.md › Tableau de bord.
 *
 * Every figure comes from `GET /api/admin/dashboard`, which defines it; this
 * screen only lays the answer out.
 */
export function DashboardScreen() {
  const [period, setPeriod] = useState<DashboardPeriod>(DASHBOARD_DEFAULT_PERIOD);
  const dashboard = useDashboard(period);
  const data = dashboard.data;
  // The sidebar's own queries: no request of its own (GH #113).
  const duplicates = queueCount(useDuplicates(), (d) => d.pairs.length);
  const orphanCount = queueCount(useOrphans(), orphanTotal);
  // A failed refetch keeps its last figures (TanStack v5 keeps `data` on
  // error), so the panels stay under the Alert. Skeletons only when there is
  // nothing yet and nothing has failed.
  const showPanels = data !== undefined || !dashboard.isError;
  const row = { busy: dashboard.isFetching, dimmed: dashboard.isPlaceholderData };

  return (
    <section className="flex flex-col gap-6">
      <ScreenHeader
        title={copy.dashboard.title}
        subtitle={copy.dashboard.subtitle}
        actions={<PeriodToggle value={period} onChange={setPeriod} />}
      />

      {/* Outside the aria-busy grid, so it is announced rather than hidden. */}
      <p role="status" className="sr-only">
        {!data && !dashboard.isError ? copy.dashboard.loading : ""}
      </p>

      {dashboard.isError && (
        <Alert variant="destructive">
          <AlertTitle>{copy.dashboard.loadFailed}</AlertTitle>
          <AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={dashboard.isFetching}
              onClick={() => void dashboard.refetch()}
            >
              {copy.dashboard.retry}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showPanels && (
        <>
          <PanelRow {...row} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {data ? (
              <>
                <KpiCard
                  label={copy.dashboard.openProspects}
                  icon={Building}
                  value={formatCount(data.openProspects)}
                  to={prospectsHref({ status: [...OPEN_STATUSES] })}
                  footer={<OpenProspectsBar split={data.openProspectsByStatus} />}
                />
                <KpiCard
                  label={copy.dashboard.visits}
                  icon={MapPin}
                  value={formatCount(data.visits.value)}
                  // Visites opens on the same period; its count is by
                  // received_at and capped at 500, so it may differ (docs/design.md).
                  to={visitsHref(period)}
                  delta={data.visits.delta}
                  footer={<KpiSparkline byDay={data.visits.byDay} delta={data.visits.delta} />}
                />
                <KpiCard
                  label={copy.dashboard.converted}
                  icon={BadgeCheck}
                  value={formatCount(data.converted.value)}
                  // Every prospect converted now, not those converted in the
                  // period; the counts may differ (docs/design.md).
                  to={prospectsHref({ status: ["converted"] })}
                  delta={data.converted.delta}
                  footer={
                    <KpiSparkline byDay={data.converted.byDay} delta={data.converted.delta} />
                  }
                />
                <KpiCard
                  label={copy.dashboard.conversionRate}
                  icon={Percent}
                  value={formatPercent(data.conversionRate.value)}
                  delta={data.conversionRate.delta}
                  deltaFormat={formatPoints}
                  footer={
                    <ConversionBar rate={data.conversionRate} converted={data.converted.value} />
                  }
                />
              </>
            ) : (
              <>
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
              </>
            )}
          </PanelRow>

          {/* 2:1 with Pipeline par statut at ≥ lg. */}
          <PanelRow {...row} className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              {data ? <VisitsChart days={data.visitsByDay} /> : <VisitsChartSkeleton />}
            </div>
            <div className="min-w-0 lg:col-span-1">
              {data ? <PipelinePanel pipeline={data.pipeline} /> : <PipelinePanelSkeleton />}
            </div>
          </PanelRow>

          {/* Activité par agent and À traiter at 3:2, as in the mockup. */}
          <PanelRow {...row} className="grid gap-6 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-3">
              {data ? <AgentActivityTable agents={data.agents} /> : <AgentActivityTableSkeleton />}
            </div>
            <div className="min-w-0 lg:col-span-2">
              {data ? (
                <TodoPanel
                  followUpsDue={data.followUpsDue}
                  // The instant the Worker counted followUpsDue before —
                  // brusselsPeriod(now, period).to — so Voir's list totals it.
                  // Not recomputed here: render must stay pure, and a stale
                  // answer read after midnight would disagree with its figure.
                  dueBefore={data.to}
                  orphans={orphanCount}
                  duplicates={duplicates}
                />
              ) : (
                <TodoPanelSkeleton />
              )}
            </div>
          </PanelRow>
        </>
      )}

      {/* Its own feed and poll, so neither the period nor a failed dashboard
          touches it. */}
      <RecentVisits />
    </section>
  );
}
