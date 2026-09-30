import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  DASHBOARD_DEFAULT_PERIOD,
  EXPORT_ROWS,
  NO_REFUSAL_REASON,
  REFUSAL_REASONS,
  type DashboardPeriod,
} from "../../shared/constants";
import { brusselsPeriod } from "../../shared/period";
import {
  dashboardQuerySchema,
  visitsReasonQuerySchema,
  type VisitsReasonFilter,
} from "../../shared/schemas";
import { ApiError } from "../api";
import { REFUSAL_REASON_LABELS, copy } from "../copy";
import { PeriodToggle } from "./PeriodToggle";
import { ANY, Filter } from "./prospects/Filter";
import { ScreenHeader } from "./ScreenHeader";
import { Button } from "../ui/button";
import { VisitsLedger } from "./visits/VisitsLedger";
import { VisitsStrip } from "./visits/VisitsStrip";
import { downloadCsv, useVisitsFeed } from "./queries";

/**
 * `?period=` read from the URL through the same schema the Worker validates
 * with (`dashboardQuerySchema`) — a bad or missing value is the 30-day
 * default (I/O matrix), never a second copy of "is this 7, 30 or 90".
 */
function parsePeriod(raw: string | null): DashboardPeriod {
  const parsed = dashboardQuerySchema.safeParse({ period: raw ?? undefined });
  return parsed.success ? parsed.data.period : DASHBOARD_DEFAULT_PERIOD;
}

/**
 * `?reason=` read through the Worker's own schema: a bad value is no filter
 * (I/O matrix), so the feed never asks with something it would 400 on.
 */
function parseReason(raw: string | null): VisitsReasonFilter | undefined {
  const parsed = visitsReasonQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** The select's options, in `REFUSAL_REASONS`' display order, then Sans raison. */
const REASON_OPTIONS = [
  ...REFUSAL_REASONS.map((value) => ({ value, label: REFUSAL_REASON_LABELS[value] })),
  { value: NO_REFUSAL_REASON, label: copy.visits.reasonFilter.none },
];

/**
 * Visites — ADR-0010, docs/design.md "The live feed", rebuilt for GH #178.
 *
 * A ledger, not a wall of cards: the roadmap sketched this with shadcn `card`,
 * `badge` and `scroll-area`, and the design pass overruled all three. Cards
 * around rows and status as a coloured pill are both on design.md's "Not
 * this" list, and a pane with its own scrollbar inside a page that scrolls is
 * two scrollbars and a lost keyboard.
 *
 * The period lives in the URL (`?period=`), same rule as Prospects' filters:
 * a reload, a shared link or the dashboard's Visites card opens the same
 * window. Changing it replaces the URL, same as Prospects. `?reason=` follows
 * the same rule (GH #249).
 */
export function VisitsScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parsePeriod(searchParams.get("period"));
  const reason = parseReason(searchParams.get("reason"));

  function setPeriod(next: DashboardPeriod) {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("period", String(next));
        return params;
      },
      { replace: true },
    );
  }

  function setReason(next: string) {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === ANY) params.delete("reason");
        else params.set("reason", next);
        return params;
      },
      { replace: true },
    );
  }

  // `VisitsScreenBody` is remounted on every period or reason change: the
  // feed's cursor lives in a ref inside `useVisitsFeed`, and a fresh mount is
  // what reseeds it from `since=0` under the new window (VisitsLedger's own
  // comment).
  return (
    <VisitsScreenBody
      key={`${period}:${reason ?? ANY}`}
      period={period}
      reason={reason}
      onPeriodChange={setPeriod}
      onReasonChange={setReason}
    />
  );
}

function VisitsScreenBody({
  period,
  reason,
  onPeriodChange,
  onReasonChange,
}: {
  period: DashboardPeriod;
  reason: VisitsReasonFilter | undefined;
  onPeriodChange: (period: DashboardPeriod) => void;
  onReasonChange: (reason: string) => void;
}) {
  const feed = useVisitsFeed(period, reason);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const bounds = brusselsPeriod(Date.now(), period);
      const params = new URLSearchParams({
        from: String(bounds.from),
        to: String(bounds.to - 1),
      });
      if (reason !== undefined) params.set("reason", reason);
      const truncated = await downloadCsv(
        `/api/admin/visits/export.csv?${params}`,
        "visites.csv",
        copy.visits.export.failed,
      );
      if (truncated) toast.warning(copy.visits.export.truncated(EXPORT_ROWS));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : copy.visits.export.failed);
    } finally {
      setExporting(false);
    }
  }

  const count = feed.visits.length;

  return (
    <section className="flex flex-col gap-6">
      <ScreenHeader
        title={copy.visits.title}
        subtitle={copy.visits.lede}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {count > 0 && (
              <span className="text-muted-foreground tnum">
                {feed.capped ? copy.visits.countCapped(count) : copy.visits.count(count)}
              </span>
            )}
            <Filter
              label={copy.visits.reasonFilter.label}
              value={reason ?? ANY}
              onChange={onReasonChange}
              anyLabel={copy.visits.reasonFilter.any}
              options={REASON_OPTIONS}
            />
            <PeriodToggle value={period} onChange={onPeriodChange} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? copy.visits.export.exporting : copy.visits.export.button}
            </Button>
          </div>
        }
      />

      <VisitsStrip period={period} />

      <VisitsLedger
        feed={feed}
        empty={reason !== undefined ? copy.visits.reasonFilter.empty : undefined}
      />
    </section>
  );
}
