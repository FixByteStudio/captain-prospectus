import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { loginCodes, prospects, sessions, users } from "./db/schema";
import { fakeAccess } from "../../test/access-jwt";
import { testSessionCookie } from "../../test/session";
import { TEST_ADMIN, TEST_AGENT, seedTestUsers } from "../../test/users";
import worker from "./index";
import { workerFetch } from "../../test/worker-fetch";
import type { Status } from "../shared/constants";
import { CROCKFORD } from "../shared/credential";
import type { LoginCodeResponse, PassphraseResponse, User } from "../shared/schemas";
import { LOGIN_CODE_TTL_MS, hmacHex } from "./session";

/** Admin user management (GH #302, ADR-0029) and the Access fallback's row check. */

const HOST = "https://captain.example";
const db = () => getDb(env.DB);
const ORIGINAL = { ACCESS_TEAM_DOMAIN: env.ACCESS_TEAM_DOMAIN, ACCESS_AUD: env.ACCESS_AUD };

async function call(path: string, cookie: string, init: RequestInit = {}): Promise<Response> {
  return workerFetch(`${HOST}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...init.headers },
  });
}

const adminCookie = () => testSessionCookie(TEST_ADMIN);

async function list(cookie?: string): Promise<User[]> {
  const response = await call("/api/admin/users", cookie ?? (await adminCookie()));
  expect(response.status).toBe(200);
  return ((await response.json()) as { users: User[] }).users;
}

function post(body: unknown, cookie: string, headers?: Record<string, string>) {
  return call("/api/admin/users", cookie, { method: "POST", body: JSON.stringify(body), headers });
}

function patch(email: string, body: unknown, cookie: string, headers?: Record<string, string>) {
  return call(`/api/admin/users/${encodeURIComponent(email)}`, cookie, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers,
  });
}

function generate(email: string, cookie: string, headers?: Record<string, string>) {
  return call(`/api/admin/users/${encodeURIComponent(email)}/code`, cookie, {
    method: "POST",
    headers,
  });
}

async function addProspect(assignedTo: string, status: Status, mergedInto: string | null = null) {
  const id = crypto.randomUUID();
  await db()
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
      createdBy: TEST_ADMIN,
      createdAt: 1,
      updatedAt: 1,
    });
  return id;
}

beforeEach(async () => {
  await db().delete(sessions);
  await db().delete(loginCodes);
  await db().delete(prospects);
  await db().delete(users);
  await seedTestUsers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.assign(env, ORIGINAL);
});

describe("GET /api/admin/users", () => {
  it("lists every user ordered by name then email, with live sessions and open prospects", async () => {
    await db().update(users).set({ name: "Zed" }).where(eq(users.email, TEST_ADMIN));
    await db().update(users).set({ name: "Ann", active: false }).where(eq(users.email, TEST_AGENT));
    await testSessionCookie(TEST_AGENT);
    await testSessionCookie(TEST_AGENT, { expiresAt: Date.now() - 1000 });
    const root = await addProspect(TEST_ADMIN, "new");
    for (const status of ["new", "assigned", "follow_up"] as const) {
      await addProspect(TEST_AGENT, status);
    }
    for (const status of ["interested", "converted", "rejected"] as const) {
      await addProspect(TEST_AGENT, status);
    }
    await addProspect(TEST_AGENT, "new", root);

    const rows = await list();
    expect(rows).toEqual([
      {
        email: TEST_AGENT,
        name: "Ann",
        role: "agent",
        active: false,
        sessions: 1,
        openProspects: 3,
      },
      {
        email: TEST_ADMIN,
        name: "Zed",
        role: "admin",
        active: true,
        sessions: 1,
        openProspects: 1,
      },
    ]);
  });
});

describe("list order", () => {
  it("sorts by name ignoring case, then email, with unnamed rows last", async () => {
    await db().delete(users);
    await db()
      .insert(users)
      .values([
        { email: TEST_ADMIN, name: null, role: "admin", active: true, createdAt: 1 },
        { email: "b@x.be", name: "ann", role: "agent", active: true, createdAt: 1 },
        { email: "a@x.be", name: "Ann", role: "agent", active: true, createdAt: 1 },
        { email: "c@x.be", name: "Bea", role: "agent", active: true, createdAt: 1 },
        { email: "d@x.be", name: "Zed", role: "agent", active: true, createdAt: 1 },
        { email: "e@x.be", name: "Élodie", role: "agent", active: true, createdAt: 1 },
      ]);
    const rows = await list(await adminCookie());
    expect(rows.map((u) => u.email)).toEqual([
      "a@x.be",
      "b@x.be",
      "c@x.be",
      "e@x.be",
      "d@x.be",
      TEST_ADMIN,
    ]);
  });
});

describe("POST /api/admin/users", () => {
  it("creates an active user from a trimmed, lowercased email", async () => {
    const cookie = await adminCookie();
    const response = await post({ email: " Lea@X.be ", name: " Léa ", role: "agent" }, cookie);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      email: "lea@x.be",
      name: "Léa",
      role: "agent",
      active: true,
      sessions: 0,
      openProspects: 0,
    });
    const [row] = await db().select().from(users).where(eq(users.email, "lea@x.be"));
    expect(row?.passphraseHash).toBeNull();
    expect((await list(cookie)).map((u) => u.email)).toContain("lea@x.be");
  });

  it("answers 409 email_taken for an existing email, active or not", async () => {
    const cookie = await adminCookie();
    const body = { email: TEST_AGENT, name: "Again", role: "agent" };
    const first = await post(body, cookie);
    expect(first.status).toBe(409);
    expect(await first.json()).toMatchObject({ error: "email_taken" });

    await db().update(users).set({ active: false }).where(eq(users.email, TEST_AGENT));
    expect((await post(body, cookie)).status).toBe(409);
  });

  it("answers 400 validation for an empty name, a bad email or an unknown role", async () => {
    const cookie = await adminCookie();
    for (const body of [
      { email: "a@b.be", name: "  ", role: "agent" },
      { email: "nope", name: "A", role: "agent" },
      { email: "a@b.be", name: "A", role: "owner" },
    ]) {
      const response = await post(body, cookie);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "validation" });
    }
  });
});

describe("PATCH /api/admin/users/:email", () => {
  it("changes a role, effective on the next request", async () => {
    const adminSession = await adminCookie();
    const agentSession = await testSessionCookie(TEST_AGENT);
    expect((await call("/api/admin/users", agentSession)).status).toBe(403);

    expect((await patch(TEST_AGENT, { role: "admin" }, adminSession)).status).toBe(204);
    expect((await call("/api/admin/users", agentSession)).status).toBe(200);
  });

  it("deactivates, deleting every session", async () => {
    const adminSession = await adminCookie();
    const agentSession = await testSessionCookie(TEST_AGENT);
    await testSessionCookie(TEST_AGENT);

    expect((await patch(TEST_AGENT, { active: false }, adminSession)).status).toBe(204);
    expect((await call("/api/me", agentSession)).status).toBe(401);
    expect(await db().select().from(sessions).where(eq(sessions.userEmail, TEST_AGENT))).toEqual(
      [],
    );
    const [row] = await db().select().from(users).where(eq(users.email, TEST_AGENT));
    expect(row).toMatchObject({ role: "agent", active: false });
  });

  it("deactivates, deleting the user's unused codes but not the used ones", async () => {
    const cookie = await adminCookie();
    expect((await generate(TEST_AGENT, cookie)).status).toBe(201);
    await db().insert(loginCodes).values({
      codeHash: "spent",
      userEmail: TEST_AGENT,
      createdAt: 1,
      expiresAt: 2,
      usedAt: 1,
    });
    expect((await generate(TEST_ADMIN, cookie)).status).toBe(201);

    expect((await patch(TEST_AGENT, { active: false }, cookie)).status).toBe(204);
    const rows = await db().select().from(loginCodes);
    expect(rows.map((r) => [r.userEmail, r.codeHash === "spent"])).toEqual(
      expect.arrayContaining([
        [TEST_AGENT, true],
        [TEST_ADMIN, false],
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  it("keeps the codes when the last-admin guard refuses the deactivation", async () => {
    const cookie = await adminCookie();
    expect((await generate(TEST_ADMIN, cookie)).status).toBe(201);
    expect((await patch(TEST_ADMIN, { active: false }, cookie)).status).toBe(409);
    expect(await db().select().from(loginCodes)).toHaveLength(1);
  });

  it("reactivates without a session", async () => {
    const cookie = await adminCookie();
    await db().update(users).set({ active: false }).where(eq(users.email, TEST_AGENT));
    expect((await patch(TEST_AGENT, { active: true }, cookie)).status).toBe(204);
    const row = (await list(cookie)).find((u) => u.email === TEST_AGENT);
    expect(row).toMatchObject({ active: true, sessions: 0 });
  });

  it("refuses to demote or deactivate the last active admin, writing nothing", async () => {
    const cookie = await adminCookie();
    for (const body of [{ role: "agent" }, { active: false }]) {
      const response = await patch(TEST_ADMIN, body, cookie);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: "last_admin" });
    }
    const [row] = await db().select().from(users).where(eq(users.email, TEST_ADMIN));
    expect(row).toMatchObject({ role: "admin", active: true });
    expect((await call("/api/me", cookie)).status).toBe(200);
  });

  it("accepts a change that leaves the only active admin an active admin", async () => {
    const cookie = await adminCookie();
    for (const body of [{ active: true }, { role: "admin" }, { role: "admin", active: true }]) {
      expect((await patch(TEST_ADMIN, body, cookie)).status).toBe(204);
      const [row] = await db().select().from(users).where(eq(users.email, TEST_ADMIN));
      expect(row).toMatchObject({ role: "admin", active: true });
    }
  });

  it("does not count an inactive admin as another admin", async () => {
    const cookie = await adminCookie();
    await db()
      .update(users)
      .set({ role: "admin", active: false })
      .where(eq(users.email, TEST_AGENT));
    expect((await patch(TEST_ADMIN, { active: false }, cookie)).status).toBe(409);
  });

  it("lets an admin deactivate their own row when another admin is active", async () => {
    const cookie = await adminCookie();
    await db().update(users).set({ role: "admin" }).where(eq(users.email, TEST_AGENT));
    expect((await patch(TEST_ADMIN, { active: false }, cookie)).status).toBe(204);
    expect((await call("/api/me", cookie)).status).toBe(401);
  });

  it("deactivating an agent keeps the acting admin's and other users' sessions", async () => {
    const adminSession = await adminCookie();
    const agentSession = await testSessionCookie(TEST_AGENT);
    await db().update(users).set({ role: "admin" }).where(eq(users.email, TEST_AGENT));
    await db()
      .insert(users)
      .values({ email: "bob@x.be", name: "Bob", role: "agent", active: true, createdAt: 1 });
    const bobSession = await testSessionCookie("bob@x.be");
    expect((await patch("bob@x.be", { active: false }, adminSession)).status).toBe(204);
    expect((await call("/api/me", adminSession)).status).toBe(200);
    expect((await call("/api/me", agentSession)).status).toBe(200);
    expect((await call("/api/me", bobSession)).status).toBe(401);
  });

  it("demoting an admin keeps their session but closes admin routes", async () => {
    const adminSession = await adminCookie();
    const other = await testSessionCookie(TEST_AGENT);
    await db().update(users).set({ role: "admin" }).where(eq(users.email, TEST_AGENT));
    expect((await patch(TEST_AGENT, { role: "agent" }, adminSession)).status).toBe(204);
    expect((await call("/api/admin/users", other)).status).toBe(403);
    expect((await call("/api/me", other)).status).toBe(200);
  });

  it("lets an Access-JWT admin from ADMIN_EMAILS deactivate an agent with no active admin row", async () => {
    await db().delete(users).where(eq(users.email, TEST_ADMIN));
    const access = await fakeAccess();
    Object.assign(env, { ACCESS_TEAM_DOMAIN: access.teamDomain, ACCESS_AUD: access.aud });
    const response = await workerFetch(
      `${HOST}/api/admin/users/${encodeURIComponent(TEST_AGENT)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cf-Access-Jwt-Assertion": await access.sign(TEST_ADMIN),
        },
        body: JSON.stringify({ active: false }),
      },
    );
    expect(response.status).toBe(204);
  });

  it("lands two PATCHes on one user", async () => {
    const cookie = await adminCookie();
    expect((await patch(TEST_AGENT, { role: "admin" }, cookie)).status).toBe(204);
    expect((await patch(TEST_AGENT, { active: false }, cookie)).status).toBe(204);
    const [row] = await db().select().from(users).where(eq(users.email, TEST_AGENT));
    expect(row).toMatchObject({ role: "admin", active: false });
  });

  it("clears the passphrase on a demotion or a deactivation, and only then", async () => {
    const cookie = await adminCookie();
    const hashOf = async () =>
      (
        await db()
          .select({ hash: users.passphraseHash })
          .from(users)
          .where(eq(users.email, TEST_AGENT))
      )[0]?.hash;
    const give = () =>
      db()
        .update(users)
        .set({ role: "admin", active: true, passphraseHash: "a".repeat(64) })
        .where(eq(users.email, TEST_AGENT));

    await give();
    expect((await patch(TEST_AGENT, { role: "admin" }, cookie)).status).toBe(204);
    expect((await patch(TEST_AGENT, { active: true }, cookie)).status).toBe(204);
    expect(await hashOf()).toBe("a".repeat(64));

    expect((await patch(TEST_AGENT, { role: "agent" }, cookie)).status).toBe(204);
    expect(await hashOf()).toBeNull();

    await give();
    expect((await patch(TEST_AGENT, { active: false }, cookie)).status).toBe(204);
    expect(await hashOf()).toBeNull();
  });

  it("keeps the passphrase when the last-admin guard refuses", async () => {
    const cookie = await adminCookie();
    await db()
      .update(users)
      .set({ passphraseHash: "b".repeat(64) })
      .where(eq(users.email, TEST_ADMIN));
    for (const body of [{ role: "agent" }, { active: false }]) {
      expect((await patch(TEST_ADMIN, body, cookie)).status).toBe(409);
    }
    const [row] = await db().select().from(users).where(eq(users.email, TEST_ADMIN));
    expect(row?.passphraseHash).toBe("b".repeat(64));
  });

  it("answers 404 for an email with no row and 400 for an empty body", async () => {
    const cookie = await adminCookie();
    expect((await patch("ghost@x.be", { active: false }, cookie)).status).toBe(404);
    expect((await patch(TEST_AGENT, {}, cookie)).status).toBe(400);
  });
});

describe("POST /api/admin/users/:email/code", () => {
  it("answers 201 with an 8-character Crockford code that expires in 15 minutes", async () => {
    const before = Date.now();
    const response = await generate(TEST_AGENT, await adminCookie());
    expect(response.status).toBe(201);
    const body = (await response.json()) as LoginCodeResponse;
    expect(body.code).toMatch(new RegExp(`^[${CROCKFORD}]{8}$`));
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + LOGIN_CODE_TTL_MS);
    expect(body.expiresAt).toBeLessThanOrEqual(Date.now() + LOGIN_CODE_TTL_MS);

    const [row] = await db().select().from(loginCodes);
    expect(row).toMatchObject({ userEmail: TEST_AGENT, expiresAt: body.expiresAt, usedAt: null });
  });

  it("deletes the user's older unused codes and keeps other users' codes", async () => {
    const cookie = await adminCookie();
    await generate(TEST_ADMIN, cookie);
    await generate(TEST_AGENT, cookie);
    await generate(TEST_AGENT, cookie);
    const rows = await db().select().from(loginCodes);
    expect(rows.filter((r) => r.userEmail === TEST_AGENT)).toHaveLength(1);
    expect(rows.filter((r) => r.userEmail === TEST_ADMIN)).toHaveLength(1);
  });

  it("generates a code on the signed-in admin's own row", async () => {
    expect((await generate(TEST_ADMIN, await adminCookie())).status).toBe(201);
  });

  it("answers 409 user_inactive for a deactivated user and 404 for no row, storing nothing", async () => {
    const cookie = await adminCookie();
    await db().update(users).set({ active: false }).where(eq(users.email, TEST_AGENT));
    const inactive = await generate(TEST_AGENT, cookie);
    expect(inactive.status).toBe(409);
    expect(await inactive.json()).toMatchObject({ error: "user_inactive" });
    const unknown = await generate("ghost@x.be", cookie);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ error: "not_found" });
    expect(await db().select().from(loginCodes)).toEqual([]);
  });

  it("fails closed with 500 misconfigured without AUTH_PEPPER, storing nothing", async () => {
    // No pepper means no session can be read, so the admin is DEV_USER_EMAIL on localhost.
    const pepper = env.AUTH_PEPPER;
    env.AUTH_PEPPER = undefined;
    try {
      const response = await workerFetch(
        `http://localhost/api/admin/users/${encodeURIComponent(TEST_AGENT)}/code`,
        { method: "POST" },
      );
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: "misconfigured" });
    } finally {
      env.AUTH_PEPPER = pepper;
    }
    expect(await db().select().from(loginCodes)).toEqual([]);
  });

  it("answers 403 to an agent and to a foreign Origin", async () => {
    const agent = await testSessionCookie(TEST_AGENT);
    expect((await generate(TEST_AGENT, agent)).status).toBe(403);
    const foreign = await generate(TEST_AGENT, await adminCookie(), {
      Origin: "https://evil.example",
    });
    expect(foreign.status).toBe(403);
    expect(await db().select().from(loginCodes)).toEqual([]);
  });
});

describe("POST /api/admin/me/passphrase", () => {
  function newPassphrase(cookie: string, headers?: Record<string, string>) {
    return call("/api/admin/me/passphrase", cookie, { method: "POST", headers });
  }

  async function storedHash(email: string): Promise<string | null | undefined> {
    const [row] = await db()
      .select({ hash: users.passphraseHash })
      .from(users)
      .where(eq(users.email, email));
    return row?.hash;
  }

  it("answers 200 with 20 Crockford characters and stores only their HMAC", async () => {
    const response = await newPassphrase(await adminCookie());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const { passphrase } = (await response.json()) as PassphraseResponse;
    expect(passphrase).toHaveLength(20);
    expect([...passphrase].every((ch) => CROCKFORD.includes(ch))).toBe(true);
    const hash = await storedHash(TEST_ADMIN);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await hmacHex(env.AUTH_PEPPER ?? "", passphrase));
  });

  it("replaces the old hash and keeps the caller's sessions", async () => {
    const cookie = await adminCookie();
    await newPassphrase(cookie);
    const first = await storedHash(TEST_ADMIN);
    expect((await newPassphrase(cookie)).status).toBe(200);
    expect(await storedHash(TEST_ADMIN)).not.toBe(first);
    expect((await call("/api/me", cookie)).status).toBe(200);
  });

  it("touches only the caller's row", async () => {
    await db().update(users).set({ role: "admin" }).where(eq(users.email, TEST_AGENT));
    expect((await newPassphrase(await adminCookie())).status).toBe(200);
    expect(await storedHash(TEST_AGENT)).toBeNull();
  });

  it("answers 404 to an Access-only admin with no users row, writing nothing", async () => {
    await db().delete(users).where(eq(users.email, TEST_ADMIN));
    const access = await fakeAccess();
    Object.assign(env, { ACCESS_TEAM_DOMAIN: access.teamDomain, ACCESS_AUD: access.aud });
    const response = await workerFetch(`${HOST}/api/admin/me/passphrase`, {
      method: "POST",
      headers: { "Cf-Access-Jwt-Assertion": await access.sign(TEST_ADMIN) },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
    const hashes = await db().select({ hash: users.passphraseHash }).from(users);
    expect(hashes.every((r) => r.hash === null)).toBe(true);
  });

  it("fails closed with 500 misconfigured without AUTH_PEPPER, storing nothing", async () => {
    const pepper = env.AUTH_PEPPER;
    env.AUTH_PEPPER = undefined;
    try {
      const response = await workerFetch("http://localhost/api/admin/me/passphrase", {
        method: "POST",
      });
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: "misconfigured" });
    } finally {
      env.AUTH_PEPPER = pepper;
    }
    expect(await storedHash(TEST_ADMIN)).toBeNull();
  });

  it("answers 403 to an agent and to a foreign Origin", async () => {
    expect((await newPassphrase(await testSessionCookie(TEST_AGENT))).status).toBe(403);
    const foreign = await newPassphrase(await adminCookie(), { Origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    expect(await storedHash(TEST_ADMIN)).toBeNull();
    expect(await storedHash(TEST_AGENT)).toBeNull();
  });

  it("never logs the passphrase or its hash", async () => {
    const calls: unknown[][] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        calls.push(args);
      });
    }
    const { passphrase } = (await (
      await newPassphrase(await adminCookie())
    ).json()) as PassphraseResponse;
    const logged = JSON.stringify(calls);
    expect(logged).not.toContain(passphrase);
    expect(logged).not.toContain(String(await storedHash(TEST_ADMIN)));
  });
});

describe("access control", () => {
  it("answers 403 to an agent on every route", async () => {
    const cookie = await testSessionCookie(TEST_AGENT);
    expect((await call("/api/admin/users", cookie)).status).toBe(403);
    expect((await post({ email: "a@b.be", name: "A", role: "agent" }, cookie)).status).toBe(403);
    expect((await patch(TEST_AGENT, { active: false }, cookie)).status).toBe(403);
  });

  it("answers 403 forbidden_origin to a foreign Origin on POST and PATCH", async () => {
    const cookie = await adminCookie();
    const foreign = { Origin: "https://evil.example" };
    const created = await post({ email: "a@b.be", name: "A", role: "agent" }, cookie, foreign);
    expect(created.status).toBe(403);
    expect(await created.json()).toMatchObject({ error: "forbidden_origin" });
    expect((await patch(TEST_AGENT, { active: false }, cookie, foreign)).status).toBe(403);

    // workerFetch adds the app's Origin, so build the request without one.
    const ctx = createExecutionContext();
    const bare = await worker.fetch(
      new Request(`${HOST}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ email: "a@b.be", name: "A", role: "agent" }),
      }),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(bare.status).toBe(403);
    expect(await bare.json()).toMatchObject({ error: "forbidden_origin" });
  });
});

describe("Access JWT fallback and the users row", () => {
  async function viaAccess(email: string): Promise<Response> {
    const access = await fakeAccess();
    Object.assign(env, { ACCESS_TEAM_DOMAIN: access.teamDomain, ACCESS_AUD: access.aud });
    return workerFetch(`${HOST}/api/me`, {
      headers: { "Cf-Access-Jwt-Assertion": await access.sign(email) },
    });
  }

  it("refuses an email whose row is inactive", async () => {
    await db().update(users).set({ active: false }).where(eq(users.email, TEST_AGENT));
    expect((await viaAccess(TEST_AGENT)).status).toBe(401);
  });

  it("takes an active row's role over ADMIN_EMAILS", async () => {
    await db().update(users).set({ role: "admin" }).where(eq(users.email, TEST_AGENT));
    expect(await (await viaAccess(TEST_AGENT)).json()).toEqual({
      email: TEST_AGENT,
      role: "admin",
    });
    await db().update(users).set({ role: "agent" }).where(eq(users.email, TEST_ADMIN));
    expect(await (await viaAccess(TEST_ADMIN)).json()).toEqual({
      email: TEST_ADMIN,
      role: "agent",
    });
  });

  it("falls back to ADMIN_EMAILS for an email with no row", async () => {
    await db().delete(users).where(eq(users.email, TEST_ADMIN));
    expect(await (await viaAccess(TEST_ADMIN)).json()).toEqual({
      email: TEST_ADMIN,
      role: "admin",
    });
  });
});
