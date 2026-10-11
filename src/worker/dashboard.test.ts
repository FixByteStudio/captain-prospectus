import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db/client";
import { eq, sql } from "drizzle-orm";
import { prospects, scripts, visits, visitsOrphaned } from "./db/schema";
import { DASHBOARD_PERIODS, OUTCOMES, type Outcome, type Status } from "../shared/constants";
import { DAY_MS, brusselsMidnightDaysFromNow, brusselsPeriod, periodDates } from "../shared/period";
import type { DashboardResponse } from "../shared/schemas";
import { workerFetch } from "../../test/worker-fetch";
import { resetTestUsers, seedUser } from "../../test/users";

/**
 * `GET /api/admin/dashboard` against a real D1 (GH #107).
 *
 * Rows are written straight through Drizzle at instants taken from
 * `brusselsPeriod`, the same function the route counts with — so these tests
 * pin which side of each bound a visit lands on, not the calendar arithmetic,
 * which `period.test.ts` covers.
 */

const ADMIN = "admin@example.com";
const AGENT = "agent@example.com";

/** What a Brussels wall clock shows at `epochMs`, to check a bound is midnight. */
const wall = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Brussels",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

async function call(path: string, init?: RequestInit): Promise<Response> {
  return workerFetch(`http://localhost${path}`, init);
}

async function dashboard(query = ""): Promise<DashboardResponse> {
  const response = await call(`/api/admin/dashboard${query}`);
  expect(response.status).toBe(200);
  return (await response.json()) as DashboardResponse;
}

async function seedProspect(
  status: Status = "assigned",
  mergedInto: string | null = null,
  statusSetAt: number | null = null,
  assignedTo: string | null = AGENT,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await getDb(env.DB)
    .insert(prospects)
    .values({
      id,
      name: "Le Bistrot",
      type: "restaurant",
      source: "csv",
      dedupeKey: `test:${id}`,
      status,
      assignedTo,
      mergedInto,
      statusSetAt,
      createdBy: ADMIN,
      createdAt: now,
      updatedAt: now,
    });
  return id;
}

async function seedVisits(
  prospectId: string,
  visitedAts: number[],
  outcome: Outcome = "interested",
  agentEmail: string = AGENT,
): Promise<void> {
  if (visitedAts.length === 0) return;
  const db = getDb(env.DB);
  // Keep last_visit_at as deriveProspectStatus would, since the manual branch
  // of Convertis reads it.
  const latest = Math.max(...visitedAts);
  await db
    .update(prospects)
    .set({ lastVisitAt: sql`max(coalesce(${prospects.lastVisitAt}, ${latest}), ${latest})` })
    .where(eq(prospects.id, prospectId));
  await db.insert(visits).values(
    visitedAts.map((visitedAt) => ({
      id: crypto.randomUUID(),
      prospectId,
      agentEmail,
      visitedAt,
      clientVisitedAt: visitedAt,
      receivedAt: visitedAt,
      outcome,
      clientVersion: 1,
    })),
  );
}

/**
 * Noon in Brussels, clear of midnight and of a DST switch. The seeds and the
 * route both read `Date.now()`, so a frozen clock keeps them on the same day
 * (GH #151); a test that needs another instant sets its own.
 */
const NOW = Date.parse("2026-06-17T10:00:00.000Z");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  const db = getDb(env.DB);
  // Order matters: visits reference prospects by foreign key.
  await db.delete(visits);
  await db.delete(visitsOrphaned);
  await db.delete(prospects);
  await db.delete(scripts);
  await resetTestUsers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/admin/dashboard", () => {
  it.each(DASHBOARD_PERIODS)(
    "counts period %i and its previous period at the exact bounds (I/O matrix, boundary)",
    async (period) => {
      const { from, to, previousFrom } = brusselsPeriod(Date.now(), period);
      const prospectId = await seedProspect();
      await seedVisits(prospectId, [
        // Current: [from, to)
        from,
        from + 1,
        to - 1,
        // Previous: [previousFrom, from)
        from - 1,
        previousFrom,
        // Neither
        previousFrom - 1,
        to,
      ]);

      const body = await dashboard(`?period=${period}`);
      expect(body.period).toBe(period);
      expect(body.from).toBe(from);
      expect(body.to).toBe(to);
      expect(body.visits).toMatchObject({ value: 3, previous: 2, delta: 0.5 });
    },
  );

  it("defaults to 30 days (I/O matrix, default period)", async () => {
    const body = await dashboard();
    expect(body.period).toBe(30);
    expect(body.from).toBe(brusselsPeriod(Date.now(), 30).from);
  });

  it("has a null delta when the previous period is empty (I/O matrix, previous empty)", async () => {
    const { from } = brusselsPeriod(Date.now(), 7);
    await seedVisits(await seedProspect(), [from, from + 1]);

    const body = await dashboard("?period=7");
    expect(body.visits).toMatchObject({ value: 2, previous: 0, delta: null });
  });

  it("has a delta of 0 when flat (I/O matrix, flat)", async () => {
    const { from } = brusselsPeriod(Date.now(), 7);
    await seedVisits(await seedProspect(), [from, from - 1]);

    const body = await dashboard("?period=7");
    expect(body.visits).toMatchObject({ value: 1, previous: 1, delta: 0 });
  });

  it("counts a merged prospect's visits and leaves quarantined ones out", async () => {
    const { from } = brusselsPeriod(Date.now(), 30);
    const survivor = await seedProspect();
    const absorbed = await seedProspect("assigned", survivor);
    await seedVisits(survivor, [from]);
    await seedVisits(absorbed, [from + 1]);
    await getDb(env.DB)
      .insert(visitsOrphaned)
      .values({
        id: crypto.randomUUID(),
        prospectId: crypto.randomUUID(),
        agentEmail: AGENT,
        visitedAt: from + 2,
        clientVisitedAt: from + 2,
        receivedAt: from + 2,
        outcome: "converted",
        clientVersion: 1,
        reason: "unknown_prospect",
        quarantinedAt: from + 2,
      });

    const body = await dashboard("?period=30");
    expect(body.visits.value).toBe(2);
    // The quarantined visit is `converted`, and still not a conversion.
    expect(body.converted.value).toBe(0);
    // Visites dans le temps counts the same rows as the card (GH #110).
    expect(body.visitsByDay[0]?.counts).toEqual({
      no_contact: 0,
      interested: 2,
      not_interested: 0,
      follow_up: 0,
      converted: 0,
    });
  });

  it("counts open, live prospects as a snapshot the period does not move (I/O matrix, snapshot)", async () => {
    const survivor = await seedProspect("new");
    await seedProspect("assigned");
    await seedProspect("follow_up");
    // Not open.
    await seedProspect("converted");
    await seedProspect("rejected");
    // Open, but merged away: not a prospect the admin has any more.
    await seedProspect("new", survivor);

    const counts = [];
    for (const period of DASHBOARD_PERIODS) {
      counts.push((await dashboard(`?period=${period}`)).openProspects);
    }
    expect(counts).toEqual([3, 3, 3]);
  });

  it.each(["14", "abc", "", "30.5"])(
    "answers 400 for period=%s (I/O matrix, bad period)",
    async (value) => {
      const response = await call(`/api/admin/dashboard?period=${value}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "validation" });
    },
  );

  it("answers 403 to an agent (I/O matrix, agent caller)", async () => {
    const saved = env.DEV_USER_EMAIL;
    try {
      env.DEV_USER_EMAIL = AGENT;
      expect((await call("/api/admin/dashboard")).status).toBe(403);
    } finally {
      env.DEV_USER_EMAIL = saved;
    }
  });
});

describe("GET /api/admin/dashboard › Convertis and Taux de conversion", () => {
  it.each(DASHBOARD_PERIODS)(
    "counts a converted visit at from, period %i (I/O matrix, by visit)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      await seedVisits(await seedProspect("converted"), [from], "converted");

      const body = await dashboard(`?period=${period}`);
      expect(body.converted).toMatchObject({ value: 1, previous: 0, delta: null });
      expect(body.conversionRate).toEqual({
        value: 1,
        previous: null,
        delta: null,
        visitedProspects: { value: 1, previous: 0 },
      });
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "does not count an Intéressé lead as a conversion, period %i (ADR-0027)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      await seedVisits(await seedProspect("converted"), [from], "converted");
      await seedVisits(await seedProspect("interested"), [from], "interested");

      const body = await dashboard(`?period=${period}`);
      expect(body.converted.value).toBe(1);
      expect(body.conversionRate.visitedProspects.value).toBe(2);
      expect(body.conversionRate.value).toBe(0.5);
      expect(body.pipeline.interested).toBe(1);
      expect(body.pipeline.converted).toBe(1);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "counts a manual conversion but not in the denominator, period %i (I/O matrix, manually)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      await seedProspect("converted", null, from);

      const body = await dashboard(`?period=${period}`);
      expect(body.converted.value).toBe(1);
      expect(body.conversionRate.visitedProspects.value).toBe(0);
      expect(body.conversionRate.value).toBeNull();
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "counts a prospect once however often it converts, period %i (I/O matrix, twice)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      const twiceByVisit = await seedProspect("converted");
      await seedVisits(twiceByVisit, [from, from + 1], "converted");
      const visitAndManual = await seedProspect("converted", null, from + 2);
      await seedVisits(visitAndManual, [from + 1], "converted");

      const body = await dashboard(`?period=${period}`);
      expect(body.converted.value).toBe(2);
      expect(body.conversionRate.visitedProspects.value).toBe(2);
      expect(body.conversionRate.value).toBe(1);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "puts a conversion on the right side of each bound, period %i (I/O matrix, boundaries)",
    async (period) => {
      const { from, to, previousFrom } = brusselsPeriod(Date.now(), period);
      // Current: [from, to)
      await seedVisits(await seedProspect("converted"), [to - 1], "converted");
      await seedProspect("converted", null, to - 1);
      // Previous: [previousFrom, from)
      await seedVisits(await seedProspect("converted"), [from - 1], "converted");
      await seedProspect("converted", null, from - 1);
      await seedVisits(await seedProspect("converted"), [previousFrom], "converted");
      await seedProspect("converted", null, previousFrom);
      // Neither
      await seedVisits(await seedProspect("converted"), [to], "converted");
      await seedProspect("converted", null, to);
      await seedVisits(await seedProspect("converted"), [previousFrom - 1], "converted");
      await seedProspect("converted", null, previousFrom - 1);

      const body = await dashboard(`?period=${period}`);
      expect(body.converted).toMatchObject({ value: 2, previous: 4, delta: -0.5 });
      expect(body.conversionRate.visitedProspects).toEqual({ value: 1, previous: 2 });
    },
  );

  it("does not count a manual conversion a later visit overrode (I/O matrix, manual, overridden)", async () => {
    const { from } = brusselsPeriod(Date.now(), 30);
    // Converted by hand at from, then a follow_up visit moved the status on.
    const prospectId = await seedProspect("follow_up", null, from);
    await seedVisits(prospectId, [from + 1], "follow_up");

    const body = await dashboard("?period=30");
    expect(body.converted.value).toBe(0);
    expect(body.conversionRate.value).toBe(0);
  });

  it.each(DASHBOARD_PERIODS)(
    "does not take a visit's conversion for an earlier manual one, period %i",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      // An admin set follow_up by hand at from − 1; a converted visit at from
      // then set the status and left status_set_at where it was.
      const prospectId = await seedProspect("converted", null, from - 1);
      await seedVisits(prospectId, [from], "converted");

      const body = await dashboard(`?period=${period}`);
      expect(body.converted).toMatchObject({ value: 1, previous: 0, delta: null });
    },
  );

  it("has a null rate and no delta when nothing was visited (I/O matrix, no visits)", async () => {
    const body = await dashboard("?period=30");
    expect(body.converted).toMatchObject({ value: 0, previous: 0, delta: null });
    expect(body.conversionRate).toEqual({
      value: null,
      previous: null,
      delta: null,
      visitedProspects: { value: 0, previous: 0 },
    });
  });

  it.each(DASHBOARD_PERIODS)(
    "divides Convertis by prospects visited and deltas in points, period %i (I/O matrix, rate)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      // Current: 2 converted of 8 visited.
      for (let i = 0; i < 8; i++) {
        await seedVisits(await seedProspect(), [from + i], i < 2 ? "converted" : "interested");
      }
      // Previous: 1 converted of 5 visited.
      for (let i = 0; i < 5; i++) {
        await seedVisits(await seedProspect(), [from - 1 - i], i < 1 ? "converted" : "no_contact");
      }

      const body = await dashboard(`?period=${period}`);
      expect(body.converted).toMatchObject({ value: 2, previous: 1, delta: 1 });
      expect(body.conversionRate.value).toBe(0.25);
      expect(body.conversionRate.previous).toBe(0.2);
      expect(body.conversionRate.delta).toBeCloseTo(0.05, 12);
      expect(body.conversionRate.visitedProspects).toEqual({ value: 8, previous: 5 });
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "counts an absorbed prospect as its survivor, period %i (I/O matrix, merged)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      const survivor = await seedProspect("converted");
      const absorbed = await seedProspect("converted", survivor);
      await seedVisits(survivor, [from], "converted");
      await seedVisits(absorbed, [from + 1], "converted");

      const body = await dashboard(`?period=${period}`);
      expect(body.converted.value).toBe(1);
      expect(body.conversionRate.visitedProspects.value).toBe(1);
      // Visites still counts both: they both happened.
      expect(body.visits.value).toBe(2);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "counts an absorbed prospect's manual conversion as its survivor, period %i",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      const survivor = await seedProspect();
      await seedProspect("converted", survivor, from + 1);

      expect((await dashboard(`?period=${period}`)).converted.value).toBe(1);

      // The survivor converting by visit too is still the one place.
      await seedVisits(survivor, [from], "converted");
      expect((await dashboard(`?period=${period}`)).converted.value).toBe(1);
    },
  );

  it("still counts a conversion reopened later in the period (I/O matrix, reopened)", async () => {
    const { from } = brusselsPeriod(Date.now(), 30);
    const prospectId = await seedProspect("follow_up");
    await seedVisits(prospectId, [from], "converted");
    await seedVisits(prospectId, [from + 1], "follow_up");

    const body = await dashboard("?period=30");
    expect(body.converted.value).toBe(1);
    expect(body.conversionRate.value).toBe(1);
  });
});

describe("GET /api/admin/dashboard › Visites dans le temps (GH #110)", () => {
  const HOUR = 60 * 60 * 1000;
  /** Brussels midnight of the period's day `i`; noon keeps clear of a DST hour. */
  const dayStart = (from: number, i: number) =>
    brusselsPeriod(from + i * DAY_MS + 12 * HOUR, 1).from;
  const zeros = () => Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;

  it.each(DASHBOARD_PERIODS)(
    "has one entry per Brussels day of period %i, oldest first (I/O matrix, shape and empty)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      const body = await dashboard(`?period=${period}`);
      expect(body.visitsByDay).toHaveLength(period);
      expect(body.visitsByDay.map((d) => d.date)).toEqual(periodDates(from, period));
      for (const day of body.visitsByDay) expect(day.counts).toEqual(zeros());
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "counts period %i's visits per day and outcome (I/O matrix, per outcome)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      const prospectId = await seedProspect();
      await seedVisits(prospectId, [dayStart(from, 0), dayStart(from, 0) + HOUR], "no_contact");
      await seedVisits(prospectId, [dayStart(from, 0) + 2 * HOUR], "converted");
      await seedVisits(prospectId, [dayStart(from, 3) + 5 * HOUR], "follow_up");

      const { visitsByDay, visits: total } = await dashboard(`?period=${period}`);
      const expected = visitsByDay.map(() => zeros());
      expected[0] = { ...zeros(), no_contact: 2, converted: 1 };
      expected[3] = { ...zeros(), follow_up: 1 };
      expect(visitsByDay.map((d) => d.counts)).toEqual(expected);
      // I/O matrix, totals: the chart and the Visites card agree.
      const sum = visitsByDay.reduce(
        (n, d) => n + OUTCOMES.reduce((m, o) => m + d.counts[o], 0),
        0,
      );
      expect(sum).toBe(total.value);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "puts a day's midnight and its last millisecond on that day, and leaves the period's outside out, for %i (I/O matrix, day and period bounds)",
    async (period) => {
      const { from, to } = brusselsPeriod(Date.now(), period);
      const prospectId = await seedProspect();
      const last = period - 1;
      await seedVisits(prospectId, [
        from,
        dayStart(from, 1) - 1,
        dayStart(from, last),
        to - 1,
        // Neither
        from - 1,
        to,
      ]);

      const { visitsByDay } = await dashboard(`?period=${period}`);
      expect(visitsByDay[0]?.counts.interested).toBe(2);
      expect(visitsByDay[last]?.counts.interested).toBe(2);
      const inside = visitsByDay.slice(1, last).reduce((n, d) => n + d.counts.interested, 0);
      expect(inside).toBe(0);
    },
  );

  it.each([
    // 23:30 Brussels on the 23 h day and on the 25 h day, then that night's
    // midnight: the last visit of the day and the first of the next.
    [
      "2026-04-03T10:00:00.000Z",
      "2026-03-29",
      "2026-03-29T21:30:00.000Z",
      "2026-03-29T22:00:00.000Z",
    ],
    [
      "2026-10-30T10:00:00.000Z",
      "2026-10-25",
      "2026-10-25T22:30:00.000Z",
      "2026-10-25T23:00:00.000Z",
    ],
  ])(
    "on %s, counts 23:30 on the DST day %s on that date (I/O matrix, DST)",
    async (now, dstDate, late, midnight) => {
      vi.setSystemTime(Date.parse(now));
      const prospectId = await seedProspect();
      await seedVisits(prospectId, [Date.parse(late)], "no_contact");
      await seedVisits(prospectId, [Date.parse(midnight)], "converted");

      for (const period of DASHBOARD_PERIODS) {
        const { visitsByDay } = await dashboard(`?period=${period}`);
        const i = visitsByDay.findIndex((d) => d.date === dstDate);
        expect(i, `period ${period}`).toBeGreaterThanOrEqual(0);
        expect(visitsByDay[i]?.counts).toEqual({ ...zeros(), no_contact: 1 });
        expect(visitsByDay[i + 1]?.counts).toEqual({ ...zeros(), converted: 1 });
      }
    },
  );
});

describe("GET /api/admin/dashboard › KPI series (GH #111)", () => {
  const HOUR = 60 * 60 * 1000;
  /** Brussels midnight of the period's day `i`; noon keeps clear of a DST hour. */
  const dayStart = (from: number, i: number) =>
    brusselsPeriod(from + i * DAY_MS + 12 * HOUR, 1).from;
  const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
  /** The period's series with `n` on each listed day and 0 elsewhere. */
  const series = (period: number, days: Record<number, number>) =>
    Array.from({ length: period }, (_, i) => days[i] ?? 0);

  it.each(DASHBOARD_PERIODS)(
    "sums each series to its figure and has period %i entries (I/O matrix, sums and length)",
    async (period) => {
      const { from, to } = brusselsPeriod(Date.now(), period);
      const last = period - 1;
      // Visits of every outcome on three days, one prospect converted twice,
      // one by hand, one absorbed into a converted survivor.
      const a = await seedProspect("converted");
      await seedVisits(a, [from, dayStart(from, last) + HOUR], "converted");
      await seedVisits(a, [dayStart(from, 1) + HOUR], "no_contact");
      await seedVisits(await seedProspect("follow_up"), [to - 1], "follow_up");
      await seedProspect("converted", null, dayStart(from, 1) + 2 * HOUR);
      const survivor = await seedProspect("converted");
      await seedVisits(survivor, [dayStart(from, 1)], "converted");
      await seedVisits(await seedProspect("converted", survivor), [from + 1], "converted");
      // Outside the period: in neither series.
      await seedVisits(await seedProspect("converted"), [from - 1, to], "converted");
      // Open prospects, one merged away.
      await seedProspect("new");
      await seedProspect("new", survivor);
      await seedProspect("assigned");

      const body = await dashboard(`?period=${period}`);
      expect(body.visits.byDay).toHaveLength(period);
      expect(body.converted.byDay).toHaveLength(period);
      expect(sum(body.visits.byDay)).toBe(body.visits.value);
      expect(sum(body.converted.byDay)).toBe(body.converted.value);
      expect(body.converted.value).toBe(3);
      expect(body.openProspectsByStatus).toEqual({ new: 1, assigned: 1, follow_up: 1 });
      expect(
        body.openProspectsByStatus.new +
          body.openProspectsByStatus.assigned +
          body.openProspectsByStatus.follow_up,
      ).toBe(body.openProspects);
      // Visites' series is the chart's days, summed over outcomes.
      expect(body.visits.byDay).toEqual(
        body.visitsByDay.map((d) => OUTCOMES.reduce((n, o) => n + d.counts[o], 0)),
      );
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "puts a prospect converted twice on its first day only, period %i (I/O matrix, converted twice)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      const prospectId = await seedProspect("converted");
      await seedVisits(
        prospectId,
        [dayStart(from, 1) + HOUR, dayStart(from, 4 % period) + 2 * HOUR],
        "converted",
      );

      const body = await dashboard(`?period=${period}`);
      expect(body.converted.byDay).toEqual(series(period, { 1: 1 }));
    },
  );

  it("puts a visit's conversion and a later manual one on the visit's day (I/O matrix, visit then manual)", async () => {
    const { from } = brusselsPeriod(Date.now(), 30);
    const prospectId = await seedProspect("converted", null, dayStart(from, 5) + HOUR);
    await seedVisits(prospectId, [dayStart(from, 2) + HOUR], "converted");

    const body = await dashboard("?period=30");
    expect(body.converted.byDay).toEqual(series(30, { 2: 1 }));
  });

  it("counts an absorbed prospect and its survivor once, on the first day (I/O matrix, merged)", async () => {
    const { from } = brusselsPeriod(Date.now(), 30);
    const survivor = await seedProspect("converted");
    await seedVisits(await seedProspect("converted", survivor), [from + HOUR], "converted");
    await seedVisits(survivor, [dayStart(from, 3) + HOUR], "converted");

    const body = await dashboard("?period=30");
    expect(body.converted.byDay).toEqual(series(30, { 0: 1 }));
  });

  it("leaves a conversion before the period out of the series (I/O matrix, previous period)", async () => {
    const { from } = brusselsPeriod(Date.now(), 30);
    await seedVisits(await seedProspect("converted"), [from - 1], "converted");
    await seedProspect("converted", null, from - 1);

    const body = await dashboard("?period=30");
    expect(body.converted.byDay).toEqual(series(30, {}));
    expect(body.converted.previous).toBe(2);
  });

  it.each([
    ["2026-04-03T10:00:00.000Z", "2026-03-29", "2026-03-29T21:30:00.000Z"],
    ["2026-10-30T10:00:00.000Z", "2026-10-25", "2026-10-25T22:30:00.000Z"],
  ])(
    "on %s, puts a conversion at 23:30 on the DST day %s on that date (I/O matrix, DST)",
    async (now, dstDate, late) => {
      vi.setSystemTime(Date.parse(now));
      await seedVisits(await seedProspect("converted"), [Date.parse(late)], "converted");
      await seedProspect("converted", null, Date.parse(late) + HOUR / 2);

      for (const period of DASHBOARD_PERIODS) {
        const body = await dashboard(`?period=${period}`);
        const i = body.visitsByDay.findIndex((d) => d.date === dstDate);
        expect(i, `period ${period}`).toBeGreaterThanOrEqual(0);
        expect(body.converted.byDay[i], `period ${period}`).toBe(1);
        // The manual one at midnight is the next day's.
        expect(body.converted.byDay[i + 1], `period ${period}`).toBe(1);
      }
    },
  );

  it("has all-zero series and an all-zero split when nothing happened (I/O matrix, empty and open split zero)", async () => {
    const body = await dashboard("?period=7");
    expect(body.visits.byDay).toEqual(series(7, {}));
    expect(body.converted.byDay).toEqual(series(7, {}));
    expect(body.openProspects).toBe(0);
    expect(body.openProspectsByStatus).toEqual({ new: 0, assigned: 0, follow_up: 0 });
  });
});

describe("Pipeline and Activité par agent (GH #112)", () => {
  const OTHER = "other@example.com";
  // OTHER is a second active agent unless a test deactivates them.
  beforeEach(async () => {
    await seedUser(OTHER, "agent");
  });
  const zeros = (email: string) => ({
    email,
    visits: 0,
    converted: 0,
    followUp: 0,
    openProspects: 0,
  });

  it.each(DASHBOARD_PERIODS)(
    "has the same pipeline at period %i, whose open part is openProspects (I/O matrix, pipeline sums)",
    async (period) => {
      for (const status of [
        "new",
        "assigned",
        "assigned",
        "follow_up",
        "interested",
        "converted",
        "rejected",
      ] as const) {
        await seedProspect(status);
      }
      // Set long before any period: a snapshot still counts it.
      const { previousFrom } = brusselsPeriod(Date.now(), period);
      await seedProspect("converted", null, previousFrom - 1);

      const body = await dashboard(`?period=${period}`);
      expect(body.pipeline).toEqual({
        new: 1,
        assigned: 2,
        follow_up: 1,
        interested: 1,
        converted: 2,
        rejected: 1,
      });
      expect(body.pipeline.new + body.pipeline.assigned + body.pipeline.follow_up).toBe(
        body.openProspects,
      );
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "leaves an absorbed prospect out of the pipeline and every open count at period %i (I/O matrix, merged)",
    async (period) => {
      const survivor = await seedProspect("assigned");
      await seedProspect("assigned", survivor);

      const body = await dashboard(`?period=${period}`);
      expect(body.pipeline.assigned).toBe(1);
      expect(body.agents.find((a) => a.email === AGENT)?.openProspects).toBe(1);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "counts a survivor and its absorbed prospect as one Convertis at period %i",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      const survivor = await seedProspect("converted");
      const absorbed = await seedProspect("converted", survivor);
      await seedVisits(survivor, [from], "converted");
      await seedVisits(absorbed, [from + 1], "converted");

      const body = await dashboard(`?period=${period}`);
      expect(body.agents.find((a) => a.email === AGENT)?.converted).toBe(1);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "credits a prospect converted by two agents to both at period %i",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      const prospectId = await seedProspect("converted");
      await seedVisits(prospectId, [from], "converted");
      await seedVisits(prospectId, [from + 1], "converted", OTHER);

      const body = await dashboard(`?period=${period}`);
      expect(body.agents.find((a) => a.email === AGENT)?.converted).toBe(1);
      expect(body.agents.find((a) => a.email === OTHER)?.converted).toBe(1);
      expect(body.converted.value).toBe(1);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "gives a deactivated user no row while their visits stay in the totals at period %i (GH #303)",
    async (period) => {
      const { from } = brusselsPeriod(Date.now(), period);
      await seedUser(OTHER, "agent", false);
      const assigned = await seedProspect("assigned", null, null, OTHER);
      await seedVisits(await seedProspect("assigned"), [from], "interested", OTHER);

      const body = await dashboard(`?period=${period}`);
      expect(body.agents.map((a) => a.email)).toEqual([ADMIN, AGENT]);
      expect(body.visits.value).toBe(1);
      // Two open prospects: the deactivated user's still counts.
      expect(body.openProspects).toBe(2);
      const [row] = await getDb(env.DB).select().from(prospects).where(eq(prospects.id, assigned));
      expect(row?.assignedTo).toBe(OTHER);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "lists an idle roster agent with their follow_up prospects at period %i (I/O matrix, idle agent)",
    async (period) => {
      await seedProspect("follow_up");
      await seedProspect("follow_up");

      const body = await dashboard(`?period=${period}`);
      expect(body.agents).toEqual([
        zeros(ADMIN),
        { email: AGENT, visits: 0, converted: 0, followUp: 2, openProspects: 2 },
        zeros(OTHER),
      ]);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "counts an agent's visits and Convertis in period %i only (I/O matrix, previous period)",
    async (period) => {
      const { from, to } = brusselsPeriod(Date.now(), period);
      const converted = await seedProspect("converted");
      // Twice on one prospect: one Convertis.
      await seedVisits(converted, [from, from + 1], "converted");
      await seedVisits(await seedProspect("assigned"), [to - 1], "interested", OTHER);
      // Previous period and after `to`: in no row.
      await seedVisits(await seedProspect("assigned"), [from - 1, to], "converted");
      // A manual conversion is credited to nobody.
      await seedProspect("converted", null, from, null);

      const body = await dashboard(`?period=${period}`);
      expect(body.agents).toEqual([
        { email: AGENT, visits: 2, converted: 1, followUp: 0, openProspects: 2 },
        { email: OTHER, visits: 1, converted: 0, followUp: 0, openProspects: 0 },
        zeros(ADMIN),
      ]);
      expect(body.agents.reduce((n, a) => n + a.visits, 0)).toBe(body.visits.value);
      expect(body.converted.value).toBe(2);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "counts an unassigned open prospect in the pipeline only at period %i (I/O matrix, unassigned)",
    async (period) => {
      await seedProspect("new", null, null, null);
      await seedProspect("assigned", null, null, OTHER);

      const body = await dashboard(`?period=${period}`);
      expect(body.pipeline.new).toBe(1);
      expect(body.openProspects).toBe(2);
      expect(body.agents).toEqual([
        zeros(ADMIN),
        zeros(AGENT),
        { email: OTHER, visits: 0, converted: 0, followUp: 0, openProspects: 1 },
      ]);
    },
  );

  it.each(DASHBOARD_PERIODS)(
    "has an all-zero pipeline and the roster with zeros at period %i when nothing happened (I/O matrix, empty)",
    async (period) => {
      const body = await dashboard(`?period=${period}`);
      expect(body.pipeline).toEqual({
        new: 0,
        assigned: 0,
        follow_up: 0,
        interested: 0,
        converted: 0,
        rejected: 0,
      });
      expect(body.agents).toEqual([zeros(ADMIN), zeros(AGENT), zeros(OTHER)]);
    },
  );
});

describe("À traiter › Relances dues (GH #113)", () => {
  /** A live follow_up prospect by default, due at `nextVisitAt`. */
  async function seedDue(
    nextVisitAt: number | null,
    status: Status = "follow_up",
    mergedInto: string | null = null,
  ): Promise<void> {
    const id = await seedProspect(status, mergedInto);
    await getDb(env.DB).update(prospects).set({ nextVisitAt }).where(eq(prospects.id, id));
  }

  it.each(DASHBOARD_PERIODS)(
    "counts due today and overdue, not tomorrow, at period %i (I/O matrix, due today/tomorrow/overdue)",
    async (period) => {
      const { to } = brusselsPeriod(Date.now(), 1);
      await seedDue(to - 1); // due today
      await seedDue(to - 40 * DAY_MS); // overdue, before any period
      await seedDue(to); // due tomorrow

      expect((await dashboard(`?period=${period}`)).followUpsDue).toBe(2);
    },
  );

  it("counts neither a merged, another status nor a null date (I/O matrix, not due)", async () => {
    const { to } = brusselsPeriod(Date.now(), 1);
    const survivor = await seedProspect("follow_up");
    await seedDue(to - 1, "follow_up", survivor);
    await seedDue(to - 1, "assigned");
    await seedDue(to - 1, "converted");
    await seedDue(null);

    expect((await dashboard()).followUpsDue).toBe(0);
  });

  it.each([
    // [now, last due instant, first not-due instant] — Brussels midnight
    // tomorrow, which UTC's midnight would put on the wrong side.
    ["2026-03-29T21:30:00.000Z", "2026-03-29T21:59:59.999Z", "2026-03-29T22:00:00.000Z"], // 23:30, spring DST day
    ["2026-03-29T22:30:00.000Z", "2026-03-30T21:59:59.999Z", "2026-03-30T22:00:00.000Z"], // 00:30 the day after
    ["2026-10-25T22:30:00.000Z", "2026-10-25T22:59:59.999Z", "2026-10-25T23:00:00.000Z"], // 23:30, autumn DST day
    ["2026-10-25T23:30:00.000Z", "2026-10-26T22:59:59.999Z", "2026-10-26T23:00:00.000Z"], // 00:30 the day after
  ])(
    "at %s, today ends at Brussels midnight (I/O matrix, Brussels boundary)",
    async (now, lastDue, firstNotDue) => {
      vi.setSystemTime(Date.parse(now));
      await seedDue(Date.parse(lastDue));
      await seedDue(Date.parse(firstNotDue));

      expect((await dashboard()).followUpsDue).toBe(1);
    },
  );
});

describe("Prospects' filtered totals match the figures they link from (GH #114)", () => {
  async function total(query: string): Promise<number> {
    const response = await call(`/api/admin/prospects?${query}`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { total: number }).total;
  }

  it("totals openProspects and followUpsDue on the same rows", async () => {
    const { to } = brusselsPeriod(Date.now(), 1);
    const due = async (nextVisitAt: number | null, mergedInto: string | null = null) => {
      const id = await seedProspect("follow_up", mergedInto);
      await getDb(env.DB).update(prospects).set({ nextVisitAt }).where(eq(prospects.id, id));
      return id;
    };
    const survivor = await due(to - 1); // due
    await due(to); // not yet due
    await due(null); // undated
    await due(to - 1, survivor); // merged
    await seedProspect("new");
    await seedProspect("assigned");
    await seedProspect("converted");
    await seedProspect("assigned", survivor); // merged, not open

    const body = await dashboard();
    expect(await total("status=new,assigned,follow_up")).toBe(body.openProspects);
    expect(await total(`status=follow_up&dueBefore=${body.to}`)).toBe(body.followUpsDue);
    expect(body.followUpsDue).toBe(1);
  });
});

describe("The Visites strip's flyers, agents and due-soon figures (GH #177)", () => {
  /** A visit with explicit `receivedAt`/`flyerGiven`, for the pair `visitedAt` never controls alone. */
  async function insertVisit(
    prospectId: string,
    visitedAt: number,
    receivedAt: number,
    flyerGiven = false,
    agentEmail: string = AGENT,
  ): Promise<void> {
    await getDb(env.DB).insert(visits).values({
      id: crypto.randomUUID(),
      prospectId,
      agentEmail,
      visitedAt,
      clientVisitedAt: visitedAt,
      receivedAt,
      flyerGiven,
      outcome: "interested",
      clientVersion: 1,
    });
  }

  describe("flyersGiven", () => {
    it("counts the period's flyer_given rows, merged included, quarantined and other periods out", async () => {
      const { from, previousFrom } = brusselsPeriod(Date.now(), 30);
      const survivor = await seedProspect("assigned");
      const merged = await seedProspect("assigned", survivor);
      await insertVisit(survivor, from, from, true);
      await insertVisit(merged, from + 1, from + 1, true);
      await insertVisit(survivor, from + 2, from + 2, false); // no flyer
      await insertVisit(survivor, previousFrom, previousFrom, true); // previous period
      await getDb(env.DB)
        .insert(visitsOrphaned)
        .values({
          id: crypto.randomUUID(),
          prospectId: crypto.randomUUID(),
          agentEmail: AGENT,
          visitedAt: from + 3,
          clientVisitedAt: from + 3,
          receivedAt: from + 3,
          flyerGiven: true,
          outcome: "interested",
          clientVersion: 1,
          reason: "unknown_prospect",
          quarantinedAt: from + 3,
        });

      expect((await dashboard("?period=30")).flyersGiven).toBe(2);
    });
  });

  describe("agentsActiveToday", () => {
    it("counts distinct agents with a visit received today, not yesterday, once each", async () => {
      // Not `to - DAY_MS`: a clock-change day is 23 h or 25 h.
      const todayStart = brusselsMidnightDaysFromNow(Date.now(), 0);
      const a = await seedProspect("assigned");
      const b = await seedProspect("assigned");
      const c = await seedProspect("assigned");
      // A: received today, visited yesterday.
      await insertVisit(a, todayStart - 1, todayStart + 1, false, "a@example.com");
      // A again today: still counts once.
      await insertVisit(a, todayStart + 10, todayStart + 10, false, "a@example.com");
      await insertVisit(b, todayStart + 5, todayStart + 5, false, "b@example.com");
      // C: received yesterday.
      await insertVisit(c, todayStart - 5, todayStart - 5, false, "c@example.com");

      const body = await dashboard();
      expect(body.agentsActiveToday).toBe(2);
      // Ignores `period`.
      expect((await dashboard("?period=90")).agentsActiveToday).toBe(2);
    });
  });

  describe("followUpsDueSoon", () => {
    /** A live follow_up prospect by default, due at `nextVisitAt`. */
    async function seedDue(
      nextVisitAt: number | null,
      status: Status = "follow_up",
      mergedInto: string | null = null,
    ): Promise<void> {
      const id = await seedProspect(status, mergedInto);
      await getDb(env.DB).update(prospects).set({ nextVisitAt }).where(eq(prospects.id, id));
    }

    it("counts overdue, today and day +6, not day +7 or later, not merged or another status", async () => {
      // Midnights from period.ts, not `± n × DAY_MS`, so a clock change in
      // the next seven days cannot move a row across the bound.
      const today = brusselsMidnightDaysFromNow(Date.now(), 0);
      const to = brusselsMidnightDaysFromNow(Date.now(), 1);
      const dayPlus7 = brusselsMidnightDaysFromNow(Date.now(), 7);
      await seedDue(today - 40 * DAY_MS); // overdue
      await seedDue(to - 1); // today
      await seedDue(dayPlus7 - 1); // day +6, its last instant
      await seedDue(dayPlus7); // day +7, not due soon
      await seedDue(null);
      const survivor = await seedProspect("follow_up");
      await seedDue(to - 1, "follow_up", survivor); // merged
      await seedDue(to - 1, "assigned"); // another status

      const body = await dashboard();
      expect(body.followUpsDueSoon.value).toBe(3);
    });

    it("dueBefore's total on the prospects list matches followUpsDueSoon.value", async () => {
      const { to } = brusselsPeriod(Date.now(), 1);
      await seedDue(to - 40 * DAY_MS); // overdue
      await seedDue(to - 1); // today
      await seedDue(to - 1 + 6 * DAY_MS); // day +6
      await seedDue(to - 1 + 7 * DAY_MS); // day +7, not due soon
      await seedDue(null);
      const survivor = await seedProspect("follow_up");
      await seedDue(to - 1, "follow_up", survivor); // merged
      await seedDue(to - 1, "assigned"); // another status

      const body = await dashboard();
      const response = await call(
        `/api/admin/prospects?status=follow_up&dueBefore=${body.followUpsDueSoon.dueBefore}`,
      );
      expect(response.status).toBe(200);
      const { total } = (await response.json()) as { total: number };
      expect(total).toBe(body.followUpsDueSoon.value);
      expect(total).toBe(3);
    });

    it.each([
      ["2026-03-29T21:30:00.000Z"], // spring DST, near the switch
      ["2026-10-25T22:30:00.000Z"], // autumn DST, near the switch
    ])("dueBefore is a Brussels midnight across a clock change, at %s", async (now) => {
      vi.setSystemTime(Date.parse(now));

      const { dueBefore } = (await dashboard()).followUpsDueSoon;
      expect(wall.format(dueBefore)).toBe("00:00:00");
    });
  });
});

describe("À traiter › Prospects sans agent actif (GH #308)", () => {
  const GONE = "gone@example.com";
  const STRAY = "stray@example.com";

  async function list(query: string): Promise<{ total: number; ids: string[] }> {
    const response = await call(`/api/admin/prospects?${query}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { total: number; prospects: { id: string }[] };
    return { total: body.total, ids: body.prospects.map((p) => p.id).sort() };
  }

  it("counts open, live prospects with no active assignee, and the list at the same filter totals it (I/O matrix)", async () => {
    await seedUser(GONE, "agent", false);
    const deactivated = await seedProspect("assigned", null, null, GONE);
    const noRow = await seedProspect("follow_up", null, null, STRAY);
    const deactivatedNew = await seedProspect("new", null, null, GONE);
    // Neither counted nor listed.
    await seedProspect("assigned"); // active assignee
    await seedProspect("new", null, null, null); // unassigned
    await seedProspect("assigned", deactivated, null, GONE); // merged
    // Won or lost: not counted, listed only when `status` lets them through.
    const won = await seedProspect("converted", null, null, GONE);
    const lost = await seedProspect("rejected", null, null, STRAY);
    const lead = await seedProspect("interested", null, null, GONE);

    const body = await dashboard();
    expect(body.inactiveAgentProspects).toBe(3);

    const open = await list("status=new,assigned,follow_up&inactiveAgent=true");
    expect(open.total).toBe(body.inactiveAgentProspects);
    expect(open.ids).toEqual([deactivated, noRow, deactivatedNew].sort());

    const all = await list("inactiveAgent=true");
    expect(all.ids).toEqual([deactivated, noRow, deactivatedNew, won, lost, lead].sort());
  });

  it("ignores the period, and reads 0 once every one is reassigned to an active agent", async () => {
    await seedUser(GONE, "agent", false);
    const id = await seedProspect("assigned", null, null, GONE);
    for (const period of DASHBOARD_PERIODS) {
      expect((await dashboard(`?period=${period}`)).inactiveAgentProspects).toBe(1);
    }

    const response = await call("/api/admin/prospects/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id], assignedTo: AGENT }),
    });
    expect(response.status).toBe(200);
    expect((await dashboard()).inactiveAgentProspects).toBe(0);
    expect((await list("status=new,assigned,follow_up&inactiveAgent=true")).total).toBe(0);
  });

  it("follows an admin deactivating and reactivating the assignee", async () => {
    await seedUser(GONE, "agent", true);
    await seedProspect("assigned", null, null, GONE);
    expect((await dashboard()).inactiveAgentProspects).toBe(0);

    const setActive = (active: boolean) =>
      call(`/api/admin/users/${GONE}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
    expect((await setActive(false)).status).toBe(204);
    expect((await dashboard()).inactiveAgentProspects).toBe(1);
    expect((await setActive(true)).status).toBe(204);
    expect((await dashboard()).inactiveAgentProspects).toBe(0);
  });
});
