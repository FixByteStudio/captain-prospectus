/**
 * Door-days (ADR-0036): one agent, one prospect, one Brussels day. The latest visit
 * of the day decides the outcome, so a correction replaces the earlier answer
 * while the visits themselves stay as they are. The rule lives here, once.
 */
import { and, asc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import type { VisitedStop } from "../shared/schemas";
import { prospects, visits } from "./db/schema";
import type { Db } from "./db/client";

/**
 * The latest-visit rule, once: `visited_at`, then arrival, then id as a last
 * tiebreak. Qualified as `"visits"`, which `doorDaysBetween` aliases its range
 * read to, so it holds in a join with `prospects` too (both have an `id`).
 */
const LATEST_VISIT_FIRST = sql`${visits.visitedAt} desc, ${visits.receivedAt} desc, ${visits.id} desc`;

/**
 * The door-days of every agent over `[from, to)` as a subquery body (no
 * parentheses; callers write `from (${doorDaysBetween(...)})`), one row each:
 * `agent_email, prospect_id, day, outcome, visited_at, refusal_reason,
 * flyer_given, visit_count`. `outcome`, `visited_at` and `refusal_reason` are
 * the latest visit's (so a correction replaces the answer, refusal reason
 * included), `flyer_given` is 1 if any visit of the day gave one.
 *
 * `dayKey` turns the instant column it is given into the day's number, in the
 * caller's key space: a day is a day however long (23 or 25 h on a clock change),
 * and the caller knows its period's offsets (`periodOffsets` allows one change
 * per period). The range read is served by `visits_visited_idx`. The prospect
 * is the visit's own, never folded to its survivor: a figure that folds does it
 * on top of this. Quarantined visits live in another table, so they are out.
 */
export function doorDaysBetween({
  from,
  to,
  dayKey,
}: {
  from: number;
  to: number;
  dayKey: (instant: SQL) => SQL;
}): SQL {
  // The inner read is aliased "visits" so LATEST_VISIT_FIRST resolves in it,
  // and carries `day` so the windows partition by a column, not an expression.
  const part = sql`partition by ${visits.agentEmail}, ${visits.prospectId}, "visits"."day"`;
  return sql`
    select agent_email, prospect_id, day, outcome, visited_at, refusal_reason, flyer_given, visit_count
    from (
      select
        ${visits.agentEmail} as agent_email,
        ${visits.prospectId} as prospect_id,
        "visits"."day" as day,
        ${visits.outcome} as outcome,
        ${visits.visitedAt} as visited_at,
        ${visits.refusalReason} as refusal_reason,
        max(${visits.flyerGiven}) over (${part}) as flyer_given,
        count(*) over (${part}) as visit_count,
        row_number() over (${part} order by ${LATEST_VISIT_FIRST}) as rnk
      from (
        select id, agent_email, prospect_id, outcome, visited_at, received_at, refusal_reason, flyer_given,
          ${dayKey(sql`visited_at`)} as day
        from ${visits}
        where visited_at >= ${from} and visited_at < ${to}
      ) as ${visits}
    )
    where rnk = 1
  `;
}

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
      // widening the query to more agents or days must widen the partition too
      // (`doorDaysBetween` is the wide one).
      rank: sql<number>`row_number() over (partition by ${visits.prospectId} order by ${LATEST_VISIT_FIRST})`,
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
