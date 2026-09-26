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
      {/* 1px margins keep the 2px stroke inside the plot at 0 and at the max. */}
      <LineChart data={rows} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
        {/* From 0, so a quiet period reads low; at least 1, so all zeros sit on the baseline. */}
        <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />
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
