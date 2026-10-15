/**
 * Carnet — docs/design.md › Carnet, ADR-0036 › Placement and Carnet.
 *
 * Today's door-days, newest first: what is done, where Tournée shows what is left.
 * One link per row, since reopening is the only action. The rows come from
 * `useRound`, so they share Tournée's snapshot, clock and identity and cannot
 * disagree with its counter. No count and no swipe here, on purpose.
 */
import { ChevronRightIcon, NotebookPenIcon } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Badge } from "@/ui/badge";
import { copy, OUTCOME_LABELS, TYPE_LABELS } from "../copy/field";
import { formatBrusselsTime, formatBrusselsWeekday } from "../format";
import { StopNumber } from "./StopNumber";
import { NotSyncedBadge } from "./StopRow";
import { visitPath } from "./today";
import type { CarnetEntry } from "./tournee-stops";
import { useRound } from "./useRound";

/** What the visit form leaves in the router state when it returns here. */
type CarnetState = { saved?: boolean };

export function CarnetScreen() {
  const { carnet, loaded, now } = useRound();
  const { state } = useLocation();
  const justSaved = ((state as CarnetState | null) ?? null)?.saved === true;

  return (
    <section>
      <header>
        <p className="text-overline text-muted-foreground uppercase">
          {formatBrusselsWeekday(now)}
        </p>
        <h2 className="text-title">{copy.carnet.title}</h2>
      </header>

      {justSaved && (
        <p role="status" className="text-success mt-2 text-sm">
          {copy.visit.saved}
        </p>
      )}

      {carnet.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {carnet.map((entry) => (
            <CarnetRow key={entry.prospectId} entry={entry} />
          ))}
        </ul>
      ) : (
        loaded && <EmptyCarnet />
      )}
    </section>
  );
}

function CarnetRow({ entry }: { entry: CarnetEntry }) {
  const time = formatBrusselsTime(entry.visitedAt);
  const outcome = OUTCOME_LABELS[entry.outcome];
  return (
    <li>
      <Link
        to={visitPath(entry.prospectId)}
        state={{ from: "carnet" }}
        aria-label={copy.carnet.rowLabel(entry.number, entry.name, outcome, time)}
        className="bg-card border-border flex min-h-16 items-start gap-3 rounded-xl border px-3.5 py-3"
      >
        <StopNumber number={entry.number} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold break-words">{entry.name}</p>
          <p className="text-muted-foreground text-meta break-words">
            {copy.today.meta(TYPE_LABELS[entry.type], entry.address)}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5">
            {/* Neutral on purpose (invariant 3): never the status the server derives. */}
            <Badge variant="secondary" className="mt-1 rounded-sm">
              {outcome}
            </Badge>
            <NotSyncedBadge item={entry} />
            {entry.visitCount > 1 && (
              <span className="text-muted-foreground mt-1 text-sm">
                {copy.carnet.visits(entry.visitCount)}
              </span>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          <span className="tnum text-base font-semibold">{time}</span>
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4" />
        </span>
      </Link>
    </li>
  );
}

function EmptyCarnet() {
  return (
    <article className="bg-card border-border mt-4 flex flex-col items-center rounded-xl border p-6 text-center">
      <span className="bg-secondary text-muted-foreground flex size-14 items-center justify-center rounded-full">
        <NotebookPenIcon aria-hidden="true" className="size-7" />
      </span>
      <p className="mt-3 text-base font-semibold">{copy.carnet.empty}</p>
      <p className="text-muted-foreground mt-1 text-base">{copy.carnet.emptyHint}</p>
    </article>
  );
}
