import { env } from "cloudflare:test";
import { expect } from "vitest";

/**
 * Plans the statements a route really prepared: the SQL as the code built it
 * and the values it bound, never a hand-typed copy that could drift from it.
 * Hand `recordingDb(seen)` to `workerFetch` as `{ DB }`, then plan what was seen.
 */

interface PlanRow {
  detail: string;
}

export interface Recorded {
  sql: string;
  params: unknown[];
}

/** The Worker's `env.DB`, remembering each prepared statement and what it was bound to. */
export function recordingDb(seen: Recorded[]): D1Database {
  const wrap = (entry: Recorded, real: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(real, {
      get(target, prop) {
        if (prop === "bind") {
          return (...values: unknown[]) => {
            entry.params = values;
            return wrap(entry, target.bind(...values));
          };
        }
        const value: unknown = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  return new Proxy(env.DB, {
    get(target, prop) {
      if (prop === "prepare") {
        return (sql: string) => {
          const entry: Recorded = { sql, params: [] };
          seen.push(entry);
          return wrap(entry, target.prepare(sql));
        };
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** SQLite's plan for the statement, one line per step. */
export async function planOf({ sql, params }: Recorded): Promise<string[]> {
  const { results } = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .bind(...params)
    .all<PlanRow>();
  return results.map((row) => row.detail);
}

/** The plan's steps that scan `table` whole. */
export const scans = (plan: string[], table: string) =>
  plan.filter((detail) => detail.startsWith(`SCAN ${table}`));

/** The statements matching every pattern. */
export function matching(seen: Recorded[], ...patterns: RegExp[]): Recorded[] {
  return seen.filter((s) => patterns.every((p) => p.test(s.sql)));
}

/** The one recorded statement matching every pattern. */
export function only(seen: Recorded[], ...patterns: RegExp[]): Recorded {
  const found = matching(seen, ...patterns);
  expect(found, `statements matching ${patterns.join(" and ")}`).toHaveLength(1);
  const [statement] = found;
  if (!statement) throw new Error("unreachable: length checked above");
  return statement;
}
