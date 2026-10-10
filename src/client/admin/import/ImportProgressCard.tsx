import { copy } from "../../copy";
import { Progress } from "../../ui/progress";
import { Surface } from "../Surface";

/** Whole percent for a `Progress` value; an empty run reads 0, not NaN. */
export function percentDone({ done, total }: { done: number; total: number }): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/**
 * The card that floats over Aperçu & validation's bottom bar while batches
 * run (docs/design.md › The CSV import › Running). Zone has no bottom bar, so
 * it keeps its inline bar.
 */
export function ImportProgressCard({ progress }: { progress: { done: number; total: number } }) {
  return (
    <Surface
      role="status"
      className="fixed right-6 bottom-6 z-40 w-72 max-w-[calc(100vw-3rem)] px-4 py-3 shadow-lg"
    >
      <div className="flex items-baseline justify-between gap-3">
        <strong className="font-semibold">{copy.import.runningTitle}</strong>
        <span className="text-muted-foreground tnum">
          {copy.import.runningCount(progress.done, progress.total)}
        </span>
      </div>
      <Progress
        value={percentDone(progress)}
        variant="ink"
        className="mt-2"
        aria-label={copy.import.progressLabel}
      />
    </Surface>
  );
}
