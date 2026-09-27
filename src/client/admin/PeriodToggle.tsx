import { DASHBOARD_PERIODS, type DashboardPeriod } from "../../shared/constants";
import { copy } from "../copy";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

function isPeriod(value: number): value is DashboardPeriod {
  return (DASHBOARD_PERIODS as readonly number[]).includes(value);
}

/**
 * The 7/30/90 segmented selector — docs/design.md › Tableau de bord, extracted
 * (GH #178) so Visites reuses the same look and the same "" guard rather than
 * a second control that could drift from it.
 *
 * A `ToggleGroup` on a `secondary` track, the chosen period lifted onto `card`
 * with a shadow: a segmented control, not a gold fill. Radix sends `""` when
 * the pressed item is pressed again; a period is never unset, so that press
 * does nothing.
 */
export function PeriodToggle({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={String(value)}
      onValueChange={(next) => {
        const parsed = Number(next);
        if (next !== "" && isPeriod(parsed)) onChange(parsed);
      }}
      aria-label={copy.dashboard.periodLabel}
      className="bg-secondary rounded-lg p-0.5"
    >
      {DASHBOARD_PERIODS.map((p) => (
        <ToggleGroupItem
          key={p}
          value={String(p)}
          className="text-muted-foreground hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground rounded-md px-3 first:rounded-md last:rounded-md hover:bg-transparent data-[state=on]:shadow-sm"
        >
          {copy.dashboard.periods[p]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
