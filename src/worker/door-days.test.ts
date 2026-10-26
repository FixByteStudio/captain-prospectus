import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { prospects, visits, visitsOrphaned } from "./db/schema";
import { doorDayCounts, doorDaysBetween, doorDaysOn, doorDaysTouched } from "./door-days";
import { periodDays, twoPeriodsDayKey } from "./routes/admin";
import type { Outcome, RefusalReason } from "../shared/constants";
import { brusselsMidnightDaysFromNow, brusselsPeriod } from "../shared/period";
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
// The two clock changes of 2026, both at 01:00 UTC.
const SPRING = Date.parse("2026-03-29T01:00:00.000Z");
const AUTUMN = Date.parse("2026-10-25T01:00:00.000Z");
const MINUTE = 60_000;
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
  refusalReason: RefusalReason | null = null,
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
    refusalReason,
    clientVersion: 1,
  });
}

/**
 * The dataset the three readers and `doorDayCounts` must agree on: both clock
 * changes of 2026, a correction, a tie, two agents, and visits within an hour
 * either side of each change.
 */
async function seedClockChangeDataset() {
  const p1 = await seedProspect("Un");
  const p2 = await seedProspect("Deux");
  const p3 = await seedProspect("Trois");
  const p4 = await seedProspect("Quatre");
  const p5 = await seedProspect("Cinq");

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
  // Within an hour either side of each change (01:00 UTC, 02:00 or 03:00 in Brussels,
  // so far from midnight): one door-day per change, the latest visit deciding,
  // whichever side of the change it fell on. A day boundary near the change is
  // p1's and p2's, at 22:30 and 23:30 UTC.
  const around = async (prospect: string, change: number, outcomes: Outcome[]) => {
    const offsets = [-55, -5, 5, 55];
    for (const [i, outcome] of outcomes.entries()) {
      await seedVisit(prospect, A, change + (offsets[i] ?? 0) * MINUTE, outcome);
    }
  };
  await around(p4, SPRING, ["no_contact", "follow_up", "interested", "converted"]);
  await around(p5, AUTUMN, ["no_contact", "follow_up", "interested", "not_interested"]);
  return { p1, p2, p3, p4, p5 };
}

const DAYS = ["2026-03-29", "2026-03-30", "2026-10-24", "2026-10-25", "2026-10-26"].map(dayStartOf);

/** Every (agent, prospect, day, latest outcome) the day-by-day reader finds. */
async function doorDaysByDay(): Promise<string[]> {
  const found: string[] = [];
  for (const agent of [A, B]) {
    for (const dayStart of DAYS) {
      for (const d of await doorDaysOn(getDb(env.DB), { dayStart, agentEmail: agent })) {
        found.push(`${agent}|${d.prospectId}|${dayStart}|${d.outcome}`);
      }
    }
  }
  return found;
}

describe("the door-day readers", () => {
  // The period the dashboard would hold at the fixed clock: its two halves each
  // carry one clock change (`periodOffsets` allows one per half), the spring one
  // in the previous period and the autumn one in the current.
  const PERIOD = 110;
  const { from, to, previousFrom } = brusselsPeriod(FAKE_NOW, PERIOD);
  /** A key of the production day builders back to the Brussels midnight it names. */
  const dayStartOfKey = (key: number) => brusselsMidnightDaysFromNow(from, key);

  type Between = { agent_email: string; prospect_id: string; day: number; outcome: Outcome };
  const line = (r: Between) =>
    `${r.agent_email}|${r.prospect_id}|${dayStartOfKey(r.day)}|${r.outcome}`;

  it("give the same (agent, prospect, day, latest outcome) over both clock changes", async () => {
    await seedClockChangeDataset();
    // Every seeded day is inside the period under test, or the keys below would not map back.
    expect(previousFrom).toBeLessThan(DAYS[0] ?? 0);
    expect(DAYS[4] ?? 0).toBeLessThan(to);

    const expected = await doorDaysByDay();
    expect(expected.length).toBe(9);

    // The dashboard's own key builder, over both periods at once.
    const between = await getDb(env.DB).all<Between>(
      sql`select agent_email, prospect_id, day, outcome from (${doorDaysBetween({
        from: previousFrom,
        to,
        dayKey: twoPeriodsDayKey({ from, to, previousFrom }, PERIOD),
      })})`,
    );
    const viaBetween = between.map(line);

    // The single-period builder (`periodDays`), over the current period alone.
    const days = periodDays(from, to, PERIOD);
    const current = await getDb(env.DB).all<Between>(
      sql`select agent_email, prospect_id, day, outcome from (${doorDaysBetween({
        from,
        to,
        dayKey: days.dayOf,
      })})`,
    );

    const touched = await doorDaysTouched(getDb(env.DB), { since: 0, limit: 100 });
    expect(touched.truncated).toBe(false);
    const viaTouched = touched.doorDays.map(
      (d) => `${d.agentEmail}|${d.prospectId}|${d.dayStart}|${d.outcome}`,
    );

    expect(viaBetween.sort()).toEqual([...expected].sort());
    expect(viaTouched.sort()).toEqual([...expected].sort());
    expect(current.map(line).sort()).toEqual(
      expected.filter((e) => Number(e.split("|")[2]) >= from).sort(),
    );
  });

  it("find the tie on a visited_at to the latest arrival, then the greater id", async () => {
    const { p3 } = await seedClockChangeDataset();
    expect(await doorDaysByDay()).toContain(`${A}|${p3}|${dayStartOf("2026-10-25")}|converted`);
  });

  it("keep visits within an hour of a clock change in one door-day, the latest deciding", async () => {
    const { p4, p5 } = await seedClockChangeDataset();
    const found = await doorDaysByDay();
    expect(found).toContain(`${A}|${p4}|${dayStartOf("2026-03-29")}|converted`);
    expect(found).toContain(`${A}|${p5}|${dayStartOf("2026-10-25")}|not_interested`);
    // One door-day each, however far the change fell between their visits.
    expect(found.filter((l) => l.includes(`|${p4}|`))).toHaveLength(1);
    expect(found.filter((l) => l.includes(`|${p5}|`))).toHaveLength(1);
  });

  it("give doorDayCounts the same door-days per prospect", async () => {
    const ids = await seedClockChangeDataset();
    const perProspect = new Map<string, number>();
    for (const l of await doorDaysByDay()) {
      const prospect = l.split("|")[1] ?? "";
      perProspect.set(prospect, (perProspect.get(prospect) ?? 0) + 1);
    }

    const counts = await doorDayCounts(getDb(env.DB), Object.values(ids));
    expect(Object.fromEntries(counts)).toEqual(Object.fromEntries(perProspect));
    // p1: A on the 29th and the 30th, B on the 29th.
    expect(counts.get(ids.p1)).toBe(3);
  });
});

describe("doorDayCounts on a clock-change day", () => {
  it("counts 00:30 and 23:30 on the 25 h day as one door-day, and 00:30 the next as a second", async () => {
    const p = await seedProspect("Tard");
    await seedVisit(p, A, at("2026-10-24T22:30:00.000Z"), "no_contact"); // 00:30 on the 25th
    await seedVisit(p, A, at("2026-10-25T22:30:00.000Z"), "interested"); // 23:30, 24 h later
    expect((await doorDayCounts(getDb(env.DB), [p])).get(p)).toBe(1);

    await seedVisit(p, A, at("2026-10-25T23:30:00.000Z"), "converted"); // 00:30 on the 26th
    expect((await doorDayCounts(getDb(env.DB), [p])).get(p)).toBe(2);
  });

  it("counts 00:30 and 23:30 on the 23 h day as one door-day, and 00:30 the next as a second", async () => {
    const p = await seedProspect("Tôt");
    await seedVisit(p, A, at("2026-03-28T23:30:00.000Z"), "no_contact"); // 00:30 on the 29th
    await seedVisit(p, A, at("2026-03-29T21:30:00.000Z"), "interested"); // 23:30, 22 h later
    expect((await doorDayCounts(getDb(env.DB), [p])).get(p)).toBe(1);

    await seedVisit(p, A, at("2026-03-29T22:30:00.000Z"), "converted"); // 00:30 on the 30th
    expect((await doorDayCounts(getDb(env.DB), [p])).get(p)).toBe(2);
  });

  it("counts an agent's two days and another agent's one day apart, and a prospect with none as absent", async () => {
    const p = await seedProspect("Un");
    const none = await seedProspect("Deux");
    await seedVisit(p, A, at("2026-10-25T10:00:00.000Z"), "no_contact");
    await seedVisit(p, B, at("2026-10-25T10:00:00.000Z"), "no_contact");
    const counts = await doorDayCounts(getDb(env.DB), [p, none, p]);
    expect(counts.get(p)).toBe(2);
    expect(counts.has(none)).toBe(false);
  });
});

describe("doorDaysTouched on the insertion cursor (GH #528, #540, #636)", () => {
  const T = at("2026-10-20T10:00:00.000Z");
  const prospectsOf = (feed: { doorDays: { prospectId: string }[] }) =>
    feed.doorDays.map((d) => d.prospectId);

  it("lists a sync that stamped early and committed late, after a poll moved past its stamp", async () => {
    const s1 = await seedProspect("S1");
    const s2 = await seedProspect("S2");
    // S2 stamped 1200 and commits at 1300, S1 stamped 1000 and commits at 1800: rows go in
    // in commit order, each with the clock its request started on.
    await seedVisit(s2, A, T + 1200, "no_contact", T + 1200);
    const first = await doorDaysTouched(getDb(env.DB), { since: 0, limit: 100 });
    expect(prospectsOf(first)).toEqual([s2]);

    await seedVisit(s1, A, T + 1000, "no_contact", T + 1000);
    const second = await doorDaysTouched(getDb(env.DB), { since: first.nextSince, limit: 100 });
    expect(prospectsOf(second)).toEqual([s1]);

    const third = await doorDaysTouched(getDb(env.DB), { since: second.nextSince, limit: 100 });
    expect(third.doorDays).toEqual([]);
    // Nothing read: the cursor stays where it was.
    expect(third.nextSince).toBe(second.nextSince);
  });

  it("lists a repaired visit received before the cursor, whole, with listedAt", async () => {
    const p = await seedProspect("Un");
    await seedVisit(p, A, T, "no_contact", T + 10);
    const held = await doorDaysTouched(getDb(env.DB), { since: 0, limit: 100 });
    // Older on both clocks than the held visit, repaired (inserted) after the cursor.
    await seedVisit(p, A, T - 1000, "interested", T - 500, crypto.randomUUID(), T + 5000);

    const feed = await doorDaysTouched(getDb(env.DB), { since: held.nextSince, limit: 100 });
    expect(feed.doorDays).toHaveLength(1);
    const [day] = feed.doorDays;
    expect(day?.visits).toHaveLength(2);
    expect(day?.listedAt).toBe(T + 5000);
    // The « Reçue » time is still the phone's sync.
    expect(day?.receivedAt).toBe(T + 10);
    // Past the repair, nothing is left.
    const next = await doorDaysTouched(getDb(env.DB), { since: feed.nextSince, limit: 100 });
    expect(next.doorDays).toEqual([]);
  });

  it("seeds the newest insertion, so a fresh repair makes the cut", async () => {
    const synced = await seedProspect("Un");
    const repaired = await seedProspect("Deux");
    await seedVisit(synced, A, T, "no_contact", T);
    await seedVisit(repaired, A, T - 9000, "interested", T - 9000, crypto.randomUUID(), T + 5000);
    const feed = await doorDaysTouched(getDb(env.DB), { since: 0, limit: 1 });
    expect(feed.truncated).toBe(true);
    expect(prospectsOf(feed)).toEqual([repaired]);
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

  it("walks a truncated delta poll forward with no gap, visits sharing a received_at included", async () => {
    const first = await seedProspect("Premier");
    await seedVisit(first, A, T, "no_contact", T);
    const { nextSince } = await doorDaysTouched(getDb(env.DB), { since: 0, limit: 100 });
    // One sync stamps one received_at: these four tie, and the first page's cut falls inside.
    const tied = [await seedProspect("A"), await seedProspect("B"), await seedProspect("C")];
    tied.push(await seedProspect("D"));
    for (const p of tied) await seedVisit(p, A, T, "no_contact", T + 50);

    const seen: string[] = [];
    let since = nextSince;
    for (let poll = 0; poll < 10; poll++) {
      const page = await doorDaysTouched(getDb(env.DB), { since, limit: 3 });
      if (page.doorDays.length === 0) break;
      seen.push(...prospectsOf(page));
      since = page.nextSince;
    }
    expect(seen.sort()).toEqual([...tied].sort());
  });

  it("moves a truncated reason= poll past door-days the filter drops", async () => {
    const held = await seedProspect("Tenu");
    await seedVisit(held, A, T, "no_contact", T);
    const { nextSince } = await doorDaysTouched(getDb(env.DB), { since: 0, limit: 100 });
    // Each door-day's latest visit, made at T + 2, has no reason; the refusal made at
    // T + 1 reached the server after it (a phone that synced out of order).
    const dropped = [await seedProspect("A"), await seedProspect("B"), await seedProspect("C")];
    for (const p of dropped) await seedVisit(p, A, T + 2, "converted", T + 2);
    for (const p of dropped) {
      await seedVisit(p, A, T + 1, "not_interested", T + 3, crypto.randomUUID(), null, "no_need");
    }

    const page = await doorDaysTouched(getDb(env.DB), {
      since: nextSince,
      reason: "no_need",
      limit: 2,
    });
    expect(page.truncated).toBe(true);
    expect(page.doorDays).toEqual([]);
    expect(page.nextSince).toBeGreaterThan(nextSince);

    const rest = await doorDaysTouched(getDb(env.DB), {
      since: page.nextSince,
      reason: "no_need",
      limit: 2,
    });
    expect(rest.truncated).toBe(false);
    expect(rest.doorDays).toEqual([]);
    expect(rest.nextSince).toBeGreaterThan(page.nextSince);
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
