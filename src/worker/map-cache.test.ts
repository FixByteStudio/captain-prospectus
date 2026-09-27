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
import { describeEviction, evictMapCache } from "./map-cache";

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
