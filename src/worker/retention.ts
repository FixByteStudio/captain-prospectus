/**
 * Retention sweep — ADR-0023.
 *
 * Keeps every visit for ever and drops its personal parts after
 * RETENTION_DAYS: `lat`, `lng` and `notes` become NULL, while the date, the
 * outcome, the agent, the flyer, the follow-up and the answers stay. The fact
 * of a visit is business history; where the agent was standing is not.
 *
 * This is the one thing in the app that writes to `visits`, which is otherwise
 * append-only. The amended rule is narrow and worth stating in full: nothing
 * updates or deletes a row in `visits` except this sweep, and this sweep only
 * ever nulls those three columns. No row is removed, no outcome is rewritten,
 * and nothing sync or the derived status depends on is touched — so idempotent
 * replay (INVARIANT 4) and server-derived status (INVARIANT 3) are unaffected.
 */
import { and, inArray, isNotNull, lt, or } from "drizzle-orm";
import { D1_MAX_BOUND_PARAMS, RETENTION_BATCH, RETENTION_MS } from "../shared/constants";
import { chunk } from "../shared/chunk";
import { visits } from "./db/schema";
import { sweepAgentPositions } from "./agent-position";
import { sweepImportLog } from "./import-log";
import { sweepAuthRows, type AuthSweepCounts } from "./auth-sweep";
import type { Db } from "./db/client";

export type SweepResult = {
  /** Rows redacted in this run. */
  redacted: number;
  /** Cutoff used, so a log line says what "old" meant on the day it ran. */
  cutoff: number;
  /** Agent positions deleted (ADR-0028); counts only, never coordinates. */
  positionsDeleted: number;
  /** Import-log rows whose created_by and file_name were nulled (ADR-0030). */
  importsRedacted: number;
} & AuthSweepCounts;

/**
 * Redact one bounded batch of expired visits.
 *
 * Idempotent by construction: a redacted row has no non-null personal field
 * left, so it stops matching and a second run the same day is a no-op. That is
 * also what lets a backlog drain a batch per run instead of needing a one-off
 * migration.
 *
 * `now` is injected so a test can place the cutoff without sleeping.
 */
export async function runRetention(db: Db, now: number): Promise<SweepResult> {
  const cutoff = now - RETENTION_MS;

  // Its own try/catch: a failed position sweep must not stop the visit redaction,
  // and the read path serves a stale row as null anyway (ADR-0028).
  let positionsDeleted = 0;
  try {
    positionsDeleted = await sweepAgentPositions(db, now);
  } catch (err) {
    console.error("agent position sweep failed", err instanceof Error ? err.name : "unknown");
  }

  // Its own try/catch too: a failed import-log sweep must not stop visit redaction.
  let importsRedacted = 0;
  try {
    importsRedacted = await sweepImportLog(db, now);
  } catch (err) {
    console.error("import log sweep failed", err instanceof Error ? err.name : "unknown");
  }

  // Never throws: sweepAuthRows guards each table itself (CAP-10).
  const auth = await sweepAuthRows(db, now);

  // SQLite has no UPDATE ... LIMIT, so the bound goes on a select of ids first.
  // That also makes the returned count the count actually written.
  const expired = await db
    .select({ id: visits.id })
    .from(visits)
    .where(
      and(
        lt(visits.receivedAt, cutoff),
        // Already-redacted rows must not rematch, or the sweep would rewrite
        // the same batch every day and never reach the backlog behind it. D1
        // bills rows written.
        or(isNotNull(visits.lat), isNotNull(visits.lng), isNotNull(visits.notes)),
      ),
    )
    .limit(RETENTION_BATCH);

  if (expired.length === 0)
    return { redacted: 0, cutoff, positionsDeleted, importsRedacted, ...auth };

  // One bound parameter per id plus the three NULLs, so the batch is chunked
  // to fit D1's limit of 100 (INVARIANT 7). RETENTION_BATCH is deliberately
  // larger than that: the cap that matters is rows written per run, not per
  // statement.
  const ids = expired.map((v) => v.id);
  for (const batch of chunk(ids, D1_MAX_BOUND_PARAMS - 3)) {
    await db
      .update(visits)
      .set({ lat: null, lng: null, notes: null })
      .where(inArray(visits.id, batch));
  }

  return { redacted: ids.length, cutoff, positionsDeleted, importsRedacted, ...auth };
}

/** The line the scheduled handler logs, so a silent cron is a visible gap. */
export function describeSweep(result: SweepResult): string {
  return `retention: redacted ${result.redacted} visit(s) received before ${new Date(
    result.cutoff,
  ).toISOString()}; deleted ${result.positionsDeleted} agent position(s), ${result.loginCodesDeleted} login code(s), ${result.sessionsDeleted} session(s), ${result.loginAttemptsDeleted} login attempt(s); redacted ${result.importsRedacted} import log row(s)`;
}
