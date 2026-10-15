/**
 * The tablet left pane, from 768px — docs/design.md, "Carte" (spec-gh-122).
 * The map's own two-pane sibling: `CarteScreen` renders this instead of
 * `CarteSheet` above that width, never both (no duplicate "Visiter" link in
 * the DOM). Reuses `NextStopCard` and `StopRow` verbatim, so the round reads
 * the same way here as it does on Tournée, in the swipe's numbers.
 */
import { useEffect, useRef } from "react";
import { copy } from "../copy/field";
import { NextStopCard } from "./NextStopCard";
import { StopRow } from "./StopRow";
import type { TourneeItem } from "./tournee-stops";

export function CarteList({
  stops,
  loaded,
  total,
  selectedId,
  onToggle,
}: {
  stops: readonly TourneeItem[];
  /** False while the tables are read: no sentence yet, not "all done". */
  loaded: boolean;
  /** The day's stops: 0 reads « Plus aucun arrêt », not « all done ». */
  total: number;
  /** `CarteScreen`'s own selection: null means "the next stop", which is
   * already open on the card — no row matches it, so none expands. */
  selectedId: string | null;
  onToggle: (id: string) => void;
}) {
  const [next, ...rest] = stops;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<HTMLUListElement | null>(null);

  // Read fresh in the effect below rather than listed as a dependency: `next`
  // and `rest` are new array/object identities on every render (`stops`
  // recomputed on a sync), and scrolling on every one of those — not just an
  // actual selection change — would fight the agent's own scroll position.
  const latestNext = useRef(next);
  const latestRest = useRef(rest);
  useEffect(() => {
    latestNext.current = next;
    latestRest.current = rest;
  });

  useEffect(() => {
    if (!selectedId) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = reduced ? "auto" : "smooth";

    if (latestNext.current?.id === selectedId) {
      cardRef.current?.scrollIntoView({ block: "nearest", behavior });
      return;
    }
    const index = latestRest.current.findIndex((item) => item.id === selectedId);
    if (index === -1) return;
    rowsRef.current?.children.item(index)?.scrollIntoView({ block: "nearest", behavior });
  }, [selectedId]);

  return (
    <section aria-label={copy.carte.listLabel} className="space-y-4 p-4">
      {!next ? (
        loaded && (
          <div className="text-muted-foreground">
            <p>{total === 0 ? copy.today.nothingLeft : copy.today.allDone}</p>
            {total > 0 && <p>{copy.today.findInCarnet}</p>}
          </div>
        )
      ) : (
        <>
          <div ref={cardRef}>
            <NextStopCard item={next} />
          </div>

          {rest.length > 0 && (
            <ul ref={rowsRef} className="space-y-2">
              {rest.map((item) => (
                <StopRow
                  key={item.id}
                  item={item}
                  expanded={selectedId === item.id}
                  onToggle={() => onToggle(item.id)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
