/**
 * The import log (ADR-0030): written from the batches the server already
 * receives, settled on read, redacted by the daily sweep.
 */
import { and, count, desc, inArray, isNotNull, lt, max, or, sum } from "drizzle-orm";
import {
  D1_MAX_BOUND_PARAMS,
  IMPORT_LOG_LIST_SIZE,
  IMPORT_LOG_SWEEP_BATCH,
  IMPORT_LOG_WINDOW,
  IMPORT_STALE_MS,
  RETENTION_MS,
} from "../shared/constants";
import { chunk } from "../shared/chunk";
import type { ImportLog, ImportLogEntry } from "../shared/schemas";
import { importBatches, imports } from "./db/schema";
import type { Db } from "./db/client";

/**
 * Both inserts in one `db.batch`, after the prospects. `onConflictDoNothing`
 * on each: the first batch of a run names the import and a re-sent batch keeps
 * its first counts (INVARIANT 4). A failure propagates so the request fails and
 * the client re-sends.
 */
export async function writeImportLog(
  db: Db,
  args: {
    log: ImportLog;
    source: string;
    createdBy: string;
    created: number;
    updated: number;
    now: number;
  },
): Promise<void> {
  const { log, source, createdBy, created, updated, now } = args;
  await db.batch([
    db
      .insert(imports)
      .values({
        id: log.importId,
        source,
        fileName: log.fileName ?? null,
        zoneVertices: log.zoneVertices ?? null,
        zoneRadiusM: log.zoneRadiusM ?? null,
        rejected: log.rejected,
        batchCount: log.batchCount,
        createdBy,
        startedAt: now,
      })
      .onConflictDoNothing(),
    db
      .insert(importBatches)
      .values({
        importId: log.importId,
        batchIndex: log.batchIndex,
        created,
        updated,
        receivedAt: now,
      })
      .onConflictDoNothing(),
  ]);
}

/**
 * The five newest settled imports among the 20 newest. Status is a function of
 * the rows and the clock; a running import is left out, and an older one is
 * never settled late into the list.
 */
export async function listImports(db: Db, now: number): Promise<ImportLogEntry[]> {
  const recent = await db
    .select()
    .from(imports)
    .orderBy(desc(imports.startedAt), desc(imports.id))
    .limit(IMPORT_LOG_WINDOW);
  if (recent.length === 0) return [];

  // At most IMPORT_LOG_WINDOW ids: well inside D1's 100 bound parameters.
  const sums = await db
    .select({
      importId: importBatches.importId,
      n: count(),
      created: sum(importBatches.created).mapWith(Number),
      updated: sum(importBatches.updated).mapWith(Number),
      newest: max(importBatches.receivedAt),
    })
    .from(importBatches)
    .where(
      inArray(
        importBatches.importId,
        recent.map((row) => row.id),
      ),
    )
    .groupBy(importBatches.importId);
  const byId = new Map(sums.map((row) => [row.importId, row]));

  const settled: ImportLogEntry[] = [];
  for (const row of recent) {
    const total = byId.get(row.id);
    const n = total?.n ?? 0;
    const complete = n >= row.batchCount;
    const stale = (total?.newest ?? row.startedAt) < now - IMPORT_STALE_MS;
    if (!complete && !stale) continue;
    settled.push({
      id: row.id,
      source: row.source,
      fileName: row.fileName,
      zoneVertices: row.zoneVertices,
      zoneRadiusM: row.zoneRadiusM,
      created: total?.created ?? 0,
      updated: total?.updated ?? 0,
      rejected: row.rejected,
      createdBy: row.createdBy,
      startedAt: row.startedAt,
      status: complete ? "done" : "interrupted",
    });
    if (settled.length === IMPORT_LOG_LIST_SIZE) break;
  }
  return settled;
}

/**
 * Null the personal parts (`created_by`, `file_name`) of imports older than
 * RETENTION_DAYS (ADR-0030, ADR-0023). Counts stay; `import_batches` holds
 * nothing personal. Idempotent: a redacted row stops matching.
 */
export async function sweepImportLog(db: Db, now: number): Promise<number> {
  const expired = await db
    .select({ id: imports.id })
    .from(imports)
    .where(
      and(
        lt(imports.startedAt, now - RETENTION_MS),
        or(isNotNull(imports.createdBy), isNotNull(imports.fileName)),
      ),
    )
    .limit(IMPORT_LOG_SWEEP_BATCH);

  const ids = expired.map((row) => row.id);
  // The two NULLs are bound parameters too (INVARIANT 7).
  for (const batch of chunk(ids, D1_MAX_BOUND_PARAMS - 2)) {
    await db
      .update(imports)
      .set({ createdBy: null, fileName: null })
      .where(inArray(imports.id, batch));
  }
  return ids.length;
}
