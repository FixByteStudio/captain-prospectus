/**
 * What the today list shows and in what order — docs/domains/field-operations.md.
 *
 *   - every prospect assigned to the agent with an open status;
 *   - greedy nearest-next from the phone's position, uncoordinated ones last;
 *   - future `follow_up`s held back in a separate "later" group.
 *
 * Pure, so the rules are tested without a browser or a Dexie instance.
 */
import { distanceMeters, orderByNearestNext, type Point } from "../../shared/geo";
import { brusselsPeriod } from "../../shared/period";
import type { Outcome } from "../../shared/constants";
import type { FieldProspect, Prospect } from "../../shared/schemas";
import { hasWhenStep } from "./visit-draft";

/**
 * A prospect the agent added on the ground that the server has not accepted
 * yet. It is on the list — an agent who adds a food truck must be able to visit
 * it immediately, offline, without waiting for a sync that may be hours away.
 *
 * `pending` is what the row uses to say so, and what stops the screen
 * pretending the server knows about it.
 */
export type TodayItem = {
  id: string;
  name: string;
  type: Prospect["type"];
  lat: number | null;
  lng: number | null;
  address: string | null;
  status: Prospect["status"] | null;
  nextVisitAt: number | null;
  /** When the server last recorded a visit here, or null. Read-only, server
   * data alone — the after-sync half of round-placement.md's "kept for
   * today" row. */
  lastVisitAt: number | null;
  pending: boolean;
  /** Metres from the agent, or null when either end has no position. */
  distanceM: number | null;
  /**
   * A visit for this stop is sitting in `outboxVisits`, not yet accepted.
   *
   * Read-only knowledge of the outbox: it never invents a status (invariant
   * 3), but the outcome the agent picked does place the stop before the sync
   * confirms it — leaving the round, or moving to the end of today's round or
   * to Plus tard (round-placement.md). The row also says "Pas encore envoyé"
   * until the server has it (docs/design.md).
   */
  visitQueued: boolean;
};

export type TodayList = {
  /** Walk these, in this order. */
  now: TodayItem[];
  /** Follow-ups not due yet. Visible, subordinate, not in the walking order. */
  later: TodayItem[];
};

function fromProspect(p: Prospect): TodayItem {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    lat: p.lat,
    lng: p.lng,
    address: p.address,
    status: p.status,
    nextVisitAt: p.nextVisitAt,
    lastVisitAt: p.lastVisitAt,
    pending: false,
    distanceM: null,
    visitQueued: false,
  };
}

function fromOutbox(p: FieldProspect): TodayItem {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    address: p.address ?? null,
    // No server-derived status exists for a prospect the server has not seen.
    // INVARIANT 3: the client does not invent one.
    status: null,
    nextVisitAt: null,
    lastVisitAt: null,
    pending: true,
    distanceM: null,
    visitQueued: false,
  };
}

/** A follow-up whose next visit is still in the future is not due today. */
function isLater(item: TodayItem, now: number): boolean {
  return item.status === "follow_up" && item.nextVisitAt !== null && item.nextVisitAt > now;
}

/**
 * "Kept for today" — round-placement.md's after-sync row: a `follow_up` stop
 * visited today with nothing pushing it past tomorrow stays in today's round,
 * at the end, rather than sliding into Plus tard. Reads only `status`,
 * `lastVisitAt`, `nextVisitAt` (never a queued outcome — that is the
 * before-sync column, handled separately in `buildTodayList`).
 */
function isKeptForToday(item: TodayItem, todayStart: number, tomorrowMidnight: number): boolean {
  if (item.status !== "follow_up" || item.lastVisitAt === null) return false;
  const visitedToday = item.lastVisitAt >= todayStart && item.lastVisitAt < tomorrowMidnight;
  if (!visitedToday) return false;
  return item.nextVisitAt === null || item.nextVisitAt < tomorrowMidnight;
}

/**
 * A visit sitting in the outbox, not yet accepted — the shape `buildTodayList`
 * needs to place its stop before the sync catches up (round-placement.md).
 * The latest one per prospect wins, by `visitedAt`.
 */
export type QueuedVisit = {
  prospectId: string;
  outcome: Outcome;
  followUpAt: number | null;
  visitedAt: number;
};

function latestQueuedByProspect(queued: readonly QueuedVisit[]): Map<string, QueuedVisit> {
  const latest = new Map<string, QueuedVisit>();
  for (const visit of queued) {
    const current = latest.get(visit.prospectId);
    if (!current || visit.visitedAt > current.visitedAt) latest.set(visit.prospectId, visit);
  }
  return latest;
}

function withDistance(items: TodayItem[], from: Point | null): TodayItem[] {
  if (!from) return items;
  return items.map((item) =>
    item.lat === null || item.lng === null
      ? item
      : { ...item, distanceM: distanceMeters(from, { lat: item.lat, lng: item.lng }) },
  );
}

/**
 * Build the list.
 *
 * `outbox` rows are deduplicated against `prospects` by id, because a sync that
 * has already been accepted leaves the row in both for the moment between the
 * server's response and the outbox delete.
 */
export function buildTodayList(
  prospects: readonly Prospect[],
  outbox: readonly FieldProspect[],
  from: Point | null,
  now: number,
  queued: readonly QueuedVisit[] = [],
): TodayList {
  const known = new Set(prospects.map((p) => p.id));
  const items = [
    ...prospects.map(fromProspect),
    ...outbox.filter((p) => !known.has(p.id)).map(fromOutbox),
  ];

  const latestQueued = latestQueuedByProspect(queued);
  const { from: todayStart, to: tomorrowMidnight } = brusselsPeriod(now, 1);

  const due: TodayItem[] = [];
  const keptForToday: TodayItem[] = [];
  const later: TodayItem[] = [];

  for (const raw of items) {
    const visit = latestQueued.get(raw.id);
    if (visit) {
      // Before sync: the picked outcome places the stop, ahead of the server
      // data a sync has not yet caught up with (round-placement.md). An
      // outcome with no when step (Intéressé, Converti, Pas intéressé) is
      // closed and leaves the round immediately.
      if (!hasWhenStep(visit.outcome)) continue;
      const item: TodayItem = { ...raw, visitQueued: true, nextVisitAt: visit.followUpAt };
      if (visit.followUpAt !== null && visit.followUpAt >= tomorrowMidnight) {
        later.push(item);
      } else if (visit.visitedAt >= todayStart) {
        // "End of today's round" only for a visit actually saved today — one
        // queued overnight and still unsent joins the normal order instead,
        // the same place the sync would put it once it lands.
        keptForToday.push(item);
      } else {
        due.push(item);
      }
      continue;
    }

    if (isLater(raw, now)) later.push(raw);
    else if (isKeptForToday(raw, todayStart, tomorrowMidnight)) keptForToday.push(raw);
    else due.push(raw);
  }

  const ordered = from ? orderByNearestNext(due, from) : due;
  // "End of today's round" ignores distance (round-placement.md): a stop
  // visited today, or queued for today, always sorts after every stop not
  // visited today rather than joining the nearest-next order.
  const walking = [...ordered, ...keptForToday];

  return {
    now: withDistance(walking, from),
    // The later group is sorted by when it comes due, not by distance: the
    // question it answers is "when", not "which door next".
    later: withDistance(
      later.sort((a, b) => (a.nextVisitAt ?? 0) - (b.nextVisitAt ?? 0)),
      from,
    ),
  };
}

/**
 * A link that shows the agent where the door is.
 *
 * OpenStreetMap rather than a `geo:` URI: `geo:` is an Android intent that iOS
 * Safari ignores entirely, so it would silently do nothing on half the phones
 * in use. An https link opens in whatever the agent has, and keeps the round on
 * OSM data, which is the source the map import uses too (ADR-0008).
 */
export function navigationUrl(item: Pick<TodayItem, "lat" | "lng" | "name">): string | null {
  if (item.lat === null || item.lng === null) return null;
  const lat = item.lat.toFixed(6);
  const lng = item.lng.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
}

/** The visit form for a stop — one spelling for the tap and the swipe (GH #120). */
export function visitPath(id: string): string {
  return `/tournee/${id}`;
}
