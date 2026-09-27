/**
 * Map-cache eviction: the daily sweep's second step (ADR-0023's cron).
 *
 * `overpass_cache` holds both providers' answers (ADR-0008, ADR-0020). A reader
 * ignores a row past its provider's TTL but never deletes it, so without this
 * the table only grows. Google's terms also cap caching Places content
 * (PLACES_CACHE_TTL_MS). A deleted row loses nothing: the next search for the
 * same shape fetches it again.
 */
import { inArray, lt } from "drizzle-orm";
import {
  D1_MAX_BOUND_PARAMS,
  MAP_CACHE_EVICT_BATCH,
  OVERPASS_CACHE_TTL_MS,
  PLACES_CACHE_TTL_MS,
} from "../shared/constants";
import { chunk } from "../shared/chunk";
import { overpassCache } from "./db/schema";
import type { Db } from "./db/client";

export type EvictionResult = {
  /** Rows deleted in this run. */
  evicted: number;
  /** Rows created before this were deleted; logged so "expired" has a date. */
  cutoff: number;
};

/**
 * Delete one bounded batch of expired cache rows.
 *
 * The cutoff is the LONGER of the two TTLs, because a row does not say which
 * provider wrote it: no row either reader would still take as fresh is
 * deleted. Idempotent, since a deleted row cannot match again.
 */
export async function evictMapCache(db: Db, now: number): Promise<EvictionResult> {
  const cutoff = now - Math.max(OVERPASS_CACHE_TTL_MS, PLACES_CACHE_TTL_MS);

  // SQLite has no DELETE ... LIMIT, so the bound goes on a select first, as in
  // runRetention.
  const expired = await db
    .select({ hash: overpassCache.hash })
    .from(overpassCache)
    .where(lt(overpassCache.createdAt, cutoff))
    .limit(MAP_CACHE_EVICT_BATCH);

  const hashes = expired.map((row) => row.hash);
  for (const batch of chunk(hashes, D1_MAX_BOUND_PARAMS)) {
    await db.delete(overpassCache).where(inArray(overpassCache.hash, batch));
  }

  return { evicted: hashes.length, cutoff };
}

/** The scheduled handler's log line. It names no hash, body or coordinate. */
export function describeEviction(result: EvictionResult): string {
  return `map cache: evicted ${result.evicted} row(s) created before ${new Date(
    result.cutoff,
  ).toISOString()}`;
}
