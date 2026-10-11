/**
 * The map cache: both import routes read and write it here, and the daily
 * sweep's second step evicts it (ADR-0023's cron).
 *
 * `overpass_cache` holds both providers' answers (ADR-0008, ADR-0020). A reader
 * ignores a row past its provider's TTL but never deletes it, so without the
 * eviction the table only grows. Google's terms also cap caching Places content
 * (PLACES_CACHE_TTL_MS). A deleted row loses nothing: the next search for the
 * same shape fetches it again.
 */
import { eq, inArray, lt } from "drizzle-orm";
import {
  D1_MAX_BOUND_PARAMS,
  MAP_CACHE_EVICT_BATCH,
  OVERPASS_CACHE_TTL_MS,
  PLACES_CACHE_TTL_MS,
} from "../shared/constants";
import { chunk } from "../shared/chunk";
import { overpassCache } from "./db/schema";
import type { Db } from "./db/client";

/**
 * The fresh answer stored for this shape, parsed, or `null`. A row past `ttlMs`
 * is a miss. So is one that no longer parses: that is a bug in what we stored,
 * not something to hand the admin, and the route asks the provider again.
 */
export async function readMapCache<T>(
  db: Db,
  hash: string,
  ttlMs: number,
  parse: (body: string) => T | null,
): Promise<{ mapped: T; cachedAt: number } | null> {
  const [hit] = await db.select().from(overpassCache).where(eq(overpassCache.hash, hash)).limit(1);
  if (!hit || Date.now() - hit.createdAt >= ttlMs) return null;
  const mapped = parse(hit.body);
  return mapped === null ? null : { mapped, cachedAt: hit.createdAt };
}

/**
 * Upsert, not `onConflictDoNothing` (the INVARIANT 4 default): two admins
 * searching the same shape a week apart must refresh the entry, not keep
 * serving the older one until it expires. For Google, an entry never refreshed
 * makes every later search of that circle a billable miss. Replaying this is
 * still a no-op in every way the admin can observe.
 */
export async function writeMapCache(db: Db, hash: string, body: string): Promise<void> {
  const createdAt = Date.now();
  await db
    .insert(overpassCache)
    .values({ hash, body, createdAt })
    .onConflictDoUpdate({ target: overpassCache.hash, set: { body, createdAt } });
}

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
