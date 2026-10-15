/**
 * Which prospects join today's tournée after the swipe, and with which numbers
 * (ADR-0036 › Numbers). Pure, so the matrix is testable without Dexie.
 *
 * R1's set is the swipe's own (`snapshotProspects`): a later follow-up is not a
 * joiner, and a prospect already among the stops, left ones included, never
 * joins again, so one that comes back keeps its first number.
 */
import type { Point } from "../../shared/geo";
import { TOURNEE_STOP_NUMBER_MAX } from "../../shared/constants";
import type { Prospect, TourneeStopSync } from "../../shared/schemas";
import { numberStops, snapshotProspects } from "../../shared/tournee";
import type { StoredFieldProspect } from "./db";
import { writtenByOrUnstamped } from "./outbox-stamp";

export function joinersFor({
  tournee,
  stops,
  prospects,
  outboxProspects,
  identity,
  now,
}: {
  tournee: { id: string };
  /** Every stop of the tournée, left ones and queued ones included. */
  stops: readonly { prospectId: string; number: number }[];
  prospects: readonly Prospect[];
  outboxProspects: readonly StoredFieldProspect[];
  identity: string;
  now: number;
}): TourneeStopSync[] {
  const mine = outboxProspects.filter(writtenByOrUnstamped(identity));
  const stopped = new Set(stops.map((s) => s.prospectId));
  const candidates = snapshotProspects(prospects, mine, now).filter((p) => !stopped.has(p.id));
  if (candidates.length === 0) return [];

  // A number is never reused: the highest counts the stops that left.
  const first = stops.reduce((max, s) => Math.max(max, s.number), 0) + 1;

  // Nearest-next from the last stop the phone can place; with none, by name.
  const held = new Map<string, Point>();
  for (const p of [...mine, ...prospects]) {
    if (p.lat != null && p.lng != null) held.set(p.id, { lat: p.lat, lng: p.lng });
  }
  const anchor = [...stops]
    .sort((a, b) => b.number - a.number)
    .map((s) => held.get(s.prospectId))
    .find((point) => point !== undefined);

  const numbered = anchor
    ? numberStops(candidates, anchor, first)
    : [...candidates]
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
        .map((item, i) => ({ item, number: first + i }));

  return numbered
    .filter(({ number }) => number <= TOURNEE_STOP_NUMBER_MAX)
    .map(({ item, number }) => ({
      id: crypto.randomUUID(),
      tourneeId: tournee.id,
      prospectId: item.id,
      number,
      addedAt: now,
    }));
}
