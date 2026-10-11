/**
 * Folds the names the migration could not (ADR-0032).
 *
 * `0014` gave every printable-ASCII name its `name_search` in SQL. An accented
 * or non-Latin name needs `foldForSearch`, which only JS can run, so the daily
 * sweep folds a bounded batch of the rows still null — and with them any row
 * the previous Worker inserted between the migration and the deploy. Until a
 * row is folded, `q` matches it the way it did before (routes/admin.ts). A row
 * the previous Worker renamed in that window is not null, so it is not seen
 * here: the ADR's consequences say how to repair one.
 */
import { and, inArray, isNull, sql } from "drizzle-orm";
import { D1_MAX_BOUND_PARAMS, NAME_SEARCH_FOLD_BATCH } from "../shared/constants";
import { chunk } from "../shared/chunk";
import { foldForSearch } from "../shared/search";
import { prospects } from "./db/schema";
import type { Db } from "./db/client";

/** Returns how many rows it folded. Idempotent: a folded row is no longer null. */
export async function foldNameSearch(db: Db): Promise<number> {
  const pending = await db
    .select({ id: prospects.id, name: prospects.name })
    .from(prospects)
    .where(isNull(prospects.nameSearch))
    .limit(NAME_SEARCH_FOLD_BATCH);

  // Each row gets its own value, so one CASE per statement: an id and a value
  // per row in the CASE, the id again in the IN list (INVARIANT 7).
  for (const batch of chunk(pending, Math.floor(D1_MAX_BOUND_PARAMS / 3))) {
    const cases = sql.join(
      batch.map((row) => sql`when ${row.id} then ${foldForSearch(row.name)}`),
      sql` `,
    );
    await db
      .update(prospects)
      .set({ nameSearch: sql`case ${prospects.id} ${cases} end` })
      .where(
        and(
          inArray(
            prospects.id,
            batch.map((row) => row.id),
          ),
          // A PATCH that renamed the row since the select has already written
          // the fold of the new name; do not put the old one back.
          isNull(prospects.nameSearch),
        ),
      );
  }
  return pending.length;
}
