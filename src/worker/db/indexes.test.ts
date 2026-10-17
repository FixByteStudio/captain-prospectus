import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workerFetch } from "../../../test/worker-fetch";

/**
 * Indexes that exist for a query plan rather than a constraint, so nothing
 * else fails when one goes missing or stops being picked.
 *
 * The statements planned are the ones the real routes prepare, recorded with
 * the values they bind, so a copy of the SQL cannot drift from the route.
 */

interface PlanRow {
  detail: string;
}

interface Recorded {
  sql: string;
  params: unknown[];
}

/** The Worker's `env.DB`, remembering each prepared statement and what it was bound to. */
function recordingDb(seen: Recorded[]): D1Database {
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

async function planOf({ sql, params }: Recorded): Promise<string[]> {
  const { results } = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .bind(...params)
    .all<PlanRow>();
  return results.map((row) => row.detail);
}

const scans = (plan: string[], table: string) =>
  plan.filter((detail) => detail.startsWith(`SCAN ${table}`));

/** The one recorded statement matching every pattern. */
function only(seen: Recorded[], ...patterns: RegExp[]): Recorded {
  const found = seen.filter((s) => patterns.every((p) => p.test(s.sql)));
  expect(found, `statements matching ${patterns.join(" and ")}`).toHaveLength(1);
  const [statement] = found;
  if (!statement) throw new Error("unreachable: length checked above");
  return statement;
}

describe("the dashboard's statements", () => {
  const seen: Recorded[] = [];

  beforeEach(async () => {
    // Noon in Brussels, clear of midnight and of a clock change.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-06-17T10:00:00.000Z"));
    seen.length = 0;
    const response = await workerFetch(
      "http://localhost/api/admin/dashboard?period=90",
      undefined,
      {
        DB: recordingDb(seen),
      },
    );
    expect(response.status).toBe(200);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The dashboard counts visits over up to 90 days by visited_at; a table scan
  // there would not fit the 10 ms CPU budget (server-gaps G2, INVARIANT 13).
  it("serves Convertis' two branches from an index", async () => {
    const statement = only(seen, /count\(distinct case when in_current = 1 and is_conversion = 1/);
    expect(statement.params.length).toBeGreaterThan(0);
    const plan = await planOf(statement);

    expect(plan.some((detail) => detail.includes("visits_visited_idx"))).toBe(true);
    expect(plan.some((detail) => detail.includes("prospects_status_idx"))).toBe(true);
    expect(scans(plan, "visits")).toEqual([]);
    expect(scans(plan, "prospects")).toEqual([]);
  });

  it("serves Visites dans le temps from visits_visited_idx", async () => {
    const statement = only(seen, /group by day, outcome/);
    expect(statement.params.length).toBeGreaterThan(0);
    const plan = await planOf(statement);

    expect(plan.some((detail) => detail.includes("visits_visited_idx"))).toBe(true);
    expect(scans(plan, "visits")).toEqual([]);
  });

  // Polled every 15 s by the recap card: it must probe the (agent, day)
  // index per active user, never scan every tournée ever stored.
  it("serves agentsStartedOn from tournees_agent_day_started_idx", async () => {
    const statement = only(seen, /exists \(select 1 from "tournees"/);
    expect(statement.params.length).toBeGreaterThan(0);
    const plan = await planOf(statement);

    expect(plan.some((detail) => detail.includes("tournees_agent_day_started_idx"))).toBe(true);
    expect(scans(plan, "tournees")).toEqual([]);
  });
});
