/**
 * Door-days (ADR-0036): one agent, one prospect, one Brussels day. The latest visit
 * of the day decides the outcome, so a correction replaces the earlier answer
 * while the visits themselves stay as they are. The rule lives here, once.
 */
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import type { VisitedStop } from "../shared/schemas";
import { prospects, visits } from "./db/schema";
import type { Db } from "./db/client";

/**
 * The agent's door-days on the Brussels day starting at `dayStart` (a Brussels
 * midnight), latest first. The prospect is the visit's own `prospect_id`, merged
 * or not, closed or not.
 */
export async function doorDaysOn(
  db: Db,
  { dayStart, agentEmail }: { dayStart: number; agentEmail: string },
): Promise<VisitedStop[]> {
  const rows = await db
    .select({
      id: visits.id,
      prospectId: visits.prospectId,
      outcome: visits.outcome,
      visitedAt: visits.visitedAt,
      flyerGiven: visits.flyerGiven,
      name: prospects.name,
      type: prospects.type,
      address: prospects.address,
      // Partitioned by prospect alone because the WHERE keeps one agent and one day;
      // widening the query to more agents or days must widen the partition too.
      // The latest-visit rule: visited_at, then arrival, then id as a last tiebreak.
      rank: sql<number>`row_number() over (partition by ${visits.prospectId} order by ${visits.visitedAt} desc, ${visits.receivedAt} desc, ${visits.id} desc)`,
    })
    .from(visits)
    .innerJoin(prospects, eq(prospects.id, visits.prospectId))
    .where(
      and(
        eq(visits.agentEmail, agentEmail),
        gte(visits.visitedAt, dayStart),
        lt(visits.visitedAt, brusselsMidnightDaysFromNow(dayStart, 1)),
      ),
    )
    .orderBy(asc(visits.visitedAt), asc(visits.receivedAt), asc(visits.id));

  const byProspect = new Map<string, VisitedStop>();
  for (const row of rows) {
    const existing = byProspect.get(row.prospectId);
    const stop: VisitedStop = existing ?? {
      prospectId: row.prospectId,
      outcome: row.outcome,
      visitedAt: row.visitedAt,
      flyerGiven: false,
      visitIds: [],
      name: row.name,
      type: row.type,
      address: row.address,
    };
    stop.visitIds.push(row.id);
    stop.flyerGiven ||= row.flyerGiven;
    if (row.rank === 1) {
      stop.outcome = row.outcome;
      stop.visitedAt = row.visitedAt;
    }
    byProspect.set(row.prospectId, stop);
  }
  return [...byProspect.values()].sort(
    (a, b) => b.visitedAt - a.visitedAt || a.prospectId.localeCompare(b.prospectId),
  );
}
