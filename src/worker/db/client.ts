import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

export type Db = ReturnType<typeof getDb>;

/**
 * JSON is camelCase, SQL is snake_case; Drizzle maps them via `casing`.
 *
 * No `schema`: it only serves `db.query.*`, which nothing uses, and Drizzle
 * walks every table to build it on each call, twice a request (GH #341).
 */
export function getDb(d1: D1Database) {
  return drizzle(d1, { casing: "snake_case" });
}

/**
 * Bound parameters a multi-row insert uses per row, for chunk().
 *
 * Derived from the table rather than hand-counted: Drizzle binds at most one
 * parameter per column, so the column count is a safe upper bound, and a column
 * added to the schema can never silently push a statement over D1's limit of
 * 100 (INVARIANT 7).
 */
export function boundParamsPerRow(table: SQLiteTable): number {
  return Object.keys(getTableColumns(table)).length;
}
