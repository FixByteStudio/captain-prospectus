import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./db/client";
import { ADMIN_VISITS_PAGE_SIZE, IMPORT_STALE_MS, type RefusalReason } from "../shared/constants";
import { agentPositions, importBatches, imports, prospects, scripts, visits } from "./db/schema";
import type {
  AdminVisitsResponse,
  AgentRoundResponse,
  AgentsResponse,
  AssignResult,
  DuplicatesResponse,
  ImportResult,
  ImportsResponse,
  MergeResult,
  Prospect,
  ProspectsResponse,
  Script,
  ScriptsResponse,
} from "../shared/schemas";
import { workerFetch } from "../../test/worker-fetch";
import { resetTestUsers, seedUser } from "../../test/users";

/**
 * Admin routes against a real D1, built by the real migrations.
 *
 * DEV_USER_EMAIL is bound in vitest.config.ts to the admin row that
 * test/setup-worker.ts seeds, so these run as an admin exactly as localhost
 * development does.
 */

const ADMIN = "admin@example.com";
const AGENT = "agent@example.com";

async function call(path: string, init?: RequestInit): Promise<Response> {
  return workerFetch(`http://localhost${path}`, init);
}

function post(path: string, body: unknown): Promise<Response> {
  return call(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patch(path: string, body: unknown): Promise<Response> {
  return call(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type Row = {
  name: string;
  type?: string;
  lat?: number;
  lng?: number;
  address?: string;
  phone?: string;
  sourceRef?: string;
};

function importRows(rows: Row[], source: "csv" | "osm" = "csv"): Promise<Response> {
  return post("/api/admin/prospects/batch", { source, rows });
}

beforeEach(async () => {
  const db = getDb(env.DB);
  // Order matters: visits reference both of the others by foreign key.
  await db.delete(visits);
  await db.delete(prospects);
  await db.delete(scripts);
  await resetTestUsers();
});

describe("GET /api/admin/agents", () => {
  it("lists the admins and the agents, with their roles", async () => {
    const response = await call("/api/admin/agents");
    expect(response.status).toBe(200);

    const body = (await response.json()) as AgentsResponse;
    expect(body.agents).toEqual([
      { email: ADMIN, role: "admin" },
      { email: AGENT, role: "agent" },
    ]);
  });

  it("lists active users only, with their own role, sorted by email (GH #303)", async () => {
    await seedUser("zoe@example.com", "admin");
    await seedUser("bob@example.com", "agent");
    await seedUser("gone@example.com", "agent", false);
    const body = (await (await call("/api/admin/agents")).json()) as AgentsResponse;
    expect(body.agents).toEqual([
      { email: ADMIN, role: "admin" },
      { email: AGENT, role: "agent" },
      { email: "bob@example.com", role: "agent" },
      { email: "zoe@example.com", role: "admin" },
    ]);
  });
});

describe("a deactivated user leaves the roster (GH #303)", () => {
  const GONE = "gone@example.com";

  it("assigns, then refuses new assignments and a round, but keeps the prospects", async () => {
    await seedUser(GONE, "agent");
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35 }]);
    await importRows([{ name: "Le Zinc", lat: 50.85, lng: 4.36 }]);
    const db = getDb(env.DB);
    const [first, second] = await db.select().from(prospects);
    if (!first || !second) throw new Error("the import wrote nothing");

    expect(
      (await post("/api/admin/prospects/assign", { ids: [first.id], assignedTo: GONE })).status,
    ).toBe(200);
    expect((await call(`/api/admin/agents/${GONE}/round`)).status).toBe(200);
    // PATCH accepts a users-only email while it is active, then unassigns so
    // the checks below start from `second` unassigned.
    const patched = await patch(`/api/admin/prospects/${second.id}`, { assignedTo: GONE });
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { assignedTo: string | null }).assignedTo).toBe(GONE);
    expect((await patch(`/api/admin/prospects/${second.id}`, { assignedTo: null })).status).toBe(
      200,
    );

    await seedUser(GONE, "agent", false);

    const refused = await post("/api/admin/prospects/assign", {
      ids: [second.id],
      assignedTo: GONE,
    });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { error: string }).error).toBe("unknown_assignee");
    expect((await patch(`/api/admin/prospects/${second.id}`, { assignedTo: GONE })).status).toBe(
      400,
    );
    expect((await call(`/api/admin/agents/${GONE}/round`)).status).toBe(404);

    const rows = await db.select().from(prospects);
    expect(rows.find((r) => r.id === first.id)?.assignedTo).toBe(GONE);
    expect(rows.find((r) => r.id === second.id)?.assignedTo).toBeNull();

    // Unassigning stays allowed.
    expect(
      (await post("/api/admin/prospects/assign", { ids: [first.id], assignedTo: null })).status,
    ).toBe(200);
  });
});

describe("GET /api/admin/prospects", () => {
  it("returns an empty list rather than an error when nothing is imported", async () => {
    const body = (await (await call("/api/admin/prospects")).json()) as ProspectsResponse;
    expect(body).toEqual({ prospects: [], total: 0 });
  });

  it("filters by status, assignee and source", async () => {
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35 }]);
    await importRows([{ name: "Le Zinc", lat: 50.85, lng: 4.36 }], "osm");

    const db = getDb(env.DB);
    const [first] = await db.select().from(prospects).limit(1);
    if (!first) throw new Error("the import wrote nothing");
    await post("/api/admin/prospects/assign", { ids: [first.id], assignedTo: AGENT });

    const byStatus = (await (
      await call("/api/admin/prospects?status=assigned")
    ).json()) as ProspectsResponse;
    expect(byStatus.prospects.map((p) => p.id)).toEqual([first.id]);

    const byAgent = (await (
      await call(`/api/admin/prospects?assignedTo=${AGENT}`)
    ).json()) as ProspectsResponse;
    expect(byAgent.prospects.map((p) => p.id)).toEqual([first.id]);

    const bySource = (await (
      await call("/api/admin/prospects?source=osm")
    ).json()) as ProspectsResponse;
    expect(bySource.prospects.map((p) => p.name)).toEqual(["Le Zinc"]);
  });

  it("pages, and reports the total matching the filter rather than the page", async () => {
    await importRows(
      Array.from({ length: 12 }, (_, i) => ({
        name: `Bistrot ${i}`,
        lat: 50.8 + i / 100,
        lng: 4.8,
      })),
    );

    const page = (await (
      await call("/api/admin/prospects?limit=5&offset=0")
    ).json()) as ProspectsResponse;
    expect(page.prospects).toHaveLength(5);
    expect(page.total).toBe(12);

    const rest = (await (
      await call("/api/admin/prospects?limit=5&offset=10")
    ).json()) as ProspectsResponse;
    expect(rest.prospects).toHaveLength(2);
    expect(rest.total).toBe(12);
  });

  it("rejects a filter value that is not a known status", async () => {
    const response = await call("/api/admin/prospects?status=parti");
    expect(response.status).toBe(400);
  });

  /** Five prospects, one per status, named after it. */
  async function onePerStatus(): Promise<void> {
    const statuses = ["new", "assigned", "follow_up", "converted", "rejected"] as const;
    await importRows(
      statuses.map((status, i) => ({ name: status, lat: 50.8 + i / 100, lng: 4.3 })),
    );
    const db = getDb(env.DB);
    for (const status of statuses) {
      await db.update(prospects).set({ status }).where(eq(prospects.name, status));
    }
  }

  async function names(query: string): Promise<{ names: string[]; total: number }> {
    const body = (await (await call(`/api/admin/prospects?${query}`)).json()) as ProspectsResponse;
    return { names: body.prospects.map((p) => p.name).sort(), total: body.total };
  }

  it("takes several statuses, comma-separated, and totals across them", async () => {
    await onePerStatus();
    expect(await names("status=new,assigned,follow_up")).toEqual({
      names: ["assigned", "follow_up", "new"],
      total: 3,
    });
  });

  it("reads one status as before and collapses duplicates", async () => {
    await onePerStatus();
    expect(await names("status=assigned")).toEqual({ names: ["assigned"], total: 1 });
    expect(await names("status=new,new")).toEqual({ names: ["new"], total: 1 });
  });

  it.each([
    "status=new,parti",
    "status=",
    "status=new,",
    "dueBefore=abc",
    "dueBefore=-1",
    "dueBefore=",
    "dueBefore=1e3",
    "dueBefore=9000000000000000",
  ])("rejects %s with a validation error", async (query) => {
    const response = await call(`/api/admin/prospects?${query}`);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("validation");
  });

  it("keeps a follow-up due strictly before dueBefore, and never one without a date", async () => {
    const T = 1_800_000_000_000;
    await importRows([
      { name: "early", lat: 50.81, lng: 4.3 },
      { name: "on time", lat: 50.82, lng: 4.3 },
      { name: "undated", lat: 50.83, lng: 4.3 },
    ]);
    const db = getDb(env.DB);
    await db.update(prospects).set({ status: "follow_up" });
    await db
      .update(prospects)
      .set({ nextVisitAt: T - 1 })
      .where(eq(prospects.name, "early"));
    await db.update(prospects).set({ nextVisitAt: T }).where(eq(prospects.name, "on time"));

    expect(await names(`status=follow_up&dueBefore=${T}`)).toEqual({ names: ["early"], total: 1 });
  });

  it("rejects a non-status item before any SQL runs", async () => {
    // A quote inside a value is an enum miss (400), never a broken statement (500).
    const response = await call(`/api/admin/prospects?status=${encodeURIComponent("new,')--")}`);
    expect(response.status).toBe(400);
  });

  it("filters by a substring of the name", async () => {
    await importRows([
      { name: "Le Bistrot du Coin", lat: 50.84, lng: 4.35 },
      { name: "Chez Marcel", lat: 50.85, lng: 4.36 },
    ]);

    expect(await names("q=bistro")).toEqual({ names: ["Le Bistrot du Coin"], total: 1 });
  });

  it("folds case, ASCII-only", async () => {
    await importRows([{ name: "Le Bistrot du Coin", lat: 50.84, lng: 4.35 }]);
    expect(await names("q=BISTRO")).toEqual({ names: ["Le Bistrot du Coin"], total: 1 });
  });

  it("combines q with status, totalling the set both select", async () => {
    await onePerStatus();
    await importRows([{ name: "assigned-bistro", lat: 50.9, lng: 4.4 }]);
    const db = getDb(env.DB);
    await db
      .update(prospects)
      .set({ status: "assigned" })
      .where(eq(prospects.name, "assigned-bistro"));

    expect(await names("q=bistro&status=assigned")).toEqual({
      names: ["assigned-bistro"],
      total: 1,
    });
  });

  it("returns an empty list rather than an error when q matches nothing", async () => {
    await importRows([{ name: "Le Bistrot du Coin", lat: 50.84, lng: 4.35 }]);
    expect(await names("q=zzz")).toEqual({ names: [], total: 0 });
  });

  it("excludes a merged prospect from a q search, like every other list", async () => {
    await importRows([
      { name: "Bistrot Survivant", lat: 50.84, lng: 4.35 },
      { name: "Bistrot Absorbe", lat: 50.85, lng: 4.36 },
    ]);
    const db = getDb(env.DB);
    const rows = await db.select().from(prospects);
    const survivor = rows.find((p) => p.name === "Bistrot Survivant");
    const merged = rows.find((p) => p.name === "Bistrot Absorbe");
    if (!survivor || !merged) throw new Error("the import wrote nothing");

    const merge = await post("/api/admin/prospects/merge", {
      survivorId: survivor.id,
      mergedId: merged.id,
    });
    expect(merge.status).toBe(200);

    expect(await names("q=bistrot")).toEqual({ names: ["Bistrot Survivant"], total: 1 });
  });

  it("rejects an empty q rather than treating it as no filter", async () => {
    const response = await call("/api/admin/prospects?q=");
    expect(response.status).toBe(400);
  });

  it("folds ASCII case only, so an accented character must match exactly", async () => {
    await importRows([
      { name: "Café du Port", lat: 50.84, lng: 4.35 },
      { name: "CAFÉ DU MIDI", lat: 50.85, lng: 4.36 },
    ]);

    expect(await names("q=café")).toEqual({ names: ["Café du Port"], total: 1 });
    expect(await names("q=CAFÉ")).toEqual({ names: ["CAFÉ DU MIDI"], total: 1 });
    // Same accented letter, opposite case: neither side folds it, so no match.
    expect(await names("q=Café DU MIDI")).toEqual({ names: [], total: 0 });
    expect(await names("q=cafe")).toEqual({ names: [], total: 0 });
    expect(await names("q=du")).toEqual({
      names: ["CAFÉ DU MIDI", "Café du Port"],
      total: 2,
    });
  });

  it("treats % and _ in q as literal characters, not wildcards", async () => {
    await importRows([
      { name: "100% Bio", lat: 50.84, lng: 4.35 },
      { name: "Snack_Bar", lat: 50.85, lng: 4.36 },
      { name: "Ordinary Bistro", lat: 50.86, lng: 4.37 },
    ]);

    expect(await names("q=" + encodeURIComponent("100%"))).toEqual({
      names: ["100% Bio"],
      total: 1,
    });
    expect(await names("q=" + encodeURIComponent("Snack_Bar"))).toEqual({
      names: ["Snack_Bar"],
      total: 1,
    });
    // Literal, not "any single character" or "anything": each matches only
    // the name that actually contains it.
    expect(await names("q=" + encodeURIComponent("_"))).toEqual({
      names: ["Snack_Bar"],
      total: 1,
    });
    expect(await names("q=" + encodeURIComponent("%"))).toEqual({
      names: ["100% Bio"],
      total: 1,
    });
  });

  it("treats the escape character itself as literal, not the start of an escape", async () => {
    await importRows([
      { name: "Chez Paul!", lat: 50.84, lng: 4.35 },
      { name: "Chez Paulette", lat: 50.85, lng: 4.36 },
    ]);

    expect(await names("q=" + encodeURIComponent("Paul!"))).toEqual({
      names: ["Chez Paul!"],
      total: 1,
    });
  });

  it("matches with q trimmed of surrounding whitespace", async () => {
    await importRows([{ name: "Le Bistrot du Coin", lat: 50.84, lng: 4.35 }]);
    expect(await names("q=" + encodeURIComponent("  bistro  "))).toEqual({
      names: ["Le Bistrot du Coin"],
      total: 1,
    });
  });

  it("rejects a q longer than 200 characters", async () => {
    const response = await call(`/api/admin/prospects?q=${"a".repeat(201)}`);
    expect(response.status).toBe(400);
  });
});

describe("Hors cible signalé (GH #250)", () => {
  const T0 = 1_000_000;

  async function seedProspect(name: string, over: Partial<typeof prospects.$inferInsert> = {}) {
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
        createdBy: ADMIN,
        createdAt: T0,
        updatedAt: T0,
        ...over,
      });
    return id;
  }

  /** Straight to D1: a test has to place visits before and after an admin edit. */
  async function seedVisit(
    prospectId: string,
    visitedAt: number,
    over: Partial<typeof visits.$inferInsert> = {},
  ) {
    const db = getDb(env.DB);
    await db.insert(visits).values({
      id: crypto.randomUUID(),
      prospectId,
      agentEmail: AGENT,
      visitedAt,
      clientVisitedAt: visitedAt,
      receivedAt: visitedAt,
      flyerGiven: true,
      outcome: "not_interested",
      refusalReason: "out_of_target",
      clientVersion: 1,
      ...over,
    });
    await db.update(prospects).set({ lastVisitAt: visitedAt }).where(eq(prospects.id, prospectId));
  }

  /** A prospect flagged the way an agent flags it: one out_of_target refusal. */
  async function flagged(name: string, over: Partial<typeof prospects.$inferInsert> = {}) {
    const id = await seedProspect(name, over);
    await seedVisit(id, T0);
    return id;
  }

  async function list(query = "outOfTarget=true") {
    const response = await call(`/api/admin/prospects?${query}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as ProspectsResponse;
    return { names: body.prospects.map((p) => p.name).sort(), total: body.total };
  }

  it("lists a prospect whose latest visit reported out_of_target, and counts it", async () => {
    await flagged("Fermé");
    const other = await seedProspect("Ouvert");
    await seedVisit(other, T0, { refusalReason: "no_need" });
    await seedProspect("Jamais visité");

    expect(await list()).toEqual({ names: ["Fermé"], total: 1 });
    expect((await list("")).total).toBe(3);
  });

  it("leaves the list once an admin PATCHes fields, and the total drops", async () => {
    const id = await flagged("Fermé");
    await flagged("Autre fermé");
    expect((await list()).total).toBe(2);

    expect((await patch(`/api/admin/prospects/${id}`, { phone: "0478000000" })).status).toBe(200);
    expect(await list()).toEqual({ names: ["Autre fermé"], total: 1 });
  });

  it("leaves the list once an admin PATCHes the status", async () => {
    const id = await flagged("Fermé");
    await patch(`/api/admin/prospects/${id}`, { status: "rejected" });
    expect(await list()).toEqual({ names: [], total: 0 });
  });

  it("leaves the list when a newer visit has another outcome or another reason", async () => {
    const outcome = await flagged("Revenu");
    await seedVisit(outcome, T0 + 1, { outcome: "interested", refusalReason: null });
    const reason = await flagged("Autre raison");
    await seedVisit(reason, T0 + 1, { refusalReason: "no_need" });

    expect(await list()).toEqual({ names: [], total: 0 });
  });

  it("settles a tie on visited_at by received_at, then id, like the status does", async () => {
    const id = await flagged("Égalité");
    await seedVisit(id, T0, { outcome: "interested", refusalReason: null, receivedAt: T0 + 5 });
    expect((await list()).total).toBe(0);

    const later = await flagged("Égalité 2");
    await seedVisit(later, T0, { receivedAt: T0 - 5, outcome: "interested", refusalReason: null });
    expect(await list()).toEqual({ names: ["Égalité 2"], total: 1 });
  });

  it("is back in the list when a newer out_of_target visit follows the review", async () => {
    const id = await flagged("Fermé");
    await patch(`/api/admin/prospects/${id}`, { phone: "0478000000" });
    expect((await list()).total).toBe(0);

    await seedVisit(id, Date.now() + 60_000);
    expect(await list()).toEqual({ names: ["Fermé"], total: 1 });
  });

  it("stays flagged when the review is stamped at exactly the visit's instant, not after it", async () => {
    const id = await flagged("Pile");
    const db = getDb(env.DB);
    await db.update(prospects).set({ outOfTargetReviewedAt: T0 }).where(eqId(id));
    expect((await list()).total).toBe(1);

    await db
      .update(prospects)
      .set({ outOfTargetReviewedAt: T0 + 1 })
      .where(eqId(id));
    expect((await list()).total).toBe(0);
  });

  it("stays flagged through assign, unassign, merge as survivor and a CSV re-import", async () => {
    await importRows([{ name: "Chez Fermé", lat: 50.84, lng: 4.35 }]);
    await importRows([{ name: "Doublon", lat: 50.9, lng: 4.4 }]);
    const db = getDb(env.DB);
    const rows = await db.select().from(prospects);
    const target = rows.find((r) => r.name === "Chez Fermé");
    const duplicate = rows.find((r) => r.name === "Doublon");
    if (!target || !duplicate) throw new Error("the import wrote nothing");
    await seedVisit(target.id, T0);

    await post("/api/admin/prospects/assign", { ids: [target.id], assignedTo: AGENT });
    expect((await list()).total).toBe(1);
    await post("/api/admin/prospects/assign", { ids: [target.id], assignedTo: null });
    expect((await list()).total).toBe(1);

    const merge = await post("/api/admin/prospects/merge", {
      survivorId: target.id,
      mergedId: duplicate.id,
    });
    expect(merge.status).toBe(200);
    expect((await list()).total).toBe(1);

    await importRows([{ name: "Chez Fermé", lat: 50.84, lng: 4.35, phone: "0478000000" }]);
    expect(await list()).toEqual({ names: ["Chez Fermé"], total: 1 });
    await importRows([{ name: "Chez Fermé", lat: 50.84, lng: 4.35, phone: "0478111111" }], "osm");
    expect(await list()).toEqual({ names: ["Chez Fermé"], total: 1 });
    const [after] = await db.select().from(prospects).where(eqId(target.id));
    expect(after?.outOfTargetReviewedAt).toBeNull();
  });

  it("never lists nor counts a merged prospect", async () => {
    const survivor = await seedProspect("Survivant");
    const absorbed = await flagged("Absorbé", { mergedInto: survivor });
    expect(absorbed).not.toBe(survivor);
    expect(await list()).toEqual({ names: [], total: 0 });
  });

  it("combines with another filter, and totals the combined set", async () => {
    await flagged("Chez Léa", { assignedTo: AGENT });
    await flagged("Le Zinc", { assignedTo: ADMIN });
    await seedProspect("Ouvert", { assignedTo: AGENT });

    expect(await list(`outOfTarget=true&assignedTo=${AGENT}`)).toEqual({
      names: ["Chez Léa"],
      total: 1,
    });
  });

  it("filters the CSV export the same way", async () => {
    await flagged("Fermé");
    await seedProspect("Ouvert");
    const csv = await (await call("/api/admin/prospects/export.csv?outOfTarget=true")).text();
    expect(csv).toContain("Fermé");
    expect(csv).not.toContain("Ouvert");
  });

  it.each(["maybe", "false", "", "TRUE", "1"])("answers 400 for outOfTarget=%s", async (value) => {
    for (const path of ["/api/admin/prospects", "/api/admin/prospects/export.csv"]) {
      const response = await call(`${path}?outOfTarget=${value}`);
      expect(response.status).toBe(400);
    }
  });
});

describe("Prospects sans agent actif (GH #308)", () => {
  const GONE = "gone@example.com";
  const STRAY = "stray@example.com";

  async function seedProspect(name: string, over: Partial<typeof prospects.$inferInsert> = {}) {
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
        createdBy: ADMIN,
        createdAt: 0,
        updatedAt: 0,
        ...over,
      });
    return id;
  }

  async function list(query: string) {
    const response = await call(`/api/admin/prospects?${query}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as ProspectsResponse;
    return { names: body.prospects.map((p) => p.name).sort(), total: body.total };
  }

  async function seedAll() {
    await seedUser(GONE, "agent", false);
    const survivor = await seedProspect("Désactivé", { assignedTo: GONE });
    await seedProspect("Sans compte", { assignedTo: STRAY, status: "follow_up" });
    await seedProspect("Converti", { assignedTo: GONE, status: "converted" });
    await seedProspect("Actif", { assignedTo: AGENT });
    await seedProspect("Libre", { status: "new" });
    await seedProspect("Absorbé", { assignedTo: GONE, mergedInto: survivor });
  }

  it("lists a deactivated assignee and an email with no users row, nothing else (I/O matrix)", async () => {
    await seedAll();
    expect(await list("inactiveAgent=true")).toEqual({
      names: ["Converti", "Désactivé", "Sans compte"],
      total: 3,
    });
    // Status stays the job of `status`.
    expect(await list("status=new,assigned,follow_up&inactiveAgent=true")).toEqual({
      names: ["Désactivé", "Sans compte"],
      total: 2,
    });
  });

  it("filters the CSV export to the list's rows", async () => {
    await seedAll();
    const query = "status=new,assigned,follow_up&inactiveAgent=true";
    const { names } = await list(query);
    const response = await call(`/api/admin/prospects/export.csv?${query}`);
    expect(response.status).toBe(200);
    const csv = await response.text();
    for (const name of ["Désactivé", "Sans compte", "Converti", "Actif", "Libre", "Absorbé"]) {
      expect(csv.includes(name), name).toBe(names.includes(name));
    }
  });

  it.each(["1", "false", ""])("answers 400 for inactiveAgent=%s", async (value) => {
    for (const path of ["/api/admin/prospects", "/api/admin/prospects/export.csv"]) {
      const response = await call(`${path}?inactiveAgent=${value}`);
      expect(response.status).toBe(400);
    }
  });
});

describe("POST /api/admin/prospects/batch", () => {
  it("rejects a row without a name", async () => {
    const response = await importRows([{ name: "" }]);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("validation");
  });

  it("imports rows and reports what it created", async () => {
    const response = await importRows([
      { name: "Chez Léa", lat: 50.84, lng: 4.35, type: "restaurant" },
      { name: "Le Zinc", lat: 50.85, lng: 4.36, type: "bar" },
    ]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<ImportResult>({ created: 2, updated: 0 });
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(2);
  });

  it("accepts a row with no coordinates", async () => {
    // ingestion.md: allowed on purpose. It appears on the agent's list without
    // distance ordering rather than being rejected at the door.
    const response = await importRows([{ name: "La Cantine Mobile" }]);
    expect(await response.json()).toEqual<ImportResult>({ created: 1, updated: 0 });
  });

  it("collapses two rows of the same place inside one request", async () => {
    // SQLite refuses an ON CONFLICT DO UPDATE that touches a row twice in one
    // statement, so a spreadsheet listing a place twice must not reach D1 twice.
    const response = await importRows([
      { name: "Chez Léa", lat: 50.84, lng: 4.35 },
      { name: "chez lea", lat: 50.8401, lng: 4.3501 },
    ]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<ImportResult>({ created: 1, updated: 0 });
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(1);
  });

  it("updates descriptive fields on re-import and never the status or assignment", async () => {
    // The test that matters: this is what the spreadsheet workflow cannot do.
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35 }]);

    const db = getDb(env.DB);
    const [before] = await db.select().from(prospects);
    if (!before) throw new Error("the import wrote nothing");

    await post("/api/admin/prospects/assign", { ids: [before.id], assignedTo: AGENT });
    await db
      .update(prospects)
      .set({ status: "converted", lastVisitAt: 1_700_000_000_000 })
      .where(eqId(before.id));

    const again = await importRows([
      { name: "Chez Léa", lat: 50.84, lng: 4.35, address: "4 place Saint-Géry" },
    ]);
    expect(await again.json()).toEqual<ImportResult>({ created: 0, updated: 1 });

    const [after] = await db.select().from(prospects);
    expect(after?.address).toBe("4 place Saint-Géry");
    // Untouched, all of it.
    expect(after?.id).toBe(before.id);
    expect(after?.status).toBe("converted");
    expect(after?.assignedTo).toBe(AGENT);
    expect(after?.lastVisitAt).toBe(1_700_000_000_000);
  });

  it("leaves a field alone when the import carries no value for it", async () => {
    // The column-mapping step makes "forgot to map the phone column" a
    // one-click mistake. It must not erase every phone number we hold.
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35, phone: "0478111111" }]);

    const again = await importRows([
      { name: "Chez Léa", lat: 50.84, lng: 4.35, address: "4 place Saint-Géry" },
    ]);
    expect(await again.json()).toEqual<ImportResult>({ created: 0, updated: 1 });

    const [after] = await getDb(env.DB).select().from(prospects);
    expect(after?.address).toBe("4 place Saint-Géry");
    expect(after?.phone).toBe("0478111111");
  });

  it("treats a renamed row as a new prospect, not an update", async () => {
    // KNOWN LIMIT, pinned here so it cannot change by accident.
    //
    // The geo: and addr: tiers of the dedupe key are built from the name
    // (prospecting.md), so correcting a spelling in the spreadsheet produces a
    // second prospect rather than updating the first. Only the ref: tier — a
    // source that supplies a stable id, such as OSM — survives a rename.
    // Manual merge is the escape hatch, on the roadmap for M5.
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35 }]);
    const renamed = await importRows([{ name: "Chez Léa et Paul", lat: 50.84, lng: 4.35 }]);

    expect(await renamed.json()).toEqual<ImportResult>({ created: 1, updated: 0 });
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(2);
  });

  it("updates through a rename when the source supplies a stable id", async () => {
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35, sourceRef: "node/123" }], "osm");
    const renamed = await importRows(
      [{ name: "Chez Léa et Paul", lat: 50.84, lng: 4.35, sourceRef: "node/123" }],
      "osm",
    );

    expect(await renamed.json()).toEqual<ImportResult>({ created: 0, updated: 1 });
    const [after] = await getDb(env.DB).select().from(prospects);
    expect(after?.name).toBe("Chez Léa et Paul");
  });

  it("writes more rows than fit in one D1 statement", async () => {
    // INVARIANT 7: prospects binds 19 parameters a row, so 5 rows fill a
    // statement and 120 needs a couple of dozen of them.
    const rows = Array.from({ length: 120 }, (_, i) => ({
      name: `Bistrot ${i}`,
      lat: 50.8 + i / 1000,
      lng: 4.8,
    }));

    const response = await importRows(rows);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<ImportResult>({ created: 120, updated: 0 });
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(120);
  });
});

/** The import log (ADR-0030, GH #371). */
describe("the import log", () => {
  const rows = (tag: string, n = 1): Row[] =>
    Array.from({ length: n }, (_, i) => ({ name: `${tag} ${i}`, lat: 50.8 + i / 1000, lng: 4.3 }));

  function logged(
    importId: string,
    batchIndex: number,
    batchCount: number,
    tag: string,
    extra: Record<string, unknown> = {},
    n = 1,
  ): Promise<Response> {
    return post("/api/admin/prospects/batch", {
      source: "csv",
      rows: rows(tag, n),
      importLog: { importId, batchIndex, batchCount, rejected: 2, fileName: "a.csv", ...extra },
    });
  }

  const listed = async () =>
    ((await (await call("/api/admin/imports")).json()) as ImportsResponse).imports;

  beforeEach(async () => {
    const db = getDb(env.DB);
    await db.delete(importBatches);
    await db.delete(imports);
  });

  it("logs nothing for a batch without importLog", async () => {
    const response = await importRows(rows("plain"));
    expect(await response.json()).toEqual<ImportResult>({ created: 1, updated: 0 });
    expect(await getDb(env.DB).select().from(imports)).toHaveLength(0);
    expect(await getDb(env.DB).select().from(importBatches)).toHaveLength(0);
  });

  it("fails the request when the log write fails, and a re-send then counts the batch once", async () => {
    const id = crypto.randomUUID();
    await env.DB.exec(
      "CREATE TRIGGER fail_log BEFORE INSERT ON import_batches BEGIN SELECT RAISE(ABORT, 'log down'); END",
    );
    let failed: Response;
    try {
      failed = await logged(id, 0, 1, "retry");
    } finally {
      await env.DB.exec("DROP TRIGGER fail_log");
    }
    expect(failed.status).toBeGreaterThanOrEqual(500);

    expect((await logged(id, 0, 1, "retry")).status).toBe(200);
    expect(await getDb(env.DB).select().from(importBatches)).toHaveLength(1);
  });

  it("writes the import from the first batch with the server's clock and the admin", async () => {
    const id = crypto.randomUUID();
    const before = Date.now();
    await logged(id, 0, 2, "a", { zoneVertices: 7, zoneRadiusM: 300 });
    const [row] = await getDb(env.DB).select().from(imports);
    expect(row).toMatchObject({
      id,
      source: "csv",
      fileName: "a.csv",
      zoneVertices: 7,
      zoneRadiusM: 300,
      rejected: 2,
      batchCount: 2,
      createdBy: ADMIN,
    });
    expect(row?.startedAt).toBeGreaterThanOrEqual(before);
  });

  it("shows one import with summed counts across batches", async () => {
    const id = crypto.randomUUID();
    await logged(id, 0, 2, "a", {}, 3);
    // The second batch re-sends one place: 1 updated, 2 created.
    await post("/api/admin/prospects/batch", {
      source: "csv",
      rows: [...rows("a", 1), ...rows("b", 2)],
      importLog: {
        importId: id,
        batchIndex: 1,
        batchCount: 2,
        rejected: 99,
        fileName: "other.csv",
      },
    });

    const [entry, ...rest] = await listed();
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      id,
      created: 5,
      updated: 1,
      rejected: 2,
      fileName: "a.csv",
      createdBy: ADMIN,
      status: "done",
    });
  });

  it("counts a re-sent batch once with its first counts, and answers live", async () => {
    const id = crypto.randomUUID();
    expect(await (await logged(id, 0, 1, "r", {}, 2)).json()).toEqual({ created: 2, updated: 0 });
    expect(await (await logged(id, 0, 1, "r", {}, 2)).json()).toEqual({ created: 0, updated: 2 });

    const [entry] = await listed();
    expect(entry).toMatchObject({ created: 2, updated: 0, status: "done" });
    expect(await getDb(env.DB).select().from(importBatches)).toHaveLength(1);
  });

  it("400s a bad log field and writes nothing", async () => {
    const id = crypto.randomUUID();
    for (const extra of [
      { batchIndex: 2 },
      { batchIndex: -1 },
      { rejected: 1e12 },
      { batchCount: 10_001 },
    ]) {
      const response = await logged(id, 0, 2, "bad", extra);
      expect(response.status).toBe(400);
    }
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(0);
    expect(await getDb(env.DB).select().from(imports)).toHaveLength(0);
  });

  it("lists done, hides running, and reads stalled as interrupted", async () => {
    const db = getDb(env.DB);
    const now = Date.now();
    const stale = now - IMPORT_STALE_MS - 1000;
    const base = {
      source: "csv",
      rejected: 0,
      createdBy: null,
      fileName: null,
      zoneVertices: null,
      zoneRadiusM: null,
    };
    await db.insert(imports).values([
      { ...base, id: "done", batchCount: 1, startedAt: now - 3000 },
      { ...base, id: "running", batchCount: 2, startedAt: now - 2000 },
      { ...base, id: "stalled", batchCount: 2, startedAt: stale - 1000 },
    ]);
    await db.insert(importBatches).values([
      { importId: "done", batchIndex: 0, created: 4, updated: 0, receivedAt: now - 3000 },
      { importId: "running", batchIndex: 0, created: 1, updated: 0, receivedAt: now - 2000 },
      { importId: "stalled", batchIndex: 0, created: 2, updated: 1, receivedAt: stale },
    ]);

    const result = await listed();
    expect(result.map((r) => [r.id, r.status])).toEqual([
      ["done", "done"],
      ["stalled", "interrupted"],
    ]);
    expect(result[1]).toMatchObject({ created: 2, updated: 1 });
  });

  it("keeps the five newest settled of the 20 newest, never settling older ones", async () => {
    const db = getDb(env.DB);
    const now = Date.now();
    const base = {
      source: "csv",
      rejected: 0,
      createdBy: null,
      fileName: null,
      zoneVertices: null,
      zoneRadiusM: null,
      batchCount: 1,
    };
    // 22 complete imports; startedAt grows with i.
    const ids = Array.from({ length: 22 }, (_, i) => `imp-${i}`);
    for (const [i, id] of ids.entries()) {
      await db.insert(imports).values({ ...base, id, startedAt: now - 100_000 + i });
      await db
        .insert(importBatches)
        .values({ importId: id, batchIndex: 0, created: 1, updated: 0, receivedAt: now - 100_000 });
    }
    expect((await listed()).map((r) => r.id)).toEqual([
      "imp-21",
      "imp-20",
      "imp-19",
      "imp-18",
      "imp-17",
    ]);

    // Make the 20 newest all running: the older complete ones are out of the window.
    await db.delete(importBatches).where(inArray(importBatches.importId, ids.slice(2)));
    expect(await listed()).toEqual([]);
  });

  it("serves the list from the started_at index", async () => {
    const { results } = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT * FROM imports ORDER BY started_at DESC, id DESC LIMIT 20",
    ).all<{ detail: string }>();
    expect(results.some((r) => r.detail.includes("imports_started_idx"))).toBe(true);
  });
});

describe("PATCH /api/admin/prospects/:id", () => {
  it("edits a prospect and leaves its dedupe key alone", async () => {
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35 }]);
    const db = getDb(env.DB);
    const [row] = await db.select().from(prospects);
    if (!row) throw new Error("the import wrote nothing");

    const response = await patch(`/api/admin/prospects/${row.id}`, {
      name: "Chez Léa et Paul",
      phone: "0478000000",
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as Prospect).name).toBe("Chez Léa et Paul");

    const [after] = await db.select().from(prospects);
    // The key is import-time identity. Recomputing it here could collide with
    // the unique index and fail an edit that is perfectly valid.
    expect(after?.dedupeKey).toBe(row.dedupeKey);
  });

  it("lets an admin reopen a prospect by hand", async () => {
    // prospecting.md: rare and deliberate, and the only way a status is sent
    // by a client. INVARIANT 3 is about statuses *derived from a visit*.
    await importRows([{ name: "Le Zinc", lat: 50.85, lng: 4.36 }]);
    const db = getDb(env.DB);
    const [row] = await db.select().from(prospects);
    if (!row) throw new Error("the import wrote nothing");

    await patch(`/api/admin/prospects/${row.id}`, { status: "rejected" });
    const response = await patch(`/api/admin/prospects/${row.id}`, { status: "assigned" });

    expect(response.status).toBe(200);
    expect(((await response.json()) as Prospect).status).toBe("assigned");
  });

  it("sets Intéressé by hand, and lists it under its own filter (ADR-0027)", async () => {
    await importRows([
      { name: "Le Zinc", lat: 50.85, lng: 4.36 },
      { name: "Chez Léa", lat: 50.84, lng: 4.35 },
    ]);
    const db = getDb(env.DB);
    const [row] = await db.select().from(prospects).where(eq(prospects.name, "Le Zinc"));
    if (!row) throw new Error("the import wrote nothing");

    const response = await patch(`/api/admin/prospects/${row.id}`, { status: "interested" });
    expect(response.status).toBe(200);
    expect(((await response.json()) as Prospect).status).toBe("interested");

    const listed = (await (
      await call("/api/admin/prospects?status=interested")
    ).json()) as ProspectsResponse;
    expect(listed.prospects.map((p) => p.name)).toEqual(["Le Zinc"]);
    expect(listed.total).toBe(1);
  });

  it("still refuses a status it does not know", async () => {
    await importRows([{ name: "Le Zinc", lat: 50.85, lng: 4.36 }]);
    const [row] = await getDb(env.DB).select().from(prospects);
    if (!row) throw new Error("the import wrote nothing");

    const response = await patch(`/api/admin/prospects/${row.id}`, { status: "warm" });
    expect(response.status).toBe(400);
  });

  it("answers 404 for an id that does not exist", async () => {
    const response = await patch(`/api/admin/prospects/${crypto.randomUUID()}`, { name: "X" });
    expect(response.status).toBe(404);
  });

  it("answers 400, not 404, when the id is not a UUID", async () => {
    const response = await patch("/api/admin/prospects/not-a-uuid", { name: "X" });
    expect(response.status).toBe(400);
  });

  it("rejects an empty patch", async () => {
    const response = await patch(`/api/admin/prospects/${crypto.randomUUID()}`, {});
    expect(response.status).toBe(400);
  });
});

describe("POST /api/admin/prospects/assign", () => {
  it("assigns in bulk and moves only new prospects to assigned", async () => {
    await importRows([
      { name: "Chez Léa", lat: 50.84, lng: 4.35 },
      { name: "Le Zinc", lat: 50.85, lng: 4.36 },
    ]);

    const db = getDb(env.DB);
    const rows = await db.select().from(prospects);
    const converted = rows[0];
    if (!converted) throw new Error("the import wrote nothing");
    await db.update(prospects).set({ status: "converted" }).where(eqId(converted.id));

    const response = await post("/api/admin/prospects/assign", {
      ids: rows.map((r) => r.id),
      assignedTo: AGENT,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<AssignResult>({ assigned: 2 });

    const after = await db.select().from(prospects);
    expect(after.every((r) => r.assignedTo === AGENT)).toBe(true);
    // A prospect that has been visited keeps the status its visits earned.
    expect(after.find((r) => r.id === converted.id)?.status).toBe("converted");
    expect(after.find((r) => r.id !== converted.id)?.status).toBe("assigned");
  });

  it("unassigns with a null assignee and returns assigned prospects to new", async () => {
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35 }]);
    const db = getDb(env.DB);
    const [row] = await db.select().from(prospects);
    if (!row) throw new Error("the import wrote nothing");

    await post("/api/admin/prospects/assign", { ids: [row.id], assignedTo: AGENT });
    await post("/api/admin/prospects/assign", { ids: [row.id], assignedTo: null });

    const [after] = await db.select().from(prospects);
    expect(after?.assignedTo).toBeNull();
    expect(after?.status).toBe("new");
  });

  it("assigns more ids than fit in one D1 statement", async () => {
    // INVARIANT 7: assignSchema allows 500 ids and inArray binds one each, so
    // this has to be chunked or D1 rejects the statement outright.
    await importRows(
      Array.from({ length: 150 }, (_, i) => ({
        name: `Bistrot ${i}`,
        lat: 50.8 + i / 1000,
        lng: 4.8,
      })),
    );

    const db = getDb(env.DB);
    const ids = (await db.select({ id: prospects.id }).from(prospects)).map((r) => r.id);
    expect(ids).toHaveLength(150);

    const response = await post("/api/admin/prospects/assign", { ids, assignedTo: AGENT });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<AssignResult>({ assigned: 150 });

    const after = await db.select().from(prospects);
    expect(after.every((r) => r.assignedTo === AGENT && r.status === "assigned")).toBe(true);
  });

  it("refuses an assignee who is not on the roster", async () => {
    // A typo here is silent data loss in slow motion: the sync pull matches on
    // the exact email, so the prospect vanishes from every agent's list while
    // the admin list still shows it as assigned and handled.
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35 }]);
    const db = getDb(env.DB);
    const [row] = await db.select().from(prospects);
    if (!row) throw new Error("the import wrote nothing");

    const response = await post("/api/admin/prospects/assign", {
      ids: [row.id],
      assignedTo: "agnet@example.com",
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("unknown_assignee");

    const [after] = await db.select().from(prospects);
    expect(after?.assignedTo).toBeNull();
  });

  it("refuses an unknown assignee through PATCH too", async () => {
    await importRows([{ name: "Chez Léa", lat: 50.84, lng: 4.35 }]);
    const [row] = await getDb(env.DB).select().from(prospects);
    if (!row) throw new Error("the import wrote nothing");

    const response = await patch(`/api/admin/prospects/${row.id}`, {
      assignedTo: "agnet@example.com",
    });
    expect(response.status).toBe(400);
  });

  it("rejects more ids than the documented cap", async () => {
    const ids = Array.from({ length: 501 }, () => crypto.randomUUID());
    const response = await post("/api/admin/prospects/assign", { ids, assignedTo: AGENT });
    expect(response.status).toBe(400);
  });
});

describe("merging duplicates", () => {
  /** The rename case: same door, two rows, because the key carries the name. */
  async function renamedPair(): Promise<{ original: string; renamed: string }> {
    await importRows([{ name: "Chez Léa", lat: 50.8478, lng: 4.352 }]);
    await importRows([{ name: "Chez Léa et Paul", lat: 50.8478, lng: 4.352 }]);

    const rows = await getDb(env.DB).select().from(prospects);
    expect(rows).toHaveLength(2);
    const original = rows.find((r) => r.name === "Chez Léa");
    const renamed = rows.find((r) => r.name === "Chez Léa et Paul");
    if (!original || !renamed) throw new Error("expected both spellings");
    return { original: original.id, renamed: renamed.id };
  }

  it("proposes the renamed pair and nothing else", async () => {
    const { original, renamed } = await renamedPair();
    await importRows([{ name: "Burger King", lat: 50.8478, lng: 4.352 }]);

    const body = (await (
      await call("/api/admin/prospects/duplicates")
    ).json()) as DuplicatesResponse;

    expect(body.truncated).toBe(false);
    expect(body.pairs).toHaveLength(1);
    const ids = [body.pairs[0]?.a.id, body.pairs[0]?.b.id].sort();
    expect(ids).toEqual([original, renamed].sort());
    // Same coordinates, so they are zero metres apart — but still a number.
    expect(body.pairs[0]?.distanceM).toBe(0);
  });

  it("reports how many visits each side carries", async () => {
    const { original, renamed } = await renamedPair();
    const db = getDb(env.DB);
    await db.insert(visits).values({
      id: crypto.randomUUID(),
      prospectId: original,
      agentEmail: AGENT,
      visitedAt: Date.now(),
      clientVisitedAt: Date.now(),
      receivedAt: Date.now(),
      flyerGiven: true,
      outcome: "interested",
      answers: {},
      clientVersion: 1,
    });

    const body = (await (
      await call("/api/admin/prospects/duplicates")
    ).json()) as DuplicatesResponse;
    const pair = body.pairs[0];
    if (!pair) throw new Error("expected a pair");

    const originalSide = pair.a.id === original ? pair.aVisits : pair.bVisits;
    const renamedSide = pair.a.id === renamed ? pair.aVisits : pair.bVisits;
    expect(originalSide).toBe(1);
    expect(renamedSide).toBe(0);
  });

  it("merges, hides the absorbed prospect, and keeps every visit", async () => {
    const { original, renamed } = await renamedPair();
    const db = getDb(env.DB);
    const visitId = crypto.randomUUID();
    await db.insert(visits).values({
      id: visitId,
      prospectId: original,
      agentEmail: AGENT,
      visitedAt: Date.now(),
      clientVisitedAt: Date.now(),
      receivedAt: Date.now(),
      flyerGiven: true,
      outcome: "interested",
      answers: {},
      clientVersion: 1,
    });

    const response = await post("/api/admin/prospects/merge", {
      survivorId: renamed,
      mergedId: original,
    });
    expect(response.status).toBe(200);
    expect((await response.json()) as MergeResult).toEqual({
      survivorId: renamed,
      mergedId: original,
      dedupeKeyUpdated: false, // the survivor's own key already matches its name
    });

    const listed = (await (await call("/api/admin/prospects")).json()) as ProspectsResponse;
    expect(listed.prospects.map((p) => p.id)).toEqual([renamed]);
    expect(listed.total).toBe(1);

    // Nothing was deleted and no visit was repointed: visits are append-only.
    expect(await db.select().from(visits)).toHaveLength(1);
    const [stillThere] = await db.select().from(visits).where(eq(visits.id, visitId));
    expect(stillThere?.prospectId).toBe(original);
  });

  it("drops the absorbed prospect from the agent's round", async () => {
    const { original, renamed } = await renamedPair();
    await post("/api/admin/prospects/assign", {
      ids: [original, renamed],
      assignedTo: ADMIN,
    });
    await post("/api/admin/prospects/merge", { survivorId: renamed, mergedId: original });

    const sync = await post("/api/agent/sync", { clientVersion: 1, prospects: [], visits: [] });
    const body = (await sync.json()) as { prospects: Prospect[] };
    expect(body.prospects.map((p) => p.id)).toEqual([renamed]);
  });

  it("sends a re-import of the old spelling to the survivor", async () => {
    // The path most likely to be got wrong: the absorbed row keeps its dedupe
    // key, so without redirection the import would update a retired prospect
    // and the live one would never see the new data.
    const { original, renamed } = await renamedPair();
    await post("/api/admin/prospects/merge", { survivorId: renamed, mergedId: original });

    const again = await importRows([
      { name: "Chez Léa", lat: 50.8478, lng: 4.352, phone: "0478111111" },
    ]);
    expect(await again.json()).toEqual<ImportResult>({ created: 0, updated: 1 });

    const db = getDb(env.DB);
    expect(await db.select().from(prospects)).toHaveLength(2); // no third row
    const [survivor] = await db.select().from(prospects).where(eq(prospects.id, renamed));
    expect(survivor?.phone).toBe("0478111111");
    // And it keeps the name the admin chose. Writing the old spelling back
    // would restore the stale dedupe key and duplicate again on the next import.
    expect(survivor?.name).toBe("Chez Léa et Paul");
  });

  it("does not duplicate again when the old spreadsheet is imported twice more", async () => {
    // The loop the previous test guards against: revert the name, revert the
    // key, and every later import creates a fresh row.
    const { original, renamed } = await renamedPair();
    await post("/api/admin/prospects/merge", { survivorId: renamed, mergedId: original });

    const old = [{ name: "Chez Léa", lat: 50.8478, lng: 4.352 }];
    await importRows(old);
    await importRows(old);

    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(2);
    const listed = (await (await call("/api/admin/prospects")).json()) as ProspectsResponse;
    expect(listed.prospects.map((p) => p.name)).toEqual(["Chez Léa et Paul"]);
  });

  it("recomputes the survivor's dedupe key when its name has drifted", async () => {
    // PATCH deliberately leaves the key alone, so an edited prospect is still
    // filed under its old spelling. The merge is where that gets fixed, so the
    // next import of the current name matches instead of duplicating again.
    const { original, renamed } = await renamedPair();
    await patch(`/api/admin/prospects/${original}`, { name: "Bistrot Léa" });

    const db = getDb(env.DB);
    const [before] = await db.select().from(prospects).where(eq(prospects.id, original));
    expect(before?.dedupeKey).toContain("chez-lea");

    const response = await post("/api/admin/prospects/merge", {
      survivorId: original,
      mergedId: renamed,
    });
    expect(((await response.json()) as MergeResult).dedupeKeyUpdated).toBe(true);

    const [after] = await db.select().from(prospects).where(eq(prospects.id, original));
    expect(after?.dedupeKey).toContain("bistrot-lea");

    // And now the current name imports as an update rather than a third row.
    const again = await importRows([{ name: "Bistrot Léa", lat: 50.8478, lng: 4.352 }]);
    expect(await again.json()).toEqual<ImportResult>({ created: 0, updated: 1 });
    expect(await db.select().from(prospects)).toHaveLength(2);
  });

  it("keeps the old key when the recomputed one is already taken", async () => {
    // The absorbed row still holds that key. Nothing breaks: a later import of
    // the survivor's name lands on the absorbed row and is redirected there.
    const { original, renamed } = await renamedPair();
    await patch(`/api/admin/prospects/${original}`, { name: "Chez Léa et Paul" });

    const response = await post("/api/admin/prospects/merge", {
      survivorId: original,
      mergedId: renamed,
    });
    expect(((await response.json()) as MergeResult).dedupeKeyUpdated).toBe(false);

    const again = await importRows([{ name: "Chez Léa et Paul", lat: 50.8478, lng: 4.352 }]);
    expect(await again.json()).toEqual<ImportResult>({ created: 0, updated: 1 });
    expect(await getDb(env.DB).select().from(prospects)).toHaveLength(2);
  });

  it("is idempotent", async () => {
    const { original, renamed } = await renamedPair();
    const body = { survivorId: renamed, mergedId: original };

    expect((await post("/api/admin/prospects/merge", body)).status).toBe(200);
    const second = await post("/api/admin/prospects/merge", body);
    expect(second.status).toBe(200);
    expect(((await second.json()) as MergeResult).mergedId).toBe(original);
  });

  it("refuses to merge a prospect into itself", async () => {
    const { renamed } = await renamedPair();
    const response = await post("/api/admin/prospects/merge", {
      survivorId: renamed,
      mergedId: renamed,
    });
    expect(response.status).toBe(400);
  });

  it("refuses to merge a prospect that is already absorbed", async () => {
    const { original, renamed } = await renamedPair();
    await importRows([{ name: "Chez Léa et Paul et Marie", lat: 50.8478, lng: 4.352 }]);
    await post("/api/admin/prospects/merge", { survivorId: renamed, mergedId: original });

    const third = (await getDb(env.DB).select().from(prospects)).find(
      (r) => r.name === "Chez Léa et Paul et Marie",
    );
    if (!third) throw new Error("expected the third spelling");

    const response = await post("/api/admin/prospects/merge", {
      survivorId: third.id,
      mergedId: original,
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("already_merged");
  });

  it("answers 404 for an id that does not exist", async () => {
    const { renamed } = await renamedPair();
    const response = await post("/api/admin/prospects/merge", {
      survivorId: renamed,
      mergedId: crypto.randomUUID(),
    });
    expect(response.status).toBe(404);
  });

  it("unmerges, returning the prospect to the list with its visits", async () => {
    const { original, renamed } = await renamedPair();
    await post("/api/admin/prospects/merge", { survivorId: renamed, mergedId: original });

    const response = await post(`/api/admin/prospects/${original}/unmerge`, {});
    expect(response.status).toBe(200);

    const listed = (await (await call("/api/admin/prospects")).json()) as ProspectsResponse;
    expect(listed.prospects.map((p) => p.id).sort()).toEqual([original, renamed].sort());
  });

  it("finds nothing to merge in a clean base", async () => {
    // A detector that cries wolf is worse than none.
    await importRows([
      { name: "Le Bouchon des Halles", lat: 50.8478, lng: 4.352 },
      { name: "Café de la Gare", lat: 45.749, lng: 4.826 },
      { name: "Pizza Roma", lat: 50.852, lng: 4.36 },
      { name: "Le Zinc", lat: 50.8501, lng: 4.3555 },
      { name: "Burger Truck 69", lat: 50.8443, lng: 4.8291 },
    ]);

    const body = (await (
      await call("/api/admin/prospects/duplicates")
    ).json()) as DuplicatesResponse;
    expect(body.pairs).toEqual([]);
  });
});

describe("scripts", () => {
  const question = (over: Partial<Script["questions"][number]> = {}) => ({
    key: "has_delivery",
    label: "Proposez-vous la livraison ?",
    type: "yes_no" as const,
    ...over,
  });

  const saveScript = (body: unknown) => post("/api/admin/scripts", body);

  async function listScripts(): Promise<ScriptsResponse> {
    const response = await call("/api/admin/scripts");
    expect(response.status).toBe(200);
    return (await response.json()) as ScriptsResponse;
  }

  it("saves the first script as version 1, active", async () => {
    const response = await saveScript({ name: "Questionnaire", questions: [question()] });
    expect(response.status).toBe(201);

    const created = (await response.json()) as Script;
    expect(created.version).toBe(1);
    expect(created.isActive).toBe(true);
    expect(created.questions).toHaveLength(1);
  });

  it("saving again writes version N+1 and stands the previous one down", async () => {
    await saveScript({ name: "Questionnaire", questions: [question()] });
    const second = await saveScript({
      name: "Questionnaire",
      questions: [question(), question({ key: "pos_system", type: "text" })],
    });
    expect(second.status).toBe(201);
    expect(((await second.json()) as Script).version).toBe(2);

    const { scripts: all } = await listScripts();
    expect(all.map((s) => [s.version, s.isActive])).toEqual([
      [2, true],
      [1, false],
    ]);
  });

  it("keeps every old version, because a visit records the one it answered", async () => {
    await saveScript({ name: "Questionnaire", questions: [question()] });
    await saveScript({ name: "Questionnaire", questions: [question()] });
    await saveScript({ name: "Questionnaire", questions: [question()] });

    const { scripts: all } = await listScripts();
    expect(all).toHaveLength(3);
    expect(all.filter((s) => s.isActive)).toHaveLength(1);
  });

  it("numbers versions per name, so a second script starts at 1", async () => {
    await saveScript({ name: "Questionnaire", questions: [question()] });
    const other = await saveScript({ name: "Food trucks", questions: [question()] });
    expect(((await other.json()) as Script).version).toBe(1);

    // ...and it is now the active one: there is exactly one, whatever its name.
    const { scripts: all } = await listScripts();
    expect(all.filter((s) => s.isActive).map((s) => s.name)).toEqual(["Food trucks"]);
  });

  it("lists newest first", async () => {
    await saveScript({ name: "A", questions: [question()] });
    await saveScript({ name: "B", questions: [question()] });

    const { scripts: all } = await listScripts();
    expect(all.map((s) => s.name)).toEqual(["B", "A"]);
  });

  it("returns an empty list rather than 404 when nothing is saved yet", async () => {
    expect((await listScripts()).scripts).toEqual([]);
  });

  describe("the contract the editor has to satisfy", () => {
    it("refuses a single or multi question with no options", async () => {
      const response = await saveScript({
        name: "Q",
        questions: [question({ key: "pos_system", type: "single" })],
      });
      expect(response.status).toBe(400);
    });

    it("accepts a single question that has them", async () => {
      const response = await saveScript({
        name: "Q",
        questions: [question({ key: "pos_system", type: "single", options: ["Aucune", "Papier"] })],
      });
      expect(response.status).toBe(201);
    });

    it("refuses options on a type whose answer does not come from them", async () => {
      const response = await saveScript({
        name: "Q",
        questions: [question({ key: "covers", type: "number", options: ["nope"] })],
      });
      expect(response.status).toBe(400);
    });

    it("refuses two questions sharing a key, which would overwrite an answer", async () => {
      const response = await saveScript({
        name: "Q",
        questions: [question(), question({ label: "Autre question" })],
      });
      expect(response.status).toBe(400);
    });

    it("refuses a key that is not snake_case", async () => {
      const response = await saveScript({
        name: "Q",
        questions: [question({ key: "Has Delivery" })],
      });
      expect(response.status).toBe(400);
    });

    it("refuses a script with no questions at all", async () => {
      expect((await saveScript({ name: "Q", questions: [] })).status).toBe(400);
    });
  });

  it("is admin-only, on both verbs", async () => {
    env.DEV_USER_EMAIL = AGENT;
    try {
      expect((await call("/api/admin/scripts")).status).toBe(403);
      expect((await saveScript({ name: "Q", questions: [question()] })).status).toBe(403);
    } finally {
      env.DEV_USER_EMAIL = ADMIN;
    }
  });
});

describe("authorization", () => {
  afterEach(() => {
    env.DEV_USER_EMAIL = ADMIN;
  });

  it("answers 403 on every admin route when the caller is an agent", async () => {
    // The seeded users row for this address is an agent.
    env.DEV_USER_EMAIL = AGENT;

    expect((await call("/api/me")).status).toBe(200);
    expect((await call("/api/admin/prospects")).status).toBe(403);
    expect((await call("/api/admin/agents")).status).toBe(403);
    expect((await call("/api/admin/imports")).status).toBe(403);
    expect((await call(`/api/admin/agents/${AGENT}/round`)).status).toBe(403);
    expect((await importRows([{ name: "Chez Léa" }])).status).toBe(403);
    expect(
      (await post("/api/admin/prospects/assign", { ids: [crypto.randomUUID()], assignedTo: null }))
        .status,
    ).toBe(403);
    expect((await patch(`/api/admin/prospects/${crypto.randomUUID()}`, { name: "X" })).status).toBe(
      403,
    );
  });

  it("checks the role before the body, so a bad payload still reads as forbidden", async () => {
    env.DEV_USER_EMAIL = AGENT;
    const response = await importRows([{ name: "" }]);
    expect(response.status).toBe(403);
  });
});

describe("GET /api/admin/visits", () => {
  // The reset in the "authorization" block is scoped to it; the admin-only
  // test below would otherwise leave every later test running as an agent.
  afterEach(() => {
    env.DEV_USER_EMAIL = ADMIN;
  });

  /**
   * Written straight to D1 rather than through /api/agent/sync: the feed is
   * about `received_at`, and only a direct insert lets a test place two visits
   * on either side of a known cursor.
   */
  async function seedVisit(
    name: string,
    receivedAt: number,
    outcome = "interested",
    refusalReason: RefusalReason | null = null,
  ) {
    const db = getDb(env.DB);
    const prospectId = crypto.randomUUID();
    await db.insert(prospects).values({
      id: prospectId,
      name,
      type: "restaurant",
      source: "csv",
      dedupeKey: `test:${name}:${receivedAt}`,
      status: "assigned",
      createdBy: ADMIN,
      createdAt: receivedAt,
      updatedAt: receivedAt,
    });
    await db.insert(visits).values({
      id: crypto.randomUUID(),
      prospectId,
      agentEmail: AGENT,
      visitedAt: receivedAt,
      clientVisitedAt: receivedAt,
      receivedAt,
      flyerGiven: true,
      outcome: outcome as "interested",
      refusalReason,
      clientVersion: 1,
    });
    return prospectId;
  }

  async function feed(query = ""): Promise<AdminVisitsResponse> {
    const response = await call(`/api/admin/visits${query}`);
    expect(response.status).toBe(200);
    return (await response.json()) as AdminVisitsResponse;
  }

  it("returns an empty list rather than an error before anyone has visited", async () => {
    const body = await feed();
    expect(body.visits).toEqual([]);
    expect(body.serverTime).toBeGreaterThan(0);
  });

  it("orders by received_at, newest first — not by when the phone says it happened", async () => {
    await seedVisit("Le Bouchon", 1_000);
    await seedVisit("Chez Marcel", 3_000);
    await seedVisit("Pizza Vera", 2_000);

    const body = await feed();
    expect(body.visits.map((v) => v.prospectName)).toEqual([
      "Chez Marcel",
      "Pizza Vera",
      "Le Bouchon",
    ]);
  });

  it("joins the prospect name, which is the whole point of the feed", async () => {
    await seedVisit("Le Comptoir", 5_000, "converted");
    const [visit] = (await feed()).visits;
    expect(visit).toMatchObject({
      prospectName: "Le Comptoir",
      agentEmail: AGENT,
      outcome: "converted",
      flyerGiven: true,
      receivedAt: 5_000,
    });
  });

  it("treats `since` as exclusive, so polling returns only what is new", async () => {
    await seedVisit("Ancienne", 1_000);
    await seedVisit("Nouvelle", 2_000);

    const body = await feed("?since=1000");
    expect(body.visits.map((v) => v.prospectName)).toEqual(["Nouvelle"]);
  });

  it("returns everything when `since` is absent, so a fresh tab is not empty", async () => {
    await seedVisit("Le Bouchon", 1_000);
    expect((await feed()).visits).toHaveLength(1);
  });

  it("still shows a visit whose prospect was merged away afterwards", async () => {
    const survivorId = await seedVisit("Le Bouchon", 1_000);
    const mergedId = await seedVisit("Le Bouchon (ancien)", 2_000);

    const merge = await post("/api/admin/prospects/merge", { survivorId, mergedId });
    expect(merge.status).toBe(200);

    // Every other admin list filters merged_into IS NULL. This one must not:
    // no visit is ever repointed, so filtering would delete history from the
    // feed because an admin tidied a duplicate (docs/domains/prospecting.md).
    expect((await feed()).visits).toHaveLength(2);
  });

  it("caps the page, and refuses a limit above it", async () => {
    await seedVisit("Le Bouchon", 1_000);
    await seedVisit("Chez Marcel", 2_000);

    expect((await feed("?limit=1")).visits).toHaveLength(1);
    expect((await call(`/api/admin/visits?limit=${ADMIN_VISITS_PAGE_SIZE + 1}`)).status).toBe(400);
  });

  it("keeps only visits whose received_at is within [from, to]", async () => {
    await seedVisit("Trop tot", 1_000);
    await seedVisit("Dans la fenetre", 2_000);
    await seedVisit("Trop tard", 3_000);

    const body = await feed("?from=1500&to=2500");
    expect(body.visits.map((v) => v.prospectName)).toEqual(["Dans la fenetre"]);
  });

  it("includes a visit whose received_at equals from or to, the range is inclusive", async () => {
    await seedVisit("Egale a from", 1_000);
    await seedVisit("Dans la fenetre", 1_500);
    await seedVisit("Egale a to", 2_000);

    const body = await feed("?from=1000&to=2000");
    expect(body.visits.map((v) => v.prospectName).sort()).toEqual([
      "Dans la fenetre",
      "Egale a from",
      "Egale a to",
    ]);
  });

  it("rejects a reversed range, the same message shape as the visits export", async () => {
    const response = await call("/api/admin/visits?from=2000&to=1000");
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("validation");
  });

  it.each(["from=1e3", "from=0x10", "to=", "to=-1"])(
    "rejects %s, the same strict decimal-digit rule as dueBefore",
    async (query) => {
      const response = await call(`/api/admin/visits?${query}`);
      expect(response.status).toBe(400);
    },
  );

  it("applies from/to alongside since, all three bounds together", async () => {
    await seedVisit("Avant since", 500);
    await seedVisit("Avant la fenetre", 1_000);
    await seedVisit("Dans la fenetre", 2_000);
    await seedVisit("Apres la fenetre", 4_000);

    const body = await feed("?since=1000&from=1500&to=3000");
    expect(body.visits.map((v) => v.prospectName)).toEqual(["Dans la fenetre"]);
  });

  it("rejects a `since` that is not a non-negative integer", async () => {
    expect((await call("/api/admin/visits?since=hier")).status).toBe(400);
    expect((await call("/api/admin/visits?since=-1")).status).toBe(400);
  });

  it("is admin-only", async () => {
    env.DEV_USER_EMAIL = AGENT;
    expect((await call("/api/admin/visits")).status).toBe(403);
  });

  describe("refusal reasons (GH #249)", () => {
    it("returns refusalReason, null where the visit has none", async () => {
      await seedVisit("Refus", 1_000, "not_interested", "no_need");
      await seedVisit("Ancien refus", 2_000, "not_interested");
      const byName = new Map((await feed()).visits.map((v) => [v.prospectName, v]));
      expect(byName.get("Refus")?.refusalReason).toBe("no_need");
      expect(byName.get("Ancien refus")?.refusalReason).toBeNull();
    });

    it("keeps only the visits with the reason asked for", async () => {
      await seedVisit("Trop d'applis", 1_000, "not_interested", "too_many_devices");
      await seedVisit("Pas besoin", 2_000, "not_interested", "no_need");
      await seedVisit("Converti", 3_000, "converted");

      const body = await feed("?reason=too_many_devices");
      expect(body.visits.map((v) => v.prospectName)).toEqual(["Trop d'applis"]);
    });

    it("applies reason alongside since, from and to", async () => {
      await seedVisit("Avant since", 500, "not_interested", "no_need");
      await seedVisit("Avant la fenetre", 1_000, "not_interested", "no_need");
      await seedVisit("Autre raison", 2_000, "not_interested", "other");
      await seedVisit("Dans la fenetre", 2_500, "not_interested", "no_need");
      await seedVisit("Apres la fenetre", 4_000, "not_interested", "no_need");

      const body = await feed("?reason=no_need&since=600&from=1500&to=3000");
      expect(body.visits.map((v) => v.prospectName)).toEqual(["Dans la fenetre"]);
    });

    it.each(["reason=bogus", "reason=", "reason=NONE", "reason=none"])(
      "rejects %s",
      async (query) => {
        const response = await call(`/api/admin/visits?${query}`);
        expect(response.status).toBe(400);
        expect(((await response.json()) as { error: string }).error).toBe("validation");
      },
    );
  });
});

/** Local helper so the tests read as prose rather than as Drizzle. */
function eqId(id: string) {
  return eq(prospects.id, id);
}

describe("GET /api/admin/agents/:email/round (ADR-0028)", () => {
  const position = (capturedAt: number, receivedAt: number) => ({
    agentEmail: AGENT,
    lat: 50.85,
    lng: 4.35,
    accuracy: 10,
    capturedAt,
    receivedAt,
  });

  beforeEach(async () => {
    await getDb(env.DB).delete(agentPositions);
  });

  it("serves the position and the remaining prospects, uncached", async () => {
    const now = Date.now();
    await getDb(env.DB)
      .insert(agentPositions)
      .values(position(now - 1_000, now));
    const response = await call(`/api/admin/agents/${AGENT.toUpperCase()}/round`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as AgentRoundResponse;
    expect(body.prospects).toEqual([]);
    expect(body.position).toEqual({ lat: 50.85, lng: 4.35, accuracy: 10, capturedAt: now - 1_000 });
  });

  it("lists exactly the agent's open, unmerged prospects", async () => {
    const db = getDb(env.DB);
    const now = Date.now();
    const ids = {
      open: crypto.randomUUID(),
      converted: crypto.randomUUID(),
      merged: crypto.randomUUID(),
      other: crypto.randomUUID(),
    };
    const base = {
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
      createdBy: ADMIN,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(prospects).values([
      { ...base, id: ids.open, dedupeKey: "round:open", status: "assigned", assignedTo: AGENT },
      {
        ...base,
        id: ids.converted,
        dedupeKey: "round:conv",
        status: "converted",
        assignedTo: AGENT,
      },
      {
        ...base,
        id: ids.merged,
        dedupeKey: "round:merged",
        status: "assigned",
        assignedTo: AGENT,
        mergedInto: ids.open,
      },
      { ...base, id: ids.other, dedupeKey: "round:other", status: "assigned", assignedTo: ADMIN },
    ]);
    const body = (await (
      await call(`/api/admin/agents/${AGENT}/round`)
    ).json()) as AgentRoundResponse;
    expect(body.prospects.map((p) => p.id)).toEqual([ids.open]);
  });

  it("answers 200 with a null position for an admin's email", async () => {
    const body = (await (
      await call(`/api/admin/agents/${ADMIN}/round`)
    ).json()) as AgentRoundResponse;
    expect(body.position).toBeNull();
  });

  it("serves capturedAt clamped to receivedAt", async () => {
    const now = Date.now();
    await getDb(env.DB)
      .insert(agentPositions)
      .values(position(now + 3_600_000, now));
    const body = (await (
      await call(`/api/admin/agents/${AGENT}/round`)
    ).json()) as AgentRoundResponse;
    expect(body.position?.capturedAt).toBe(now);
  });

  it("serves null when there is no row or the row is not from today", async () => {
    const empty = (await (
      await call(`/api/admin/agents/${AGENT}/round`)
    ).json()) as AgentRoundResponse;
    expect(empty.position).toBeNull();
    const old = Date.now() - 48 * 3_600_000;
    await getDb(env.DB).insert(agentPositions).values(position(old, old));
    const stale = (await (
      await call(`/api/admin/agents/${AGENT}/round`)
    ).json()) as AgentRoundResponse;
    expect(stale.position).toBeNull();
  });

  it("answers 404 for an unknown email and 400 for a malformed one", async () => {
    expect((await call("/api/admin/agents/nobody@example.com/round")).status).toBe(404);
    expect((await call("/api/admin/agents/not-an-email/round")).status).toBe(400);
  });
});
