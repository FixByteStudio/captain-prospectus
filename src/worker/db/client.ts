import { getTableColumns, getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { chunk } from "../../shared/chunk";

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

/**
 * `insert ... on conflict do nothing` of many rows, one `d1.batch`, built
 * without Drizzle's query builder (GH #449).
 *
 * The builder costs about 1 µs of Worker CPU per bound value, which made 100
 * field prospects of 23 columns ~2 ms of a sync's 10 ms (INVARIANT 13). Table
 * and column names still come from the schema, rows are the table's insert
 * type, and each value goes through its column's `mapToDriverValue`, so the
 * typing ADR-0005 wanted is kept. Use it for a hot multi-row insert only; every
 * other write stays on Drizzle (ADR-0005).
 *
 * Columns are the first row's keys, and every row must have exactly those keys,
 * else it throws before writing anything. A column absent from every row takes
 * its SQL default; an `undefined` or `null` value binds NULL. Drizzle's JS
 * defaults (`$defaultFn`, `$onUpdate`) do not run. Column names are read from
 * `column.name`, so each column must be declared with an explicit SQL name (all
 * are today). Statements hold at most 100 bound parameters (INVARIANT 7).
 */
export async function insertOrIgnore<T extends SQLiteTable>(
  d1: D1Database,
  table: T,
  rows: readonly T["$inferInsert"][],
): Promise<void> {
  const first = rows[0];
  if (!first) return;

  const columns = getTableColumns(table);
  const keys = Object.keys(first);
  for (const row of rows) {
    const rowKeys = Object.keys(row);
    const missing = keys.find((key) => !(key in row));
    const extra = rowKeys.find((key) => !(key in first));
    if (missing || extra) {
      throw new Error(
        `insertOrIgnore: rows must share the first row's keys (${missing ? `missing "${missing}"` : `extra "${extra}"`})`,
      );
    }
  }

  const columnList = keys
    .map((key) => {
      const column = columns[key];
      if (!column) throw new Error(`insertOrIgnore: "${key}" is not a column of this table`);
      return `"${column.name}"`;
    })
    .join(",");
  const tuple = `(${keys.map(() => "?").join(",")})`;
  const head = `insert into "${getTableName(table)}" (${columnList}) values `;

  const statements = chunk(rows, keys.length).map((batch) => {
    const values = batch.flatMap((row: Record<string, unknown>) =>
      keys.map((key) => {
        const value = row[key];
        // `columns[key]` was checked above.
        return value === undefined || value === null ? null : columns[key]?.mapToDriverValue(value);
      }),
    );
    return d1
      .prepare(`${head}${batch.map(() => tuple).join(",")} on conflict do nothing`)
      .bind(...values);
  });
  await d1.batch(statements);
}
