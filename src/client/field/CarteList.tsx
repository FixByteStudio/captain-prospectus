/**
 * The tablet left pane, from 768px — docs/design.md, "Carte" (spec-gh-122).
 * The map's own two-pane sibling: `CarteScreen` renders this instead of
 * `CarteSheet` above that width, never both (no duplicate "Visiter" link in
 * the DOM). Reuses `NextStopCard` and `StopRow` verbatim, so the round reads
 * the same way here as it does on Tournée.
 *
 * "Plus tard" is not listed: a follow-up not yet due has no pin and is not
 * walkable from Carte either (docs/design.md, "Plus tard").
 */
import { useEffect, useRef } from "react";
import { copy } from "../copy/field";
import { NextStopCard } from "./NextStopCard";
import { StopRow } from "./StopRow";
import type { TodayList } from "../../shared/today";

export function CarteList({
  list,
  selectedId,
  onToggle,
}: {
  list: TodayList;
  /** `CarteScreen`'s own selection: null means "the next stop", which is
   * already open on the card — no row matches it, so none expands. */
  selectedId: string | null;
  onToggle: (id: string) => void;
}) {
  const [next, ...rest] = list.now;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<HTMLUListElement | null>(null);

  // Read fresh in the effect below rather than listed as a dependency: `next`
  // and `rest` are new array/object identities on every render (`list.now`
  // reshuffling on a sync), and scrolling on every one of those — not just an
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
        <p className="text-muted-foreground">{copy.today.empty}</p>
      ) : (
        <>
          <div ref={cardRef}>
            <NextStopCard item={next} />
          </div>

          {rest.length > 0 && (
            <ul ref={rowsRef} className="space-y-2">
              {rest.map((item, i) => (
                <StopRow
                  key={item.id}
                  item={item}
                  index={i + 2}
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
