import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { prospects, visits, visitsOrphaned } from "./db/schema";
import { doorDaysBetween, doorDaysOn, doorDaysTouched } from "./door-days";
import { DAY_MS, type Outcome } from "../shared/constants";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import { resetTestUsers } from "../../test/users";

/**
 * The three door-day readers (ADR-0036) on one dataset that crosses both clock
 * changes of 2026, and `doorDaysOn` on the 23 h and the 25 h day. Rows go
 * straight through Drizzle, as `dashboard.test.ts` does.
 */

const ADMIN = "admin@example.com";
const A = "agent@example.com";
const B = "second.agent@example.com";

const HOUR = 3_600_000;
const SPRING = Date.parse("2026-03-29T01:00:00.000Z");
const AUTUMN = Date.parse("2026-10-25T01:00:00.000Z");
const at = (iso: string) => Date.parse(iso);

/** Brussels midnight starting the given calendar date, from noon UTC of that date. */
const dayStartOf = (date: string) => brusselsMidnightDaysFromNow(at(`${date}T12:00:00.000Z`), 0);

/** 00:30 in Brussels on 2026-10-27, so the fixed clock sits in the first hour after midnight. */
const FAKE_NOW = at("2026-10-26T23:30:00.000Z");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FAKE_NOW);
  const db = getDb(env.DB);
  await db.delete(visits);
  await db.delete(visitsOrphaned);
  await db.delete(prospects);
  await resetTestUsers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function seedProspect(name: string): Promise<string> {
  const id = crypto.randomUUID();
  await getDb(env.DB)
    .insert(prospects)
    .values({
      id,
      name,
      type: "restaurant",
      source: "csv",
      dedupeKey: `test:${id}`,
      status: "assigned",
      assignedTo: A,
      createdBy: ADMIN,
      createdAt: 0,
      updatedAt: 0,
    });
  return id;
}

async function seedVisit(
  prospectId: string,
  agentEmail: string,
  visitedAt: number,
  outcome: Outcome,
  receivedAt = visitedAt,
  id: string = crypto.randomUUID(),
  repairedAt: number | null = null,
): Promise<void> {
  await getDb(env.DB).insert(visits).values({
    id,
    prospectId,
    agentEmail,
    visitedAt,
    clientVisitedAt: visitedAt,
    receivedAt,
    repairedAt,
    outcome,
    clientVersion: 1,
  });
}

describe("the door-day readers", () => {
  it("give the same (agent, prospect, day, latest outcome) over both clock changes", async () => {
    const p1 = await seedProspect("Un");
    const p2 = await seedProspect("Deux");
    const p3 = await seedProspect("Trois");

    // The 23 h day, 2026-03-29: a correction, then 23:30 and the next midnight.
    await seedVisit(p1, A, at("2026-03-29T08:00:00.000Z"), "no_contact");
    await seedVisit(p1, A, at("2026-03-29T09:00:00.000Z"), "interested");
    await seedVisit(p1, A, at("2026-03-29T21:30:00.000Z"), "not_interested");
    await seedVisit(p1, A, at("2026-03-29T22:30:00.000Z"), "converted"); // 00:30 on the 30th
    // The 25 h day, 2026-10-25.
    await seedVisit(p2, A, at("2026-10-24T22:30:00.000Z"), "no_contact"); // 00:30
    await seedVisit(p2, A, at("2026-10-25T22:30:00.000Z"), "interested"); // 23:30
    await seedVisit(p2, A, at("2026-10-25T23:30:00.000Z"), "converted"); // 00:30 on the 26th
    // A visited_at tie: the later arrival decides, then the greater id.
    const tie = at("2026-10-25T10:00:00.000Z");
    await seedVisit(p3, A, tie, "no_contact", tie + 5, "00000000-0000-4000-8000-000000000001");
    await seedVisit(p3, A, tie, "interested", tie + 9, "00000000-0000-4000-8000-000000000002");
    await seedVisit(p3, A, tie, "converted", tie + 9, "00000000-0000-4000-8000-000000000003");
    // Another agent on the same doors and days.
    await seedVisit(p1, B, at("2026-03-29T10:00:00.000Z"), "not_interested");
    await seedVisit(p2, B, at("2026-10-25T22:45:00.000Z"), "no_contact");

    const days = ["2026-03-29", "2026-03-30", "2026-10-24", "2026-10-25", "2026-10-26"].map(
      dayStartOf,
    );
    const expected: string[] = [];
    for (const agent of [A, B]) {
      for (const dayStart of days) {
        for (const d of await doorDaysOn(getDb(env.DB), { dayStart, agentEmail: agent })) {
          expected.push(`${agent}|${d.prospectId}|${dayStart}|${d.outcome}`);
        }
      }
    }
    expect(expected.length).toBe(7);

    // The Brussels day number of an instant, with this range's two changes.
    const offset = (t: number) => (t >= SPRING && t < AUTUMN ? 2 * HOUR : HOUR);
    const keyOfDayStart = new Map(days.map((d) => [Math.floor((d + offset(d)) / DAY_MS), d]));
    const between = await getDb(env.DB).all<{
      agent_email: string;
      prospect_id: string;
      day: number;
      outcome: Outcome;
    }>(
      sql`select agent_email, prospect_id, day, outcome from (${doorDaysBetween({
        from: at("2026-03-01T00:00:00.000Z"),
        to: at("2026-11-30T00:00:00.000Z"),
        dayKey: (t) =>
          sql`cast((${t} + case when ${t} >= ${SPRING} and ${t} < ${AUTUMN} then ${2 * HOUR} else ${HOUR} end) / ${DAY_MS} as integer)`,
      })})`,
    );
    const viaBetween = between.map(
      (r) => `${r.agent_email}|${r.prospect_id}|${keyOfDayStart.get(r.day)}|${r.outcome}`,
    );

    const touched = await doorDaysTouched(getDb(env.DB), { since: 0, limit: 100 });
    expect(touched.truncated).toBe(false);
    const viaTouched = touched.doorDays.map(
      (d) => `${d.agentEmail}|${d.prospectId}|${d.dayStart}|${d.outcome}`,
    );

    expect(viaBetween.sort()).toEqual([...expected].sort());
    expect(viaTouched.sort()).toEqual([...expected].sort());
    // The tie went to the latest arrival, then the greater id.
    expect(expected).toContain(`${A}|${p3}|${dayStartOf("2026-10-25")}|converted`);
  });
});

describe("doorDaysTouched on the feed clock (GH #528)", () => {
  const T = at("2026-10-20T10:00:00.000Z");

  it("lists a repaired visit received before the cursor, whole, with listedAt", async () => {
    const p = await seedProspect("Un");
    await seedVisit(p, A, T, "no_contact", T + 10);
    // Older on both clocks than the held visit, repaired after the cursor.
    await seedVisit(p, A, T - 1000, "interested", T - 500, crypto.randomUUID(), T + 5000);

    const cursor = T + 100;
    const feed = await doorDaysTouched(getDb(env.DB), { since: cursor, limit: 100 });
    expect(feed.doorDays).toHaveLength(1);
    const [day] = feed.doorDays;
    expect(day?.visits).toHaveLength(2);
    expect(day?.listedAt).toBe(T + 5000);
    // The « Reçue » time is still the phone's sync.
    expect(day?.receivedAt).toBe(T + 10);
    // Past the repair, nothing is left.
    const next = await doorDaysTouched(getDb(env.DB), { since: T + 5000, limit: 100 });
    expect(next.doorDays).toEqual([]);
  });

  it("seeds the newest page on the feed clock, so a fresh repair makes the cut", async () => {
    const synced = await seedProspect("Un");
    const repaired = await seedProspect("Deux");
    await seedVisit(synced, A, T, "no_contact", T);
    await seedVisit(repaired, A, T - 9000, "interested", T - 9000, crypto.randomUUID(), T + 5000);
    const feed = await doorDaysTouched(getDb(env.DB), { since: 0, limit: 1 });
    expect(feed.truncated).toBe(true);
    expect(feed.doorDays.map((d) => d.prospectId)).toEqual([repaired]);
  });

  it("equals received_at for synced visits only", async () => {
    const p = await seedProspect("Un");
    await seedVisit(p, A, T, "no_contact", T + 7);
    const [day] = (await doorDaysTouched(getDb(env.DB), { since: 0, limit: 10 })).doorDays;
    expect(day?.listedAt).toBe(day?.receivedAt);
    expect(day?.listedAt).toBe(T + 7);
  });

  it("keeps an old orphan out of a scoped window, repaired today or not", async () => {
    const p = await seedProspect("Un");
    await seedVisit(p, A, T, "no_contact", T, crypto.randomUUID(), T + 9000);
    const feed = await doorDaysTouched(getDb(env.DB), { since: 0, from: T + 1, limit: 10 });
    expect(feed.doorDays).toEqual([]);
  });

  it("takes a tie group on the feed clock whole", async () => {
    const p1 = await seedProspect("Un");
    const p2 = await seedProspect("Deux");
    const p3 = await seedProspect("Trois");
    await seedVisit(p1, A, T, "no_contact", T + 1);
    // Two repairs stamped in the same millisecond, received long before.
    await seedVisit(p2, A, T, "interested", T - 9000, crypto.randomUUID(), T + 50);
    await seedVisit(p3, A, T, "interested", T - 8000, crypto.randomUUID(), T + 50);
    const feed = await doorDaysTouched(getDb(env.DB), { since: T, limit: 2 });
    expect(feed.doorDays).toHaveLength(3);
  });
});

describe("doorDaysOn on a clock-change day", () => {
  it("includes 23:30 on the 25 h day, 2026-10-25", async () => {
    const p = await seedProspect("Tard");
    const dayStart = dayStartOf("2026-10-25");
    expect(brusselsMidnightDaysFromNow(dayStart, 1) - dayStart).toBe(25 * HOUR);
    await seedVisit(p, A, at("2026-10-25T22:30:00.000Z"), "interested");

    const stops = await doorDaysOn(getDb(env.DB), { dayStart, agentEmail: A });
    expect(stops.map((s) => s.prospectId)).toEqual([p]);
  });

  it("excludes 00:30 on the day after the 23 h day, 2026-03-30", async () => {
    const p = await seedProspect("Tôt");
    const dayStart = dayStartOf("2026-03-29");
    expect(brusselsMidnightDaysFromNow(dayStart, 1) - dayStart).toBe(23 * HOUR);
    await seedVisit(p, A, at("2026-03-29T22:30:00.000Z"), "interested");

    expect(await doorDaysOn(getDb(env.DB), { dayStart, agentEmail: A })).toEqual([]);
    const next = await doorDaysOn(getDb(env.DB), {
      dayStart: dayStartOf("2026-03-30"),
      agentEmail: A,
    });
    expect(next.map((s) => s.prospectId)).toEqual([p]);
  });
});
