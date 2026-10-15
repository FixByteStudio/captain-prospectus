import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import type { Prospect, Visit } from "../../shared/schemas";
import { brusselsPeriod } from "../../shared/period";
import {
  appendJoiners,
  cacheVisitHistory,
  clearAgentCache,
  confirmOutbox,
  FieldDb,
  getMeta,
  outboxCounts,
  queueFieldProspect,
  queueVisit,
  releaseUnconfirmed,
  setMeta,
  startTournee,
} from "./db";
import { readingToSend, rememberReading, setReadingIdentity } from "./last-reading";

/**
 * INVARIANT 5 again, from the storage end. A schema upgrade is the one moment
 * the outbox could be silently emptied, and `db.ts` says so at the top: this is
 * a cache plus an outbox, and the outbox is the only copy of a visit until the
 * server accepts it.
 */

let counter = 0;
const dbName = () => `upgrade-test-${counter++}`;

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

const entry = (prospectId: string, over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  prospectId,
  agentEmail: "agent@example.com",
  visitedAt: 1_700_000_000_000,
  flyerGiven: true,
  outcome: "interested" as const,
  followUpAt: null,
  notes: null,
  ...over,
});

describe("the v1 → v2 upgrade", () => {
  it("carries the outbox across untouched", async () => {
    const name = dbName();

    // A phone on the old build, holding visits it has not synced.
    const v1 = new Dexie(name);
    v1.version(1).stores({
      prospects: "id, status, assignedTo",
      outboxProspects: "id",
      outboxVisits: "id, prospectId",
      meta: "key",
    });
    await v1.open();
    const pending = [visit(), visit(), visit()];
    await v1.table("outboxVisits").bulkPut(pending);
    v1.close();

    // The new build opens the same database.
    const v2 = new FieldDb(name);
    await v2.open();

    const kept = await v2.outboxVisits.toArray();
    expect(kept).toHaveLength(3);
    expect(kept.map((v) => v.id).sort()).toEqual(pending.map((v) => v.id).sort());
    v2.close();
  });

  it("reaches v6 with the history and tournée tables present but empty, and no sentVisits", async () => {
    const name = dbName();
    const db = new FieldDb(name);
    await db.open();

    expect(db.verno).toBe(6);
    expect(db.tables.map((t) => t.name)).not.toContain("sentVisits");
    await expect(db.visitHistory.count()).resolves.toBe(0);
    for (const table of [
      db.outboxTournees,
      db.outboxStops,
      db.tournees,
      db.tourneeStops,
      db.visitedStops,
    ]) {
      await expect(table.count()).resolves.toBe(0);
    }
    db.close();
  });
});

/**
 * A hand-copied snapshot of the schema a phone stopped on before v3 shipped
 * (docs/backlog/005), not an import from `db.ts`: importing `FieldDb` here
 * would test v4's upgrade against whatever earlier versions happen to look
 * like today, not the shape that is actually sitting on a device in the
 * field.
 */
const openV2 = async (name: string) => {
  const v2 = new Dexie(name);
  v2.version(1).stores({
    prospects: "id, status, assignedTo",
    outboxProspects: "id",
    outboxVisits: "id, prospectId",
    meta: "key",
  });
  v2.version(2).stores({ visitHistory: "id, prospectId" });
  await v2.open();
  return v2;
};

/**
 * Same reasoning as `openV2`, one version further: a hand-copied snapshot of
 * the real v3 upgrade (the `writtenBy` stamp, docs/backlog/005) rather than
 * an import, so this test proves v4 against v3 as it is, not as `db.ts`
 * might drift to. Verified to match `db.ts`'s own `version(3)` as it stands.
 */
const openV3 = async (name: string) => {
  const v3 = new Dexie(name);
  v3.version(1).stores({
    prospects: "id, status, assignedTo",
    outboxProspects: "id",
    outboxVisits: "id, prospectId",
    meta: "key",
  });
  v3.version(2).stores({ visitHistory: "id, prospectId" });
  v3.version(3)
    .stores({})
    .upgrade(async (tx) => {
      const row = (await tx.table("meta").get("identity")) as
        { value?: { email?: unknown } } | undefined;
      const email = row?.value?.email;
      if (typeof email !== "string") return;
      const stamp = (item: { writtenBy?: string }) => {
        item.writtenBy ??= email;
      };
      await tx.table("outboxVisits").toCollection().modify(stamp);
      await tx.table("outboxProspects").toCollection().modify(stamp);
    });
  await v3.open();
  return v3;
};

describe("the v2 → v6 upgrade", () => {
  it("carries the outbox across, stamped with the cached identity", async () => {
    const name = dbName();
    const v2 = await openV2(name);
    const pending = [visit(), visit(), visit()];
    await v2.table("outboxVisits").bulkPut(pending);
    await v2.table("outboxProspects").put({
      id: crypto.randomUUID(),
      name: "Le camion",
      type: "food_truck",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      createdAt: 1_700_000_000_000,
    });
    await v2
      .table("meta")
      .put({ key: "identity", value: { email: "a@example.com", role: "agent" } });
    v2.close();

    const v5 = new FieldDb(name);
    await v5.open();

    expect(v5.verno).toBe(6);
    const kept = await v5.outboxVisits.toArray();
    expect(kept.map((v) => v.id).sort()).toEqual(pending.map((v) => v.id).sort());
    expect(kept.every((v) => v.writtenBy === "a@example.com")).toBe(true);
    const { writtenBy, ...wire } = kept.find((v) => v.id === pending[0]?.id) ?? {};
    expect(writtenBy).toBe("a@example.com");
    expect(wire).toEqual(pending[0]);
    const prospects = await v5.outboxProspects.toArray();
    expect(prospects.map((p) => p.writtenBy)).toEqual(["a@example.com"]);
    v5.close();
  });

  it("leaves rows unstamped, never dropped, when no identity is cached", async () => {
    const name = dbName();
    const v2 = await openV2(name);
    const pending = [visit(), visit()];
    await v2.table("outboxVisits").bulkPut(pending);
    v2.close();

    const v5 = new FieldDb(name);
    await v5.open();

    const kept = await v5.outboxVisits.toArray();
    expect(kept).toHaveLength(2);
    expect(kept.every((v) => v.writtenBy === undefined)).toBe(true);
    v5.close();
  });
});

describe("the v3 → v6 upgrade", () => {
  it("carries stamped outbox rows and their stamps across", async () => {
    const name = dbName();
    const v3 = await openV3(name);
    const pending = [visit(), visit()].map((v) => ({ ...v, writtenBy: "a@example.com" }));
    await v3.table("outboxVisits").bulkPut(pending);
    v3.close();

    const v5 = new FieldDb(name);
    await v5.open();

    expect(v5.verno).toBe(6);
    const kept = await v5.outboxVisits.toArray();
    expect(kept.map((v) => v.id).sort()).toEqual(pending.map((v) => v.id).sort());
    expect(kept.every((v) => v.writtenBy === "a@example.com")).toBe(true);
    v5.close();
  });
});

/** The schema a phone stopped on before v5 shipped, copied by hand like `openV3`. */
const openV4 = async (name: string) => {
  const v4 = new Dexie(name);
  v4.version(1).stores({
    prospects: "id, status, assignedTo",
    outboxProspects: "id",
    outboxVisits: "id, prospectId",
    meta: "key",
  });
  v4.version(2).stores({ visitHistory: "id, prospectId" });
  v4.version(3).stores({});
  v4.version(4).stores({ sentVisits: "id, sentAt" });
  await v4.open();
  return v4;
};

describe("the v4 → v6 upgrade", () => {
  it("carries a populated outbox across untouched and opens the tournée tables empty — INVARIANT 5", async () => {
    const name = dbName();
    const v4 = await openV4(name);
    const queued = visit();
    const fieldProspect = {
      id: crypto.randomUUID(),
      name: "Le camion",
      type: "food_truck",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      createdAt: 1_700_000_000_000,
      writtenBy: "a@example.com",
    };
    await v4.table("outboxVisits").put({ ...queued, writtenBy: "a@example.com" });
    await v4.table("outboxProspects").put(fieldProspect);
    v4.close();

    const v5 = new FieldDb(name);
    await v5.open();

    expect(v5.verno).toBe(6);
    await expect(v5.outboxVisits.toArray()).resolves.toEqual([
      { ...queued, writtenBy: "a@example.com" },
    ]);
    await expect(v5.outboxProspects.toArray()).resolves.toEqual([fieldProspect]);
    for (const table of [
      v5.outboxTournees,
      v5.outboxStops,
      v5.tournees,
      v5.tourneeStops,
      v5.visitedStops,
    ]) {
      await expect(table.count()).resolves.toBe(0);
    }
    v5.close();
  });
});

/** The schema a phone stopped on before v6 shipped: v5 still holds the `sentVisits` log. */
const openV5 = async (name: string) => {
  const v5 = new Dexie(name);
  v5.version(1).stores({
    prospects: "id, status, assignedTo",
    outboxProspects: "id",
    outboxVisits: "id, prospectId",
    meta: "key",
  });
  v5.version(2).stores({ visitHistory: "id, prospectId" });
  v5.version(3).stores({});
  v5.version(4).stores({ sentVisits: "id, sentAt" });
  v5.version(5).stores({
    outboxTournees: "id",
    outboxStops: "id, tourneeId, prospectId",
    tournees: "id",
    tourneeStops: "id, tourneeId",
    visitedStops: "prospectId",
  });
  await v5.open();
  return v5;
};

describe("the v5 → v6 upgrade", () => {
  it("keeps every outbox and tournée row and drops the sentVisits table — INVARIANT 5", async () => {
    const name = dbName();
    const v5 = await openV5(name);
    const queued = [visit(), visit()].map((v) => ({ ...v, writtenBy: "a@example.com" }));
    const tourneeId = crypto.randomUUID();
    const queuedTournee = {
      id: tourneeId,
      startedAt: 1_700_000_000_000,
      writtenBy: "a@example.com",
    };
    const queuedStop = {
      id: crypto.randomUUID(),
      tourneeId,
      prospectId: crypto.randomUUID(),
      number: 1,
      addedAt: 1_700_000_000_000,
      writtenBy: "a@example.com",
    };
    const pulled = { id: crypto.randomUUID(), dayStart: 1, startedAt: 2 };
    await v5.table("outboxVisits").bulkPut(queued);
    await v5.table("outboxTournees").put(queuedTournee);
    await v5.table("outboxStops").put(queuedStop);
    await v5.table("tournees").put(pulled);
    await v5.table("sentVisits").bulkPut(
      queued.map((v) => ({
        id: v.id,
        prospectId: v.prospectId,
        sentAt: 1_700_000_000_000,
        writtenBy: "a@example.com",
      })),
    );
    v5.close();

    const v6 = new FieldDb(name);
    await v6.open();

    expect(v6.verno).toBe(6);
    expect((await v6.outboxVisits.toArray()).map((v) => v.id).sort()).toEqual(
      queued.map((v) => v.id).sort(),
    );
    await expect(v6.outboxTournees.toArray()).resolves.toEqual([queuedTournee]);
    await expect(v6.outboxStops.toArray()).resolves.toEqual([queuedStop]);
    await expect(v6.tournees.toArray()).resolves.toEqual([pulled]);
    expect(v6.tables.map((t) => t.name)).not.toContain("sentVisits");
    // The table is gone from the database itself, not only from the class.
    expect(v6.backendDB().objectStoreNames.contains("sentVisits")).toBe(false);
    v6.close();
  });
});

describe("queueVisit", () => {
  it("adds the outbox row stamped with the identity", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const v = visit();

    await queueVisit(db, v, "a@example.com");

    const [outboxRow] = await db.outboxVisits.toArray();
    expect(outboxRow).toMatchObject({ id: v.id, writtenBy: "a@example.com" });
    db.close();
  });

  it("rejects, and keeps the queued row, on a duplicate id", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const v = visit();
    await db.outboxVisits.add({ ...v, writtenBy: "a@example.com" });

    await expect(queueVisit(db, v, "a@example.com")).rejects.toBeDefined();

    await expect(db.outboxVisits.count()).resolves.toBe(1);
    db.close();
  });

  it("stamps the row unconfirmed when asked, docs/backlog/013", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const v = visit();

    await queueVisit(db, v, "a@example.com", true);

    const [outboxRow] = await db.outboxVisits.toArray();
    expect(outboxRow?.unconfirmed).toBe(true);
    db.close();
  });

  // Not behavioural coverage — VisitScreen is lazy, Dexie-backed and
  // form-heavy, so mounting it to prove one call site would be slow and
  // brittle (leave-guard.test.tsx's idiom). This is a reminder that the call
  // site still writes through `queueVisit`, so reverting it to a bare
  // `outboxVisits.add` — which would leave the whole suite green while the
  // feature ships inert — is noticed.
  it("is still the write VisitScreen makes when it saves a visit", () => {
    const source = readFileSync(new URL("./VisitScreen.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/queueVisit\(\s*fieldDb\s*,\s*result\.visit\s*,\s*identity\b/);
  });
});

describe("outboxCounts", () => {
  it("splits the outbox between this identity's rows and another's", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await db.outboxVisits.bulkPut([
      { ...visit(), writtenBy: "a@example.com" },
      { ...visit(), writtenBy: "b@example.com" },
      visit(),
    ]);

    // The unstamped row counts as whoever is signed in: it would be sent.
    await expect(outboxCounts(db, "b@example.com")).resolves.toEqual({ pending: 2, heldBack: 1 });
    db.close();
  });

  it("still counts an unconfirmed row as pending — it is this identity's own work, not another agent's (docs/backlog/013)", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await db.outboxVisits.bulkPut([
      { ...visit(), writtenBy: "a@example.com" },
      { ...visit(), writtenBy: "a@example.com", unconfirmed: true },
      { ...visit(), writtenBy: "b@example.com" },
    ]);

    // Not sendable yet (sync.test.ts), but the count and the "N en attente"
    // pill must not read it as belonging to another agent — the
    // "unconfirmed" sync state already says why it has not gone out.
    await expect(outboxCounts(db, "a@example.com")).resolves.toEqual({ pending: 2, heldBack: 1 });
    db.close();
  });
});

describe("cacheVisitHistory", () => {
  it("replaces what it holds for one prospect", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const prospectId = crypto.randomUUID();

    await cacheVisitHistory(db, prospectId, [entry(prospectId), entry(prospectId)]);
    await cacheVisitHistory(db, prospectId, [entry(prospectId)]);

    await expect(db.visitHistory.where("prospectId").equals(prospectId).count()).resolves.toBe(1);
    db.close();
  });

  it("leaves another prospect's cache alone", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();

    await cacheVisitHistory(db, a, [entry(a), entry(a)]);
    await cacheVisitHistory(db, b, [entry(b)]);

    // An agent who goes offline mid-round keeps the history they already pulled.
    await expect(db.visitHistory.where("prospectId").equals(a).count()).resolves.toBe(2);
    db.close();
  });

  it("clears a prospect's cache when the server reports no visits", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const prospectId = crypto.randomUUID();

    await cacheVisitHistory(db, prospectId, [entry(prospectId)]);
    await cacheVisitHistory(db, prospectId, []);

    await expect(db.visitHistory.where("prospectId").equals(prospectId).count()).resolves.toBe(0);
    db.close();
  });
});

describe("clearAgentCache", () => {
  it("drops the round, the history and the identity", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const prospectId = crypto.randomUUID();

    await db.prospects.put({
      id: prospectId,
      name: "Chez Paul",
      type: "restaurant",
      status: "assigned",
      address: null,
      phone: null,
      website: null,
      cuisine: null,
      source: "osm",
      assignedTo: "a@example.com",
      lat: null,
      lng: null,
      lastVisitAt: null,
      nextVisitAt: null,
    });
    await cacheVisitHistory(db, prospectId, [entry(prospectId)]);
    await setMeta(db, "identity", { email: "a@example.com", role: "agent" });

    await clearAgentCache(db);

    await expect(db.prospects.count()).resolves.toBe(0);
    await expect(db.visitHistory.count()).resolves.toBe(0);
    await expect(getMeta(db, "identity")).resolves.toBeUndefined();
    db.close();
  });

  it("drops the last position reading (ADR-0028)", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const now = Date.now();
    setReadingIdentity("a@example.com");
    rememberReading({ lat: 50.8467, lng: 4.3525, accuracy: 20, capturedAt: now });
    expect(readingToSend("a@example.com", now)).toBeDefined();

    await clearAgentCache(db);

    expect(readingToSend("a@example.com", now)).toBeUndefined();
    setReadingIdentity(null);
    db.close();
  });

  it("leaves the outbox alone — INVARIANT 5", async () => {
    const db = new FieldDb(dbName());
    await db.open();

    // A revoked session is not the server listing these in `accepted`, which
    // is the only thing allowed to delete them.
    await db.outboxVisits.bulkPut([visit(), visit()]);
    await db.outboxProspects.put({
      id: crypto.randomUUID(),
      name: "Le camion",
      type: "food_truck",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      createdAt: 1_700_000_000_000,
    });

    await clearAgentCache(db);

    await expect(db.outboxVisits.count()).resolves.toBe(2);
    await expect(db.outboxProspects.count()).resolves.toBe(1);
    db.close();
  });

  it("forgets the last sync time, so the next agent reads « pas encore chargée » until a pull lands", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await setMeta(db, "lastSyncAt", 1_700_000_000_000);

    await clearAgentCache(db);

    await expect(getMeta(db, "lastSyncAt")).resolves.toBeUndefined();
    db.close();
  });
});

/**
 * docs/backlog/013: the identity a cache-sourced session queued a row under
 * is unconfirmed until a live `/api/me` says who is really signed in.
 */
describe("confirmOutbox", () => {
  it("re-stamps unconfirmed rows in all three tables and drops the flag", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const v = visit();
    await queueVisit(db, v, "a@example.com", true);
    const prospectId = crypto.randomUUID();
    await db.outboxProspects.add({
      id: prospectId,
      name: "Le camion",
      type: "food_truck",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      createdAt: 1_700_000_000_000,
      writtenBy: "a@example.com",
      unconfirmed: true,
    });

    await confirmOutbox(db, "a@example.com");

    const [outboxVisit] = await db.outboxVisits.toArray();
    const [outboxProspect] = await db.outboxProspects.toArray();
    expect(outboxVisit).toMatchObject({ writtenBy: "a@example.com" });
    expect(outboxVisit).not.toHaveProperty("unconfirmed");
    expect(outboxProspect).not.toHaveProperty("unconfirmed");
    db.close();
  });

  it("re-stamps to whoever the live answer names, not necessarily the cached email", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const v = visit();
    await queueVisit(db, v, "a@example.com", true);

    // /api/me answered a different agent than the one the cache showed.
    await confirmOutbox(db, "b@example.com");

    const [outboxRow] = await db.outboxVisits.toArray();
    expect(outboxRow?.writtenBy).toBe("b@example.com");
    expect(outboxRow?.unconfirmed).toBeUndefined();
    db.close();
  });

  it("leaves a row that was never unconfirmed alone", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const alreadyConfirmed = visit();
    await db.outboxVisits.add({ ...alreadyConfirmed, writtenBy: "b@example.com" });
    const legacy = visit();
    await db.outboxVisits.add(legacy);

    await confirmOutbox(db, "a@example.com");

    // Another identity's confirmed row stays theirs — never re-attributed —
    // and a pre-v3 unstamped row stays unstamped, both untouched by a
    // confirmation that is not about them.
    expect(await db.outboxVisits.get(alreadyConfirmed.id)).toMatchObject({
      writtenBy: "b@example.com",
    });
    expect((await db.outboxVisits.get(legacy.id))?.writtenBy).toBeUndefined();
    db.close();
  });

  it("never deletes a row — INVARIANT 5", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await queueVisit(db, visit(), "a@example.com", true);

    await confirmOutbox(db, "a@example.com");

    await expect(db.outboxVisits.count()).resolves.toBe(1);
    db.close();
  });

  it("is a no-op when nothing is flagged, so calling it on every live /api/me costs nothing", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const plain = visit();
    await db.outboxVisits.add({ ...plain, writtenBy: "a@example.com" });

    await confirmOutbox(db, "a@example.com");

    expect(await db.outboxVisits.get(plain.id)).toEqual({ ...plain, writtenBy: "a@example.com" });
    db.close();
  });
});

/**
 * docs/backlog/013: an expired cookie cannot confirm anyone, so a 401 only
 * drops the flag rather than re-stamping to a single "current" identity —
 * there may be flagged rows from more than one cache-sourced launch.
 */
describe("releaseUnconfirmed", () => {
  it("drops the flag from every outbox table, keeping each row's own writtenBy", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await queueVisit(db, visit(), "a@example.com", true);
    await db.outboxProspects.add({
      id: crypto.randomUUID(),
      name: "Le camion",
      type: "food_truck",
      lat: null,
      lng: null,
      address: null,
      phone: null,
      createdAt: 1_700_000_000_000,
      writtenBy: "b@example.com",
      unconfirmed: true,
    });

    await releaseUnconfirmed(db);

    const [outboxVisit] = await db.outboxVisits.toArray();
    const [outboxProspect] = await db.outboxProspects.toArray();
    expect(outboxVisit).toMatchObject({ writtenBy: "a@example.com" });
    expect(outboxVisit).not.toHaveProperty("unconfirmed");
    expect(outboxProspect).toMatchObject({ writtenBy: "b@example.com" });
    expect(outboxProspect).not.toHaveProperty("unconfirmed");
    db.close();
  });

  it("releases rows written under different cached identities in the same call — no single email is assumed", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await db.outboxVisits.bulkAdd([
      { ...visit(), writtenBy: "a@example.com", unconfirmed: true },
      { ...visit(), writtenBy: "b@example.com", unconfirmed: true },
    ]);

    await releaseUnconfirmed(db);

    const rows = await db.outboxVisits.toArray();
    expect(rows.map((r) => r.writtenBy).sort()).toEqual(["a@example.com", "b@example.com"]);
    expect(rows.every((r) => r.unconfirmed === undefined)).toBe(true);
    db.close();
  });

  it("leaves an already-confirmed row untouched", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const confirmed = visit();
    await db.outboxVisits.add({ ...confirmed, writtenBy: "a@example.com" });

    await releaseUnconfirmed(db);

    expect(await db.outboxVisits.get(confirmed.id)).toEqual({
      ...confirmed,
      writtenBy: "a@example.com",
    });
    db.close();
  });

  it("never deletes a row — INVARIANT 5", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await queueVisit(db, visit(), "a@example.com", true);

    await releaseUnconfirmed(db);

    await expect(db.outboxVisits.count()).resolves.toBe(1);
    db.close();
  });
});

const day = (stops = 3) => {
  const tourneeId = crypto.randomUUID();
  return {
    tournee: { id: tourneeId, startedAt: 1_700_000_000_000 },
    stops: Array.from({ length: stops }, (_, i) => ({
      id: crypto.randomUUID(),
      tourneeId,
      prospectId: crypto.randomUUID(),
      number: i + 1,
      addedAt: 1_700_000_000_000,
    })),
  };
};

describe("startTournee", () => {
  it("writes the tournée and every stop, stamped with the identity", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const { tournee, stops } = day();

    await startTournee(db, { tournee, stops }, "a@example.com");

    await expect(db.outboxTournees.toArray()).resolves.toEqual([
      { ...tournee, writtenBy: "a@example.com" },
    ]);
    const stored = await db.outboxStops.toArray();
    expect(stored).toHaveLength(3);
    expect(stored.every((s) => s.writtenBy === "a@example.com")).toBe(true);
    db.close();
  });

  it("stamps every row unconfirmed when asked, docs/backlog/013", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await startTournee(db, day(), "a@example.com", true);

    expect((await db.outboxTournees.toArray()).every((t) => t.unconfirmed)).toBe(true);
    expect((await db.outboxStops.toArray()).every((t) => t.unconfirmed)).toBe(true);

    await confirmOutbox(db, "b@example.com");
    expect((await db.outboxTournees.toArray())[0]).toMatchObject({ writtenBy: "b@example.com" });
    expect((await db.outboxStops.toArray()).every((s) => s.writtenBy === "b@example.com")).toBe(
      true,
    );
    expect((await db.outboxStops.toArray())[0]).not.toHaveProperty("unconfirmed");
    db.close();
  });

  it("writes nothing when a stop cannot be written — no tournée without its stops", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const { tournee, stops } = day(2);
    const [first] = stops;
    if (!first) throw new Error("fixture");

    // A duplicate stop id makes the bulk add fail after the tournée was added.
    await expect(
      startTournee(db, { tournee, stops: [first, first] }, "a@example.com"),
    ).rejects.toThrow();

    await expect(db.outboxTournees.count()).resolves.toBe(0);
    await expect(db.outboxStops.count()).resolves.toBe(0);
    db.close();
  });

  it("is dropped from the unconfirmed flag by releaseUnconfirmed, keeping the writer", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await startTournee(db, day(), "a@example.com", true);

    await releaseUnconfirmed(db);

    const [t] = await db.outboxTournees.toArray();
    expect(t).toMatchObject({ writtenBy: "a@example.com" });
    expect(t).not.toHaveProperty("unconfirmed");
    expect((await db.outboxStops.toArray())[0]).not.toHaveProperty("unconfirmed");
    db.close();
  });
});

describe("outboxCounts with a tournée", () => {
  it("counts a swipe of 20 stops as one element", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await startTournee(db, day(20), "a@example.com");

    await expect(outboxCounts(db, "a@example.com")).resolves.toEqual({ pending: 1, heldBack: 0 });
    db.close();
  });

  it("counts stops alone once their tournée left the outbox", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const { tournee, stops } = day(20);
    await startTournee(db, { tournee, stops }, "a@example.com");
    await db.outboxTournees.delete(tournee.id);

    await expect(outboxCounts(db, "a@example.com")).resolves.toEqual({ pending: 20, heldBack: 0 });
    db.close();
  });

  it("holds back another identity's tournée", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await startTournee(db, day(5), "a@example.com");

    await expect(outboxCounts(db, "b@example.com")).resolves.toEqual({ pending: 0, heldBack: 1 });
    db.close();
  });
});

describe("clearAgentCache and the tournée", () => {
  it("clears the pulled tournée tables and keeps the outbox", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const { tournee, stops } = day(2);
    await startTournee(db, { tournee, stops }, "a@example.com");
    await db.tournees.put({ id: tournee.id, dayStart: 1, startedAt: 2 });
    await db.tourneeStops.put({
      id: crypto.randomUUID(),
      tourneeId: tournee.id,
      prospectId: crypto.randomUUID(),
      number: 1,
      addedAt: 1,
      left: false,
    });
    await db.visitedStops.put({
      prospectId: crypto.randomUUID(),
      outcome: "interested",
      visitedAt: 1,
      flyerGiven: false,
      visitIds: [],
      name: "x",
      type: "bar",
      address: null,
    });

    await clearAgentCache(db);

    await expect(db.tournees.count()).resolves.toBe(0);
    await expect(db.tourneeStops.count()).resolves.toBe(0);
    await expect(db.visitedStops.count()).resolves.toBe(0);
    await expect(db.outboxTournees.count()).resolves.toBe(1);
    await expect(db.outboxStops.count()).resolves.toBe(2);
    db.close();
  });
});

describe("appendJoiners", () => {
  const NOW = 1_700_000_100_000;
  const AGENT = "a@example.com";
  const DAY_START = brusselsPeriod(NOW, 1).from;

  const prospect = (over: Partial<Prospect> = {}): Prospect => ({
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

  /** A pulled tournée of `held`, numbered 1..n and started before `NOW`. */
  async function pulled(db: FieldDb, held: readonly Prospect[]) {
    const tourneeId = crypto.randomUUID();
    await db.prospects.bulkPut([...held]);
    await db.tournees.put({ id: tourneeId, dayStart: DAY_START, startedAt: DAY_START + 1 });
    await db.tourneeStops.bulkPut(
      held.map((p, i) => ({
        id: crypto.randomUUID(),
        tourneeId,
        prospectId: p.id,
        number: i + 1,
        addedAt: DAY_START + 1,
        left: false,
      })),
    );
    return tourneeId;
  }

  it("queues the missing prospects as the next numbers, stamped like the swipe", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const held = [prospect(), prospect()];
    const tourneeId = await pulled(db, held);
    const [p, q] = [prospect({ name: "P" }), prospect({ name: "Q" })];
    await db.prospects.bulkPut([p, q]);

    await appendJoiners(db, AGENT, NOW);

    const stops = (await db.outboxStops.toArray()).sort((a, b) => a.number - b.number);
    expect(stops.map((s) => s.number)).toEqual([3, 4]);
    expect(stops.every((s) => s.tourneeId === tourneeId && s.writtenBy === AGENT)).toBe(true);
    expect(stops.every((s) => s.addedAt === NOW && !("unconfirmed" in s))).toBe(true);
    expect(new Set(stops.map((s) => s.prospectId))).toEqual(new Set([p.id, q.id]));
    db.close();
  });

  it("appends a prospect once, however many times it runs", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await pulled(db, [prospect()]);
    await db.prospects.put(prospect());

    await appendJoiners(db, AGENT, NOW);
    await appendJoiners(db, AGENT, NOW + 1);

    await expect(db.outboxStops.count()).resolves.toBe(1);
    db.close();
  });

  it("does nothing before the swipe, or with yesterday's tournée", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await db.prospects.put(prospect());
    await appendJoiners(db, AGENT, NOW);

    await db.tournees.put({
      id: crypto.randomUUID(),
      dayStart: DAY_START - 86_400_000,
      startedAt: DAY_START - 86_000_000,
    });
    await appendJoiners(db, AGENT, NOW);

    await expect(db.outboxStops.count()).resolves.toBe(0);
    db.close();
  });

  it("stamps a joiner unconfirmed when asked", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    await pulled(db, [prospect()]);
    await db.prospects.put(prospect());

    await appendJoiners(db, AGENT, NOW, true);

    expect((await db.outboxStops.toArray())[0]?.unconfirmed).toBe(true);
    db.close();
  });

  it("appends to a tournée still in the outbox and counts its queued stops", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const held = prospect();
    await db.prospects.put(held);
    const tourneeId = crypto.randomUUID();
    await startTournee(
      db,
      {
        tournee: { id: tourneeId, startedAt: DAY_START + 1 },
        stops: [
          {
            id: crypto.randomUUID(),
            tourneeId,
            prospectId: held.id,
            number: 9,
            addedAt: DAY_START + 1,
          },
        ],
      },
      AGENT,
    );
    await db.prospects.put(prospect());

    await appendJoiners(db, AGENT, NOW);

    const numbers = (await db.outboxStops.toArray()).map((s) => s.number).sort((a, b) => a - b);
    expect(numbers).toEqual([9, 10]);
    db.close();
  });
});

describe("queueFieldProspect", () => {
  const NOW = 1_700_000_100_000;
  const AGENT = "a@example.com";
  const DAY_START = brusselsPeriod(NOW, 1).from;

  const field = () => ({
    id: crypto.randomUUID(),
    name: "Food truck du pont",
    type: "food_truck" as const,
    lat: null,
    lng: null,
    address: null,
    phone: null,
    createdAt: NOW,
  });

  it("queues the prospect and its stop together once the day has started", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const tourneeId = crypto.randomUUID();
    await db.tournees.put({ id: tourneeId, dayStart: DAY_START, startedAt: DAY_START + 1 });
    await db.tourneeStops.put({
      id: crypto.randomUUID(),
      tourneeId,
      prospectId: crypto.randomUUID(),
      number: 20,
      addedAt: DAY_START + 1,
      left: false,
    });
    const prospect = field();

    await queueFieldProspect(db, prospect, AGENT, false, NOW);

    await expect(db.outboxProspects.toArray()).resolves.toEqual([
      { ...prospect, writtenBy: AGENT },
    ]);
    const [stop] = await db.outboxStops.toArray();
    expect(stop).toMatchObject({ prospectId: prospect.id, number: 21, tourneeId });
    db.close();
  });

  it("stamps the joiner stop unconfirmed with the prospect", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const tourneeId = crypto.randomUUID();
    await db.tournees.put({ id: tourneeId, dayStart: DAY_START, startedAt: DAY_START + 1 });

    await queueFieldProspect(db, field(), AGENT, true, NOW);

    const [stop] = await db.outboxStops.toArray();
    expect(stop).toMatchObject({ tourneeId, writtenBy: AGENT, unconfirmed: true });
    db.close();
  });

  it("queues only the prospect before the swipe", async () => {
    const db = new FieldDb(dbName());
    await db.open();

    await queueFieldProspect(db, field(), AGENT, true, NOW);

    expect((await db.outboxProspects.toArray())[0]?.unconfirmed).toBe(true);
    await expect(db.outboxStops.count()).resolves.toBe(0);
    db.close();
  });

  it("queues neither when the stop cannot be written", async () => {
    const db = new FieldDb(dbName());
    await db.open();
    const tourneeId = crypto.randomUUID();
    await db.tournees.put({ id: tourneeId, dayStart: DAY_START, startedAt: DAY_START + 1 });
    const prospect = field();
    vi.spyOn(db.outboxStops, "bulkAdd").mockRejectedValueOnce(new Error("QuotaExceededError"));

    await expect(queueFieldProspect(db, prospect, AGENT, false, NOW)).rejects.toThrow();

    await expect(db.outboxProspects.count()).resolves.toBe(0);
    db.close();
  });
});
