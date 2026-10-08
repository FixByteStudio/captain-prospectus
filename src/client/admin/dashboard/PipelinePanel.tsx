import { STATUSES, type Status } from "../../../shared/constants";
import type { DashboardResponse } from "../../../shared/schemas";
import { STATUS_LABELS, copy } from "../../copy";
import { formatCount, formatPercent } from "../../format";
import { cn } from "../../lib/utils";
import { Card } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { STATUS_FILL } from "./status-fill";

type Pipeline = DashboardResponse["pipeline"];

/** The count's ink per status, as in key-a1-dashboard.html. */
const COUNT_INK = {
  new: "text-muted-foreground",
  assigned: "text-foreground",
  follow_up: "text-warn",
  interested: "text-success",
  converted: "text-success",
  rejected: "text-destructive",
} as const satisfies Record<Status, string>;

const SHELL = "min-w-0 gap-2 p-4.5";

/**
 * Pipeline par statut — docs/design.md › Tableau de bord, GH #112.
 *
 * The share is presentation, so it is computed here from the same six counts
 * as the total: the two can never disagree, and a total of 0 shows 0 %.
 */
export function PipelinePanel({ pipeline }: { pipeline: Pipeline }) {
  const total = STATUSES.reduce((n, s) => n + pipeline[s], 0);
  return (
    <Card className={SHELL}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-heading">{copy.dashboard.pipeline.title}</h3>
        <span className="text-meta text-muted-foreground tnum">
          {copy.dashboard.pipeline.total(total)}
        </span>
      </div>
      <ul>
        {STATUSES.map((status) => {
          const share = total === 0 ? 0 : pipeline[status] / total;
          return (
            <li key={status} className="py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{STATUS_LABELS[status]}</span>
                <span className="tnum">
                  <b className={cn("font-semibold", COUNT_INK[status])}>
                    {formatCount(pipeline[status])}
                  </b>
                  <span className="text-meta text-muted-foreground inline-block w-14 text-right">
                    {formatPercent(share)}
                  </span>
                </span>
              </div>
              <div
                className="bg-secondary mt-1.5 h-1.5 overflow-hidden rounded-full"
                aria-hidden="true"
              >
                <div
                  className={cn("h-full rounded-full", STATUS_FILL[status])}
                  style={{ width: `${share * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function PipelinePanelSkeleton() {
  return (
    <Card className={SHELL} aria-hidden="true">
      <Skeleton className="h-5 w-40" />
      {STATUSES.map((s) => (
        <div key={s} className="py-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-1.5 h-1.5 w-full" />
        </div>
      ))}
    </Card>
  );
}
