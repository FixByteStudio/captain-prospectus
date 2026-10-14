import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db/client";
import { prospects, visits, visitsOrphaned } from "./db/schema";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import type { RecapResponse } from "../shared/schemas";
import { workerFetch } from "../../test/worker-fetch";
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
  await db.delete(visits);
  await db.delete(visitsOrphaned);
  await db.delete(prospects);
  await resetTestUsers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/admin/recap", () => {
  it("reports an empty day with the roster, the Brussels date and the server's clock", async () => {
    const { status, cache, body } = await recap();

    expect(status).toBe(200);
    expect(cache).toBe("no-store");
    expect(body).toEqual({
      date: "2026-06-17",
      activeAgents: 0,
      rosterSize: 2,
      visitsToday: 0,
      lastReceivedAt: null,
      serverTime: NOW,
    });
  });

  it("counts visits received from Brussels midnight to the next, by received_at", async () => {
    const dayStart = brusselsMidnightDaysFromNow(NOW, 0);
    const prospectId = await seedProspect();
    // Received yesterday, one millisecond before midnight: not today.
    await receive(prospectId, dayStart - 1);
    // Received today, though made yesterday (visitedAt is an hour earlier).
    await receive(prospectId, dayStart);
    await receive(prospectId, NOW - 4 * 60_000);

    const { body } = await recap();

    expect(body.visitsToday).toBe(2);
    expect(body.activeAgents).toBe(1);
    expect(body.lastReceivedAt).toBe(NOW - 4 * 60_000);
  });

  it("counts each roster member once, and a sender off the roster as a visit only", async () => {
    const prospectId = await seedProspect();
    await seedUser("gone@example.com", "agent", false);
    await receive(prospectId, NOW - 60_000, TEST_AGENT);
    await receive(prospectId, NOW - 30_000, TEST_AGENT);
    await receive(prospectId, NOW - 10_000, "gone@example.com");

    const { body } = await recap();

    expect(body.activeAgents).toBe(1);
    expect(body.rosterSize).toBe(2);
    expect(body.visitsToday).toBe(3);
    expect(body.lastReceivedAt).toBe(NOW - 10_000);
  });

  it("never reports more active agents than the roster holds", async () => {
    const prospectId = await seedProspect();
    await receive(prospectId, NOW - 60_000, TEST_AGENT);
    await receive(prospectId, NOW - 50_000, TEST_ADMIN);
    await seedUser("gone@example.com", "agent", false);
    await receive(prospectId, NOW - 40_000, "gone@example.com");

    const { body } = await recap();

    expect(body.activeAgents).toBe(2);
    expect(body.activeAgents).toBeLessThanOrEqual(body.rosterSize);
  });
});
