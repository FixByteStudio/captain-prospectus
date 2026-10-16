/**
 * Door-days (ADR-0036): one agent, one prospect, one Brussels day. The latest visit
 * of the day decides the outcome, so a correction replaces the earlier answer
 * while the visits themselves stay as they are. The rule lives here, once.
 */
import { and, asc, desc, eq, gt, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import type { Outcome, RefusalReason } from "../shared/constants";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import type { AdminDoorDay, VisitedStop } from "../shared/schemas";
import { prospects, visits } from "./db/schema";
import type { Db } from "./db/client";

/**
 * The latest-visit rule, once: `visited_at`, then arrival, then id as a last
 * tiebreak. Qualified as `"visits"`, which `doorDaysBetween` aliases its range
 * read to, so it holds in a join with `prospects` too (both have an `id`), and
 * in `doorDaysTouched`'s join with `json_each`.
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

/** What `doorDaysTouched` answers: the feed's rows and whether the read was cut. */
export type DoorDaysTouched = { doorDays: AdminDoorDay[]; truncated: boolean };

/**
 * The door-days the live feed lists (R13, docs/api.md › The live feed): every
 * door-day with a visit whose `received_at` is after `since` and within
 * `[from, to]`, each whole, all its visits included, oldest first.
 *
 * Three steps, so a door-day is listed whole however few of its visits the
 * bounds touch:
 * 1. The touched visits, newest arrival first, `limit + 1` so a cut is known.
 *    With `reason`, only visits that have it: a door-day whose latest visit has
 *    it has at least one.
 * 2. Each touched visit's Brussels day, in JS rather than SQL: the unscoped feed
 *    spans any number of clock changes, which `periodOffsets` cannot. `Intl` runs
 *    only when an instant leaves the day held, about twice a distinct day
 *    (INVARIANT 13).
 * 3. Every visit of those door-days in one statement, driven by `json_each` over
 *    one bound JSON array (INVARIANT 7: a chunked `IN` would need six statements
 *    for 500 door-days), each found through `visits_prospect_visited_idx`, and
 *    none received after the newest touched visit.
 *
 * The prospect is the visit's own and is not filtered on `merged_into`: the feed
 * records what agents did, so the name is the one the visit was made against.
 */
export async function doorDaysTouched(
  db: Db,
  {
    since,
    from,
    to,
    reason,
    limit,
  }: { since: number; from?: number; to?: number; reason?: RefusalReason; limit: number },
): Promise<DoorDaysTouched> {
  const filters = [
    since > 0 ? gt(visits.receivedAt, since) : undefined,
    from !== undefined ? gte(visits.receivedAt, from) : undefined,
    to !== undefined ? lte(visits.receivedAt, to) : undefined,
    reason !== undefined ? eq(visits.refusalReason, reason) : undefined,
  ].filter((f) => f !== undefined);

  const read = await db
    .select({
      agentEmail: visits.agentEmail,
      prospectId: visits.prospectId,
      visitedAt: visits.visitedAt,
      receivedAt: visits.receivedAt,
    })
    .from(visits)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(visits.receivedAt))
    .limit(limit + 1);
  const truncated = read.length > limit;
  const touched = truncated ? read.slice(0, limit) : read;
  if (touched.length === 0) return { doorDays: [], truncated };

  const days = brusselsDays(touched.map((v) => v.visitedAt));
  // Newest arrival first, so the first touched visit holds the greatest.
  const newest = touched[0]?.receivedAt ?? 0;
  const keys = new Map<string, [string, string, number, number]>();
  for (const v of touched) {
    // Set by `brusselsDays` for every instant it was given.
    const [dayStart, dayEnd] = days.get(v.visitedAt) ?? [0, 0];
    keys.set(doorDayKey(v.agentEmail, v.prospectId, dayStart), [
      v.agentEmail,
      v.prospectId,
      dayStart,
      dayEnd,
    ]);
  }

  // Aliased "visits" (the table's own name) so LATEST_VISIT_FIRST resolves here.
  const rows = await db.all<{
    id: string;
    prospect_id: string;
    prospect_name: string;
    agent_email: string;
    day_start: number;
    visited_at: number;
    received_at: number;
    outcome: Outcome;
    refusal_reason: RefusalReason | null;
    flyer_given: number;
    follow_up_at: number | null;
    notes: string | null;
    answer_count: number;
  }>(sql`
    select
      "visits"."id" as id,
      "visits"."prospect_id" as prospect_id,
      ${prospects.name} as prospect_name,
      "visits"."agent_email" as agent_email,
      json_extract(k.value, '$[2]') as day_start,
      "visits"."visited_at" as visited_at,
      "visits"."received_at" as received_at,
      "visits"."outcome" as outcome,
      "visits"."refusal_reason" as refusal_reason,
      "visits"."flyer_given" as flyer_given,
      "visits"."follow_up_at" as follow_up_at,
      "visits"."notes" as notes,
      (select count(*) from json_each("visits"."answers")) as answer_count
    from json_each(${JSON.stringify([...keys.values()])}) as k
    join ${visits}
      on "visits"."prospect_id" = json_extract(k.value, '$[1]')
      and "visits"."visited_at" >= json_extract(k.value, '$[2]')
      and "visits"."visited_at" < json_extract(k.value, '$[3]')
      and "visits"."agent_email" = json_extract(k.value, '$[0]')
      -- A visit synced after the first read waits for the next poll: it would
      -- lift the cursor past a door-day that read never touched.
      and "visits"."received_at" <= ${newest}
    join ${prospects} on ${prospects.id} = "visits"."prospect_id"
    order by ${LATEST_VISIT_FIRST}
  `);

  // Newest first, so a door-day's first row is its latest visit.
  const byKey = new Map<string, AdminDoorDay>();
  for (const row of rows) {
    const key = doorDayKey(row.agent_email, row.prospect_id, row.day_start);
    const visit = {
      id: row.id,
      visitedAt: row.visited_at,
      receivedAt: row.received_at,
      outcome: row.outcome,
      refusalReason: row.refusal_reason,
      flyerGiven: row.flyer_given === 1,
      followUpAt: row.follow_up_at,
      notes: row.notes,
      answerCount: row.answer_count,
    };
    const held = byKey.get(key);
    if (held) {
      held.visits.push(visit);
      held.flyerGiven ||= visit.flyerGiven;
      held.receivedAt = Math.max(held.receivedAt, visit.receivedAt);
      continue;
    }
    byKey.set(key, {
      key,
      prospectId: row.prospect_id,
      prospectName: row.prospect_name,
      agentEmail: row.agent_email,
      dayStart: row.day_start,
      visitedAt: visit.visitedAt,
      receivedAt: visit.receivedAt,
      outcome: visit.outcome,
      refusalReason: visit.refusalReason,
      flyerGiven: visit.flyerGiven,
      followUpAt: visit.followUpAt,
      notes: visit.notes,
      visits: [visit],
    });
  }

  const doorDays = [...byKey.values()]
    // A refusal count reads the latest visit only (R12), so the filter does too.
    .filter((d) => reason === undefined || d.refusalReason === reason)
    .sort((a, b) => b.receivedAt - a.receivedAt || a.key.localeCompare(b.key));
  for (const d of doorDays) d.visits.reverse();
  return { doorDays, truncated };
}

/** A door-day's identity on the wire (`adminDoorDaySchema.key`). */
function doorDayKey(agentEmail: string, prospectId: string, dayStart: number): string {
  return `${agentEmail}|${prospectId}|${dayStart}`;
}

/**
 * Each instant's Brussels day as `[start, end)`. Walked in order, so `Intl`
 * runs only when an instant leaves the day held.
 */
function brusselsDays(instants: readonly number[]): Map<number, [number, number]> {
  const days = new Map<number, [number, number]>();
  let day: [number, number] = [0, 0];
  for (const t of [...new Set(instants)].sort((a, b) => a - b)) {
    if (t < day[0] || t >= day[1]) {
      day = [brusselsMidnightDaysFromNow(t, 0), brusselsMidnightDaysFromNow(t, 1)];
    }
    days.set(t, day);
  }
  return days;
}
