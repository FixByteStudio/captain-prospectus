/**
 * Visites précédentes — docs/design.md, "From 768px, the form sits left".
 *
 * One component in one slot per layout (spec-gh-126): under step 1 on a
 * phone, in `VisitSidePane` from 768px. Never both, so the list is never
 * rendered twice.
 */
import { copy, OUTCOME_LABELS } from "../copy/field";
import { formatDate } from "../format";
import type { VisitHistoryEntry } from "../../shared/schemas";

export function VisitHistory({
  history,
  lastVisitAt,
  className,
  headingId,
}: {
  history: readonly VisitHistoryEntry[];
  /** The cached prospect's `lastVisitAt`; null for a first visit. */
  lastVisitAt: number | null;
  className?: string;
  /** Names `VisitSidePane`'s landmark after this heading. */
  headingId?: string;
}) {
  // An empty cache for a prospect the server says was visited means this
  // device never fetched its history (offline since the round was pulled),
  // not a first visit: saying « Première visite » there would hide the notes
  // this section exists for (field-operations.md).
  const empty = lastVisitAt === null ? copy.visit.noPreviousVisits : copy.visit.historyOffline;
  return (
    <section className={className}>
      <h3 id={headingId} className="text-muted-foreground text-sm font-medium">
        {copy.visit.previousVisits}
      </h3>
      {history.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">{empty}</p>
      ) : (
        <ul className="divide-border mt-2 divide-y">
          {history.map((entry) => (
            <li key={entry.id} className="py-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground text-sm">{formatDate(entry.visitedAt)}</span>
                <span className="text-sm font-medium">{OUTCOME_LABELS[entry.outcome]}</span>
              </div>
              {/* What the last agent wrote is the reason this section exists
                  (field-operations.md): "ferme le lundi" is the difference
                  between a wasted walk and a kept appointment. */}
              {entry.notes && (
                <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
                  {entry.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
