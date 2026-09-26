import type { DashboardResponse } from "../../../shared/schemas";
import { copy } from "../../copy";
import { Progress } from "../../ui/progress";

/**
 * Taux de conversion's gold bar — docs/design.md › Tableau de bord: the same
 * exception to gold as the field's daily progress, and the same idiom
 * (`DailyProgress.tsx`), at 6px. The rate is not capped at 1 by the endpoint,
 * so the bar is; the caption always says the counts behind it.
 */
export function ConversionBar({
  rate,
  converted,
}: {
  rate: DashboardResponse["conversionRate"];
  converted: number;
}) {
  const visited = rate.visitedProspects.value;
  return (
    <div>
      {/* bg-secondary: the vendored bg-primary/20 track is the fill's own
          colour. Radix gives the root no name, hence the aria-label. */}
      <Progress
        value={rate.value === null ? 0 : Math.min(rate.value, 1) * 100}
        className="bg-secondary h-1.5"
        aria-label={copy.dashboard.conversionRate}
      />
      <p className="text-meta text-muted-foreground mt-1.5">
        {rate.value === null
          ? copy.dashboard.kpiFooter.noneVisited
          : copy.dashboard.kpiFooter.conversionCaption(converted, visited)}
      </p>
    </div>
  );
}
