/**
 * The round — docs/design.md, "Next-stop card".
 *
 * The next stop gets a card, its own gold edge and both actions. Everything
 * after it is a quiet ledger that expands in place on tap, or slides open on
 * a swipe (GH #120) — no navigation on tap. The stops keep the numbers the swipe
 * gave them, and a stop with a visit today has left (ADR-0036).
 */
import { useState } from "react";
import { useLocation } from "react-router";
import { copy } from "../copy/field";
import { AllDoneCard } from "./AllDoneCard";
import { DailyProgress } from "./DailyProgress";
import { NextStopCard } from "./NextStopCard";
import { StopRow } from "./StopRow";
import { useRound } from "./useRound";

/**
 * What the visit form and the add-prospect form left in the router state.
 *
 * Both replace their history entry with this screen, so there is nowhere else
 * to confirm a save: without this, an agent taps « Enregistrer la visite » and
 * lands back on the round with no sign anything happened.
 */
type RoundState = { saved?: boolean; added?: boolean };

export function TodayScreen() {
  const { stops, loaded, total, progress } = useRound();
  const { state } = useLocation();
  const justSaved = (state as RoundState | null) ?? null;

  const [next, ...rest] = stops;

  // One row expanded at a time (CAP-6): expanding row 3 collapses row 2.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  return (
    <section>
      <header>
        <h2 className="text-title">{copy.today.title}</h2>
      </header>

      <DailyProgress progress={progress} />

      {justSaved?.saved && (
        <p role="status" className="text-success mt-2 text-sm">
          {copy.visit.saved}
        </p>
      )}
      {justSaved?.added && (
        <p role="status" className="text-success mt-2 text-sm">
          {copy.fieldProspect.saved}
        </p>
      )}

      {next ? (
        <div className="mt-4 md:grid md:grid-cols-5 md:gap-6">
          {/* DOM order keeps the card first; from 768px only its grid
              placement moves it to the right. self-start, or the stretched
              grid item is as tall as the list and sticky never engages. */}
          <div className="md:sticky md:top-4 md:col-span-3 md:col-start-3 md:row-start-1 md:self-start">
            <NextStopCard item={next} />
          </div>

          {rest.length > 0 && (
            <ul className="mt-4 space-y-2 md:col-span-2 md:col-start-1 md:row-start-1 md:mt-0">
              {rest.map((item) => (
                <StopRow
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        loaded && (
          <div className="mt-4">
            <AllDoneCard total={total} />
          </div>
        )
      )}
    </section>
  );
}
