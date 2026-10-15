/**
 * Today's stops by their swipe numbers — ADR-0036 › Numbers, docs/design.md ›
 * Next-stop card. Pure, so Tournée and Carte read one list and the matrix is
 * testable without Dexie.
 *
 * Placement reads the outbox, never a status (invariants 2, 3): a stop with a
 * visit today leaves the moment that visit is queued, whatever its outcome.
 * Distances are information and never reorder anything.
 */
import { distanceMeters, type Point } from "../../shared/geo";
import { brusselsPeriod } from "../../shared/period";
import type { Prospect, VisitedStop } from "../../shared/schemas";
import type {
  PulledStop,
  PulledTournee,
  StoredFieldProspect,
  StoredStop,
  StoredTournee,
  StoredVisit,
} from "./db";
import { writtenByOrUnstamped } from "./outbox-stamp";

/** One stop of today's tournée, joined with its prospect. */
export type TourneeItem = {
  /** The prospect's id: the visit form's route and the outbox key on it. */
  id: string;
  /** The swipe's number. Never a position in the list. */
  number: number;
  name: string;
  type: Prospect["type"];
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** Null for a field prospect the server has not seen: no status is invented (invariant 3). */
  status: Prospect["status"] | null;
  /** A field prospect still in the outbox. */
  pending: boolean;
  /** Metres from the latest reading, or null when either end has no position. */
  distanceM: number | null;
};

type Period = { from: number; to: number };

/**
 * The prospects with at least one visit in `period`: the server's visited stops
 * unioned with this identity's outbox visits. A visit from another day never
 * counts, and neither does another identity's.
 */
export function visitedTodayIds({
  visitedStops,
  outboxVisits,
  identity,
  period,
}: {
  visitedStops: readonly VisitedStop[];
  outboxVisits: readonly StoredVisit[];
  identity: string;
  period: Period;
}): Set<string> {
  const mine = writtenByOrUnstamped(identity);
  const today = (at: number) => at >= period.from && at < period.to;
  const ids = new Set<string>();
  for (const stop of visitedStops) {
    if (today(stop.visitedAt)) ids.add(stop.prospectId);
  }
  for (const visit of outboxVisits) {
    if (mine(visit) && today(visit.visitedAt)) ids.add(visit.prospectId);
  }
  return ids;
}

export type TodaysStopsInput = {
  pulledTournees: readonly PulledTournee[];
  pulledStops: readonly PulledStop[];
  outboxTournees: readonly StoredTournee[];
  outboxStops: readonly StoredStop[];
  prospects: readonly Prospect[];
  outboxProspects: readonly StoredFieldProspect[];
  visitedStops: readonly VisitedStop[];
  outboxVisits: readonly StoredVisit[];
  identity: string;
  /** "Today" is the gate's: `brusselsPeriod(now, 1)` (`tournee-gate.ts`). */
  now: number;
  point: Point | null;
};

/** The stops of today's tournée: the pulled one wins, else this identity's queued one. */
function stopsOfToday(
  input: TodaysStopsInput,
  period: Period,
): { number: number; prospectId: string }[] {
  const pulled = input.pulledTournees.find((t) => t.dayStart === period.from);
  if (pulled) {
    return input.pulledStops.filter((s) => s.tourneeId === pulled.id);
  }
  const mine = writtenByOrUnstamped(input.identity);
  const queued = input.outboxTournees.find(
    (t) => mine(t) && t.startedAt >= period.from && t.startedAt < period.to,
  );
  if (!queued) return [];
  return input.outboxStops.filter((s) => s.tourneeId === queued.id && mine(s));
}

/**
 * Today's tournée stops without a visit today, in number order. A stop whose
 * prospect the phone does not hold is not drawn: its number is simply missing.
 */
export function todaysStops(input: TodaysStopsInput): TourneeItem[] {
  const period = brusselsPeriod(input.now, 1);
  const visited = visitedTodayIds({
    visitedStops: input.visitedStops,
    outboxVisits: input.outboxVisits,
    identity: input.identity,
    period,
  });

  const mine = writtenByOrUnstamped(input.identity);
  const server = new Map(input.prospects.map((p) => [p.id, p]));
  const field = new Map(input.outboxProspects.filter(mine).map((p) => [p.id, p]));

  const items: TourneeItem[] = [];
  for (const stop of stopsOfToday(input, period)) {
    if (visited.has(stop.prospectId)) continue;

    const known = server.get(stop.prospectId);
    const queued = known ? undefined : field.get(stop.prospectId);
    const source = known ?? queued;
    if (!source) continue;

    const lat = source.lat ?? null;
    const lng = source.lng ?? null;
    items.push({
      id: stop.prospectId,
      number: stop.number,
      name: source.name,
      type: source.type,
      address: source.address ?? null,
      lat,
      lng,
      status: known ? known.status : null,
      pending: !known,
      distanceM:
        input.point && lat !== null && lng !== null
          ? distanceMeters(input.point, { lat, lng })
          : null,
    });
  }

  return items.sort((a, b) => a.number - b.number);
}
