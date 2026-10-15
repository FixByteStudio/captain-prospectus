/**
 * The day's counter and bar — docs/design.md › Next-stop card: `{n}` in display
 * size, « sur {total} » beside it, then the bar. No percentage as text.
 */
import { Progress } from "../ui/progress";
import { copy } from "../copy/field";
import type { RoundProgress } from "./tournee-stops";

export function DailyProgress({ progress }: { progress: RoundProgress }) {
  if (progress.total === 0) return null;

  return (
    <div className="mt-2">
      <p aria-hidden="true" className="tnum flex items-baseline gap-2">
        <span className="text-display">{progress.n}</span>
        <span className="text-lg font-semibold">{copy.today.progressOf(progress.total)}</span>
      </p>
      {/* The mock's track is `--secondary`; the vendored default is
          `bg-primary/20`, which is the gold fill's own colour and would
          leave the bar with no visible track. aria-label: Radix gives the
          root no accessible name of its own, and the visible text above is hidden from assistive tech
          so the count is announced once. */}
      <Progress
        value={progress.percent}
        className="bg-secondary mt-1.5"
        aria-label={copy.today.progressLabel(progress.n, progress.total)}
      />
    </div>
  );
}
