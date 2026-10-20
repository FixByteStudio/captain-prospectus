import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db/client";
import { prospects, tourneeStops, tournees, visits, visitsOrphaned } from "./db/schema";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import type { DashboardResponse, RecapResponse } from "../shared/schemas";
import { workerFetch } from "../../test/worker-fetch";
import { seedTournee } from "../../test/tournees";
import { TEST_ADMIN, TEST_AGENT, resetTestUsers, seedUser } from "../../test/users";

/**
 * `GET /api/admin/recap` against a real D1 — the sidebar's recap card
 * (docs/api.md › The recap card). The roster is the two seeded users.
 */

/** Noon in Brussels on a plain June day, clear of midnight and of a DST switch. */
const NOW = Date.parse("2026-06-17T10:00:00.000Z");

async function recap(): Promise<{ status: number; cache: string | null; body: RecapResponse }> {
  const response = await workerFetch("http://localhost/api/admin/recap");
  return {
    status: response.status,
    cache: response.headers.get("Cache-Control"),
    body: (await response.json()) as RecapResponse,
  };
}

async function seedProspect(): Promise<string> {
  const id = crypto.randomUUID();
  await getDb(env.DB)
    .insert(prospects)
    .values({
      id,
      name: "Le Bistrot",
      type: "restaurant",
      source: "csv",
      dedupeKey: `test:${id}`,
      status: "assigned",
      assignedTo: TEST_AGENT,
      createdBy: TEST_ADMIN,
      createdAt: NOW,
      updatedAt: NOW,
    });
  return id;
}

/** A visit by `agentEmail`, received at `receivedAt` and made an hour before. */
async function receive(prospectId: string, receivedAt: number, agentEmail = TEST_AGENT) {
  await getDb(env.DB)
    .insert(visits)
    .values({
      id: crypto.randomUUID(),
      prospectId,
      agentEmail,
      visitedAt: receivedAt - 3_600_000,
      clientVisitedAt: receivedAt - 3_600_000,
      receivedAt,
      outcome: "no_contact",
      clientVersion: 1,
    });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  const db = getDb(env.DB);
  await db.delete(tourneeStops);
  await db.delete(tournees);
  await db.delete(visits);
  await db.delete(visitsOrphaned);
  await db.delete(prospects);
  await resetTestUsers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/admin/recap › door-days (ADR-0036)", () => {
  it("counts a correction on one door once, and each door and each agent separately", async () => {
    const dayStart = brusselsMidnightDaysFromNow(NOW, 0);
    const a = await seedProspect();
    const b = await seedProspect();
    // `receive` makes the visit an hour before it arrives.
    await receive(a, dayStart + 3 * 3_600_000);
    await receive(a, dayStart + 6 * 3_600_000);
    await receive(b, dayStart + 7 * 3_600_000);
    await receive(a, dayStart + 8 * 3_600_000, TEST_ADMIN);

    const { body } = await recap();

    expect(body.visitsToday).toBe(3);
  });

  it("equals the dashboard's Visites for one day", async () => {
    const dayStart = brusselsMidnightDaysFromNow(NOW, 0);
    const a = await seedProspect();
    await receive(a, dayStart + 3 * 3_600_000);
    await receive(a, dayStart + 6 * 3_600_000);
    await receive(await seedProspect(), dayStart + 7 * 3_600_000);
    // Made yesterday, synced today: not today's door-day.
    await receive(a, dayStart + 1_000);

    const dashboard = await workerFetch("http://localhost/api/admin/dashboard?period=7");
    const { visits: figure } = (await dashboard.json()) as DashboardResponse;
    const { body } = await recap();

    expect(body.visitsToday).toBe(2);
    // The dashboard's last day of period 7 is today.
    expect(figure.byDay[6]).toBe(body.visitsToday);
  });
});

describe("GET /api/admin/recap", () => {
  it("reports an empty day with the roster, the Brussels date and the server's clock", async () => {
    const { status, cache, body } = await recap();

    expect(status).toBe(200);
    expect(cache).toBe("no-store");
    expect(body).toEqual({
      date: "2026-06-17",
      activeAgents: 0,
      rosterSize: 1,
      visitsToday: 0,
      lastReceivedAt: null,
      serverTime: NOW,
    });
  });

  it("counts today's door-days among the visits received from Brussels midnight to the next, by visited_at", async () => {
    const dayStart = brusselsMidnightDaysFromNow(NOW, 0);
    const prospectId = await seedProspect();
    // Received yesterday, one millisecond before midnight: not today.
    await receive(prospectId, dayStart - 1);
    // Received today, though made yesterday (visitedAt is an hour earlier):
    // yesterday's door-day, synced today, is not today's.
    await receive(prospectId, dayStart);
    await receive(prospectId, NOW - 4 * 60_000);

    const { body } = await recap();

    expect(body.visitsToday).toBe(1);
    // Visits alone never make an agent active: only the swipe does (ADR-0036).
    expect(body.activeAgents).toBe(0);
    expect(body.lastReceivedAt).toBe(NOW - 4 * 60_000);
  });

  it("counts a roster member once, and a sender off the roster as a door-day only", async () => {
    const prospectId = await seedProspect();
    await seedUser("gone@example.com", "agent", false);
    await seedTournee(TEST_AGENT, NOW - 2 * 3_600_000);
    await receive(prospectId, NOW - 60_000, TEST_AGENT);
    await receive(prospectId, NOW - 30_000, TEST_AGENT);
    await seedTournee("gone@example.com", NOW - 3_600_000);
    await receive(prospectId, NOW - 10_000, "gone@example.com");

    const { body } = await recap();

    expect(body.activeAgents).toBe(1);
    expect(body.rosterSize).toBe(1);
    // The agent's two visits to one door are one door-day; the sender off the roster has one.
    expect(body.visitsToday).toBe(2);
    expect(body.lastReceivedAt).toBe(NOW - 10_000);
  });

  it("never reports more active agents than the roster holds", async () => {
    const prospectId = await seedProspect();
    await seedTournee(TEST_AGENT, NOW - 3_600_000);
    await receive(prospectId, NOW - 60_000, TEST_AGENT);
    await seedUser("bob@example.com", "agent");
    await seedTournee("bob@example.com", NOW - 3_000_000);
    await receive(prospectId, NOW - 50_000, "bob@example.com");
    await seedUser("gone@example.com", "agent", false);
    await seedTournee("gone@example.com", NOW - 2_000_000);
    await receive(prospectId, NOW - 40_000, "gone@example.com");

    const { body } = await recap();

    expect(body.activeAgents).toBe(2);
    expect(body.activeAgents).toBeLessThanOrEqual(body.rosterSize);
  });
});

describe("GET /api/admin/recap › actifs aujourd'hui (ADR-0036)", () => {
  it("counts an agent who swiped and sent nothing", async () => {
    await seedTournee(TEST_AGENT, NOW - 3_600_000);

    const { body } = await recap();

    expect(body.activeAgents).toBe(1);
    expect(body.visitsToday).toBe(0);
  });

  it("counts neither an agent with visits and no swipe, nor yesterday's tournée", async () => {
    const dayStart = brusselsMidnightDaysFromNow(NOW, 0);
    await receive(await seedProspect(), NOW - 60_000, TEST_AGENT);
    await seedTournee(TEST_ADMIN, dayStart - 1);

    const { body } = await recap();

    expect(body.activeAgents).toBe(0);
  });

  it("counts no admin's tournée, since the roster is agents only (ADR-0037)", async () => {
    await seedTournee(TEST_ADMIN, NOW - 3_600_000);

    const { body } = await recap();

    expect(body.activeAgents).toBe(0);
  });

  it("counts a deactivated user's tournée in neither", async () => {
    await seedUser("gone@example.com", "agent", false);
    await seedTournee("gone@example.com", NOW - 3_600_000);

    const { body } = await recap();

    expect(body.activeAgents).toBe(0);
  });

  it("is the dashboard's « Agents en tournée »", async () => {
    await seedTournee(TEST_AGENT, NOW - 3_600_000);
    await seedUser("bob@example.com", "agent");
    await seedTournee("bob@example.com", NOW - 1_000);

    const dashboard = await workerFetch("http://localhost/api/admin/dashboard");
    const { agentsActiveToday } = (await dashboard.json()) as DashboardResponse;
    const { body } = await recap();

    expect(body.activeAgents).toBe(2);
    expect(agentsActiveToday).toBe(body.activeAgents);
  });
});
