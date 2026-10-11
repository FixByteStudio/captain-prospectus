/**
 * INVARIANT 3: prospect status is derived from visits, by the server.
 *
 * Three callers reach this — `POST /api/agent/sync` when a phone pushes visits,
 * the orphan repair endpoint when an admin attaches a quarantined one
 * (ADR-0022), and the dev seed. They have to agree, and the way two copies of
 * this stop agreeing is that only one of them gets fixed.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { D1_MAX_BOUND_PARAMS, OUTCOME_TO_STATUS, OUTCOMES } from "../../shared/constants";
import { prospects, visits } from "../db/schema";
import type { Db } from "../db/client";

/**
 * Parameters each statement binds besides the prospect ids: a WHEN and a THEN
 * per outcome, `updated_at`, and the rank filter. `sync.test.ts` derives a full
 * batch, so a miscount here fails there on D1's limit (INVARIANT 7).
 */
const FIXED_PARAMS = 2 * OUTCOMES.length + 2;
const PROSPECTS_PER_STATEMENT = D1_MAX_BOUND_PARAMS - FIXED_PARAMS;

/**
 * Recompute these prospects' status from their own visits.
 *
 * Only the latest visit by `visited_at` moves one, so a late-syncing older
 * visit is stored without overwriting a newer outcome (ADR-0011). `visited_at`
 * is already clamped to the server clock on insert, so a phone ahead by a week
 * cannot win this comparison for ever (INVARIANT 12). That clamp also makes
 * ties real — two visits dated ahead in one sync land on the same `visited_at`
 * — so `received_at` then `id` settle which one decides, and every caller gets
 * the same answer however often it runs.
 *
 * Nor does it overwrite a newer decision: when an admin set the status by hand
 * at or after that visit, the status and `next_visit_at` stay theirs and only
 * `last_visit_at` moves (ADR-0025). One conditional UPDATE rather than a read
 * then a write, so an admin edit landing in between cannot be lost.
 *
 * One statement per chunk of prospects, not two per prospect: a full sync names
 * up to SYNC_VISITS_PER_REQUEST of them, which was ~400 D1 round trips in one
 * request (#102, docs/free-tier-budget.md). A prospect with no visit has no
 * ranked row to join, so it is left alone.
 *
 * `now` is passed in rather than read here so every row a single request
 * touches carries the same `updated_at`, which is what makes the admin list's
 * ordering stable within one sync.
 */
export async function deriveProspectStatus(
  db: Db,
  prospectIds: Iterable<string>,
  now: number,
): Promise<void> {
  const ids = [...new Set(prospectIds)];
  for (let i = 0; i < ids.length; i += PROSPECTS_PER_STATEMENT) {
    const batch = ids.slice(i, i + PROSPECTS_PER_STATEMENT);
    const ranked = db
      .select({
        prospectId: visits.prospectId,
        outcome: visits.outcome,
        visitedAt: visits.visitedAt,
        followUpAt: visits.followUpAt,
        rank: sql<number>`row_number() over (partition by ${visits.prospectId} order by ${desc(visits.visitedAt)}, ${desc(visits.receivedAt)}, ${desc(visits.id)})`.as(
          "rank",
        ),
      })
      .from(visits)
      .where(inArray(visits.prospectId, batch))
      .as("ranked");

    const visitWins = sql`(${prospects.statusSetAt} IS NULL OR ${prospects.statusSetAt} < ${ranked.visitedAt})`;
    const outcomeStatus = sql.join(
      OUTCOMES.map((outcome) => sql`WHEN ${outcome} THEN ${OUTCOME_TO_STATUS[outcome]}`),
      sql` `,
    );

    await db
      .update(prospects)
      .set({
        status: sql`CASE WHEN ${visitWins} THEN CASE ${ranked.outcome} ${outcomeStatus} END ELSE ${prospects.status} END`,
        lastVisitAt: sql`${ranked.visitedAt}`,
        nextVisitAt: sql`CASE WHEN ${visitWins} THEN ${ranked.followUpAt} ELSE ${prospects.nextVisitAt} END`,
        updatedAt: now,
      })
      .from(ranked)
      .where(and(eq(prospects.id, ranked.prospectId), eq(ranked.rank, 1)));
  }
}
