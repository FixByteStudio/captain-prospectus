/**
 * The tournée's pure rules (ADR-0036): which stops a swipe freezes, how they are
 * numbered, and whether a stop has left the agent's work. Shared so the phone and
 * the server never read the same rule two ways.
 */
import { isOpen } from "./constants";
import type { Status } from "./constants";
import { orderByNearestNext, type Point } from "./geo";
import { brusselsMidnightDaysFromNow } from "./period";
import type { FieldProspect, Prospect } from "./schemas";

/**
 * Whether a tournée stop has left the agent's work. Derived, never written: the
 * server computes it on every sync, and nothing else decides it.
 */
export type StopProspect = {
  assignedTo: string | null;
  status: Status;
  mergedInto: string | null;
};

/**
 * A visited stop never leaves: Carnet and the counter keep it, whatever the visit
 * did to the prospect. An unvisited one leaves unless it is still the agent's, open
 * and not merged.
 */
export function isStopLeft(
  prospect: StopProspect,
  agentEmail: string,
  visitedToday: boolean,
): boolean {
  if (visitedToday) return false;
  return !(
    prospect.assignedTo === agentEmail &&
    isOpen(prospect.status) &&
    prospect.mergedInto === null
  );
}

/**
 * Whether a stop joined after the swipe. The swipe writes each stop's `addedAt`
 * equal to the tournée's `startedAt` (StartScreen), both from the phone clock; a
 * joiner's is written later, so an equality needs no clock comparison.
 */
export function isJoiner(addedAt: number, startedAt: number): boolean {
  return addedAt !== startedAt;
}

/** What a swipe freezes about one prospect: enough to preview, order and number it. */
export type SnapshotProspect = {
  id: string;
  name: string;
  type: Prospect["type"];
  address: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * What the swipe freezes ([ADR-0036](../../docs/adr/0036-a-swipe-freezes-each-agents-numbered-tournee.md)):
 * the open prospects pulled for the agent, with a follow-up only once it is due
 * (before tomorrow's Brussels midnight, so one due at 16:00 today is in and one
 * due tomorrow is not; a follow-up with no date counts as due), plus the field prospects
 * still in the outbox. A prospect sitting in both, between a sync's response and
 * the outbox delete, counts once.
 */
export function snapshotProspects(
  prospects: readonly Prospect[],
  outboxProspects: readonly FieldProspect[],
  now: number,
): SnapshotProspect[] {
  const tomorrow = brusselsMidnightDaysFromNow(now, 1);
  const snapshot: SnapshotProspect[] = [];
  const seen = new Set<string>();

  for (const p of prospects) {
    if (!isOpen(p.status)) continue;
    if (p.status === "follow_up" && p.nextVisitAt !== null && p.nextVisitAt >= tomorrow) continue;
    seen.add(p.id);
    snapshot.push({
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
    });
  }
  for (const p of outboxProspects) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    snapshot.push({
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
    });
  }
  return snapshot;
}

/**
 * Number stops nearest-next from `from`, starting at `firstNumber` (unlocated
 * ones last, in input order). The swipe numbers from 1; a joiner takes the next
 * number after the highest ever given (entry 6 reuses this).
 */
export function numberStops<T extends { lat: number | null; lng: number | null }>(
  items: readonly T[],
  from: Point,
  firstNumber = 1,
): { item: T; number: number }[] {
  return orderByNearestNext(items, from).map((item, i) => ({ item, number: firstNumber + i }));
}
