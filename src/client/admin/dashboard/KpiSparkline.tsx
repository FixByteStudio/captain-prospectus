import { Line, LineChart, YAxis } from "recharts";
import { deltaTone, type DeltaTone } from "../../format";
import { ChartContainer, type ChartConfig } from "../../ui/chart";

/**
 * The line takes the delta chip's tone, so it never says "up" under a red
 * chip (GH #111 decision). Raw app.css tokens, as in `outcome-series.ts`.
 */
const SPARKLINE_TOKEN: Record<DeltaTone, string> = {
  up: "--success",
  down: "--destructive",
  flat: "--muted-foreground",
};

/**
 * The line's Y domain: the period's own min to max, so its shape fills the
 * 32px row as in the mockup (the bars elsewhere keep a zero baseline). A flat
 * series has no range to divide by, so it gets one either side and sits at
 * mid-height.
 */
export function sparklineDomain(byDay: readonly number[]): [number, number] {
  if (byDay.length === 0) return [-1, 1];
  const min = Math.min(...byDay);
  const max = Math.max(...byDay);
  return min === max ? [min - 1, max + 1] : [min, max];
}

/**
 * A KPI card's 32px sparkline — docs/design.md › Tableau de bord: one point
 * per day of the period, no axis, dot, tooltip or animation. Decorative: the
 * figure above it carries the value, so it is hidden from assistive tech.
 */
export function KpiSparkline({ byDay, delta }: { byDay: number[]; delta: number | null }) {
  const config = {
    value: { color: `var(${SPARKLINE_TOKEN[deltaTone(delta)]})` },
  } satisfies ChartConfig;
  const rows = byDay.map((value, day) => ({ day, value }));

  return (
    <ChartContainer config={config} className="aspect-auto h-8 w-full" aria-hidden="true">
      {/* 1px margins keep the 2px stroke inside the plot at the min and the max. */}
      <LineChart data={rows} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
        <YAxis hide domain={sparklineDomain(byDay)} />
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
