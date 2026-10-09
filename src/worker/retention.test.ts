import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { boundParamsPerRow, getDb } from "./db/client";
import { chunk } from "../shared/chunk";
import {
  agentPositions,
  loginAttempts,
  loginCodes,
  overpassCache,
  prospects,
  scripts,
  sessions,
  visits,
  visitsOrphaned,
} from "./db/schema";
import {
  AUTH_SWEEP_BATCH,
  D1_MAX_BOUND_PARAMS,
  OVERPASS_CACHE_TTL_MS,
  PLACES_CACHE_TTL_MS,
  RETENTION_BATCH,
  RETENTION_MS,
} from "../shared/constants";
import { describeSweep, runRetention } from "./retention";
import worker from "./index";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, throttleKey } from "./login-throttle";
import { hmacHex } from "./session";
import { TEST_ADMIN, TEST_AGENT } from "../../test/users";
import { workerFetch } from "../../test/worker-fetch";

/**
 * The retention sweep — ADR-0023.
 *
 * This is the only thing in the app that writes to `visits`, so the tests are
 * as much about what it must NOT touch as about what it clears.
 */

const AGENT = "agent@example.com";
const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);

async function seedProspect(id: string): Promise<void> {
  const db = getDb(env.DB);
  await db.insert(prospects).values({
    id,
    name: "Le Bistrot",
    type: "restaurant",
    lat: 50.85,
    lng: 4.35,
    address: null,
    phone: null,
    website: null,
    cuisine: null,
    source: "csv",
    sourceRef: null,
    dedupeKey: `test:${id}`,
    status: "assigned",
    assignedTo: AGENT,
    createdBy: AGENT,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

async function seedVisit(
  prospectId: string,
  over: { receivedAt?: number; lat?: number | null; notes?: string | null } = {},
): Promise<string> {
  const db = getDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(visits).values({
    id,
    prospectId,
    agentEmail: AGENT,
    visitedAt: over.receivedAt ?? NOW,
    clientVisitedAt: over.receivedAt ?? NOW,
    receivedAt: over.receivedAt ?? NOW,
    lat: over.lat === undefined ? 50.85 : over.lat,
    lng: over.lat === undefined ? 4.35 : null,
    flyerGiven: true,
    outcome: "converted",
    followUpAt: NOW + 1000,
    notes: over.notes === undefined ? "patron absent" : over.notes,
    scriptId: null,
    answers: { q1: true },
    clientVersion: 1,
  });
  return id;
}

/** Comfortably past the window. */
const OLD = NOW - RETENTION_MS - 24 * 60 * 60 * 1000;
/** Just inside it. */
const RECENT = NOW - RETENTION_MS + 24 * 60 * 60 * 1000;

beforeEach(async () => {
  const db = getDb(env.DB);
  await db.delete(visits);
  await db.delete(visitsOrphaned);
  await db.delete(prospects);
  await db.delete(scripts);
  await db.delete(overpassCache);
});

describe("runRetention", () => {
  it("nulls position and notes on an expired visit", async () => {
    const db = getDb(env.DB);
    const p = crypto.randomUUID();
    await seedProspect(p);
    const id = await seedVisit(p, { receivedAt: OLD });

    const result = await runRetention(db, NOW);
    expect(result.redacted).toBe(1);

    const [row] = await db.select().from(visits).where(eq(visits.id, id));
    expect(row?.lat).toBeNull();
    expect(row?.lng).toBeNull();
    expect(row?.notes).toBeNull();
  });

  it("keeps everything that is business history, not personal data", async () => {
    const db = getDb(env.DB);
    const p = crypto.randomUUID();
    await seedProspect(p);
    const id = await seedVisit(p, { receivedAt: OLD });

    await runRetention(db, NOW);

    const [row] = await db.select().from(visits).where(eq(visits.id, id));
    // The visit itself survives for ever: this is not a delete.
    expect(row).toBeDefined();
    expect(row?.outcome).toBe("converted");
    expect(row?.agentEmail).toBe(AGENT);
    expect(row?.visitedAt).toBe(OLD);
    expect(row?.flyerGiven).toBe(true);
    expect(row?.followUpAt).toBe(NOW + 1000);
    expect(row?.answers).toEqual({ q1: true });
    expect(row?.clientVersion).toBe(1);
  });

  it("leaves a visit inside the window alone", async () => {
    const db = getDb(env.DB);
    const p = crypto.randomUUID();
    await seedProspect(p);
    const id = await seedVisit(p, { receivedAt: RECENT });

    expect((await runRetention(db, NOW)).redacted).toBe(0);

    const [row] = await db.select().from(visits).where(eq(visits.id, id));
    expect(row?.lat).not.toBeNull();
    expect(row?.notes).toBe("patron absent");
  });

  /**
   * INVARIANT 12: a phone's clock can be wrong. Retention read against
   * visited_at could redact a visit the day it arrives, or never redact one.
   */
  it("measures against received_at, not visited_at", async () => {
    const db = getDb(env.DB);
    const p = crypto.randomUUID();
    await seedProspect(p);
    const id = await seedVisit(p, { receivedAt: RECENT });
    // A phone claiming the visit happened years ago must not age it out.
    await db.update(visits).set({ visitedAt: OLD, clientVisitedAt: OLD }).where(eq(visits.id, id));

    expect((await runRetention(db, NOW)).redacted).toBe(0);
    const [row] = await db.select().from(visits).where(eq(visits.id, id));
    expect(row?.notes).toBe("patron absent");
  });

  it("is idempotent: a second run the same day redacts nothing", async () => {
    const db = getDb(env.DB);
    const p = crypto.randomUUID();
    await seedProspect(p);
    await seedVisit(p, { receivedAt: OLD });

    expect((await runRetention(db, NOW)).redacted).toBe(1);
    // Already-redacted rows must stop matching, or the sweep rewrites the same
    // batch every day and never reaches the backlog behind it.
    expect((await runRetention(db, NOW)).redacted).toBe(0);
  });

  it("redacts a row that has only notes left, and one that has only a position", async () => {
    const db = getDb(env.DB);
    const p = crypto.randomUUID();
    await seedProspect(p);
    const notesOnly = await seedVisit(p, { receivedAt: OLD, lat: null });
    const posOnly = await seedVisit(p, { receivedAt: OLD, notes: null });

    expect((await runRetention(db, NOW)).redacted).toBe(2);

    const [a] = await db.select().from(visits).where(eq(visits.id, notesOnly));
    const [b] = await db.select().from(visits).where(eq(visits.id, posOnly));
    expect(a?.notes).toBeNull();
    expect(b?.lat).toBeNull();
  });

  it("bounds one run, and drains the backlog over later runs", async () => {
    const db = getDb(env.DB);
    const p = crypto.randomUUID();
    await seedProspect(p);

    const rows = Array.from({ length: RETENTION_BATCH + 10 }, () => ({
      id: crypto.randomUUID(),
      prospectId: p,
      agentEmail: AGENT,
      visitedAt: OLD,
      clientVisitedAt: OLD,
      receivedAt: OLD,
      lat: 50.85,
      lng: 4.35,
      flyerGiven: false,
      outcome: "interested" as const,
      followUpAt: null,
      notes: "x",
      scriptId: null,
      answers: {},
      clientVersion: 1,
    }));
    for (const batch of chunk(rows, boundParamsPerRow(visits))) {
      await db.insert(visits).values(batch);
    }

    // Bounded: one run does a batch, not the whole backlog (INVARIANT 13).
    expect((await runRetention(db, NOW)).redacted).toBe(RETENTION_BATCH);
    expect((await runRetention(db, NOW)).redacted).toBe(10);
    expect((await runRetention(db, NOW)).redacted).toBe(0);
  });

  it("reports the cutoff it used", () => {
    const line = describeSweep({
      redacted: 3,
      cutoff: Date.UTC(2026, 5, 25),
      positionsDeleted: 0,
      loginCodesDeleted: 0,
      sessionsDeleted: 0,
      loginAttemptsDeleted: 0,
    });
    expect(line).toContain("3 visit(s)");
    expect(line).toContain("2026-06-25");
  });
});

describe("the agent position sweep (ADR-0028)", () => {
  it("deletes a row not from today in Brussels and keeps today's", async () => {
    const db = getDb(env.DB);
    await db.delete(agentPositions);
    // NOW is 12:00 UTC on 2026-09-23, so Brussels midnight is 22:00 UTC the day before.
    const yesterday = Date.UTC(2026, 8, 22, 21, 0, 0);
    const today = Date.UTC(2026, 8, 22, 22, 30, 0);
    const row = (agentEmail: string, at: number) => ({
      agentEmail,
      lat: 50.85,
      lng: 4.35,
      accuracy: 10,
      capturedAt: at,
      receivedAt: at,
    });
    // Future phone clock: captured today, received yesterday, so the clamp puts it yesterday.
    const skewed = {
      ...row("skew@example.com", Date.UTC(2026, 8, 23, 6)),
      receivedAt: Date.UTC(2026, 8, 22, 21),
    };
    await db
      .insert(agentPositions)
      .values([row("old@example.com", yesterday), row(AGENT, today), skewed]);

    const result = await runRetention(db, NOW);

    expect(result.positionsDeleted).toBe(2);
    expect((await db.select().from(agentPositions)).map((r) => r.agentEmail)).toEqual([AGENT]);
    expect(describeSweep(result)).toContain("deleted 2 agent position(s)");
  });
});

/**
 * The cron wiring, not the sweep.
 *
 * `runRetention` being correct is worth nothing if nothing calls it, and a Cron
 * Trigger that is not wired fails silently — no error, no request, just a table
 * that quietly keeps its positions for ever.
 */
describe("the agent position sweep failing (ADR-0028)", () => {
  it("still redacts expired visits and reports zero positions deleted", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await seedProspect("p-fail");
    const real = getDb(env.DB);
    await real.insert(visits).values({
      id: "v-fail",
      prospectId: "p-fail",
      agentEmail: AGENT,
      visitedAt: OLD,
      clientVisitedAt: OLD,
      receivedAt: OLD,
      lat: 50.85,
      lng: 4.35,
      flyerGiven: false,
      outcome: "interested",
      notes: "secret",
      answers: {},
      clientVersion: 1,
    });
    const broken = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (sql.includes("agent_positions")) throw new Error("positions unavailable");
            return target.prepare(sql);
          };
        }
        const value: unknown = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const result = await runRetention(getDb(broken), NOW);

    expect(result.positionsDeleted).toBe(0);
    expect(result.redacted).toBe(1);
    expect(error).toHaveBeenCalledWith("agent position sweep failed", "Error");
    error.mockRestore();
  });
});

describe("the scheduled handler", () => {
  it("runs the sweep when the cron fires", async () => {
    const db = getDb(env.DB);
    const p = crypto.randomUUID();
    await seedProspect(p);
    const id = await seedVisit(p, { receivedAt: Date.now() - RETENTION_MS - 60_000 });

    const ctx = createExecutionContext();
    await worker.scheduled({} as ScheduledController, env, ctx);
    // The handler defers the work with waitUntil, so the test waits for it.
    await waitOnExecutionContext(ctx);

    const [row] = await db.select().from(visits).where(eq(visits.id, id));
    expect(row?.lat).toBeNull();
    expect(row?.notes).toBeNull();
  });

  it("swallows a failure rather than looping against the daily quota", async () => {
    const ctx = createExecutionContext();
    const broken = { DB: undefined } as unknown as typeof env;
    // Must not throw: a cron that throws retries, and a retry loop against D1
    // burns the free-tier quota for nothing. Tomorrow's run picks up the same
    // rows anyway, because the sweep is idempotent.
    await expect(worker.scheduled({} as ScheduledController, broken, ctx)).resolves.toBeUndefined();
    await waitOnExecutionContext(ctx);
  });

  it("evicts expired map-cache rows in the same run", async () => {
    const db = getDb(env.DB);
    const oldest = Math.max(OVERPASS_CACHE_TTL_MS, PLACES_CACHE_TTL_MS);
    await db.insert(overpassCache).values([
      { hash: "expired", body: "{}", createdAt: Date.now() - oldest - 60_000 },
      { hash: "fresh", body: "{}", createdAt: Date.now() },
    ]);

    const ctx = createExecutionContext();
    await worker.scheduled({} as ScheduledController, env, ctx);
    await waitOnExecutionContext(ctx);

    const left = await db.select({ hash: overpassCache.hash }).from(overpassCache);
    expect(left.map((r) => r.hash)).toEqual(["fresh"]);
  });

  it("still logs the retention sweep when eviction fails", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // Only statements on the cache table fail, so the sweep before it runs.
    const db = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (sql.includes("overpass_cache")) throw new Error("cache unavailable");
            return target.prepare(sql);
          };
        }
        const value: unknown = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const ctx = createExecutionContext();
    await expect(
      worker.scheduled({} as ScheduledController, { ...env, DB: db }, ctx),
    ).resolves.toBeUndefined();
    await waitOnExecutionContext(ctx);

    expect(log.mock.calls.some(([line]) => String(line).startsWith("retention: redacted"))).toBe(
      true,
    );
    expect(error).toHaveBeenCalledWith("map cache eviction failed", expect.any(String));
    log.mockRestore();
    error.mockRestore();
  });
});

/**
 * The auth tables' share of the sweep (CAP-10). "Expired" is the exact
 * complement of what the readers accept, so these tests sit on both sides of
 * the boundary: a wrong comparison would sign every agent out.
 */
describe("the auth rows sweep (CAP-10)", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const code = (hash: string, expiresAt: number, usedAt: number | null = null) => ({
    codeHash: hash,
    userEmail: TEST_AGENT,
    createdAt: expiresAt - 15 * 60 * 1000,
    expiresAt,
    usedAt,
  });
  const session = (hash: string, expiresAt: number, lastSeenAt = NOW) => ({
    tokenHash: hash,
    userEmail: TEST_AGENT,
    createdAt: NOW - 100 * DAY,
    lastSeenAt,
    expiresAt,
  });
  const windowOf = (at: number) => at - (at % LOGIN_WINDOW_MS);

  beforeEach(async () => {
    const db = getDb(env.DB);
    await db.delete(loginAttempts);
    await db.delete(sessions);
    await db.delete(loginCodes);
  });

  it("deletes expired and used-and-expired codes, keeps an unexpired one", async () => {
    const db = getDb(env.DB);
    await db
      .insert(loginCodes)
      .values([
        code("expired", NOW - 1),
        code("used", NOW - 1, NOW - 60_000),
        code("live", NOW + 60_000),
        code("used-live", NOW + 60_000, NOW - 1000),
      ]);

    const result = await runRetention(db, NOW);

    expect(result.loginCodesDeleted).toBe(2);
    const left = await db.select({ h: loginCodes.codeHash }).from(loginCodes);
    expect(left.map((r) => r.h).sort()).toEqual(["live", "used-live"]);
  });

  it("deletes an expired session, keeps a live one even if last seen long ago", async () => {
    const db = getDb(env.DB);
    await db
      .insert(sessions)
      .values([
        session("expired", NOW - 1),
        session("live", NOW + DAY),
        session("live-idle", NOW + DAY, NOW - 80 * DAY),
      ]);

    const result = await runRetention(db, NOW);

    expect(result.sessionsDeleted).toBe(1);
    const left = await db.select({ h: sessions.tokenHash }).from(sessions);
    expect(left.map((r) => r.h).sort()).toEqual(["live", "live-idle"]);
  });

  it("deletes a finished login window and keeps the open one, whose lockout still holds", async () => {
    const db = getDb(env.DB);
    const pepper = env.AUTH_PEPPER;
    if (!pepper) throw new Error("needs AUTH_PEPPER (vitest.config.ts)");
    const ip = "198.51.100.7";
    const ipHash = await hmacHex(pepper, throttleKey(ip));
    const now = Date.now();
    const open = windowOf(now);
    await db.insert(loginAttempts).values([
      { ipHash, windowStart: open, failures: LOGIN_MAX_FAILURES },
      { ipHash, windowStart: open - LOGIN_WINDOW_MS, failures: 3 },
      { ipHash: "other", windowStart: open - 5 * LOGIN_WINDOW_MS, failures: 1 },
    ]);

    const result = await runRetention(db, now);

    expect(result.loginAttemptsDeleted).toBe(2);
    expect((await db.select().from(loginAttempts)).map((r) => r.windowStart)).toEqual([open]);
    const refused = await workerFetch("https://captain.example/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
      body: JSON.stringify({ kind: "passphrase", email: TEST_ADMIN, passphrase: "wrong" }),
    });
    expect(refused.status).toBe(429);
  });

  it("deletes one batch per table and leaves the rest for the next run", async () => {
    const db = getDb(env.DB);
    const extra = 7;
    const n = AUTH_SWEEP_BATCH + extra;
    const ids = Array.from({ length: n }, (_, i) => i);
    // 5 columns per code row, so chunk by D1's bound-parameter limit.
    for (const part of chunk(
      ids,
      Math.floor(D1_MAX_BOUND_PARAMS / boundParamsPerRow(loginCodes)),
    )) {
      await db.insert(loginCodes).values(part.map((i) => code(`c${i}`, NOW - 1)));
    }

    const first = await runRetention(db, NOW);
    const second = await runRetention(db, NOW);

    expect(first.loginCodesDeleted).toBe(AUTH_SWEEP_BATCH);
    expect(second.loginCodesDeleted).toBe(extra);
    expect(await db.select().from(loginCodes)).toEqual([]);
  });

  it("lets the other tables and the visit redaction run when one delete fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await seedProspect("p-auth-fail");
    const real = getDb(env.DB);
    await seedVisit("p-auth-fail", { receivedAt: OLD });
    await real.insert(sessions).values(session("expired", NOW - 1));
    await real.insert(loginCodes).values(code("expired", NOW - 1));
    const broken = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (sql.includes("login_codes")) throw new Error("codes unavailable");
            return target.prepare(sql);
          };
        }
        const value: unknown = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const result = await runRetention(getDb(broken), NOW);

    expect(result.loginCodesDeleted).toBe(0);
    expect(result.sessionsDeleted).toBe(1);
    expect(result.redacted).toBe(1);
    expect(error).toHaveBeenCalledWith("login_codes sweep failed", "Error");
    error.mockRestore();
  });

  it("logs the three counts and nothing identifying", async () => {
    const db = getDb(env.DB);
    await db.insert(loginCodes).values(code("secret-code-hash", NOW - 1));
    await db.insert(sessions).values(session("secret-token-hash", NOW - 1));
    await db.insert(loginAttempts).values({
      ipHash: "secret-ip-hash",
      windowStart: windowOf(NOW) - LOGIN_WINDOW_MS,
      failures: 2,
    });

    const line = describeSweep(await runRetention(db, NOW));

    expect(line).toContain("1 login code(s), 1 session(s), 1 login attempt(s)");
    expect(line).not.toMatch(/secret|@/);
  });
});
