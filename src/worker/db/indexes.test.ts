import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import { prospects, tourneeStops, tournees, visits, visitsOrphaned } from "./schema";
import { CLIENT_VERSION } from "../../shared/constants";
import type { DuplicatesResponse } from "../../shared/schemas";
import { resetTestUsers, TEST_AGENT } from "../../../test/users";
import { only, planOf, recordingDb, scans, type Recorded } from "../../../test/query-plan";
import { workerFetch } from "../../../test/worker-fetch";

/**
 * Indexes that exist for a query plan rather than a constraint, so nothing
 * else fails when one goes missing or stops being picked.
 *
 * The statements planned are the ones the real routes prepare, recorded with
 * the values they bind, so a copy of the SQL cannot drift from the route.
 */

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

const PROSPECT = {
  type: "restaurant" as const,
  source: "csv" as const,
  status: "assigned" as const,
  createdBy: "admin@example.com",
  createdAt: 0,
  updatedAt: 0,
};

/** Noon in Brussels, clear of midnight and of a clock change. */
const NOON = Date.parse("2026-06-17T10:00:00.000Z");

async function clearTables(): Promise<void> {
  const db = getDb(env.DB);
  // Order matters: stops reference tournées and prospects, visits reference prospects.
  await db.delete(tourneeStops);
  await db.delete(tournees);
  await db.delete(visits);
  await db.delete(visitsOrphaned);
  await db.delete(prospects);
  await resetTestUsers();
}

async function seedProspects(count: number, assignedTo: string | null): Promise<string[]> {
  const ids = Array.from({ length: count }, () => crypto.randomUUID());
  await getDb(env.DB)
    .insert(prospects)
    .values(
      ids.map((id, i) => ({
        ...PROSPECT,
        id,
        name: `Chez ${i}`,
        dedupeKey: `test:${id}`,
        assignedTo,
      })),
    );
  return ids;
}

async function seedVisit(prospectId: string, visitedAt: number, receivedAt = visitedAt) {
  await getDb(env.DB).insert(visits).values({
    id: crypto.randomUUID(),
    prospectId,
    agentEmail: TEST_AGENT,
    visitedAt,
    clientVisitedAt: visitedAt,
    receivedAt,
    flyerGiven: false,
    outcome: "interested",
    clientVersion: CLIENT_VERSION,
  });
}

describe("the tournée and door-day statements at sync", () => {
  const seen: Recorded[] = [];
  const tourneeId = crypto.randomUUID();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOON);
    await clearTables();
    seen.length = 0;

    // Two assigned prospects: a swipe's stops, one visited today, so every read has a row.
    const ids = await seedProspects(2, TEST_AGENT);
    const startedAt = NOON - 60_000;
    const response = await workerFetch(
      "http://localhost/api/agent/sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientVersion: CLIENT_VERSION,
          prospects: [],
          visits: [
            {
              id: crypto.randomUUID(),
              prospectId: ids[0],
              visitedAt: NOON - 30_000,
              flyerGiven: false,
              outcome: "interested",
              answers: {},
            },
          ],
          tournees: [{ id: tourneeId, startedAt }],
          stops: ids.map((prospectId, i) => ({
            id: crypto.randomUUID(),
            tourneeId,
            prospectId,
            number: i + 1,
            addedAt: startedAt,
          })),
        }),
      },
      { DB: recordingDb(seen), DEV_USER_EMAIL: TEST_AGENT },
    );
    expect(response.status).toBe(200);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Each sync runs these on every 60 s heartbeat of every phone: none may read a
  // whole table (INVARIANT 13).
  it("finds the agent's own tournées in writeTournees by primary key", async () => {
    const plan = await planOf(only(seen, /^select "id", "day_start" from "tournees"/));
    expect(
      plan.some((d) => d.includes("SEARCH tournees USING INDEX sqlite_autoindex_tournees_1")),
    ).toBe(true);
    expect(scans(plan, "tournees")).toEqual([]);
  });

  it("finds a stop's prospect in writeTournees by primary key", async () => {
    const plan = await planOf(
      only(seen, /^select "id" from "prospects" where "prospects"."id" in/),
    );
    expect(
      plan.some((d) =>
        d.includes("SEARCH prospects USING COVERING INDEX sqlite_autoindex_prospects_1"),
      ),
    ).toBe(true);
    expect(scans(plan, "prospects")).toEqual([]);
  });

  it("reads today's tournée from tournees_agent_day_started_idx", async () => {
    const plan = await planOf(
      only(seen, /^select .* from "tournees" where .*"day_start" = \?.* order by/s),
    );
    expect(plan.some((d) => d.includes("tournees_agent_day_started_idx"))).toBe(true);
    expect(scans(plan, "tournees")).toEqual([]);
  });

  it("reads the tournée's stops from tournee_stops_tournee_number_idx", async () => {
    const plan = await planOf(only(seen, /from "tournee_stops" inner join "prospects"/));
    expect(plan.some((d) => d.includes("tournee_stops_tournee_number_idx"))).toBe(true);
    expect(scans(plan, "tournee_stops")).toEqual([]);
    expect(scans(plan, "prospects")).toEqual([]);
  });

  it("reads the door-days of the day from visits_agent_visited_idx", async () => {
    const statement = only(seen, /row_number\(\) over \(partition by "visits"."prospect_id"/);
    const plan = await planOf(statement);
    expect(plan.some((d) => d.includes("visits_agent_visited_idx"))).toBe(true);
    expect(scans(plan, "visits")).toEqual([]);
    expect(scans(plan, "prospects")).toEqual([]);
  });
});

describe("the duplicates' door-day counts", () => {
  const seen: Recorded[] = [];

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOON);
    await clearTables();
    seen.length = 0;

    // The rename case: one door, two rows, a visit on one of them.
    const [a, b] = await seedProspects(2, null);
    await getDb(env.DB)
      .update(prospects)
      .set({ lat: 50.8478, lng: 4.352 })
      .where(inArray(prospects.id, [a ?? "", b ?? ""]));
    await getDb(env.DB)
      .update(prospects)
      .set({ name: "Chez Léa" })
      .where(eq(prospects.id, a ?? ""));
    await getDb(env.DB)
      .update(prospects)
      .set({ name: "Chez Léa et Paul" })
      .where(eq(prospects.id, b ?? ""));
    await seedVisit(a ?? "", NOON - 1_000);

    const response = await workerFetch(
      "http://localhost/api/admin/prospects/duplicates",
      undefined,
      {
        DB: recordingDb(seen),
      },
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as DuplicatesResponse).pairs).toHaveLength(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads both sides' visits in one statement, from visits_prospect_visited_idx", async () => {
    const statement = only(
      seen,
      /^select "prospect_id", "agent_email", "visited_at" from "visits"/,
    );
    // One bound id per side of the pair (INVARIANT 7 caps the chunk, not this).
    expect(statement.params).toHaveLength(2);
    const plan = await planOf(statement);
    expect(plan.some((d) => d.includes("visits_prospect_visited_idx"))).toBe(true);
    expect(scans(plan, "visits")).toEqual([]);
  });
});

// Pinned as they stand on `main`. The Visites feed cursor story (#636) changes the seed and tie
// reads, and updates these tests with it; the delta poll and `json_each` plans are in admin.test.ts.
describe("the live feed's seed and tie reads", () => {
  const seen: Recorded[] = [];

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOON);
    await clearTables();
    seen.length = 0;
    // Three visits arriving in one sync: one `received_at`, so a limit of 2 cuts the group.
    for (const id of await seedProspects(3, TEST_AGENT)) await seedVisit(id, NOON - 5_000, NOON);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function feed(query: string): Promise<void> {
    const response = await workerFetch(`http://localhost/api/admin/visits${query}`, undefined, {
      DB: recordingDb(seen),
    });
    expect(response.status).toBe(200);
  }

  // A fresh tab reads the newest page: ordered by the feed clock, so
  // visits_listed_idx, never a sort of every visit ever stored.
  it("seeds the newest page from visits_listed_idx", async () => {
    await feed("?limit=2");
    const statement = only(seen, /^select .* from "visits" order by coalesce\(.*\) desc limit \?/s);
    expect(statement.params.length).toBeGreaterThan(0);
    const plan = await planOf(statement);
    expect(plan.some((d) => d.includes("visits_listed_idx"))).toBe(true);
    // An ordered walk of the index that stops at the limit, not a scan then a sort.
    expect(
      scans(plan, "visits").filter((d) => !d.includes("USING INDEX visits_listed_idx")),
    ).toEqual([]);
    expect(plan.some((d) => d.includes("USE TEMP B-TREE FOR ORDER BY"))).toBe(false);
  });

  it("takes the tie group at a cut from visits_listed_idx", async () => {
    await feed("?since=1&limit=2");
    const statement = only(seen, /^select .* from "visits" where \(.* > \? and .* = \?\)$/s);
    expect(statement.params).toContain(NOON);
    const plan = await planOf(statement);
    expect(plan.some((d) => d.includes("visits_listed_idx"))).toBe(true);
    expect(scans(plan, "visits")).toEqual([]);
  });
});
