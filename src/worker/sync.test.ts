import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { boundParamsPerRow, getDb, insertOrIgnore } from "./db/client";
import { chunk } from "../shared/chunk";
import { dedupeKey } from "../shared/dedupe";
import { DAY_MS } from "../shared/constants";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import {
  agentPositions,
  prospects,
  scripts,
  tourneeStops,
  tournees,
  visits,
  visitsOrphaned,
} from "./db/schema";
import { visitHistoryResponseSchema } from "../shared/schemas";
import type { Outcome } from "../shared/constants";
import { OUTCOMES, OUTCOME_TO_STATUS } from "../shared/constants";
import {
  CLIENT_VERSION,
  MAX_REQUEST_BYTES,
  SCRIPT_QUESTIONS_MAX,
  SYNC_PROSPECTS_PER_REQUEST,
  SYNC_STOPS_PER_REQUEST,
  SYNC_TOURNEES_PER_REQUEST,
  SYNC_VISITS_PER_BATCH,
  TOURNEE_STOP_NUMBER_MAX,
} from "../shared/constants";
import { syncResponseSchema, todayTourneeSchema } from "../shared/schemas";
import type { SyncRequest, SyncResponse } from "../shared/schemas";
import { MAX_VALIDATION_ISSUES } from "./validate";
import { workerFetch } from "../../test/worker-fetch";
import { testSessionCookie } from "../../test/session";
import { TEST_AGENT, resetTestUsers, seedUser } from "../../test/users";

/**
 * Routes against a real D1, built by the real migrations.
 * DEV_USER_EMAIL is bound in vitest.config.ts; these run as the test agent, since
 * /api/agent/* is agents only (ADR-0037).
 */

const AGENT = TEST_AGENT;
/** A second agent, for the tests where somebody else sends or owns. */
const OTHER_AGENT = "other-agent@example.com";
const SAVED_DEV_USER = env.DEV_USER_EMAIL;

async function call(path: string, init?: RequestInit): Promise<Response> {
  return workerFetch(`http://localhost${path}`, init);
}

async function sync(body: Partial<SyncRequest>): Promise<Response> {
  return call("/api/agent/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientVersion: CLIENT_VERSION, prospects: [], visits: [], ...body }),
  });
}

async function seedProspect(id: string, owner: string | null = AGENT): Promise<void> {
  await seedProspects([id], owner);
}

/** Many at once: a batch of sequential inserts would dominate a test's runtime. */
async function seedProspects(ids: readonly string[], owner: string | null = AGENT): Promise<void> {
  const db = getDb(env.DB);
  const now = Date.now();
  const rows = ids.map((id) => ({
    id,
    name: "Le Bistrot",
    type: "restaurant" as const,
    lat: 48.85,
    lng: 2.35,
    address: null,
    phone: null,
    website: null,
    cuisine: null,
    source: "csv" as const,
    sourceRef: null,
    dedupeKey: `test:${id}`,
    status: "assigned" as const,
    assignedTo: owner,
    createdBy: AGENT,
    createdAt: now,
    updatedAt: now,
  }));
  for (const batch of chunk(rows, boundParamsPerRow(prospects))) {
    await db.insert(prospects).values(batch);
  }
}

beforeEach(async () => {
  const db = getDb(env.DB);
  // Order matters: stops reference tournées and prospects, visits reference prospects.
  await db.delete(tourneeStops);
  await db.delete(tournees);
  await db.delete(visits);
  // No foreign keys of its own, but it holds rows across tests just the same.
  await db.delete(visitsOrphaned);
  await db.delete(prospects);
  await db.delete(scripts);
  await resetTestUsers();
  await seedUser(OTHER_AGENT, "agent");
  env.DEV_USER_EMAIL = AGENT;
});

afterEach(() => {
  env.DEV_USER_EMAIL = SAVED_DEV_USER;
});

describe("GET /api/me", () => {
  it("returns the identity and the derived role", async () => {
    const response = await call("/api/me");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: AGENT, role: "agent" });
  });
});

describe("POST /api/agent/sync", () => {
  it("rejects a body that does not match the schema", async () => {
    const response = await sync({ visits: [{ id: "not-a-uuid" }] as never });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("validation");
  });

  it("caps a 400's issues at their path and code, however malformed the body (#36)", async () => {
    const answers = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`q${i}`, { nested: true }]),
    );
    const visit = {
      id: crypto.randomUUID(),
      prospectId: crypto.randomUUID(),
      visitedAt: Date.now(),
      flyerGiven: false,
      outcome: "not_interested",
      answers,
    };
    const response = await sync({ visits: [visit] as never });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; issues: object[] };
    expect(body.error).toBe("validation");
    expect(body.issues).toHaveLength(MAX_VALIDATION_ISSUES);
    for (const issue of body.issues) expect(Object.keys(issue).sort()).toEqual(["code", "path"]);
  });

  it("caps a visit's answers at a script's question ceiling (#32)", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);
    const visitWith = (count: number) => ({
      id: crypto.randomUUID(),
      prospectId,
      visitedAt: Date.now(),
      flyerGiven: false,
      outcome: "not_interested" as const,
      answers: Object.fromEntries(Array.from({ length: count }, (_, i) => [`q${i}`, true])),
    });

    const refused = await sync({ visits: [visitWith(SCRIPT_QUESTIONS_MAX + 1)] });
    expect(refused.status).toBe(400);
    expect(await getDb(env.DB).select().from(visits)).toHaveLength(0);

    const accepted = await sync({ visits: [visitWith(SCRIPT_QUESTIONS_MAX)] });
    expect(accepted.status).toBe(200);
    expect(await getDb(env.DB).select().from(visits)).toHaveLength(1);
  });

  it("requires followUpAt when the outcome is follow_up", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const response = await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: true,
          outcome: "follow_up",
          answers: {},
        } as never,
      ],
    });
    expect(response.status).toBe(400);
  });

  it("stores a visit and derives the prospect's status on the server", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const response = await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: true,
          outcome: "converted",
          answers: {},
        } as never,
      ],
    });

    expect(response.status).toBe(200);
    // Parsed with the wire schema the client trusts, not just cast.
    const body = syncResponseSchema.parse(await response.json());
    expect(body.accepted.visits).toHaveLength(1);

    const db = getDb(env.DB);
    const [row] = await db.select().from(prospects);
    // INVARIANT 3: the client sent an outcome, never a status.
    expect(row?.status).toBe("converted");
  });

  it("stores refusalReason when the outcome is not_interested", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const response = await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "not_interested",
          refusalReason: "too_many_devices",
          answers: {},
        } as never,
      ],
    });

    expect(response.status).toBe(200);
    const db = getDb(env.DB);
    const [visitRow] = await db.select().from(visits);
    expect(visitRow?.refusalReason).toBe("too_many_devices");
    const [prospectRow] = await db.select().from(prospects);
    expect(prospectRow?.status).toBe("rejected");
  });

  it("stores refusalReason as null when an old build omits it", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const response = await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "not_interested",
          answers: {},
        } as never,
      ],
    });

    expect(response.status).toBe(200);
    const db = getDb(env.DB);
    const [visitRow] = await db.select().from(visits);
    expect(visitRow?.refusalReason).toBeNull();
    const [prospectRow] = await db.select().from(prospects);
    expect(prospectRow?.status).toBe("rejected");
  });

  it("drops refusalReason sent with another outcome", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const response = await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "converted",
          refusalReason: "no_need",
          answers: {},
        } as never,
      ],
    });

    expect(response.status).toBe(200);
    const db = getDb(env.DB);
    const [visitRow] = await db.select().from(visits);
    expect(visitRow?.refusalReason).toBeNull();
    const [prospectRow] = await db.select().from(prospects);
    expect(prospectRow?.status).toBe("converted");
  });

  it.each(OUTCOMES)("a refusalReason never changes the status %s derives", async (outcome) => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const response = await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome,
          followUpAt: Date.now() + 86_400_000,
          refusalReason: "out_of_target",
          answers: {},
        } as never,
      ],
    });

    expect(response.status).toBe(200);
    const [prospectRow] = await getDb(env.DB).select().from(prospects);
    expect(prospectRow?.status).toBe(OUTCOME_TO_STATUS[outcome]);
    const [visitRow] = await getDb(env.DB).select().from(visits);
    expect(visitRow?.refusalReason).toBe(outcome === "not_interested" ? "out_of_target" : null);
  });

  it("rejects a refusalReason outside the enum, as for any bad value", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const response = await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "not_interested",
          refusalReason: "bogus",
          answers: {},
        } as never,
      ],
    });

    expect(response.status).toBe(400);
  });

  it("is idempotent: resending the same payload changes nothing", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);
    const payload = {
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "interested",
          answers: {},
        } as never,
      ],
    };

    await sync(payload);
    const second = await sync(payload);
    expect(second.status).toBe(200);

    const db = getDb(env.DB);
    expect(await db.select().from(visits)).toHaveLength(1);
    // Accepted again, so a phone that missed the first response can clear it.
    expect(((await second.json()) as SyncResponse).accepted.visits).toHaveLength(1);
  });

  it("clamps a visit dated in the future so it cannot freeze the status", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);
    const oneYearAhead = Date.now() + 365 * 24 * 3600 * 1000;

    await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: oneYearAhead,
          flyerGiven: false,
          outcome: "interested",
          answers: {},
        } as never,
      ],
    });

    const db = getDb(env.DB);
    const [stored] = await db.select().from(visits);

    // INVARIANT 12: stored time is clamped, raw phone clock is preserved.
    expect(stored?.visitedAt).toBeLessThanOrEqual(Date.now());
    expect(stored?.clientVisitedAt).toBe(oneYearAhead);

    // A later, honest visit must still win.
    await sync({
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "not_interested",
          answers: {},
        } as never,
      ],
    });
    const [row] = await db.select().from(prospects);
    expect(row?.status).toBe("rejected");
  });

  it("records the contract version of the sending build", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);
    await sync({
      clientVersion: CLIENT_VERSION,
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "interested",
          answers: {},
        } as never,
      ],
    });

    const db = getDb(env.DB);
    const [stored] = await db.select().from(visits);
    expect(stored?.clientVersion).toBe(CLIENT_VERSION);
  });

  it("answers 426 for a build below the minimum supported version", async () => {
    const response = await sync({ clientVersion: 0 });
    expect(response.status).toBe(426);
  });

  // INVARIANT 5: an old build's payload may no longer match the schema, and only
  // the 426 tells it the outbox is fine.
  it("answers 426, not 400, for an old build whose body also fails the schema", async () => {
    const response = await sync({ clientVersion: 0, visits: [{ id: "not-a-uuid" }] as never });
    expect(response.status).toBe(426);
  });

  // GH #451: a build from before the cap fell to SYNC_VISITS_PER_BATCH still
  // sends up to 200 visits a pass; it must be told to update, keeping its outbox.
  it("answers 426, not 400, to the previous version sending more than a batch", async () => {
    const response = await sync({
      clientVersion: CLIENT_VERSION - 1,
      visits: Array.from({ length: SYNC_VISITS_PER_BATCH + 1 }, () => ({
        id: crypto.randomUUID(),
        prospectId: crypto.randomUUID(),
        visitedAt: Date.now(),
        flyerGiven: true,
        outcome: "interested" as const,
        answers: {},
      })),
    });
    expect(response.status).toBe(426);
    expect(await getDb(env.DB).select().from(visits)).toHaveLength(0);
  });

  it("answers 400, not 500, to a body that is not JSON", async () => {
    const response = await call("/api/agent/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(response.status).toBe(400);
  });

  /**
   * docs/security.md, "Malformed or oversized payloads". The body here is not
   * valid JSON at all, so a 400 or a 500 would prove the cap ran *after* the
   * parse it exists to prevent (INVARIANT 13).
   */
  it("refuses a body over MAX_REQUEST_BYTES before parsing it", async () => {
    const response = await call("/api/agent/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(MAX_REQUEST_BYTES + 1),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: "too_large" });
  });

  /**
   * The other direction, and the one that matters more: a cap set below what a
   * phone can legitimately build answers 413 to a payload the outbox rebuilds
   * identically for ever (INVARIANT 5).
   *
   * The phone sends SYNC_VISITS_PER_BATCH visits a pass and the server
   * accepts exactly that many (GH #451).
   */
  it("accepts a full batch of visits carrying maximum-length notes", async () => {
    const db = getDb(env.DB);
    const ids = Array.from({ length: SYNC_VISITS_PER_BATCH }, () => crypto.randomUUID());
    await seedProspects(ids);
    const sent = ids.map((prospectId) => ({
      id: crypto.randomUUID(),
      prospectId,
      visitedAt: Date.now(),
      flyerGiven: true,
      outcome: "interested" as const,
      notes: "é".repeat(2000),
      answers: {},
    }));

    const response = await sync({ visits: sent });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SyncResponse;
    expect(body.accepted.visits).toHaveLength(SYNC_VISITS_PER_BATCH);
    expect(new Set(body.accepted.visits)).toEqual(new Set(sent.map((v) => v.id)));
    expect(await db.select().from(visits)).toHaveLength(SYNC_VISITS_PER_BATCH);
  });

  it("refuses one visit over a batch with 400, storing none", async () => {
    const response = await sync({
      visits: Array.from({ length: SYNC_VISITS_PER_BATCH + 1 }, () => ({
        id: crypto.randomUUID(),
        prospectId: crypto.randomUUID(),
        visitedAt: Date.now(),
        flyerGiven: true,
        outcome: "interested" as const,
        answers: {},
      })),
    });

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("validation");
    expect(await getDb(env.DB).select().from(visits)).toHaveLength(0);
  });

  /**
   * #102. Deriving status took two D1 statements per distinct prospect, so a
   * full batch was ~400 round trips in one request. It is now one statement
   * per chunk of prospects; this pins both the result and that it stays a
   * handful, on a real D1 so the chunk's bound parameters are checked too.
   */
  it("derives a full batch of distinct prospects in a handful of statements", async () => {
    const db = getDb(env.DB);
    const ids = Array.from({ length: SYNC_VISITS_PER_BATCH }, () => crypto.randomUUID());
    await seedProspects(ids);
    const outcomeOf = (i: number): Outcome => OUTCOMES[i % OUTCOMES.length] as Outcome;

    const statements: string[] = [];
    const counted = new Proxy(env.DB, {
      get(target, key) {
        if (key === "prepare")
          return (query: string) => (statements.push(query), target.prepare(query));
        const value: unknown = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const now = Date.now();
    const response = await workerFetch(
      "http://localhost/api/agent/sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientVersion: CLIENT_VERSION,
          prospects: [],
          visits: ids.map((prospectId, i) => ({
            id: crypto.randomUUID(),
            prospectId,
            visitedAt: now - i,
            flyerGiven: false,
            outcome: outcomeOf(i),
            answers: {},
            ...(outcomeOf(i) === "follow_up" && { followUpAt: now + 86_400_000 }),
          })),
        }),
      },
      { DB: counted },
    );

    expect(response.status).toBe(200);
    const updates = statements.filter((q) => /^update "prospects"/i.test(q));
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.length).toBeLessThanOrEqual(3);
    const rows = await db.select().from(prospects);
    expect(rows).toHaveLength(SYNC_VISITS_PER_BATCH);
    for (const row of rows) {
      const i = ids.indexOf(row.id);
      expect(row.status).toBe(OUTCOME_TO_STATUS[outcomeOf(i)]);
      expect(row.lastVisitAt).toBe(now - i);
      expect(row.nextVisitAt).toBe(outcomeOf(i) === "follow_up" ? now + 86_400_000 : null);
    }
  });

  it("returns the existing prospect's id when a field prospect already exists", async () => {
    // Same name and position as the seeded prospect, so the dedupe key collides.
    const db = getDb(env.DB);
    const existingId = crypto.randomUUID();
    await db.insert(prospects).values({
      id: existingId,
      name: "Le Bistrot",
      type: "restaurant",
      lat: 48.85,
      lng: 2.35,
      address: null,
      phone: null,
      website: null,
      cuisine: null,
      source: "csv",
      sourceRef: null,
      dedupeKey: "geo:le-bistrot:48.850:2.350",
      status: "new",
      assignedTo: null,
      createdBy: AGENT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const clientId = crypto.randomUUID();
    const response = await sync({
      prospects: [
        {
          id: clientId,
          name: "Le Bistrot",
          type: "restaurant",
          lat: 48.85,
          lng: 2.35,
          createdAt: Date.now(),
        } as never,
      ],
    });

    const body = (await response.json()) as SyncResponse;
    expect(body.idMap[clientId]).toBe(existingId);
    expect(body.accepted.prospects).toContain(clientId);
    expect(await db.select().from(prospects)).toHaveLength(1);
  });

  it("points a field prospect, and its visit, at the survivor of the row it collides with", async () => {
    // The key lands on a prospect an admin has merged away: the phone must be
    // told the survivor, or its visits would pile up on a retired row.
    const db = getDb(env.DB);
    const survivor = crypto.randomUUID();
    const merged = crypto.randomUUID();
    await seedProspects([survivor, merged]);
    await db
      .update(prospects)
      .set({
        dedupeKey: dedupeKey({ name: "Le Bistrot", lat: 48.85, lng: 2.35 }),
        mergedInto: survivor,
      })
      .where(eq(prospects.id, merged));

    const clientId = crypto.randomUUID();
    const visitId = crypto.randomUUID();
    const response = await sync({
      prospects: [
        {
          id: clientId,
          name: "Le Bistrot",
          type: "restaurant",
          lat: 48.85,
          lng: 2.35,
          createdAt: Date.now(),
        },
      ] as never,
      visits: [
        {
          id: visitId,
          prospectId: clientId,
          visitedAt: Date.now(),
          flyerGiven: true,
          outcome: "interested",
          answers: {},
        },
      ] as never,
    });

    const body = (await response.json()) as SyncResponse;
    expect(body.idMap).toEqual({ [clientId]: survivor });
    expect(body.accepted.prospects).toEqual([clientId]);
    expect(await db.select().from(prospects)).toHaveLength(2);
    const [stored] = await db.select().from(visits).where(eq(visits.id, visitId));
    expect(stored?.prospectId).toBe(survivor);
  });

  it("stores a field prospect's folded name for search (ADR-0032)", async () => {
    const id = crypto.randomUUID();
    const response = await sync({
      prospects: [
        { id, name: "Crêperie Élise", type: "restaurant", createdAt: Date.now() } as never,
      ],
    });
    expect(response.status).toBe(200);

    const [row] = await getDb(env.DB).select().from(prospects).where(eq(prospects.id, id));
    expect(row?.nameSearch).toBe("creperie elise");
  });

  it("inserts more rows than fit in one D1 statement", async () => {
    // Regression: the per-row parameter count used to be hand-counted and was
    // wrong, so any batch large enough to need chunking failed outright
    // (INVARIANT 7). 30 field prospects needs several statements.
    const created = Array.from({ length: 30 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Découverte ${i}`,
      type: "food_truck" as const,
      lat: 45.75 + i * 0.001,
      lng: 4.83,
      createdAt: Date.now(),
    }));

    const response = await sync({ prospects: created as never });
    expect(response.status).toBe(200);

    const body = (await response.json()) as SyncResponse;
    expect(body.accepted.prospects).toHaveLength(30);

    const db = getDb(env.DB);
    expect(await db.select().from(prospects)).toHaveLength(30);
  });

  it("stores a full payload of field prospects with every column the route sets (GH #449)", async () => {
    const created = Array.from({ length: SYNC_PROSPECTS_PER_REQUEST }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Café Épicerie ${i}`,
      type: i % 2 === 0 ? ("restaurant" as const) : ("food_truck" as const),
      lat: 45.75 + i * 0.001,
      lng: 4.83,
      address: i % 3 === 0 ? `${i} rue de la Paix` : undefined,
      phone: i % 5 === 0 ? `+3300000${i}` : undefined,
      createdAt: 1_700_000_000_000 + i,
    }));

    // A full batch of visits rides on them, as a day offline would send.
    const visited = created.slice(0, SYNC_VISITS_PER_BATCH).map((p) => ({
      id: crypto.randomUUID(),
      prospectId: p.id,
      visitedAt: Date.now(),
      flyerGiven: true,
      outcome: "interested",
      answers: {},
    }));

    const response = await sync({ prospects: created as never, visits: visited as never });
    expect(response.status).toBe(200);
    const body = (await response.json()) as SyncResponse;
    expect(body.accepted.prospects).toHaveLength(SYNC_PROSPECTS_PER_REQUEST);
    expect(body.accepted.visits).toHaveLength(SYNC_VISITS_PER_BATCH);
    expect(body.idMap).toEqual({});
    expect(await getDb(env.DB).select().from(visits)).toHaveLength(SYNC_VISITS_PER_BATCH);

    const stored = await getDb(env.DB).select().from(prospects);
    expect(stored).toHaveLength(SYNC_PROSPECTS_PER_REQUEST);
    for (const [i, sent] of created.entries()) {
      const row = stored.find((r) => r.id === sent.id);
      expect(row).toMatchObject({
        name: sent.name,
        nameSearch: `cafe epicerie ${i}`,
        type: sent.type,
        lat: sent.lat,
        lng: sent.lng,
        address: sent.address ?? null,
        phone: sent.phone ?? null,
        source: "field",
        sourceRef: null,
        // Stored as assigned; a visit in the same payload then derives its status.
        status: i < SYNC_VISITS_PER_BATCH ? "interested" : "assigned",
        assignedTo: AGENT,
        createdBy: AGENT,
        createdAt: sent.createdAt,
      });
      expect(row?.dedupeKey).toBe(
        dedupeKey({ name: sent.name, lat: sent.lat, lng: sent.lng, address: sent.address }),
      );
    }
  });

  it("stores the first of two field prospects with the same key and maps the second to it", async () => {
    const first = crypto.randomUUID();
    const twin = crypto.randomUUID();
    const place = { name: "Le Camion", type: "food_truck", lat: 45.76, lng: 4.83 };
    const response = await sync({
      prospects: [
        { id: first, ...place, createdAt: Date.now() },
        { id: twin, ...place, createdAt: Date.now() },
      ] as never,
    });

    const body = (await response.json()) as SyncResponse;
    expect(body.idMap).toEqual({ [twin]: first });
    expect(body.accepted.prospects).toEqual(expect.arrayContaining([first, twin]));
    const stored = await getDb(env.DB).select().from(prospects);
    expect(stored.map((r) => r.id)).toEqual([first]);
  });

  it("stores nothing new and accepts everything when the same payload is resent", async () => {
    const created = Array.from({ length: 12 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Renvoi ${i}`,
      type: "restaurant" as const,
      lat: 45.7 + i * 0.001,
      lng: 4.8,
      createdAt: Date.now(),
    }));

    const firstPass = await sync({ prospects: created as never });
    expect(firstPass.status).toBe(200);
    const secondPass = await sync({ prospects: created as never });
    expect(secondPass.status).toBe(200);

    const body = (await secondPass.json()) as SyncResponse;
    expect(body.accepted.prospects).toHaveLength(12);
    expect(body.idMap).toEqual({});
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(12);
  });

  it("quarantines a visit whose prospect is unknown, and accepts it", async () => {
    // ADR-0022. This used to be neither stored nor accepted, which kept the
    // visit safe but left the phone resending it for ever whenever the prospect
    // genuinely was not coming. It is now stored in visits_orphaned, where it
    // is just as safe, and reported in `accepted` so the outbox drains —
    // `accepted` means the server has durably taken the visit, not that a row
    // exists in `visits`.
    const id = crypto.randomUUID();
    const response = await sync({
      visits: [
        {
          id,
          prospectId: crypto.randomUUID(), // never inserted
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "interested",
          answers: {},
        } as never,
      ],
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SyncResponse;
    expect(body.accepted.visits).toContain(id);

    const db = getDb(env.DB);
    expect(await db.select().from(visits)).toHaveLength(0);
    const [held] = await db.select().from(visitsOrphaned);
    expect(held?.id).toBe(id);
    expect(held?.reason).toBe("unknown_prospect");
  });

  it("accepts a visit against a field prospect created in the same payload", async () => {
    // The ordinary case the filter must not break: prospects are inserted
    // before visits precisely so a visit can reference one of them.
    const clientProspectId = crypto.randomUUID();
    const response = await sync({
      prospects: [
        {
          id: clientProspectId,
          name: "Camion du marché",
          type: "food_truck",
          lat: 45.76,
          lng: 4.83,
          createdAt: Date.now(),
        } as never,
      ],
      visits: [
        {
          id: crypto.randomUUID(),
          prospectId: clientProspectId,
          visitedAt: Date.now(),
          flyerGiven: true,
          outcome: "interested",
          answers: {},
        } as never,
      ],
    });

    const body = (await response.json()) as SyncResponse;
    expect(body.accepted.visits).toHaveLength(1);
    expect(await getDb(env.DB).select().from(visits)).toHaveLength(1);
  });

  it("pulls back only the agent's open prospects", async () => {
    const db = getDb(env.DB);
    const mine = crypto.randomUUID();
    await seedProspect(mine);
    await db.insert(prospects).values({
      id: crypto.randomUUID(),
      name: "Fermé",
      type: "bar",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      website: null,
      cuisine: null,
      source: "csv",
      sourceRef: null,
      dedupeKey: "test:closed",
      status: "converted",
      assignedTo: AGENT,
      createdBy: AGENT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const body = (await (await sync({})).json()) as SyncResponse;
    expect(body.prospects.map((p) => p.id)).toEqual([mine]);
  });
});

describe("POST /api/agent/sync — the script a visit was answered with", () => {
  async function seedScript(): Promise<number> {
    const db = getDb(env.DB);
    const [row] = await db
      .insert(scripts)
      .values({
        name: "Questionnaire",
        version: 1,
        questions: [{ key: "has_delivery", label: "Livraison ?", type: "yes_no" }],
        isActive: true,
        createdAt: Date.now(),
      })
      .returning({ id: scripts.id });
    if (!row) throw new Error("seed failed");
    return row.id;
  }

  it("pulls the active script down on every sync", async () => {
    const scriptId = await seedScript();
    const body = (await (await sync({})).json()) as SyncResponse;

    expect(body.script?.id).toBe(scriptId);
    expect(body.script?.questions).toHaveLength(1);
  });

  it("pulls null when no script has been saved yet", async () => {
    const body = (await (await sync({})).json()) as SyncResponse;
    expect(body.script).toBeNull();
  });

  it("stores the script id and the answers a visit was given", async () => {
    const scriptId = await seedScript();
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const visitId = crypto.randomUUID();
    const response = await sync({
      visits: [
        {
          id: visitId,
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: true,
          outcome: "interested",
          scriptId,
          answers: { has_delivery: true },
        },
      ],
    });
    expect(response.status).toBe(200);

    const db = getDb(env.DB);
    const [row] = await db
      .select({ scriptId: visits.scriptId, answers: visits.answers })
      .from(visits)
      .where(eq(visits.id, visitId));

    expect(row?.scriptId).toBe(scriptId);
    expect(row?.answers).toEqual({ has_delivery: true });
  });

  /**
   * INVARIANT 5. `visits.script_id` is a foreign key, so a visit naming a
   * script this database does not have would fail the whole chunked insert and
   * cost the agent every visit in the batch. Refusing the visit instead would
   * strand it in the outbox for ever (docs/backlog/003). The visit is true
   * either way — only the questionnaire reference is stale.
   */
  it("keeps a visit whose script id this database does not know, answers and all", async () => {
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const visitId = crypto.randomUUID();
    const response = await sync({
      visits: [
        {
          id: visitId,
          prospectId,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "interested",
          scriptId: 424_242,
          answers: { has_delivery: false },
        },
      ],
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SyncResponse;
    expect(body.accepted.visits).toContain(visitId);

    const db = getDb(env.DB);
    const [row] = await db
      .select({ scriptId: visits.scriptId, answers: visits.answers })
      .from(visits)
      .where(eq(visits.id, visitId));

    expect(row?.scriptId).toBeNull();
    expect(row?.answers).toEqual({ has_delivery: false });
  });

  it("does not let one unknown script id take down the rest of the batch", async () => {
    const scriptId = await seedScript();
    const prospectId = crypto.randomUUID();
    await seedProspect(prospectId);

    const good = crypto.randomUUID();
    const stale = crypto.randomUUID();
    const base = { prospectId, visitedAt: Date.now(), flyerGiven: false, outcome: "interested" };

    const response = await sync({
      visits: [
        { ...base, id: good, scriptId, answers: {} },
        { ...base, id: stale, scriptId: 424_242, answers: {} },
      ] as SyncRequest["visits"],
    });

    const body = (await response.json()) as SyncResponse;
    expect(body.accepted.visits).toEqual(expect.arrayContaining([good, stale]));
  });
});

describe("GET /api/agent/prospects/:id/visits", () => {
  const PROSPECT = "33333333-3333-4333-8333-333333333333";

  it("rejects an id that is not a UUID with 400, not 404", async () => {
    // A malformed id is a client bug; a well-formed unknown one is a 404.
    const response = await call("/api/agent/prospects/not-a-uuid/visits");
    expect(response.status).toBe(400);
  });

  it("404s a prospect that does not exist", async () => {
    const response = await call(`/api/agent/prospects/${PROSPECT}/visits`);
    expect(response.status).toBe(404);
  });

  it("answers an admin 403, even for a prospect that exists (ADR-0037)", async () => {
    await seedProspect(PROSPECT);
    env.DEV_USER_EMAIL = "admin@example.com";
    const response = await call(`/api/agent/prospects/${PROSPECT}/visits`);
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: string }).error).toBe("forbidden");
  });

  it("answers an admin 403 on sync and writes nothing", async () => {
    await seedProspect(PROSPECT);
    env.DEV_USER_EMAIL = "admin@example.com";
    const id = crypto.randomUUID();
    const response = await sync({
      visits: [
        {
          id,
          prospectId: PROSPECT,
          visitedAt: Date.now(),
          flyerGiven: false,
          outcome: "interested",
          answers: {},
        },
      ],
    });
    expect(response.status).toBe(403);
    expect(await getDb(env.DB).select().from(visits)).toHaveLength(0);
  });

  it("returns the history newest first, matching the shared contract", async () => {
    await seedProspect(PROSPECT);
    await sync({
      visits: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          prospectId: PROSPECT,
          visitedAt: 1_600_000_000_000,
          flyerGiven: true,
          outcome: "interested",
          notes: "ferme le lundi",
          answers: {},
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          prospectId: PROSPECT,
          visitedAt: 1_600_000_100_000,
          flyerGiven: false,
          outcome: "not_interested",
          answers: {},
        },
      ],
    });

    const response = await call(`/api/agent/prospects/${PROSPECT}/visits`);
    expect(response.status).toBe(200);

    const body = visitHistoryResponseSchema.parse(await response.json());
    expect(body.visits.map((v) => v.outcome)).toEqual(["not_interested", "interested"]);
    expect(body.visits[1]?.notes).toBe("ferme le lundi");
  });

  it("leaks no clock-skew or upgrade diagnostics", async () => {
    await seedProspect(PROSPECT);
    await sync({
      visits: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          prospectId: PROSPECT,
          visitedAt: 1_600_000_000_000,
          flyerGiven: true,
          outcome: "interested",
          answers: {},
        },
      ],
    });

    const body = (await (await call(`/api/agent/prospects/${PROSPECT}/visits`)).json()) as {
      visits: Record<string, unknown>[];
    };

    const entry = body.visits[0] ?? {};
    expect(entry).not.toHaveProperty("clientVisitedAt");
    expect(entry).not.toHaveProperty("receivedAt");
    expect(entry).not.toHaveProperty("clientVersion");
  });
});

/**
 * ADR-0022 and #33.
 *
 * Sync used to check only that a visit's prospect *existed*, so any signed-in
 * agent could post a visit against any prospect id and — because the server
 * derives status from the newest visit — change it. Such a visit is now
 * quarantined: kept, attributed, accepted, and inert until an admin decides
 * where it belongs.
 */
describe("POST /api/agent/sync — a visit for someone else's prospect", () => {
  const OTHER = OTHER_AGENT;

  const visitOf = (prospectId: string, outcome: Outcome) => ({
    id: crypto.randomUUID(),
    prospectId,
    visitedAt: Date.now(),
    flyerGiven: false,
    outcome,
    answers: {},
  });

  /** Runs one sync as somebody else, then restores the ambient identity. */
  async function asOtherAgent(body: Partial<SyncRequest>): Promise<Response> {
    const saved = env.DEV_USER_EMAIL;
    try {
      env.DEV_USER_EMAIL = OTHER;
      return await sync(body);
    } finally {
      env.DEV_USER_EMAIL = saved;
    }
  }

  it("does not let another agent reject a prospect out of its owner's round", async () => {
    const db = getDb(env.DB);
    const id = crypto.randomUUID();
    await seedProspect(id, AGENT);

    const response = await asOtherAgent({ visits: [visitOf(id, "not_interested")] });
    expect(response.status).toBe(200);

    const [row] = await db.select().from(prospects).where(eq(prospects.id, id));
    // "rejected" is outside OPEN_STATUSES, which is what would have dropped it
    // off the owner's today list.
    expect(row?.status).toBe("assigned");
    expect(row?.lastVisitAt).toBeNull();
  });

  it("quarantines it rather than storing it, and accepts it all the same", async () => {
    const db = getDb(env.DB);
    const id = crypto.randomUUID();
    await seedProspect(id, AGENT);
    const visit = visitOf(id, "not_interested");

    const response = await asOtherAgent({ visits: [visit] });
    const body = (await response.json()) as SyncResponse;

    // Accepted, so the phone clears its outbox instead of resending for ever.
    expect(body.accepted.visits).toContain(visit.id);
    expect(await db.select().from(visits)).toHaveLength(0);

    const [held] = await db.select().from(visitsOrphaned);
    expect(held?.id).toBe(visit.id);
    expect(held?.reason).toBe("not_assigned");
    // It keeps the prospect it named, so approving it is just a repair against
    // that same id.
    expect(held?.prospectId).toBe(id);
    // Attributed to whoever really wrote it (INVARIANT 10), never the assignee.
    expect(held?.agentEmail).toBe(OTHER);
  });

  it("quarantines a refusal with its reason intact", async () => {
    const db = getDb(env.DB);
    const id = crypto.randomUUID();
    await seedProspect(id, AGENT);
    const visit = { ...visitOf(id, "not_interested"), refusalReason: "no_need" as const };

    await asOtherAgent({ visits: [visit] });

    const [held] = await db.select().from(visitsOrphaned);
    expect(held?.refusalReason).toBe("no_need");
  });

  it("still derives status from the assignee's own visit", async () => {
    const db = getDb(env.DB);
    const id = crypto.randomUUID();
    await seedProspect(id, AGENT);

    await sync({ visits: [visitOf(id, "not_interested")] });

    const [row] = await db.select().from(prospects).where(eq(prospects.id, id));
    expect(row?.status).toBe("rejected");
    expect(await db.select().from(visitsOrphaned)).toHaveLength(0);
  });

  it("does not let a later outsider visit undo the assignee's outcome", async () => {
    const db = getDb(env.DB);
    const id = crypto.randomUUID();
    await seedProspect(id, AGENT);

    await sync({ visits: [visitOf(id, "converted")] });
    await asOtherAgent({ visits: [visitOf(id, "not_interested")] });

    const [row] = await db.select().from(prospects).where(eq(prospects.id, id));
    expect(row?.status).toBe("converted");
  });

  it("quarantines a visit for an unassigned prospect", async () => {
    const db = getDb(env.DB);
    const id = crypto.randomUUID();
    await seedProspect(id, null);

    await sync({ visits: [visitOf(id, "converted")] });

    const [row] = await db.select().from(prospects).where(eq(prospects.id, id));
    expect(row?.status).toBe("assigned");
    expect((await db.select().from(visitsOrphaned))[0]?.reason).toBe("not_assigned");
  });

  it("replaying a quarantined payload stays a no-op", async () => {
    const db = getDb(env.DB);
    const id = crypto.randomUUID();
    await seedProspect(id, AGENT);
    const visit = visitOf(id, "interested");

    await asOtherAgent({ visits: [visit] });
    await asOtherAgent({ visits: [visit] });

    expect(await db.select().from(visitsOrphaned)).toHaveLength(1);
  });
});

describe("POST /api/agent/sync — a late visit against a newer outcome", () => {
  const DAY = 24 * 3600 * 1000;

  const visitAt = (prospectId: string, outcome: Outcome, visitedAt: number) => ({
    id: crypto.randomUUID(),
    prospectId,
    visitedAt,
    flyerGiven: false,
    outcome,
    answers: {},
    ...(outcome === "follow_up" && { followUpAt: visitedAt + 7 * DAY }),
  });

  /** The admin's PATCH: sent as the test admin, then back to the agent. */
  async function patch(id: string, body: Record<string, unknown>): Promise<Response> {
    env.DEV_USER_EMAIL = "admin@example.com";
    try {
      return await call(`/api/admin/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      env.DEV_USER_EMAIL = AGENT;
    }
  }

  async function prospect(id: string) {
    const [row] = await getDb(env.DB).select().from(prospects).where(eq(prospects.id, id));
    return row;
  }

  it("does not let an older visit that syncs later overwrite a newer outcome (ADR-0011)", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);
    const now = Date.now();

    await sync({ visits: [visitAt(id, "converted", now - DAY)] });
    await sync({ visits: [visitAt(id, "not_interested", now - 3 * DAY)] });

    const row = await prospect(id);
    expect(row?.status).toBe("converted");
    expect(row?.lastVisitAt).toBe(now - DAY);
  });

  it("keeps an admin's manual status against a visit made before it (ADR-0025)", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);
    const monday = Date.now() - 2 * DAY;

    // Tuesday: the admin closes it after a phone call.
    expect((await patch(id, { status: "converted", nextVisitAt: null })).status).toBe(200);

    // Wednesday: Monday's offline visit finally syncs.
    const response = await sync({ visits: [visitAt(id, "follow_up", monday)] });
    const body = (await response.json()) as SyncResponse;

    const row = await prospect(id);
    expect(row?.status).toBe("converted");
    // The visit is still a fact: it is stored and dates the last visit…
    expect(row?.lastVisitAt).toBe(monday);
    // …but it does not schedule a follow-up on a prospect the admin closed.
    expect(row?.nextVisitAt).toBeNull();
    expect(body.accepted.visits).toHaveLength(1);
    expect(body.prospects.map((p) => p.id)).not.toContain(id);
  });

  it("still lets a visit made after the admin's change move the status", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);

    await patch(id, { status: "rejected" });
    await sync({ visits: [visitAt(id, "interested", Date.now())] });

    expect((await prospect(id))?.status).toBe("interested");
  });

  it("settles two visits with the same visited_at by id, whatever order they arrive in", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);
    const sameMoment = Date.now() - DAY;
    const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
    const [lower, higher] = a < b ? [a, b] : [b, a];

    // Same sync, so both share a received_at: only the id can decide. The
    // winner is sent first, so the order of the array is not what settles it.
    await sync({
      visits: [
        { ...visitAt(id, "converted", sameMoment), id: higher },
        { ...visitAt(id, "not_interested", sameMoment), id: lower },
      ],
    });

    expect((await prospect(id))?.status).toBe("converted");
  });

  it("prefers the visit received last when visited_at ties across two syncs", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);
    const sameMoment = Date.now() - DAY;
    const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
    const [lower, higher] = a < b ? [a, b] : [b, a];

    await sync({ visits: [{ ...visitAt(id, "converted", sameMoment), id: higher }] });
    // Push the first one an hour back so the two received_at cannot land on the
    // same millisecond, and give it the higher id, so only received_at can put
    // the second visit last.
    await getDb(env.DB)
      .update(visits)
      .set({ receivedAt: Date.now() - 3600 * 1000 })
      .where(eq(visits.id, higher));
    await sync({ visits: [{ ...visitAt(id, "not_interested", sameMoment), id: lower }] });

    expect((await prospect(id))?.status).toBe("rejected");
  });

  it("does not treat an assignment as a manual status", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);

    await patch(id, { assignedTo: AGENT });
    await sync({ visits: [visitAt(id, "interested", Date.now() - DAY)] });

    expect((await prospect(id))?.status).toBe("interested");
  });

  it("closes the prospect on an Intéressé visit, so the next pull leaves it out (ADR-0027)", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);

    const first = (await (
      await sync({ visits: [visitAt(id, "interested", Date.now())] })
    ).json()) as SyncResponse;

    expect((await prospect(id))?.status).toBe("interested");
    expect(first.prospects.map((p) => p.id)).not.toContain(id);
    const next = (await (await sync({})).json()) as SyncResponse;
    expect(next.prospects.map((p) => p.id)).not.toContain(id);
  });

  it("derives the status from a visit made after an admin reopens an Intéressé lead", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);
    await sync({ visits: [visitAt(id, "interested", Date.now() - 2 * DAY)] });

    expect((await patch(id, { status: "assigned" })).status).toBe(200);
    const reopened = (await (await sync({})).json()) as SyncResponse;
    expect(reopened.prospects.map((p) => p.id)).toContain(id);

    await sync({ visits: [visitAt(id, "converted", Date.now())] });
    expect((await prospect(id))?.status).toBe("converted");
  });
});

describe("agent position at sync (ADR-0028)", () => {
  const AGENT_ONLY = AGENT;
  const reading = (capturedAt: number, lat = 50.85) => ({
    lat,
    lng: 4.35,
    accuracy: 15,
    capturedAt,
  });
  const stored = () => getDb(env.DB).select().from(agentPositions);

  beforeEach(async () => {
    // Noon in Brussels, clear of midnight and of a clock change: a reading taken
    // seconds before "now" is today's, which the real clock breaks in the first
    // seconds after midnight (the tournée block below sets the pattern).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-06-17T10:00:00.000Z"));
    await getDb(env.DB).delete(agentPositions);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores nothing for a body with no position", async () => {
    env.DEV_USER_EMAIL = AGENT_ONLY;
    expect((await sync({})).status).toBe(200);
    expect(await stored()).toHaveLength(0);
  });

  it("stores an agent's reading and never echoes it", async () => {
    env.DEV_USER_EMAIL = AGENT_ONLY;
    const before = Date.now();
    const capturedAt = before - 5_000;
    const response = await sync({ position: reading(capturedAt) });
    const after = Date.now();
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("position");
    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      agentEmail: AGENT_ONLY,
      lat: 50.85,
      lng: 4.35,
      accuracy: 15,
      capturedAt,
    });
    expect(rows[0]?.receivedAt).toBeGreaterThanOrEqual(before);
    expect(rows[0]?.receivedAt).toBeLessThanOrEqual(after);
  });

  it("answers an admin 403 and stores no position", async () => {
    env.DEV_USER_EMAIL = "admin@example.com";
    expect((await sync({ position: reading(Date.now() - 5_000) })).status).toBe(403);
    expect(await stored()).toHaveLength(0);
  });

  it("stores a reading for a newly created active agent (GH #303)", async () => {
    await seedUser("fresh@example.com", "agent");
    env.DEV_USER_EMAIL = "fresh@example.com";
    expect((await sync({ position: reading(Date.now() - 5_000) })).status).toBe(200);
    expect(await stored()).toHaveLength(1);
  });

  it("still answers 200 with the visit accepted when the position write fails", async () => {
    env.DEV_USER_EMAIL = AGENT_ONLY;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await seedProspect("22222222-2222-4222-8222-222222222222", AGENT_ONLY);
    const visitId = crypto.randomUUID();
    const realDb = env.DB;
    const broken = new Proxy(realDb, {
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
    env.DB = broken;
    let response: Response;
    try {
      response = await sync({
        position: reading(Date.now() - 5_000),
        visits: [
          {
            id: visitId,
            prospectId: "22222222-2222-4222-8222-222222222222",
            visitedAt: Date.now(),
            flyerGiven: true,
            outcome: "no_contact",
            answers: {},
          },
        ],
      });
    } finally {
      env.DB = realDb;
    }
    expect(response.status).toBe(200);
    expect(((await response.json()) as SyncResponse).accepted.visits).toEqual([visitId]);
    expect(error).toHaveBeenCalledWith("agent position write failed", "Error");
    error.mockRestore();
  });

  it("drops an invalid position but still takes the visit", async () => {
    env.DEV_USER_EMAIL = AGENT_ONLY;
    await seedProspect("11111111-1111-4111-8111-111111111111", AGENT_ONLY);
    const visitId = crypto.randomUUID();
    const response = await sync({
      position: reading(Date.now(), 200),
      visits: [
        {
          id: visitId,
          prospectId: "11111111-1111-4111-8111-111111111111",
          visitedAt: Date.now(),
          flyerGiven: true,
          outcome: "no_contact",
          answers: {},
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as SyncResponse).accepted.visits).toEqual([visitId]);
    expect(await stored()).toHaveLength(0);
  });

  it("keeps the row on an older or equal reading and replaces it on a newer one", async () => {
    env.DEV_USER_EMAIL = AGENT_ONLY;
    const t = Date.now() - 20_000;
    await sync({ position: reading(t, 50.1) });
    await sync({ position: reading(t - 5_000, 50.2) });
    await sync({ position: reading(t, 50.3) });
    expect((await stored())[0]?.lat).toBe(50.1);
    await sync({ position: reading(t + 5_000, 50.4) });
    expect((await stored())[0]?.lat).toBe(50.4);
  });

  it("stores a future-clock reading raw", async () => {
    env.DEV_USER_EMAIL = AGENT_ONLY;
    const future = Date.now() + 3_600_000;
    await sync({ position: reading(future) });
    expect((await stored())[0]?.capturedAt).toBe(future);
  });

  it("does not write a reading from before today", async () => {
    env.DEV_USER_EMAIL = AGENT_ONLY;
    await sync({ position: reading(Date.now() - 48 * 3_600_000) });
    expect(await stored()).toHaveLength(0);
  });
});

describe("tournée at sync (ADR-0036)", () => {
  const OTHER = OTHER_AGENT;

  /**
   * Noon in Brussels, clear of midnight and of a DST switch: these tests put
   * visits and swipes a little before "now" and expect them today, which the
   * real clock breaks between 00:00 and 01:00 Brussels (dashboard.test.ts sets
   * the pattern).
   */
  const NOW = Date.parse("2026-06-17T10:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const tourneeOf = (startedAt = Date.now()) => ({ id: crypto.randomUUID(), startedAt });
  const stopOf = (tourneeId: string, prospectId: string, number: number) => ({
    id: crypto.randomUUID(),
    tourneeId,
    prospectId,
    number,
    addedAt: Date.now(),
  });
  const visitOf = (
    prospectId: string,
    outcome: Outcome,
    over: { visitedAt?: number; flyerGiven?: boolean } = {},
  ) => ({
    id: crypto.randomUUID(),
    prospectId,
    visitedAt: over.visitedAt ?? Date.now(),
    flyerGiven: over.flyerGiven ?? false,
    outcome,
    answers: {},
  });
  /** Parsed with the wire schemas, so a dropped field (`serverTime`) fails here. */
  const bodyOf = async (response: Response): Promise<SyncResponse> => {
    const body = syncResponseSchema.parse(await response.json());
    if (body.tournee) todayTourneeSchema.parse(body.tournee);
    return body;
  };

  /** A stored visit, bypassing sync's ownership rule and its clamp to "now". */
  async function insertVisit(prospectId: string, agentEmail: string, visitedAt: number) {
    await getDb(env.DB).insert(visits).values({
      id: crypto.randomUUID(),
      prospectId,
      agentEmail,
      visitedAt,
      clientVisitedAt: visitedAt,
      receivedAt: visitedAt,
      flyerGiven: false,
      outcome: "interested",
      answers: {},
      clientVersion: CLIENT_VERSION,
    });
  }

  async function asOther(body: Partial<SyncRequest>): Promise<Response> {
    const saved = env.DEV_USER_EMAIL;
    try {
      env.DEV_USER_EMAIL = OTHER;
      return await sync(body);
    } finally {
      env.DEV_USER_EMAIL = saved;
    }
  }

  async function swipe(count: number) {
    const ids = Array.from({ length: count }, () => crypto.randomUUID());
    await seedProspects(ids);
    const t = tourneeOf();
    const stops = ids.map((id, i) => stopOf(t.id, id, i + 1));
    return { ids, t, stops };
  }

  it("stores a swipe, accepts every id and returns the tournée with its stops", async () => {
    const { t, stops } = await swipe(20);
    const body = await bodyOf(await sync({ tournees: [t], stops }));

    expect(body.accepted.tournees).toEqual([t.id]);
    expect(body.accepted.stops).toEqual(stops.map((s) => s.id));
    expect(body.tournee?.id).toBe(t.id);
    expect(body.tournee?.dayStart).toBe(brusselsMidnightDaysFromNow(Date.now(), 0));
    expect(body.tournee?.stops.map((s) => [s.id, s.number, s.left])).toEqual(
      stops.map((s) => [s.id, s.number, false]),
    );
    const db = getDb(env.DB);
    expect(await db.select().from(tournees)).toHaveLength(1);
    expect(await db.select().from(tourneeStops)).toHaveLength(20);
  });

  it("still acknowledges the visits when the tournée write throws, and lists none of its ids", async () => {
    const { ids, t, stops } = await swipe(1);
    const visit = visitOf(ids[0] ?? "", "interested");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await env.DB.exec(
      "CREATE TRIGGER fail_tournee BEFORE INSERT ON tournees BEGIN SELECT RAISE(ABORT, 'tournee down'); END",
    );
    let response: Response;
    let logged: unknown[][];
    try {
      response = await sync({ visits: [visit], tournees: [t], stops });
    } finally {
      await env.DB.exec("DROP TRIGGER fail_tournee");
      logged = [...error.mock.calls];
      error.mockRestore();
    }

    expect(response.status).toBe(200);
    // The name alone: a Drizzle message carries the bound values.
    expect(logged).toContainEqual(["tournee write failed", "Error"]);
    const body = await bodyOf(response);
    expect(body.accepted.visits).toEqual([visit.id]);
    expect(body.accepted.tournees).toEqual([]);
    expect(body.accepted.stops).toEqual([]);
    // The phone resends them, and this time they land.
    const again = await bodyOf(await sync({ tournees: [t], stops }));
    expect(again.accepted.tournees).toEqual([t.id]);
    expect(again.accepted.stops).toEqual(stops.map((s) => s.id));
  });

  it("still acknowledges the visits when the stops insert throws beside a stored tournée, and the resend lands", async () => {
    const { ids, t, stops } = await swipe(2);
    const visit = visitOf(ids[0] ?? "", "interested");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await env.DB.exec(
      "CREATE TRIGGER fail_stops BEFORE INSERT ON tournee_stops BEGIN SELECT RAISE(ABORT, 'stops down'); END",
    );
    let response: Response;
    let logged: unknown[][];
    try {
      response = await sync({ visits: [visit], tournees: [t], stops });
    } finally {
      await env.DB.exec("DROP TRIGGER fail_stops");
      logged = [...error.mock.calls];
      error.mockRestore();
    }

    expect(response.status).toBe(200);
    expect(logged).toContainEqual(["tournee write failed", "Error"]);
    const body = await bodyOf(response);
    expect(body.accepted.visits).toEqual([visit.id]);
    // The tournée row went in before the stops threw; neither is listed, so the phone resends both.
    const db = getDb(env.DB);
    expect(await db.select().from(tournees)).toHaveLength(1);
    expect(await db.select().from(tourneeStops)).toHaveLength(0);
    expect(body.accepted.tournees).toEqual([]);
    expect(body.accepted.stops).toEqual([]);

    const again = await bodyOf(await sync({ tournees: [t], stops }));
    expect(again.accepted.tournees).toEqual([t.id]);
    expect(again.accepted.stops).toEqual(stops.map((s) => s.id));
    expect(await db.select().from(tournees)).toHaveLength(1);
    expect(await db.select().from(tourneeStops)).toHaveLength(2);
    expect(again.tournee?.stops.map((s) => s.id)).toEqual(stops.map((s) => s.id));
  });

  it("gives a second session of the same agent the same tournée and numbers", async () => {
    const { t, stops } = await swipe(3);
    const first = await bodyOf(await sync({ tournees: [t], stops }));
    const second = await bodyOf(await sync({}));
    expect(second.tournee).toEqual(first.tournee);
    expect(second.accepted.tournees).toEqual([]);
  });

  it("writes nothing twice when the same batch is sent again", async () => {
    const { t, stops } = await swipe(20);
    const first = await bodyOf(await sync({ tournees: [t], stops }));
    const again = await bodyOf(await sync({ tournees: [t], stops }));

    expect(again.accepted).toEqual(first.accepted);
    expect(again.tournee).toEqual(first.tournee);
    const db = getDb(env.DB);
    expect(await db.select().from(tournees)).toHaveLength(1);
    expect(await db.select().from(tourneeStops)).toHaveLength(20);
  });

  /** Two swipes of one agent's day: `later` over [3,2,1], `earlier` over [1,2,3]. */
  async function twoSwipes(laterAt: number, earlierAt: number) {
    const ids = Array.from({ length: 3 }, () => crypto.randomUUID());
    await seedProspects(ids);
    const later = tourneeOf(laterAt);
    const earlier = tourneeOf(earlierAt);
    return {
      later,
      earlier,
      laterStops: ids.map((id, i) => stopOf(later.id, id, 3 - i)),
      earlierStops: ids.map((id, i) => stopOf(earlier.id, id, i + 1)),
    };
  }

  /** Both swipes stored, and the losing phone's next pull returns the earlier one. */
  async function expectEarliestWins(earlier: { id: string }, earlierStops: { id: string }[]) {
    const db = getDb(env.DB);
    expect(await db.select().from(tournees)).toHaveLength(2);
    expect(await db.select().from(tourneeStops)).toHaveLength(6);
    const pull = await bodyOf(await sync({}));
    expect(pull.tournee?.id).toBe(earlier.id);
    expect(pull.tournee?.stops.map((s) => s.id)).toEqual(earlierStops.map((s) => s.id));
    expect(pull.tournee?.stops.map((s) => s.number)).toEqual([1, 2, 3]);
  }

  it("keeps the earliest swipe whichever phone syncs first, and stores both", async () => {
    const { later, earlier, laterStops, earlierStops } = await twoSwipes(
      NOW - 5 * 60_000,
      NOW - 10 * 60_000,
    );
    const first = await bodyOf(await sync({ tournees: [later], stops: laterStops }));
    expect(first.tournee?.id).toBe(later.id);

    const body = await bodyOf(await sync({ tournees: [earlier], stops: earlierStops }));
    expect(body.accepted.tournees).toEqual([earlier.id]);
    expect(body.accepted.stops).toEqual(earlierStops.map((s) => s.id));
    expect(body.tournee?.id).toBe(earlier.id);
    expect(body.tournee?.stops.map((s) => s.number)).toEqual([1, 2, 3]);
    await expectEarliestWins(earlier, earlierStops);

    // The losing phone's own stops are still taken, never read.
    const again = await bodyOf(await sync({ tournees: [later], stops: laterStops }));
    expect(again.accepted.tournees).toEqual([later.id]);
    expect(again.accepted.stops).toEqual(laterStops.map((s) => s.id));
    expect(again.tournee?.id).toBe(earlier.id);
  });

  it("keeps the earliest swipe when both clocks run two hours ahead", async () => {
    const twoHours = 2 * 3_600_000;
    const { later, earlier, laterStops, earlierStops } = await twoSwipes(
      NOW + twoHours,
      NOW + twoHours - 10 * 60_000,
    );
    await sync({ tournees: [later], stops: laterStops });
    vi.setSystemTime(NOW + 5 * 60_000);
    const body = await bodyOf(await sync({ tournees: [earlier], stops: earlierStops }));

    expect(body.tournee?.id).toBe(earlier.id);
    await expectEarliestWins(earlier, earlierStops);
  });

  it("accepts both swipes again on a resend and stores nothing new", async () => {
    const { later, earlier, laterStops, earlierStops } = await twoSwipes(
      NOW - 5 * 60_000,
      NOW - 10 * 60_000,
    );
    await sync({ tournees: [later], stops: laterStops });
    await sync({ tournees: [earlier], stops: earlierStops });
    const body = await bodyOf(
      await sync({ tournees: [later, earlier], stops: [...laterStops, ...earlierStops] }),
    );

    expect(body.accepted.tournees.sort()).toEqual([later.id, earlier.id].sort());
    expect(body.accepted.stops).toHaveLength(6);
    expect(body.tournee?.id).toBe(earlier.id);
    const db = getDb(env.DB);
    expect(await db.select().from(tournees)).toHaveLength(2);
    expect(await db.select().from(tourneeStops)).toHaveLength(6);
  });

  it("breaks a tie on the swipe time with the lower id", async () => {
    const { later, earlier, laterStops, earlierStops } = await twoSwipes(
      NOW - 60_000,
      NOW - 60_000,
    );
    const [low, high] = later.id < earlier.id ? [later, earlier] : [earlier, later];
    const highStops = high === later ? laterStops : earlierStops;
    const lowStops = low === later ? laterStops : earlierStops;
    await sync({ tournees: [high], stops: highStops });
    const body = await bodyOf(await sync({ tournees: [low], stops: lowStops }));
    expect(body.tournee?.id).toBe(low.id);
  });

  it("stores a stop on a prospect reassigned since, flagged left", async () => {
    const { ids, t, stops } = await swipe(2);
    await getDb(env.DB)
      .update(prospects)
      .set({ assignedTo: OTHER })
      .where(eq(prospects.id, ids[1] ?? ""));

    const body = await bodyOf(await sync({ tournees: [t], stops }));
    expect(body.accepted.stops).toHaveLength(2);
    expect(body.tournee?.stops.map((s) => s.left)).toEqual([false, true]);
  });

  it("keeps a visited stop, and lists the door-day with its latest outcome", async () => {
    const { ids, t, stops } = await swipe(2);
    await sync({ tournees: [t], stops });

    const now = Date.now();
    const first = visitOf(ids[0] ?? "", "no_contact", {
      visitedAt: now - 60_000,
      flyerGiven: true,
    });
    const second = visitOf(ids[0] ?? "", "converted", { visitedAt: now - 1_000 });
    const body = await bodyOf(await sync({ visits: [second, first] }));

    // Closed by the second visit, yet not left: the agent did it today.
    expect(body.tournee?.stops.map((s) => s.left)).toEqual([false, false]);
    expect(body.visitedStops).toHaveLength(1);
    const [door] = body.visitedStops;
    expect(door).toMatchObject({
      prospectId: ids[0],
      outcome: "converted",
      flyerGiven: true,
      name: "Le Bistrot",
      type: "restaurant",
      address: null,
    });
    expect(door?.visitIds).toEqual([first.id, second.id]);
  });

  it("flags an unvisited stop left once its prospect closes", async () => {
    const { ids, t, stops } = await swipe(2);
    await sync({ tournees: [t], stops });
    await getDb(env.DB)
      .update(prospects)
      .set({ status: "rejected" })
      .where(eq(prospects.id, ids[1] ?? ""));
    const body = await bodyOf(await sync({}));
    expect(body.tournee?.stops.map((s) => s.left)).toEqual([false, true]);
  });

  it("stores a stop on a field prospect against the server id its dedupe rewrote", async () => {
    const existing = crypto.randomUUID();
    await seedProspect(existing);
    // Same place as the seeded row, under a new client id.
    await getDb(env.DB)
      .update(prospects)
      .set({ dedupeKey: dedupeKey({ name: "Chez Nous", lat: 50.85, lng: 4.35, address: null }) })
      .where(eq(prospects.id, existing));
    const clientId = crypto.randomUUID();
    const t = tourneeOf();
    const stop = stopOf(t.id, clientId, 1);

    const body = await bodyOf(
      await sync({
        prospects: [
          { id: clientId, name: "Chez Nous", type: "cafe", lat: 50.85, lng: 4.35, createdAt: 1 },
        ],
        tournees: [t],
        stops: [stop],
      }),
    );

    expect(body.idMap[clientId]).toBe(existing);
    const [row] = await getDb(env.DB).select().from(tourneeStops);
    expect(row?.prospectId).toBe(existing);
    expect(body.tournee?.stops[0]?.prospectId).toBe(existing);
  });

  it("holds back a stop whose prospect has not arrived, and takes it once it has", async () => {
    const known = crypto.randomUUID();
    await seedProspect(known);
    const t = tourneeOf();
    const waiting = stopOf(t.id, crypto.randomUUID(), 1);
    const kept = stopOf(t.id, known, 2);

    const first = await bodyOf(await sync({ tournees: [t], stops: [waiting, kept] }));
    // Not accepted: the phone keeps the row and resends it.
    expect(first.accepted.stops).toEqual([kept.id]);
    expect(first.tournee?.stops.map((s) => s.id)).toEqual([kept.id]);

    const second = await bodyOf(
      await sync({
        prospects: [
          {
            id: waiting.prospectId,
            name: "Chez Nous",
            type: "cafe",
            lat: 50.85,
            lng: 4.35,
            createdAt: 1,
          },
        ],
        stops: [waiting],
      }),
    );
    expect(second.accepted.stops).toEqual([waiting.id]);
    expect(second.tournee?.stops.map((s) => [s.id, s.number])).toEqual([
      [waiting.id, 1],
      [kept.id, 2],
    ]);
  });

  describe("a joiner number another prospect already holds", () => {
    it("keeps the first stored, accepts the second and stores only the first", async () => {
      const { t, stops } = await swipe(2);
      await sync({ tournees: [t], stops });
      const [x, y] = [crypto.randomUUID(), crypto.randomUUID()];
      await seedProspects([x, y]);

      // Phone A synced X as 3. Phone B, which has not pulled yet, sends Y as 3.
      const first = stopOf(t.id, x, 3);
      const second = stopOf(t.id, y, 3);
      await sync({ stops: [first] });
      const body = await bodyOf(await sync({ stops: [second] }));

      expect(body.accepted.stops).toEqual([second.id]);
      expect(body.tournee?.stops.map((s) => [s.prospectId, s.number])).toEqual([
        ...stops.map((s) => [s.prospectId, s.number]),
        [x, 3],
      ]);
      expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(3);
    });

    it("stores the joiners 21 and 22 of a 20-stop swipe", async () => {
      const { t, stops } = await swipe(20);
      await sync({ tournees: [t], stops });
      const [x, y] = [crypto.randomUUID(), crypto.randomUUID()];
      await seedProspects([x, y]);

      const body = await bodyOf(await sync({ stops: [stopOf(t.id, x, 21), stopOf(t.id, y, 22)] }));

      expect(body.tournee?.stops.slice(20).map((s) => [s.prospectId, s.number])).toEqual([
        [x, 21],
        [y, 22],
      ]);
      expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(22);
    });

    it("keeps the earlier one of two sent in one request", async () => {
      const { t, stops } = await swipe(1);
      await sync({ tournees: [t], stops });
      const [x, y, z] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
      await seedProspects([x, y, z]);
      const batch = [stopOf(t.id, x, 2), stopOf(t.id, y, 2), stopOf(t.id, z, 3)];

      const body = await bodyOf(await sync({ stops: batch }));

      expect(body.accepted.stops).toEqual(batch.map((s) => s.id));
      expect(body.tournee?.stops.map((s) => [s.prospectId, s.number])).toEqual([
        ...stops.map((s) => [s.prospectId, s.number]),
        [x, 2],
        [z, 3],
      ]);
    });

    it("is no collision when the same stop is sent again", async () => {
      const { t, stops } = await swipe(2);
      await sync({ tournees: [t], stops });
      const x = crypto.randomUUID();
      await seedProspect(x);
      const joiner = stopOf(t.id, x, 3);
      await sync({ stops: [joiner] });

      // Same id, and a fresh id for the same prospect and number.
      const body = await bodyOf(await sync({ stops: [joiner, stopOf(t.id, x, 3)] }));

      expect(body.accepted.stops).toHaveLength(2);
      expect(body.tournee?.stops.filter((s) => s.prospectId === x)).toHaveLength(1);
      expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(3);
    });

    it("drops a joiner on a number a stop that left still holds", async () => {
      const { ids, t, stops } = await swipe(2);
      await sync({ tournees: [t], stops });
      await getDb(env.DB)
        .update(prospects)
        .set({ assignedTo: OTHER })
        .where(eq(prospects.id, ids[1] ?? ""));
      const x = crypto.randomUUID();
      await seedProspect(x);

      const body = await bodyOf(await sync({ stops: [stopOf(t.id, x, 2)] }));

      // The left stop still holds 2: the phone numbers from 3 and would not send this.
      expect(body.tournee?.stops.filter((s) => s.number === 2).map((s) => s.prospectId)).toEqual([
        ids[1],
      ]);
    });
  });

  it("lets the database refuse a second stop under one number", async () => {
    const { t, stops } = await swipe(1);
    await sync({ tournees: [t], stops });
    const x = crypto.randomUUID();
    await seedProspect(x);

    const refused = await getDb(env.DB)
      .insert(tourneeStops)
      .values({
        id: crypto.randomUUID(),
        tourneeId: t.id,
        prospectId: x,
        number: 1,
        addedAt: NOW,
        clientAddedAt: NOW,
        receivedAt: NOW,
      })
      .then(
        () => null,
        (error: unknown) => error,
      );

    // Drizzle wraps the driver's error: the constraint is named in its cause.
    expect(String((refused as { cause?: unknown } | null)?.cause)).toMatch(/UNIQUE/);
  });

  it("drains a stop whose prospect never came once the tournée's day has passed", async () => {
    const t = tourneeOf();
    const missing = stopOf(t.id, crypto.randomUUID(), 1);
    const first = await bodyOf(await sync({ tournees: [t], stops: [missing] }));
    expect(first.accepted.stops).toEqual([]);

    vi.setSystemTime(NOW + 86_400_000);
    const next = await bodyOf(await sync({ stops: [missing] }));

    expect(next.accepted.stops).toEqual([missing.id]);
    expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(0);
  });

  it("derives joiner and clientStartedAt, whatever the phone clock says", async () => {
    // A phone two hours ahead: the server clamps the tournée to its own time.
    const ahead = NOW + 2 * 3_600_000;
    const t = tourneeOf(ahead);
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    await seedProspects(ids);
    const snapshot = { ...stopOf(t.id, ids[0] ?? "", 1), addedAt: ahead };
    // The joiner is stamped with the server's time, earlier than the phone's swipe.
    const joiner = { ...stopOf(t.id, ids[1] ?? "", 2), addedAt: NOW };

    const body = await bodyOf(await sync({ tournees: [t], stops: [snapshot, joiner] }));

    expect(body.tournee?.clientStartedAt).toBe(ahead);
    expect(body.tournee?.stops.map((s) => [s.number, s.joiner])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it("accepts and drops a stop for a tournée that is not the agent's", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id, OTHER);
    const theirs = tourneeOf();
    await asOther({ tournees: [theirs] });

    const stray = stopOf(theirs.id, id, 1);
    const orphan = stopOf(crypto.randomUUID(), id, 2);
    const body = await bodyOf(await sync({ stops: [stray, orphan] }));

    expect(body.accepted.stops).toEqual([stray.id, orphan.id]);
    expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(0);
    expect(body.tournee).toBeNull();
  });

  it("keeps one tournée per agent, and shows each agent only their own", async () => {
    const ids = [crypto.randomUUID()];
    await seedProspects(ids, OTHER);
    const mine = tourneeOf();
    const theirs = tourneeOf();
    await sync({ tournees: [mine] });
    const body = await bodyOf(
      await asOther({ tournees: [theirs], stops: [stopOf(theirs.id, ids[0] ?? "", 1)] }),
    );
    expect(body.tournee?.id).toBe(theirs.id);
    expect(await getDb(env.DB).select().from(tournees)).toHaveLength(2);
  });

  it("answers 426 to the old build and writes nothing", async () => {
    const { t, stops } = await swipe(2);
    const response = await sync({ clientVersion: 1, tournees: [t], stops });
    expect(response.status).toBe(426);
    expect(await getDb(env.DB).select().from(tournees)).toHaveLength(0);
    expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(0);
  });

  it("returns no tournée before the first swipe, yet today's visited stops", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);
    const body = await bodyOf(await sync({ visits: [visitOf(id, "interested")] }));
    expect(body.tournee).toBeNull();
    expect(body.visitedStops.map((v) => [v.prospectId, v.outcome])).toEqual([[id, "interested"]]);
  });

  it("excludes yesterday's visits from the visited stops", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id);
    const body = await bodyOf(
      await sync({ visits: [visitOf(id, "interested", { visitedAt: Date.now() - 2 * DAY_MS })] }),
    );
    expect(body.visitedStops).toEqual([]);
  });

  it("clamps a future start to the server clock, and files an old swipe under its own day", async () => {
    const future = tourneeOf(Date.now() + 3_600_000);
    const past = tourneeOf(Date.now() - 3 * DAY_MS);
    const before = Date.now();
    const body = await bodyOf(await sync({ tournees: [future, past] }));

    const rows = await getDb(env.DB).select().from(tournees);
    const row = rows.find((r) => r.id === future.id);
    expect(row?.clientStartedAt).toBe(future.startedAt);
    expect(row?.startedAt).toBeGreaterThanOrEqual(before);
    expect(row?.startedAt).toBeLessThan(future.startedAt);
    expect(rows.find((r) => r.id === past.id)?.dayStart).toBe(
      brusselsMidnightDaysFromNow(past.startedAt, 0),
    );
    expect(body.tournee?.id).toBe(future.id);
  });

  it("answers an admin 403 and stores no tournée", async () => {
    env.DEV_USER_EMAIL = "admin@example.com";
    const { t, stops } = await swipe(2);
    expect((await sync({ tournees: [t], stops })).status).toBe(403);
    expect(await getDb(env.DB).select().from(tournees)).toHaveLength(0);
    expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(0);
  });

  it("ignores another agent's visit to a shared prospect", async () => {
    const id = crypto.randomUUID();
    await seedProspect(id, OTHER);
    const t = tourneeOf();
    await sync({ tournees: [t], stops: [stopOf(t.id, id, 1)] });
    await insertVisit(id, OTHER, Date.now() - 1_000);

    const body = await bodyOf(await sync({}));
    expect(body.visitedStops).toEqual([]);
    // Reassigned and visited by somebody else: still left for this agent.
    expect(body.tournee?.stops.map((s) => s.left)).toEqual([true]);
  });

  it("counts the Brussels day from its midnight, inclusive", async () => {
    const midnight = brusselsMidnightDaysFromNow(Date.now(), 0);
    const [before, at] = [crypto.randomUUID(), crypto.randomUUID()];
    await seedProspects([before, at]);
    await insertVisit(before, AGENT, midnight - 1);
    await insertVisit(at, AGENT, midnight);

    const body = await bodyOf(await sync({}));
    expect(body.visitedStops.map((v) => v.prospectId)).toEqual([at]);
  });

  it("takes a full 250-stop swipe", async () => {
    const { t, stops } = await swipe(250);
    const body = await bodyOf(await sync({ tournees: [t], stops }));
    expect(body.accepted.stops).toHaveLength(250);
    expect(body.tournee?.stops).toHaveLength(250);
    expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(250);
  });

  it("refuses more tournées or stops than a request may carry", async () => {
    const t = tourneeOf();
    const tooManyTournees = await sync({
      tournees: Array.from({ length: SYNC_TOURNEES_PER_REQUEST + 1 }, () => tourneeOf()),
    });
    expect(tooManyTournees.status).toBe(400);

    const stops = Array.from({ length: SYNC_STOPS_PER_REQUEST + 1 }, (_, i) =>
      stopOf(t.id, crypto.randomUUID(), i + 1),
    );
    expect((await sync({ tournees: [t], stops })).status).toBe(400);
    expect(
      (await sync({ stops: [{ ...stops[0], number: TOURNEE_STOP_NUMBER_MAX + 1 }] as never }))
        .status,
    ).toBe(400);
  });

  // A stop's number counts from 1 (ADR-0036): zero or less is a 400, not a stored gap.
  it.each([0, -1])("refuses a stop numbered %i", async (number) => {
    const { ids, t } = await swipe(1);
    const response = await sync({
      tournees: [t],
      stops: [{ ...stopOf(t.id, ids[0] ?? "", 1), number }],
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("validation");
    expect(await getDb(env.DB).select().from(tournees)).toHaveLength(0);
    expect(await getDb(env.DB).select().from(tourneeStops)).toHaveLength(0);
  });

  it("gives a second real session of the agent the same tournée", async () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    await seedProspects(ids, AGENT);
    const t = tourneeOf();
    const stops = ids.map((id, i) => stopOf(t.id, id, i + 1));
    const post = async (cookie: string, body: Partial<SyncRequest>) =>
      bodyOf(
        await call("/api/agent/sync", {
          method: "POST",
          // A session wins over DEV_USER_EMAIL, which stays set for the other tests.
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ clientVersion: CLIENT_VERSION, ...body }),
        }),
      );

    const first = await post(await testSessionCookie(TEST_AGENT), { tournees: [t], stops });
    const second = await post(await testSessionCookie(TEST_AGENT), {});
    expect(first.tournee?.id).toBe(t.id);
    expect(second.tournee).toEqual(first.tournee);
  });

  it.each([
    // Late on the 25 h day and on the 23 h day: the swipe's day is that day's
    // Brussels midnight, not a fixed 24 h before or after.
    ["2026-10-25", "2026-10-25T22:45:00.000Z", "2026-10-24T22:00:00.000Z"],
    ["2026-03-29", "2026-03-29T21:45:00.000Z", "2026-03-28T23:00:00.000Z"],
  ])(
    "stores a swipe made late on %s under that day and gives it back on the next sync",
    async (_date, now, dayStart) => {
      vi.setSystemTime(Date.parse(now));
      const { t, stops } = await swipe(2);
      const first = await bodyOf(await sync({ tournees: [t], stops }));
      expect(first.accepted.tournees).toEqual([t.id]);
      expect(first.tournee?.id).toBe(t.id);
      expect(first.tournee?.dayStart).toBe(Date.parse(dayStart));

      const [stored] = await getDb(env.DB).select().from(tournees);
      expect(stored?.dayStart).toBe(Date.parse(dayStart));

      const next = await bodyOf(await sync({}));
      expect(next.tournee).toEqual(first.tournee);
      expect(next.tournee?.stops.map((s) => s.id)).toEqual(stops.map((s) => s.id));
    },
  );
});

describe("insertOrIgnore", () => {
  const base = {
    type: "restaurant" as const,
    source: "csv" as const,
    status: "new" as const,
    createdBy: AGENT,
    createdAt: 1,
    updatedAt: 1,
  };

  it("throws when a row sets a key the first row lacks, writing nothing", async () => {
    const rows = [
      { ...base, id: "a", name: "A", dedupeKey: "k:a" },
      { ...base, id: "b", name: "B", dedupeKey: "k:b", phone: "+33" },
    ];
    await expect(insertOrIgnore(env.DB, prospects, rows)).rejects.toThrow(/"phone"/);
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(0);
  });

  it("throws when a later row lacks a key the first row sets, writing nothing", async () => {
    const rows = [
      { ...base, id: "a", name: "A", dedupeKey: "k:a", phone: "+33" },
      { ...base, id: "b", name: "B", dedupeKey: "k:b" },
    ];
    await expect(insertOrIgnore(env.DB, prospects, rows)).rejects.toThrow(/"phone"/);
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(0);
  });

  it("does nothing for no rows, and skips a row whose key already exists", async () => {
    await insertOrIgnore(env.DB, prospects, []);
    const row = { ...base, id: "a", name: "A", dedupeKey: "k:a" };
    await insertOrIgnore(env.DB, prospects, [row, { ...row, id: "b", name: "Other" }]);
    const stored = await getDb(env.DB).select().from(prospects);
    expect(stored.map((r) => r.id)).toEqual(["a"]);
  });
});
