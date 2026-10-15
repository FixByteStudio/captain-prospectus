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
  /** Joined after the swipe: « Nouveau » (ADR-0036 › Numbers). */
  joiner: boolean;
  /** Metres from the latest reading, or null when either end has no position. */
  distanceM: number | null;
};

type Period = { from: number; to: number };

/** One prospect's day at the door: every visit of the day, joined by visit id. */
export type DoorDay = {
  prospectId: string;
  visitIds: string[];
  /** The day's latest visit's outcome. */
  outcome: VisitedStop["outcome"];
  /** The day's latest visit's time. */
  visitedAt: number;
  /** At least one visit is in the outbox and the server has not listed it. */
  pending: boolean;
};

/**
 * Today's door-days: the server's visited stops joined with this identity's
 * outbox visits by visit id, so a visit seen on both sides counts once. A visit
 * from another day never counts, and neither does another identity's. The latest
 * `visitedAt` gives the outcome. Carnet reads it too (#496).
 */
export function doorDaysToday({
  visitedStops,
  outboxVisits,
  identity,
  period,
}: {
  visitedStops: readonly VisitedStop[];
  outboxVisits: readonly StoredVisit[];
  identity: string;
  period: Period;
}): Map<string, DoorDay> {
  const mine = writtenByOrUnstamped(identity);
  const today = (at: number) => at >= period.from && at < period.to;
  const days = new Map<string, DoorDay>();

  for (const stop of visitedStops) {
    if (!today(stop.visitedAt)) continue;
    days.set(stop.prospectId, {
      prospectId: stop.prospectId,
      visitIds: [...stop.visitIds],
      outcome: stop.outcome,
      visitedAt: stop.visitedAt,
      pending: false,
    });
  }

  for (const visit of outboxVisits) {
    if (!mine(visit) || !today(visit.visitedAt)) continue;
    const day = days.get(visit.prospectId);
    if (!day) {
      days.set(visit.prospectId, {
        prospectId: visit.prospectId,
        visitIds: [visit.id],
        outcome: visit.outcome,
        visitedAt: visit.visitedAt,
        pending: true,
      });
      continue;
    }
    // The server already lists this visit: it is not pending, and not a second one.
    if (day.visitIds.includes(visit.id)) continue;
    day.visitIds.push(visit.id);
    day.pending = true;
    if (visit.visitedAt >= day.visitedAt) {
      day.outcome = visit.outcome;
      day.visitedAt = visit.visitedAt;
    }
  }

  return days;
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

/** One stop of today's tournée, wherever it is held: the last pull or the outbox. */
export type DayStop = {
  id: string;
  prospectId: string;
  number: number;
  addedAt: number;
  /** Only the server decides it, so a queued stop is never left. */
  left: boolean;
};

export type DayStops = {
  tourneeId: string;
  startedAt: number;
  stops: DayStop[];
};

type StopSources = Pick<
  TodaysStopsInput,
  "pulledTournees" | "pulledStops" | "outboxTournees" | "outboxStops" | "identity"
>;

/**
 * The stops of today's tournée: the pulled one wins, else this identity's queued
 * one. A stop still in the outbox for that tournée (a joiner not yet sent, or the
 * rest of a swipe over 250 stops) counts with the pulled ones, unless the pull
 * already holds the prospect.
 */
export function stopsOfToday(input: StopSources, period: Period): DayStops | null {
  const mine = writtenByOrUnstamped(input.identity);
  const queued = (tourneeId: string): DayStop[] =>
    input.outboxStops
      .filter((s) => s.tourneeId === tourneeId && mine(s))
      .map((s) => ({
        id: s.id,
        prospectId: s.prospectId,
        number: s.number,
        addedAt: s.addedAt,
        left: false,
      }));

  const pulled = input.pulledTournees.find((t) => t.dayStart === period.from);
  if (pulled) {
    const stops: DayStop[] = input.pulledStops.filter((s) => s.tourneeId === pulled.id);
    const held = new Set(stops.map((s) => s.prospectId));
    for (const stop of queued(pulled.id)) {
      if (!held.has(stop.prospectId)) stops.push(stop);
    }
    return { tourneeId: pulled.id, startedAt: pulled.startedAt, stops };
  }

  const own = input.outboxTournees.find(
    (t) => mine(t) && t.startedAt >= period.from && t.startedAt < period.to,
  );
  if (!own) return null;
  return { tourneeId: own.id, startedAt: own.startedAt, stops: queued(own.id) };
}

/** What the counter shows: `percent` only fills the bar. */
export type RoundProgress = { n: number; total: number; percent: number };

/**
 * The day's counter, « {n} sur {total} » (docs/design.md › Next-stop card).
 * `n` is the tournée's stops with a door-day today, each once, so a second visit
 * never moves it. `total` is the stops the server has not marked `left`, plus any
 * `left` one that still has a door-day: a visited stop is always in `total`, so
 * `n <= total`. A door-day with no stop in the tournée counts in neither.
 */
export function tourneeCounter(
  input: StopSources & {
    visitedStops: readonly VisitedStop[];
    outboxVisits: readonly StoredVisit[];
    now: number;
  },
): RoundProgress {
  const period = brusselsPeriod(input.now, 1);
  const today = stopsOfToday(input, period);
  if (!today) return { n: 0, total: 0, percent: 0 };
  const visited = doorDaysToday({ ...input, period });

  // A prospect has one stop; a `left` flag on any copy of it does not hide a visit.
  const counted = new Set<string>();
  const done = new Set<string>();
  for (const stop of today.stops) {
    if (visited.has(stop.prospectId)) {
      counted.add(stop.prospectId);
      done.add(stop.prospectId);
    } else if (!stop.left) {
      counted.add(stop.prospectId);
    }
  }
  const n = done.size;
  const total = counted.size;
  return { n, total, percent: total === 0 ? 0 : Math.round((n / total) * 100) };
}

/**
 * Today's tournée stops without a visit today, in number order. A stop whose
 * prospect the phone does not hold is not drawn: its number is simply missing.
 * Nor is a stop the server marks `left`: it leaves a gap, and nothing renumbers.
 */
export function todaysStops(input: TodaysStopsInput): TourneeItem[] {
  const period = brusselsPeriod(input.now, 1);
  const visited = doorDaysToday({
    visitedStops: input.visitedStops,
    outboxVisits: input.outboxVisits,
    identity: input.identity,
    period,
  });

  const mine = writtenByOrUnstamped(input.identity);
  const server = new Map(input.prospects.map((p) => [p.id, p]));
  const field = new Map(input.outboxProspects.filter(mine).map((p) => [p.id, p]));

  const today = stopsOfToday(input, period);
  const items: TourneeItem[] = [];
  for (const stop of today?.stops ?? []) {
    if (stop.left || visited.has(stop.prospectId)) continue;

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
      // `addedAt = startedAt` at the swipe, so only a later stop is a joiner.
      joiner: today !== null && stop.addedAt > today.startedAt,
      distanceM:
        input.point && lat !== null && lng !== null
          ? distanceMeters(input.point, { lat, lng })
          : null,
    });
  }

  return items.sort((a, b) => a.number - b.number);
}

/** One row of Carnet: a door-day, its stop's number and its latest outcome. */
export type CarnetEntry = {
  prospectId: string;
  /** The swipe's number, `left` stops included. Null for a prospect with no stop today. */
  number: number | null;
  name: string;
  type: Prospect["type"];
  address: string | null;
  outcome: VisitedStop["outcome"];
  visitedAt: number;
  /** Today's visits to this prospect, each once whichever side lists it. */
  visitCount: number;
  /** Something of this door-day is in the outbox and the server has not listed it. */
  pending: boolean;
};

/**
 * Today's door-days, newest first — docs/design.md › Carnet. Same inputs and
 * period as `tourneeCounter`, so the rows and the counter agree. A door-day whose
 * prospect no table can name is not drawn: the form could not open it either.
 * `pending` is any unsent visit of the day, not strictly the latest (Design Notes).
 */
export function carnetEntries(input: Omit<TodaysStopsInput, "point">): CarnetEntry[] {
  const period = brusselsPeriod(input.now, 1);
  const days = doorDaysToday({
    visitedStops: input.visitedStops,
    outboxVisits: input.outboxVisits,
    identity: input.identity,
    period,
  });
  if (days.size === 0) return [];

  const numbers = new Map<string, number>();
  for (const stop of stopsOfToday(input, period)?.stops ?? []) {
    if (!numbers.has(stop.prospectId)) numbers.set(stop.prospectId, stop.number);
  }
  const mine = writtenByOrUnstamped(input.identity);
  const pulled = new Map(input.visitedStops.map((s) => [s.prospectId, s]));
  const server = new Map(input.prospects.map((p) => [p.id, p]));
  const field = new Map(input.outboxProspects.filter(mine).map((p) => [p.id, p]));

  const entries: CarnetEntry[] = [];
  for (const day of days.values()) {
    const source =
      pulled.get(day.prospectId) ?? server.get(day.prospectId) ?? field.get(day.prospectId);
    if (!source) continue;
    entries.push({
      prospectId: day.prospectId,
      number: numbers.get(day.prospectId) ?? null,
      name: source.name,
      type: source.type,
      address: source.address ?? null,
      outcome: day.outcome,
      visitedAt: day.visitedAt,
      visitCount: day.visitIds.length,
      pending: day.pending,
    });
  }
  return entries.sort((a, b) => b.visitedAt - a.visitedAt);
}
