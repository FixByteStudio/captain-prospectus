import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { boundParamsPerRow, getDb } from "./db/client";
import { chunk } from "../shared/chunk";
import { overpassCache } from "./db/schema";
import {
  MAP_CACHE_EVICT_BATCH,
  OVERPASS_CACHE_TTL_MS,
  PLACES_CACHE_TTL_MS,
} from "../shared/constants";
import { describeEviction, evictMapCache, readMapCache, writeMapCache } from "./map-cache";

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);
// From the imported TTLs, so a change to either keeps this test honest.
const CUTOFF = NOW - Math.max(OVERPASS_CACHE_TTL_MS, PLACES_CACHE_TTL_MS);

async function seedRows(createdAt: number, count: number): Promise<string[]> {
  const rows = Array.from({ length: count }, () => ({
    hash: crypto.randomUUID(),
    body: "{}",
    createdAt,
  }));
  const db = getDb(env.DB);
  for (const batch of chunk(rows, boundParamsPerRow(overpassCache))) {
    await db.insert(overpassCache).values(batch);
  }
  return rows.map((r) => r.hash);
}

async function remaining(): Promise<string[]> {
  const rows = await getDb(env.DB).select({ hash: overpassCache.hash }).from(overpassCache);
  return rows.map((r) => r.hash);
}

beforeEach(async () => {
  await getDb(env.DB).delete(overpassCache);
});

describe("evictMapCache", () => {
  it("cuts off at the longer of the two provider TTLs", async () => {
    const result = await evictMapCache(getDb(env.DB), NOW);
    expect(result.cutoff).toBe(CUTOFF);
  });

  it("deletes a row older than the cutoff and keeps one just inside it", async () => {
    const [expired] = await seedRows(CUTOFF - 1, 1);
    const [fresh] = await seedRows(CUTOFF + 1, 1);

    const result = await evictMapCache(getDb(env.DB), NOW);

    expect(result.evicted).toBe(1);
    const left = await remaining();
    expect(left).toContain(fresh);
    expect(left).not.toContain(expired);
  });

  it("evicts nothing on a second run the same day", async () => {
    await seedRows(CUTOFF - 1, 3);

    expect((await evictMapCache(getDb(env.DB), NOW)).evicted).toBe(3);
    expect((await evictMapCache(getDb(env.DB), NOW)).evicted).toBe(0);
  });

  it("drains a backlog one bounded batch per run", async () => {
    await seedRows(CUTOFF - 1, MAP_CACHE_EVICT_BATCH + 5);

    expect((await evictMapCache(getDb(env.DB), NOW)).evicted).toBe(MAP_CACHE_EVICT_BATCH);
    expect((await evictMapCache(getDb(env.DB), NOW)).evicted).toBe(5);
    expect(await remaining()).toEqual([]);
  });

  it("logs a count and a date, nothing from the rows", () => {
    expect(describeEviction({ evicted: 2, cutoff: CUTOFF })).toBe(
      `map cache: evicted 2 row(s) created before ${new Date(CUTOFF).toISOString()}`,
    );
  });
});

describe("readMapCache and writeMapCache", () => {
  const TTL = 60_000;
  const parse = (body: string): { body: string } | null => (body === "bad" ? null : { body });

  it("reads back what was written, with when it was cached", async () => {
    const db = getDb(env.DB);
    await writeMapCache(db, "h", "good");

    const hit = await readMapCache(db, "h", TTL, parse);

    expect(hit?.mapped).toEqual({ body: "good" });
    expect(Date.now() - (hit?.cachedAt ?? 0)).toBeLessThan(TTL);
  });

  it("misses on an unknown hash, an expired row and a body that no longer parses", async () => {
    const db = getDb(env.DB);
    await db.insert(overpassCache).values([
      { hash: "old", body: "good", createdAt: Date.now() - TTL },
      { hash: "broken", body: "bad", createdAt: Date.now() },
    ]);

    expect(await readMapCache(db, "none", TTL, parse)).toBeNull();
    expect(await readMapCache(db, "old", TTL, parse)).toBeNull();
    expect(await readMapCache(db, "broken", TTL, parse)).toBeNull();
  });

  it("refreshes an existing row rather than keeping the older answer", async () => {
    const db = getDb(env.DB);
    await db.insert(overpassCache).values({ hash: "h", body: "old", createdAt: 0 });

    await writeMapCache(db, "h", "new");

    expect((await readMapCache(db, "h", TTL, parse))?.mapped).toEqual({ body: "new" });
  });
});
