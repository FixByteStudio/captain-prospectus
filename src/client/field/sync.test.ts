import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_VERSION,
  SYNC_BYTES_PER_BATCH,
  SYNC_STOPS_PER_REQUEST,
  SYNC_VISITS_PER_BATCH,
} from "../../shared/constants";
import type {
  FieldProspect,
  Prospect,
  Script,
  SyncRequest,
  SyncResponse,
  TodayTournee,
  Visit,
} from "../../shared/schemas";
import { brusselsPeriod } from "../../shared/period";
import { clearAgentCache, FieldDb, getMeta, setMeta, startTournee } from "./db";
import { dropReading, rememberReading, setReadingIdentity } from "./last-reading";
import { backoffDelayMs, runSync } from "./sync";
import { stopsOfToday } from "./tournee-stops";

/**
 * INVARIANT 5: never lose a visit. Every test here is a way the outbox could be
 * cleared when it must not be. CONTRIBUTING.md: sync has tests before merge.
 */

let db: FieldDb;
let dbCounter = 0;

const AGENT = "agent@example.com";

const visit = (over: Partial<Visit> = {}): Visit => ({
  id: crypto.randomUUID(),
  prospectId: crypto.randomUUID(),
  visitedAt: 1_700_000_000_000,
  lat: null,
  lng: null,
  flyerGiven: true,
  outcome: "interested",
  followUpAt: null,
  notes: null,
  scriptId: null,
  answers: {},
  ...over,
});

const okResponse = (over: Partial<SyncResponse> = {}): SyncResponse => ({
  serverTime: 1_700_000_100_000,
  accepted: { prospects: [], visits: [], tournees: [], stops: [] },
  idMap: {},
  prospects: [],
  script: null,
  tournee: null,
  visitedStops: [],
  ...over,
});

const respondWith = (body: SyncResponse, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const failWith = (status: number) =>
  (async () => new Response("{}", { status })) as unknown as typeof fetch;

// A real opaqueredirect response reports status 0, which the Response
// constructor rejects, so `type` and `ok` are faked instead.
const redirected = (async () => {
  const r = new Response(null, { status: 200 });
  Object.defineProperty(r, "type", { value: "opaqueredirect" });
  Object.defineProperty(r, "ok", { value: false });
  return r;
}) as unknown as typeof fetch;

beforeEach(async () => {
  db = new FieldDb(`test-${dbCounter++}`);
  await db.open();
});

describe("runSync — what clears the outbox", () => {
  it("deletes only the ids the server listed in accepted", async () => {
    const kept = visit();
    const accepted = visit();
    await db.outboxVisits.bulkAdd([kept, accepted]);

    const result = await runSync({
      db,
      identity: AGENT,
      fetchFn: respondWith(
        okResponse({ accepted: { prospects: [], visits: [accepted.id], tournees: [], stops: [] } }),
      ),
    });

    expect(result.status).toBe("ok");
    const remaining = await db.outboxVisits.toArray();
    expect(remaining.map((v) => v.id)).toEqual([kept.id]);
  });

  it("keeps everything when the response omits accepted ids entirely", async () => {
    await db.outboxVisits.add(visit());
    await runSync({ db, identity: AGENT, fetchFn: respondWith(okResponse()) });
    expect(await db.outboxVisits.count()).toBe(1);
  });
});

/**
 * The script travels on every sync and is cached for the visit form to pin.
 * Nothing asserted this before: `okResponse()` set `script: null` everywhere.
 */
describe("runSync — the cached script", () => {
  const script: Script = {
    id: 7,
    name: "Questionnaire",
    version: 3,
    isActive: true,
    createdAt: 1_700_000_000_000,
    questions: [{ key: "has_delivery", label: "Livraison ?", type: "yes_no", required: true }],
  };

  it("writes the active script into meta", async () => {
    await runSync({ db, identity: AGENT, fetchFn: respondWith(okResponse({ script })) });

    expect(await getMeta(db, "script")).toEqual(script);
  });

  it("clears it when the server reports none, rather than keeping a stale one", async () => {
    await setMeta(db, "script", script);
    await runSync({ db, identity: AGENT, fetchFn: respondWith(okResponse({ script: null })) });

    expect(await getMeta(db, "script")).toBeNull();
  });

  it("leaves the cached script alone when the sync failed", async () => {
    await setMeta(db, "script", script);
    await runSync({ db, identity: AGENT, fetchFn: failWith(500) });

    expect(await getMeta(db, "script")).toEqual(script);
  });
});

describe("runSync — failures must never clear the outbox", () => {
  it.each([
    ["an expired session (401)", 401],
    ["a cross-origin refusal (403)", 403],
    ["a build too old (426)", 426],
    ["a server error (500)", 500],
    ["a D1 quota error (503)", 503],
    ["a payload too large (413)", 413],
  ])("keeps the outbox on %s", async (_label, status) => {
    await db.outboxVisits.add(visit());
    const result = await runSync({ db, identity: AGENT, fetchFn: failWith(status) });

    expect(result.status).not.toBe("ok");
    expect(await db.outboxVisits.count()).toBe(1);
    expect(result.remaining).toBe(1);
  });

  it("reports 426 as an upgrade, distinctly from an auth failure", async () => {
    await db.outboxVisits.add(visit());
    expect((await runSync({ db, identity: AGENT, fetchFn: failWith(426) })).status).toBe("upgrade");
    expect((await runSync({ db, identity: AGENT, fetchFn: failWith(401) })).status).toBe(
      "unauthorized",
    );
  });

  it("keeps the outbox when the network is gone", async () => {
    await db.outboxVisits.add(visit());
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const result = await runSync({ db, identity: AGENT, fetchFn: offline });
    expect(result.status).toBe("offline");
    expect(await db.outboxVisits.count()).toBe(1);
  });

  it("treats an opaque redirect as a failed sync, not as success or a lost session", async () => {
    await db.outboxVisits.add(visit());

    const result = await runSync({ db, identity: AGENT, fetchFn: redirected });
    expect(result.status).toBe("error");
    expect(await db.outboxVisits.count()).toBe(1);
  });

  it("asks fetch not to follow redirects, so a proxy's login page is never parsed as a sync", async () => {
    const fetchFn = vi.fn(respondWith(okResponse()));
    await runSync({ db, identity: AGENT, fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("keeps the outbox when the response does not match the contract", async () => {
    await db.outboxVisits.add(visit());
    const garbage = (async () =>
      new Response(JSON.stringify({ unexpected: true }), {
        status: 200,
      })) as unknown as typeof fetch;

    const result = await runSync({ db, identity: AGENT, fetchFn: garbage });
    expect(result.status).toBe("error");
    expect(await db.outboxVisits.count()).toBe(1);
  });
});

describe("runSync — an auth refusal drops the cached round (GH #35)", () => {
  const seedCache = async () => {
    await db.prospects.put({
      id: crypto.randomUUID(),
      name: "Chez Paul",
      type: "restaurant",
      status: "assigned",
      address: null,
      phone: null,
      website: null,
      cuisine: null,
      source: "osm",
      assignedTo: AGENT,
      lat: null,
      lng: null,
      lastVisitAt: null,
      nextVisitAt: null,
    });
    await setMeta(db, "identity", { email: AGENT, role: "agent" });
  };

  it.each([
    ["a 401", failWith(401)],
    ["a 403", failWith(403)],
  ])(
    "clears the round and the cached identity on %s, and keeps the outbox",
    async (_l, fetchFn) => {
      // A PWA resumed from the app switcher never remounts, so this refusal is
      // the only place a revoked phone learns to forget the round.
      await seedCache();
      await db.outboxVisits.add(visit());

      const result = await runSync({ db, identity: AGENT, fetchFn });

      expect(result.status).toBe("unauthorized");
      expect(await db.prospects.count()).toBe(0);
      expect(await getMeta(db, "identity")).toBeUndefined();
      expect(await db.outboxVisits.count()).toBe(1);
      expect(result.remaining).toBe(1);
    },
  );

  it.each([
    [
      "the network is gone",
      (async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
    ],
    ["a server error (500)", failWith(500)],
    ["a build too old (426)", failWith(426)],
    ["an opaque redirect", redirected],
  ])("keeps the round when %s — not a statement about this identity", async (_l, fetchFn) => {
    await seedCache();

    await runSync({ db, identity: AGENT, fetchFn });

    expect(await db.prospects.count()).toBe(1);
    expect(await getMeta(db, "identity")).toEqual({ email: AGENT, role: "agent" });
  });
});

describe("runSync — dedupe collisions", () => {
  it("rewrites prospectId on outbox visits before deleting anything", async () => {
    const clientProspectId = crypto.randomUUID();
    const serverProspectId = crypto.randomUUID();
    const pending = visit({ prospectId: clientProspectId });
    await db.outboxVisits.add(pending);

    await runSync({
      db,
      identity: AGENT,
      fetchFn: respondWith(
        okResponse({
          idMap: { [clientProspectId]: serverProspectId },
          accepted: { prospects: [clientProspectId], visits: [], tournees: [], stops: [] },
        }),
      ),
    });

    const [remaining] = await db.outboxVisits.toArray();
    expect(remaining?.prospectId).toBe(serverProspectId);
  });
});

describe("runSync — the pull", () => {
  it("replaces the today list rather than merging into it", async () => {
    await db.prospects.add({
      id: crypto.randomUUID(),
      name: "Ancien",
      type: "restaurant",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      website: null,
      cuisine: null,
      source: "csv",
      status: "assigned",
      assignedTo: "agent@example.com",
      lastVisitAt: null,
      nextVisitAt: null,
    });

    await runSync({
      db,
      identity: AGENT,
      fetchFn: respondWith(
        okResponse({
          prospects: [
            {
              id: crypto.randomUUID(),
              name: "Nouveau",
              type: "cafe",
              lat: null,
              lng: null,
              address: null,
              phone: null,
              website: null,
              cuisine: null,
              source: "csv",
              status: "assigned",
              assignedTo: "agent@example.com",
              lastVisitAt: null,
              nextVisitAt: null,
            },
          ],
        }),
      ),
    });

    const list = await db.prospects.toArray();
    expect(list.map((p) => p.name)).toEqual(["Nouveau"]);
  });

  it("sends the current contract version", async () => {
    let sent: unknown;
    const capture = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify(okResponse()), { status: 200 });
    }) as unknown as typeof fetch;

    await runSync({ db, identity: AGENT, fetchFn: capture });
    expect((sent as { clientVersion: number }).clientVersion).toBe(CLIENT_VERSION);
  });
});

describe("backoffDelayMs", () => {
  it("grows exponentially and stops at five minutes", () => {
    expect(backoffDelayMs(0)).toBe(0);
    expect(backoffDelayMs(1)).toBe(5_000);
    expect(backoffDelayMs(2)).toBe(10_000);
    expect(backoffDelayMs(3)).toBe(20_000);
    expect(backoffDelayMs(50)).toBe(300_000);
  });
});

/**
 * GH #404: the phone sends at most SYNC_VISITS_PER_BATCH visits a pass, well
 * under the server's SYNC_VISITS_PER_REQUEST, so one request stays inside the
 * Worker's 10 ms of CPU. The drain loop sends the rest in further passes.
 */
describe("runSync — visits per pass", () => {
  it("sends exactly one batch from a larger outbox, then the rest in later passes", async () => {
    const batch = SYNC_VISITS_PER_BATCH;
    const tail = 20;
    await db.outboxVisits.bulkAdd(Array.from({ length: 2 * batch + tail }, () => visit()));

    const sent: number[] = [];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as SyncRequest;
      sent.push(body.visits.length);
      const accepted = {
        prospects: [],
        visits: body.visits.map((v) => v.id),
        tournees: [],
        stops: [],
      };
      return new Response(JSON.stringify(okResponse({ accepted })), { status: 200 });
    }) as unknown as typeof fetch;

    const first = await runSync({ db, identity: AGENT, fetchFn });
    expect(sent).toEqual([batch]);
    expect(first).toMatchObject({ status: "ok", acceptedVisits: batch, remaining: batch + tail });

    await runSync({ db, identity: AGENT, fetchFn });
    await runSync({ db, identity: AGENT, fetchFn });
    expect(sent).toEqual([batch, batch, tail]);
    expect(await db.outboxVisits.count()).toBe(0);
  });
});

/**
 * A pass carries at most SYNC_BYTES_PER_BATCH, below the Worker's 413 cap
 * (MAX_REQUEST_BYTES), because a heavy batch runs past 10 ms of CPU (GH #450).
 * A 413 or a CPU kill keeps the outbox, so a payload that always fails is an
 * outbox that never drains. The client's job is never to build one.
 */
describe("runSync — staying under SYNC_BYTES_PER_BATCH", () => {
  /** A visit with 50 answers of 2000 characters: ~100 kB, and schema-valid. */
  const hugeVisit = () =>
    visit({
      notes: "n".repeat(2000),
      answers: Object.fromEntries(
        Array.from({ length: 50 }, (_, q) => [`question_${q}`, "a".repeat(2000)]),
      ),
    });

  const captureBody = () => {
    const sent: string[] = [];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      sent.push(init.body as string);
      return new Response(JSON.stringify(okResponse()), { status: 200 });
    }) as unknown as typeof fetch;
    /** The one request runSync made. Fails loudly rather than yielding undefined. */
    const only = (): string => {
      expect(sent).toHaveLength(1);
      const [body] = sent;
      if (body === undefined) throw new Error("runSync sent no request");
      return body;
    };
    return { only, fetchFn };
  };

  it("trims a batch that would exceed the cap, and sends every field prospect", async () => {
    const prospect: FieldProspect = {
      id: crypto.randomUUID(),
      name: "Le Bistrot",
      type: "restaurant",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      createdAt: 1_700_000_000_000,
    };
    await db.outboxProspects.add(prospect);
    for (let i = 0; i < SYNC_VISITS_PER_BATCH; i++) await db.outboxVisits.add(hugeVisit());

    const { only, fetchFn } = captureBody();
    await runSync({ db, identity: AGENT, fetchFn });

    const body = only();
    const bodyBytes = new TextEncoder().encode(body).length;
    expect(bodyBytes).toBeLessThanOrEqual(SYNC_BYTES_PER_BATCH);
    // Filled, not halved: one more visit of the same size would not have fit.
    const oneMore = new TextEncoder().encode(JSON.stringify(hugeVisit())).length + 1;
    expect(bodyBytes + oneMore).toBeGreaterThan(SYNC_BYTES_PER_BATCH);

    const parsed = JSON.parse(body) as SyncRequest;
    expect(parsed.visits.length).toBeLessThan(SYNC_VISITS_PER_BATCH);
    expect(parsed.visits.length).toBeGreaterThan(0);
    // A visit may reference a prospect created in the same payload, so prospects
    // are never what gets dropped.
    expect(parsed.prospects).toHaveLength(1);
  });

  it("still sends a single visit that is near the cap on its own", async () => {
    await db.outboxVisits.add(hugeVisit());

    const { only, fetchFn } = captureBody();
    await runSync({ db, identity: AGENT, fetchFn });

    expect((JSON.parse(only()) as SyncRequest).visits).toHaveLength(1);
  });

  // INVARIANT 5: a visit bigger than the budget is sent alone, never stranded.
  it("sends a first visit that is over the budget on its own", async () => {
    // The outbox reads in id order: these ids put the oversized visit first.
    const oversized = visit({
      id: "00000000-0000-4000-8000-000000000000",
      notes: "n".repeat(SYNC_BYTES_PER_BATCH),
    });
    await db.outboxVisits.add(oversized);
    await db.outboxVisits.add(visit({ id: "ffffffff-ffff-4fff-bfff-ffffffffffff" }));

    const { only, fetchFn } = captureBody();
    const result = await runSync({ db, identity: AGENT, fetchFn });

    expect((JSON.parse(only()) as SyncRequest).visits.map((v) => v.id)).toEqual([oversized.id]);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("does not trim, or re-serialize, an ordinary batch", async () => {
    for (let i = 0; i < 20; i++) await db.outboxVisits.add(visit());

    const { only, fetchFn } = captureBody();
    await runSync({ db, identity: AGENT, fetchFn });

    expect((JSON.parse(only()) as SyncRequest).visits).toHaveLength(20);
  });
});

/**
 * docs/backlog/005: the Worker files every visit under the identity that sends
 * it, so a row another identity wrote must never be sent — nor dropped.
 */
describe("runSync — rows written by another identity", () => {
  const A = "a@example.com";
  const B = "b@example.com";

  const captureAll = () => {
    const sent: SyncRequest[] = [];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as SyncRequest;
      sent.push(body);
      const accepted = {
        prospects: body.prospects.map((p) => p.id),
        visits: body.visits.map((v) => v.id),
        tournees: [],
        stops: [],
      };
      return new Response(JSON.stringify(okResponse({ accepted })), { status: 200 });
    }) as unknown as typeof fetch;
    return { sent, fetchFn };
  };

  it("holds back A's row when B syncs, and sends it once A syncs again", async () => {
    const aVisit = visit();
    await db.outboxVisits.add({ ...aVisit, writtenBy: A });

    const { sent, fetchFn } = captureAll();
    const asB = await runSync({ db, identity: B, fetchFn });

    expect(sent[0]?.visits).toEqual([]);
    expect(asB).toMatchObject({ status: "ok", remaining: 0, heldBack: 1 });
    expect(await db.outboxVisits.get(aVisit.id)).toEqual({ ...aVisit, writtenBy: A });

    const asA = await runSync({ db, identity: A, fetchFn });

    expect(sent[1]?.visits.map((v) => v.id)).toEqual([aVisit.id]);
    expect(asA).toMatchObject({ status: "ok", acceptedVisits: 1, remaining: 0, heldBack: 0 });
  });

  it("holds back another identity's field prospect the same way", async () => {
    const prospect: FieldProspect = {
      id: crypto.randomUUID(),
      name: "Le camion",
      type: "food_truck",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      createdAt: 1_700_000_000_000,
    };
    await db.outboxProspects.add({ ...prospect, writtenBy: A });

    const { sent, fetchFn } = captureAll();
    const result = await runSync({ db, identity: B, fetchFn });

    expect(sent[0]?.prospects).toEqual([]);
    expect(result.heldBack).toBe(1);
    expect(await db.outboxProspects.count()).toBe(1);
  });

  it("never puts the stamp in the request body", async () => {
    await db.outboxVisits.add({ ...visit(), writtenBy: A });

    const { sent, fetchFn } = captureAll();
    await runSync({ db, identity: A, fetchFn });

    expect(sent[0]?.visits).toHaveLength(1);
    expect(sent[0]?.visits[0]).not.toHaveProperty("writtenBy");
  });

  it("does not let held-back rows fill the slice and starve the current identity", async () => {
    for (let i = 0; i < SYNC_VISITS_PER_BATCH; i++) {
      await db.outboxVisits.add({ ...visit(), writtenBy: A });
    }
    const own = visit();
    await db.outboxVisits.add({ ...own, writtenBy: B });

    const { sent, fetchFn } = captureAll();
    await runSync({ db, identity: B, fetchFn });

    expect(sent[0]?.visits.map((v) => v.id)).toEqual([own.id]);
  });

  it("sends an unstamped (pre-v3) row once, then keeps it with that identity", async () => {
    const legacy = visit();
    await db.outboxVisits.add(legacy);

    // The server takes the request but does not accept this row (an orphan,
    // say), so it stays queued: it must now belong to A, not to whoever next.
    let body: SyncRequest | undefined;
    const capture = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body)) as SyncRequest;
      return new Response(JSON.stringify(okResponse()), { status: 200 });
    }) as unknown as typeof fetch;

    await runSync({ db, identity: A, fetchFn: capture });
    expect(body?.visits.map((v) => v.id)).toEqual([legacy.id]);
    expect((await db.outboxVisits.get(legacy.id))?.writtenBy).toBe(A);

    const { sent, fetchFn } = captureAll();
    const asB = await runSync({ db, identity: B, fetchFn });
    expect(sent[0]?.visits).toEqual([]);
    expect(asB.heldBack).toBe(1);
  });

  it("removes an unstamped row through the normal accept path", async () => {
    const legacy = visit();
    await db.outboxVisits.add(legacy);

    const { fetchFn } = captureAll();
    await runSync({ db, identity: A, fetchFn });

    expect(await db.outboxVisits.count()).toBe(0);
  });

  it("counts held-back rows apart from remaining when the network is down", async () => {
    await db.outboxVisits.add({ ...visit(), writtenBy: A });
    await db.outboxVisits.add({ ...visit(), writtenBy: B });
    await db.outboxVisits.add(visit());

    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const result = await runSync({ db, identity: B, fetchFn: offline });

    expect(result).toMatchObject({ status: "offline", remaining: 2, heldBack: 1 });
    expect(await db.outboxVisits.count()).toBe(3);
  });
});

/**
 * docs/backlog/013: a row written while the identity was cache-sourced is
 * never sendable, whatever identity `runSync` is later called with — the
 * cache that wrote it may not be who the session cookie really names.
 */
describe("runSync — unconfirmed rows", () => {
  const A = "a@example.com";

  const captureAll = () => {
    const sent: SyncRequest[] = [];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as SyncRequest;
      sent.push(body);
      const accepted = {
        prospects: body.prospects.map((p) => p.id),
        visits: body.visits.map((v) => v.id),
        tournees: [],
        stops: [],
      };
      return new Response(JSON.stringify(okResponse({ accepted })), { status: 200 });
    }) as unknown as typeof fetch;
    return { sent, fetchFn };
  };

  it("never sends an unconfirmed row, even to the identity that wrote it — but still counts it as remaining, not held back", async () => {
    const own = visit();
    await db.outboxVisits.add({ ...own, writtenBy: A, unconfirmed: true });

    const { sent, fetchFn } = captureAll();
    const result = await runSync({ db, identity: A, fetchFn });

    expect(sent[0]?.visits).toEqual([]);
    // It is A's own row, only not yet sendable — `remaining` (backed by
    // `writtenByOrUnstamped`), not `heldBack` (another identity's writes).
    expect(result).toMatchObject({ status: "ok", remaining: 1, heldBack: 0 });
    expect(await db.outboxVisits.get(own.id)).toEqual({
      ...own,
      writtenBy: A,
      unconfirmed: true,
    });
  });

  it("holds back an unconfirmed field prospect from being sent, the same way", async () => {
    const prospect: FieldProspect = {
      id: crypto.randomUUID(),
      name: "Le camion",
      type: "food_truck",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      createdAt: 1_700_000_000_000,
    };
    await db.outboxProspects.add({ ...prospect, writtenBy: A, unconfirmed: true });

    const { sent, fetchFn } = captureAll();
    const result = await runSync({ db, identity: A, fetchFn });

    expect(sent[0]?.prospects).toEqual([]);
    expect(result).toMatchObject({ remaining: 1, heldBack: 0 });
  });

  it("sends it once confirmed — never carrying `unconfirmed` or `writtenBy` on the wire", async () => {
    await db.outboxVisits.add({ ...visit(), writtenBy: A, unconfirmed: true });

    const { fetchFn: fetchFnStillUnconfirmed } = captureAll();
    await runSync({ db, identity: A, fetchFn: fetchFnStillUnconfirmed });

    // `confirmOutbox` (db.ts) is what an app confirming a cache-sourced
    // identity calls; simulated here as the same Dexie write to keep this
    // test at `runSync`'s own level.
    await db.outboxVisits.toCollection().modify((row) => {
      delete row.unconfirmed;
    });

    const { sent, fetchFn } = captureAll();
    const result = await runSync({ db, identity: A, fetchFn });

    expect(result).toMatchObject({ status: "ok", heldBack: 0 });
    expect(sent[0]?.visits).toHaveLength(1);
    expect(sent[0]?.visits[0]).not.toHaveProperty("unconfirmed");
    expect(sent[0]?.visits[0]).not.toHaveProperty("writtenBy");
  });
});

/**
 * ADR-0028, "On the phone": the latest reading goes with the sync, and nothing
 * but a qualifying one does. Every row of spec-5-3's matrix that reaches the wire.
 */
describe("runSync — the position", () => {
  const NOW = Date.UTC(2026, 9, 5, 12, 0, 0); // 14:00 in Brussels
  const MIDNIGHT = Date.UTC(2026, 9, 4, 22, 0, 0);
  const OTHER = "other@example.com";

  const fix = (over: Partial<Parameters<typeof rememberReading>[0]> = {}) => ({
    lat: 50.8467,
    lng: 4.3525,
    accuracy: 25,
    capturedAt: NOW - 60_000,
    ...over,
  });

  /** The body `runSync` sent, parsed. */
  async function sentBody(identity = AGENT): Promise<Record<string, unknown>> {
    let body = "";
    const fetchFn = (async (_url: string, init: RequestInit) => {
      body = init.body as string;
      return new Response(JSON.stringify(okResponse()), { status: 200 });
    }) as unknown as typeof fetch;
    await runSync({ db, identity, fetchFn, now: () => NOW });
    return JSON.parse(body) as Record<string, unknown>;
  }

  afterEach(() => {
    setReadingIdentity(null);
    dropReading();
  });

  it("carries today's reading for the confirmed identity", async () => {
    setReadingIdentity(AGENT);
    rememberReading(fix());
    expect((await sentBody()).position).toEqual(fix());
  });

  it("carries no position key when there is no reading", async () => {
    setReadingIdentity(AGENT);
    expect(await sentBody()).not.toHaveProperty("position");
  });

  it("carries none for a reading from yesterday", async () => {
    setReadingIdentity(AGENT);
    rememberReading(fix({ capturedAt: MIDNIGHT - 1 }));
    expect(await sentBody()).not.toHaveProperty("position");
  });

  it("carries none for a reading dated after today in Brussels", async () => {
    setReadingIdentity(AGENT);
    rememberReading(fix({ capturedAt: MIDNIGHT + 24 * 60 * 60_000 }));
    expect(await sentBody()).not.toHaveProperty("position");
  });

  it("carries none for a reading stamped with another identity", async () => {
    setReadingIdentity(OTHER);
    rememberReading(fix());
    expect(await sentBody(AGENT)).not.toHaveProperty("position");
  });

  it("carries none for a reading taken under a cache-sourced identity", async () => {
    // SyncProvider passes null while `confirmed` is false.
    setReadingIdentity(null);
    rememberReading(fix());
    setReadingIdentity(AGENT);
    expect(await sentBody()).not.toHaveProperty("position");
  });

  it("carries none for a reading that fails the wire schema, and still syncs", async () => {
    setReadingIdentity(AGENT);
    rememberReading(fix({ accuracy: 10_001 }));
    const visitRow = visit();
    await db.outboxVisits.add(visitRow);

    const body = await sentBody();

    expect(body).not.toHaveProperty("position");
    expect((body.visits as Visit[]).map((v) => v.id)).toEqual([visitRow.id]);
  });

  it("carries none once clearAgentCache dropped it", async () => {
    setReadingIdentity(AGENT);
    rememberReading(fix());
    await clearAgentCache(db);
    expect(await sentBody()).not.toHaveProperty("position");
  });

  it("keeps the position through serializeWithinCap's visit trimming", async () => {
    setReadingIdentity(AGENT);
    rememberReading(fix());
    const big = "x".repeat(2_000);
    const heavy = (): Visit =>
      visit({ answers: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`q${i}`, big])) });
    await db.outboxVisits.bulkAdd(Array.from({ length: 60 }, heavy));

    const body = await sentBody();

    expect((body.visits as Visit[]).length).toBeLessThan(60);
    expect(body.position).toEqual(fix());
  });

  it("never calls geolocation", async () => {
    const getCurrentPosition = vi.fn();
    const watchPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition, watchPosition } });
    try {
      setReadingIdentity(AGENT);
      rememberReading(fix());
      await sentBody();
      await runSync({ db, identity: AGENT, fetchFn: failWith(500), now: () => NOW });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();
  });
});

const day = (stops: number, prospectIds: string[] = []) => {
  const tourneeId = crypto.randomUUID();
  return {
    tournee: { id: tourneeId, startedAt: 1_700_000_000_000 },
    stops: Array.from({ length: stops }, (_, i) => ({
      id: crypto.randomUUID(),
      tourneeId,
      prospectId: prospectIds[i] ?? crypto.randomUUID(),
      number: i + 1,
      addedAt: 1_700_000_000_000,
    })),
  };
};

/** Echoes every tournée and stop it receives into `accepted`, recording each request. */
function acceptingServer(requests: SyncRequest[] = []) {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as SyncRequest;
    requests.push(body);
    const accepted = {
      prospects: [],
      visits: [],
      tournees: body.tournees.map((t) => t.id),
      stops: body.stops.map((s) => s.id),
    };
    return new Response(JSON.stringify(okResponse({ accepted })), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("runSync — the swipe's outbox (ADR-0036)", () => {
  it("sends the tournée with its stops, never the stamp, and deletes them once listed", async () => {
    const { tournee, stops } = day(3);
    await startTournee(db, { tournee, stops }, AGENT);
    const requests: SyncRequest[] = [];

    const result = await runSync({ db, identity: AGENT, fetchFn: acceptingServer(requests) });

    expect(requests[0]?.tournees).toEqual([tournee]);
    expect([...(requests[0]?.stops ?? [])].sort((a, b) => a.number - b.number)).toEqual(stops);
    expect(result).toMatchObject({ status: "ok", acceptedTournees: 1, acceptedStops: 3 });
    expect(result.remaining).toBe(0);
    expect(await db.outboxTournees.count()).toBe(0);
    expect(await db.outboxStops.count()).toBe(0);
  });

  it("keeps every row the server did not list — INVARIANT 5", async () => {
    await startTournee(db, day(3), AGENT);
    await runSync({ db, identity: AGENT, fetchFn: respondWith(okResponse()) });
    expect(await db.outboxTournees.count()).toBe(1);
    expect(await db.outboxStops.count()).toBe(3);
  });

  it("deletes only the stops the server listed, and keeps an unlisted tournée — INVARIANT 5", async () => {
    const { tournee, stops } = day(3);
    await startTournee(db, { tournee, stops }, AGENT);
    const requests: SyncRequest[] = [];
    const [listed] = stops;
    if (!listed) throw new Error("day(3) seeds three stops");
    const fetchFn = (async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)) as SyncRequest);
      const accepted = { prospects: [], visits: [], tournees: [], stops: [listed.id] };
      return new Response(JSON.stringify(okResponse({ accepted })), { status: 200 });
    }) as unknown as typeof fetch;

    await runSync({ db, identity: AGENT, fetchFn });

    expect(requests[0]?.stops).toHaveLength(3);
    const kept = await db.outboxStops.toArray();
    expect(kept.map((s) => s.id).sort()).toEqual(
      stops
        .slice(1)
        .map((s) => s.id)
        .sort(),
    );
    expect(await db.outboxTournees.count()).toBe(1);
  });

  it("sends a confirmed tournée without its unconfirmed stops, which stay queued", async () => {
    const { tournee, stops } = day(2);
    await startTournee(db, { tournee, stops }, AGENT);
    await db.outboxTournees.update(tournee.id, { writtenBy: AGENT });
    await db.outboxStops.toCollection().modify({ writtenBy: AGENT, unconfirmed: true });
    const requests: SyncRequest[] = [];

    await runSync({ db, identity: AGENT, fetchFn: acceptingServer(requests) });

    expect(requests[0]?.tournees).toEqual([tournee]);
    expect(requests[0]?.stops).toEqual([]);
    expect(await db.outboxTournees.count()).toBe(0);
    expect(await db.outboxStops.count()).toBe(2);
  });

  it("keeps them through a 426, a 401 and a lost network", async () => {
    await startTournee(db, day(2), AGENT);
    await runSync({ db, identity: AGENT, fetchFn: failWith(426) });
    await runSync({ db, identity: AGENT, fetchFn: failWith(401) });
    await runSync({
      db,
      identity: AGENT,
      fetchFn: (async () => {
        throw new TypeError("offline");
      }) as unknown as typeof fetch,
    });
    expect(await db.outboxTournees.count()).toBe(1);
    expect(await db.outboxStops.count()).toBe(2);
  });

  it("drains a big snapshot over passes, the tournée first", async () => {
    const total = SYNC_STOPS_PER_REQUEST + 50;
    const { tournee, stops } = day(total);
    await startTournee(db, { tournee, stops }, AGENT);
    const requests: SyncRequest[] = [];
    const fetchFn = acceptingServer(requests);

    const first = await runSync({ db, identity: AGENT, fetchFn });
    expect(requests[0]?.tournees).toHaveLength(1);
    expect(requests[0]?.stops).toHaveLength(SYNC_STOPS_PER_REQUEST);
    expect(first.remaining).toBe(50);

    const second = await runSync({ db, identity: AGENT, fetchFn });
    expect(requests[1]?.tournees).toHaveLength(0);
    expect(requests[1]?.stops).toHaveLength(50);
    expect(second.remaining).toBe(0);
  });

  it("holds a stop back while its tournée waits outside this request", async () => {
    const { tournee, stops } = day(2);
    await startTournee(db, { tournee, stops }, AGENT);
    // A second, older tournée fills nothing here; the point is the stops of a
    // tournée that is queued but unsendable are not sent ahead of it.
    await db.outboxTournees.update(tournee.id, { unconfirmed: true });
    await db.outboxStops.toCollection().modify({ writtenBy: AGENT });
    const requests: SyncRequest[] = [];

    await runSync({ db, identity: AGENT, fetchFn: acceptingServer(requests) });

    expect(requests[0]?.tournees).toEqual([]);
    expect(requests[0]?.stops).toEqual([]);
  });

  it("rewrites a stop's prospect id through idMap before resending", async () => {
    const clientId = crypto.randomUUID();
    const serverId = crypto.randomUUID();
    const { tournee, stops } = day(2, [clientId]);
    await startTournee(db, { tournee, stops }, AGENT);

    await runSync({
      db,
      identity: AGENT,
      fetchFn: respondWith(okResponse({ idMap: { [clientId]: serverId } })),
    });

    const rewritten = await db.outboxStops.where("tourneeId").equals(tournee.id).toArray();
    expect(rewritten.map((s) => s.prospectId)).toContain(serverId);
    expect(rewritten.map((s) => s.prospectId)).not.toContain(clientId);
  });

  it("never sends another identity's tournée", async () => {
    await startTournee(db, day(2), "other@example.com");
    const requests: SyncRequest[] = [];

    const result = await runSync({ db, identity: AGENT, fetchFn: acceptingServer(requests) });

    expect(requests[0]?.tournees).toEqual([]);
    expect(requests[0]?.stops).toEqual([]);
    expect(result).toMatchObject({ remaining: 0, heldBack: 1 });
    expect(await db.outboxTournees.count()).toBe(1);
  });

  it("stores the pulled tournée, its stops and the visited stops, replacing the last pull", async () => {
    const stale = day(1);
    await db.tournees.put({ id: stale.tournee.id, dayStart: 1, startedAt: 1, clientStartedAt: 1 });
    const tournee: TodayTournee = {
      id: crypto.randomUUID(),
      dayStart: 1_700_000_000_000,
      startedAt: 1_700_000_050_000,
      clientStartedAt: 1_700_000_050_000,
      stops: [
        {
          id: crypto.randomUUID(),
          prospectId: crypto.randomUUID(),
          number: 1,
          addedAt: 1_700_000_050_000,
          left: false,
          joiner: false,
        },
      ],
    };
    const visitedStop = {
      prospectId: crypto.randomUUID(),
      outcome: "interested" as const,
      visitedAt: 1_700_000_060_000,
      flyerGiven: false,
      visitIds: [crypto.randomUUID()],
      name: "Chez Paul",
      type: "bar" as const,
      address: null,
    };

    await runSync({
      db,
      identity: AGENT,
      fetchFn: respondWith(okResponse({ tournee, visitedStops: [visitedStop] })),
    });

    expect((await db.tournees.toArray()).map((t) => t.id)).toEqual([tournee.id]);
    expect(await db.tourneeStops.toArray()).toEqual([
      { ...tournee.stops[0], tourneeId: tournee.id },
    ]);
    expect(await db.visitedStops.toArray()).toEqual([visitedStop]);
  });

  it("drains the outbox and adopts the winner's tournée when the server kept another", async () => {
    const mine = day(2);
    await startTournee(db, mine, AGENT);
    const winner: TodayTournee = {
      id: crypto.randomUUID(),
      dayStart: 1_700_000_000_000,
      startedAt: 1_699_999_000_000,
      clientStartedAt: 1_699_999_000_000,
      stops: [],
    };
    const echo = acceptingServer();
    const fetchFn = (async (url: string, init: RequestInit) => {
      const res = await echo(url, init);
      const body = (await res.json()) as SyncResponse;
      return new Response(JSON.stringify({ ...body, tournee: winner }), { status: 200 });
    }) as unknown as typeof fetch;

    await runSync({ db, identity: AGENT, fetchFn });

    expect(await db.outboxTournees.count()).toBe(0);
    expect((await db.tournees.toArray()).map((t) => t.id)).toEqual([winner.id]);
  });

  describe("joiners", () => {
    const prospectOf = (over: Partial<Prospect> = {}): Prospect => ({
      id: crypto.randomUUID(),
      name: "Le Bouchon",
      type: "restaurant",
      lat: 50.85,
      lng: 4.35,
      address: null,
      phone: null,
      website: null,
      cuisine: null,
      source: "csv",
      status: "assigned",
      assignedTo: AGENT,
      lastVisitAt: null,
      nextVisitAt: null,
      ...over,
    });

    /** A pulled tournée numbering `held` 1..n, started before the response's serverTime. */
    const pulledDay = (held: readonly Prospect[], left: readonly number[] = []): TodayTournee => ({
      id: crypto.randomUUID(),
      dayStart: brusselsPeriod(1_700_000_100_000, 1).from,
      startedAt: 1_700_000_000_000,
      clientStartedAt: 1_700_000_000_000,
      stops: held.map((p, i) => ({
        id: crypto.randomUUID(),
        prospectId: p.id,
        number: i + 1,
        addedAt: 1_700_000_000_000,
        left: left.includes(i + 1),
        joiner: false,
      })),
    });

    it("replaces a pulled later tournée and its queued joiner with the earliest swipe's stops", async () => {
      const held = [prospectOf({ name: "H1" }), prospectOf({ name: "H2" })];
      const joiner = prospectOf({ name: "J" });
      const b = pulledDay(held);
      await runSync({
        db,
        identity: AGENT,
        fetchFn: respondWith(okResponse({ prospects: [...held, joiner], tournee: b })),
      });
      const queued = await db.outboxStops.toArray();
      expect(queued.map((q) => q.tourneeId)).toEqual([b.id]);

      // The server now answers the earliest swipe, which does not hold the joiner.
      const a: TodayTournee = { ...pulledDay([...held].reverse()), dayStart: b.dayStart };
      await runSync({
        db,
        identity: AGENT,
        fetchFn: respondWith(okResponse({ prospects: [...held, joiner], tournee: a })),
      });

      const pulledTournees = await db.tournees.toArray();
      const pulledStops = await db.tourneeStops.toArray();
      expect(pulledTournees.map((t) => t.id)).toEqual([a.id]);
      expect(pulledStops.every((st) => st.tourneeId === a.id)).toBe(true);
      expect(pulledStops.map((st) => st.id).sort()).toEqual(a.stops.map((st) => st.id).sort());

      const today = stopsOfToday(
        {
          pulledTournees,
          pulledStops,
          outboxTournees: await db.outboxTournees.toArray(),
          outboxStops: await db.outboxStops.toArray(),
          identity: AGENT,
        },
        brusselsPeriod(1_700_000_100_000, 1),
      );
      expect(today?.tourneeId).toBe(a.id);
      // The joiner is re-derived against A, at the next number after A's.
      const rederived = (await db.outboxStops.toArray()).filter((q) => q.tourneeId === a.id);
      expect(rederived.map((q) => [q.prospectId, q.number])).toEqual([
        [joiner.id, Math.max(...a.stops.map((st) => st.number)) + 1],
      ]);
      expect(today?.stops.map((st) => st.prospectId)).toContain(joiner.id);
      expect(today?.stops).toHaveLength(a.stops.length + 1);
    });

    it("queues stops 21 and 22 for the two prospects a pull brings after a 20-stop swipe", async () => {
      const held = Array.from({ length: 20 }, (_, i) => prospectOf({ name: `P${i + 1}` }));
      const [p, q] = [prospectOf({ name: "P" }), prospectOf({ name: "Q" })];

      await runSync({
        db,
        identity: AGENT,
        fetchFn: respondWith(okResponse({ prospects: [...held, p, q], tournee: pulledDay(held) })),
      });

      const stops = (await db.outboxStops.toArray()).sort((a, b) => a.number - b.number);
      expect(stops.map((s) => s.number)).toEqual([21, 22]);
      expect(new Set(stops.map((s) => s.prospectId))).toEqual(new Set([p.id, q.id]));
      expect(stops.every((s) => s.writtenBy === AGENT && !("unconfirmed" in s))).toBe(true);
      expect(stops.every((s) => s.addedAt === 1_700_000_100_000)).toBe(true);
    });

    it("sends the joiner on the next sync, and queues a prospect once per pull", async () => {
      const held = [prospectOf(), prospectOf()];
      const p = prospectOf();
      const requests: SyncRequest[] = [];
      const server = acceptingServer(requests);
      // The server accepts what it is sent but has not stored the joiner yet.
      const echo = (async (url: string, init: RequestInit) => {
        const res = await server(url, init);
        const body = (await res.json()) as SyncResponse;
        return new Response(
          JSON.stringify({ ...body, prospects: [...held, p], tournee: pulledDay(held) }),
          { status: 200 },
        );
      }) as unknown as typeof fetch;

      await runSync({ db, identity: AGENT, fetchFn: echo });
      expect(await db.outboxStops.count()).toBe(1);

      await runSync({ db, identity: AGENT, fetchFn: echo });
      expect(requests[1]?.stops.map((s) => [s.number, s.prospectId])).toEqual([[3, p.id]]);
    });

    it("does not rejoin a stop that left, nor one the pull marks left and brings back", async () => {
      const held = Array.from({ length: 3 }, () => prospectOf());
      await runSync({
        db,
        identity: AGENT,
        fetchFn: respondWith(
          // Stop 2 is `left` yet its prospect is still pulled (open again): it must not rejoin.
          okResponse({
            prospects: held,
            tournee: pulledDay(held, [2]),
          }),
        ),
      });

      expect(await db.outboxStops.count()).toBe(0);
    });

    it("appends nothing when the pull has no tournée today", async () => {
      await runSync({
        db,
        identity: AGENT,
        fetchFn: respondWith(okResponse({ prospects: [prospectOf()], tournee: null })),
      });

      expect(await db.outboxStops.count()).toBe(0);
    });

    it("re-appends the prospect a colliding phone lost, as the next number", async () => {
      const held = [prospectOf(), prospectOf()];
      const winner = prospectOf({ name: "X" });
      const loser = prospectOf({ name: "Y" });
      const day = pulledDay(held);
      // This phone sent Y as 3; the server kept X as 3 (from the other phone) and accepted Y.
      await db.outboxStops.add({
        id: crypto.randomUUID(),
        tourneeId: day.id,
        prospectId: loser.id,
        number: 3,
        addedAt: 1_700_000_050_000,
        writtenBy: AGENT,
      });
      const stopId = (await db.outboxStops.toArray())[0]?.id ?? "";
      const withWinner: TodayTournee = {
        ...day,
        stops: [
          ...day.stops,
          {
            id: crypto.randomUUID(),
            prospectId: winner.id,
            number: 3,
            addedAt: 1_700_000_060_000,
            left: false,
            joiner: false,
          },
        ],
      };

      await runSync({
        db,
        identity: AGENT,
        fetchFn: respondWith(
          okResponse({
            accepted: { prospects: [], visits: [], tournees: [], stops: [stopId] },
            prospects: [...held, winner, loser],
            tournee: withWinner,
          }),
        ),
      });

      const [again] = await db.outboxStops.toArray();
      expect(again).toMatchObject({ prospectId: loser.id, number: 4 });
      expect(again?.id).not.toBe(stopId);
    });
  });

  it("clears the pulled tournée when the pull says there is none", async () => {
    await db.tournees.put({
      id: crypto.randomUUID(),
      dayStart: 1,
      startedAt: 1,
      clientStartedAt: 1,
    });
    await runSync({ db, identity: AGENT, fetchFn: respondWith(okResponse({ tournee: null })) });
    expect(await db.tournees.count()).toBe(0);
  });
});
