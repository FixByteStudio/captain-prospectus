import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { boundParamsPerRow, getDb } from "./db/client";
import { prospects, type NewProspectRow } from "./db/schema";
import { chunk } from "../shared/chunk";
import { NAME_SEARCH_FOLD_BATCH } from "../shared/constants";
import { foldForSearch } from "../shared/search";
import { foldNameSearch } from "./search-backfill";

/** `name_search` for rows written before it existed — ADR-0032. */

function row(id: string, name: string): NewProspectRow {
  return {
    id,
    name,
    nameSearch: null,
    type: "restaurant",
    source: "csv",
    dedupeKey: `test:${id}`,
    createdBy: "admin@example.com",
    createdAt: 1,
    updatedAt: 1,
  };
}

const NAMES = ["Le Bistrot", "Chez Paul! 100%", "Café du Port", "Le Bœuf", "Phở 75", "餃子館"];

async function stored(): Promise<Map<string, string | null>> {
  const rows = await getDb(env.DB)
    .select({ name: prospects.name, nameSearch: prospects.nameSearch })
    .from(prospects);
  return new Map(rows.map((r) => [r.name, r.nameSearch]));
}

describe("name_search backfill", () => {
  beforeEach(async () => {
    const db = getDb(env.DB);
    await db.delete(prospects);
    await db.insert(prospects).values(NAMES.map((name, i) => row(`p${i}`, name)));
  });

  it("the migration folds printable-ASCII names exactly and leaves the rest null", async () => {
    const migration = env.TEST_MIGRATIONS.find((m) => m.name.startsWith("0014_"));
    const update = migration?.queries.find((q) => q.includes("UPDATE"));
    if (!update) throw new Error("migration 0014 has no UPDATE");
    await env.DB.prepare(update).run();

    const after = await stored();
    expect(after.get("Le Bistrot")).toBe(foldForSearch("Le Bistrot"));
    expect(after.get("Chez Paul! 100%")).toBe(foldForSearch("Chez Paul! 100%"));
    for (const name of ["Café du Port", "Le Bœuf", "Phở 75", "餃子館"]) {
      expect(after.get(name)).toBeNull();
    }
  });

  it("the sweep folds every null row in JS, then has nothing left to do", async () => {
    const db = getDb(env.DB);
    expect(await foldNameSearch(db)).toBe(NAMES.length);
    const after = await stored();
    for (const name of NAMES) expect(after.get(name)).toBe(foldForSearch(name));

    expect(await foldNameSearch(db)).toBe(0);
  });

  it("never overwrites a row that already has its fold", async () => {
    const db = getDb(env.DB);
    await db.update(prospects).set({ nameSearch: "renamed" }).where(eq(prospects.id, "p2"));
    await foldNameSearch(db);
    expect((await stored()).get("Café du Port")).toBe("renamed");
  });

  it("is bounded per run", async () => {
    const db = getDb(env.DB);
    await db.delete(prospects);
    const rows = Array.from({ length: NAME_SEARCH_FOLD_BATCH + 10 }, (_, i) =>
      row(`bulk-${i}`, `Café ${i}`),
    );
    for (const batch of chunk(rows, boundParamsPerRow(prospects))) {
      await db.insert(prospects).values(batch);
    }
    expect(await foldNameSearch(db)).toBe(NAME_SEARCH_FOLD_BATCH);
    expect(await foldNameSearch(db)).toBe(10);
    expect(await foldNameSearch(db)).toBe(0);
  });
});
