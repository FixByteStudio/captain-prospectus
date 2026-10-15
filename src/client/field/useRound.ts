/**
 * Today's stops by their swipe numbers and the agent's position, read once here
 * and shared by Tournée du jour and Carte (epic-496 context) — a screen that
 * re-derived the stops on its own could number its pins or rows differently
 * from the other screen's, which is exactly the drift a shared hook rules out.
 */
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Point } from "../../shared/geo";
import { fieldDb } from "./db";
import {
  carnetEntries,
  todaysStops,
  tourneeCounter,
  type CarnetEntry,
  type RoundProgress,
  type TourneeItem,
} from "./tournee-stops";
import { useFieldNow } from "./field-clock";
import { useAgentPosition } from "./useAgentPosition";
import { useSyncState } from "./useSync";

const NO_PROGRESS: RoundProgress = { n: 0, total: 0, percent: 0 };

export type RoundState = {
  /** False until the tables have been read once: an empty `stops` is not "all done" yet. */
  loaded: boolean;
  /** Today's tournée stops with no visit today, in number order. */
  stops: TourneeItem[];
  /** The day's stops, visited ones included and left ones not: 0 is not « all done ». */
  total: number;
  point: Point | null;
  /** Ask again — the agent has moved, or granted permission since. */
  refresh: () => void;
  /** The tournée's counter, « {n} sur {total} »: from this one snapshot, like `stops`. */
  progress: RoundProgress;
  /** Today's door-days, newest first: Carnet's rows, from this same snapshot and clock. */
  carnet: CarnetEntry[];
  /** The field clock's "now" the stops were built with (`useFieldNow`). */
  now: number;
};

export function useRound(): RoundState {
  const { point, refresh } = useAgentPosition();
  const { identity } = useSyncState();

  // The one field clock (`field-clock.ts`), so Tournée picks the same day the gate opened on.
  const now = useFieldNow();

  // One snapshot, like `useTourneeGate`: eight separate queries would each
  // default to `[]` and flash an empty tournée between ticks.
  const stored = useLiveQuery(async () => {
    const [
      prospects,
      outboxProspects,
      pulledTournees,
      pulledStops,
      outboxTournees,
      outboxStops,
      visitedStops,
      outboxVisits,
    ] = await Promise.all([
      fieldDb.prospects.toArray(),
      fieldDb.outboxProspects.toArray(),
      fieldDb.tournees.toArray(),
      fieldDb.tourneeStops.toArray(),
      fieldDb.outboxTournees.toArray(),
      fieldDb.outboxStops.toArray(),
      fieldDb.visitedStops.toArray(),
      fieldDb.outboxVisits.toArray(),
    ]);
    return {
      prospects,
      outboxProspects,
      pulledTournees,
      pulledStops,
      outboxTournees,
      outboxStops,
      visitedStops,
      outboxVisits,
    };
  }, []);

  // Recomputed when the position or the snapshot changes. Cheap: a tournée is tens of stops.
  const stops = useMemo(
    () => (stored ? todaysStops({ ...stored, identity, now, point }) : []),
    [stored, identity, now, point],
  );

  const progress = useMemo(() => {
    if (!stored) return NO_PROGRESS;
    return tourneeCounter({ ...stored, identity, now });
  }, [stored, identity, now]);

  const carnet = useMemo(
    () => (stored ? carnetEntries({ ...stored, identity, now }) : []),
    [stored, identity, now],
  );

  return {
    stops,
    carnet,
    total: progress.total,
    progress,
    loaded: stored !== undefined,
    point,
    refresh,
    now,
  };
}
