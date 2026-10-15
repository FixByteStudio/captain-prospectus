/**
 * Today's progress line — GH #119, docs/design.md's "2 portes sur 5
 * aujourd'hui" with a bar, and the union of the log and the
 * pending outbox (docs/domains/field-operations.md).
 *
 * Pure: `writtenByOrUnstamped` comes from `outbox-stamp.ts`, the one
 * definition of "mine" the outbox side shares (the two sides must agree), and
 * `db.ts` contributes types only. Not `sendableBy`: a row still `unconfirmed`
 * (docs/backlog/013) is this agent's own queued visit, not yet sendable but
 * already counted — `sendableBy`'s narrower "may go on the wire" is
 * `runSync`'s question, not this one's.
 */
import type { SentVisit, StoredVisit } from "./db";
import { writtenByOrUnstamped } from "./outbox-stamp";

export type DailyProgressValue = { n: number; total: number; percent: number };

/**
 * `n` counts doors: each prospect visited today once, however many visits it
 * got (GH #492) — a stop revisited after an À relancer "Aujourd'hui" must not
 * read as a second one, and `n` is a subset of `total`, so `n <= total`
 * always holds. The prospects come from the log unioned with the pending
 * outbox — a visit queued by an older build has no log entry, so the union
 * (not the log alone) is what still counts it. The outbox side is bound to `period`
 * the same way `todaysSentVisits` already bounds the log: without it, a
 * visit queued yesterday and still unsent this morning would count as
 * today's, and the agent's line would disagree with the admin's "Visites
 * aujourd'hui" (docs/domains/field-operations.md).
 *
 * `total` is the size of the *union* of counted prospect ids and `stops`,
 * today's unvisited tournée stops, so a stop counted in `n` is never counted
 * again and a visited stop that left `stops` still holds its place. Entry 7
 * of #496 replaces this helper with the server's counter.
 */
export function dailyProgress({
  logged,
  outboxVisits,
  identity,
  stops,
  period,
}: {
  logged: readonly SentVisit[];
  outboxVisits: readonly StoredVisit[];
  identity: string;
  stops: readonly { id: string }[];
  /** The Brussels calendar day, from `src/shared/period.ts`. */
  period: { from: number; to: number };
}): DailyProgressValue {
  const mine = writtenByOrUnstamped(identity);
  const isToday = (visitedAt: number) => visitedAt >= period.from && visitedAt < period.to;
  const countedProspectIds = new Set<string>();

  for (const row of logged) {
    if (mine(row)) countedProspectIds.add(row.prospectId);
  }
  for (const row of outboxVisits) {
    if (mine(row) && isToday(row.visitedAt)) countedProspectIds.add(row.prospectId);
  }

  const n = countedProspectIds.size;
  const total = new Set([...countedProspectIds, ...stops.map((stop) => stop.id)]).size;
  const percent = total === 0 ? 0 : Math.round((n / total) * 100);

  return { n, total, percent };
}
