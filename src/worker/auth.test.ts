import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import worker from "./index";
import { getDb } from "./db/client";
import { sessions, users } from "./db/schema";
import { SESSION_COOKIE, hmacHex } from "./session";
import { SignJWT, generateKeyPair } from "jose";
import { fakeAccess, type FakeAccess } from "../../test/access-jwt";

/**
 * Own login (ADR-0029, GH #299): break-glass, the session cookie, and the
 * identity gate's order — session, then DEV_USER_EMAIL on localhost, then the
 * Access JWT, then 401.
 *
 * Requests go to a non-local host, so DEV_USER_EMAIL (bound in
 * vitest.config.ts) is ignored unless a test says otherwise.
 */

const HOST = "https://captain.example";
const OWNER = "owner@example.com";
const BREAK_GLASS = "test-break-glass";
const PEPPER = "test-pepper";
const DAY_MS = 24 * 60 * 60 * 1000;

const ORIGINAL = {
  AUTH_PEPPER: env.AUTH_PEPPER,
  BREAK_GLASS: env.BREAK_GLASS,
  OWNER_EMAIL: env.OWNER_EMAIL,
  ACCESS_TEAM_DOMAIN: env.ACCESS_TEAM_DOMAIN,
  ACCESS_AUD: env.ACCESS_AUD,
  DEV_USER_EMAIL: env.DEV_USER_EMAIL,
};

async function call(path: string, init?: RequestInit, host = HOST): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`${host}${path}`, init), env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

function login(body: unknown): Promise<Response> {
  return call("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function me(headers?: Record<string, string>, host?: string): Promise<Response> {
  return call("/api/me", { headers }, host);
}

/** The session token out of a Set-Cookie header. */
function tokenFrom(response: Response): string {
  const header = response.headers.get("Set-Cookie") ?? "";
  const match = new RegExp(`^${SESSION_COOKIE}=([^;]*)`).exec(header);
  if (!match?.[1]) throw new Error(`no session cookie in ${JSON.stringify(header)}`);
  return match[1];
}

async function signIn(): Promise<string> {
  const response = await login({ kind: "passphrase", email: OWNER, passphrase: BREAK_GLASS });
  expect(response.status).toBe(200);
  return tokenFrom(response);
}

/**
 * wrangler.jsonc's placeholders make the generated Env type these vars as the
 * literal `""`; the Worker itself reads them as `string` (types.ts).
 */
function configureAccess(access: FakeAccess) {
  Object.assign(env, { ACCESS_TEAM_DOMAIN: access.teamDomain, ACCESS_AUD: access.aud });
}

const cookie = (token: string) => ({ Cookie: `${SESSION_COOKIE}=${token}` });

const db = () => getDb(env.DB);

beforeEach(async () => {
  await db().delete(sessions);
  await db().delete(users);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.assign(env, ORIGINAL);
});

describe("POST /api/auth/login — break-glass", () => {
  it("opens an admin session for OWNER_EMAIL in any case, with the secret as typed", async () => {
    const response = await login({
      kind: "passphrase",
      email: "  Owner@Example.COM ",
      passphrase: BREAK_GLASS,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: OWNER, role: "admin" });

    const setCookie = response.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43};`));
    for (const attribute of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"]) {
      expect(setCookie).toContain(attribute);
    }
    expect(setCookie).toContain(`Max-Age=${(30 * DAY_MS) / 1000}`);
    expect(setCookie).not.toMatch(/Domain=/i);

    const [user] = await db().select().from(users);
    expect(user).toMatchObject({ email: OWNER, role: "admin", active: true });

    const token = tokenFrom(response);
    const [session] = await db().select().from(sessions);
    // Only the HMAC is stored, never the token itself.
    expect(session?.tokenHash).toBe(await hmacHex(PEPPER, token));
    expect(session?.tokenHash).not.toContain(token);
    expect(session?.userEmail).toBe(OWNER);
    expect(session && session.expiresAt - session.createdAt).toBe(30 * DAY_MS);
  });

  it("puts a deactivated or demoted owner back as an active admin", async () => {
    await db().insert(users).values({ email: OWNER, role: "agent", active: false, createdAt: 1 });

    await signIn();

    const [user] = await db().select().from(users).where(eq(users.email, OWNER));
    expect(user).toMatchObject({ role: "admin", active: true, createdAt: 1 });
    expect(await db().select().from(sessions)).toHaveLength(1);
  });

  it("refuses a wrong email and a wrong secret with the same body, and opens nothing", async () => {
    const wrongEmail = await login({
      kind: "passphrase",
      email: "someone@example.com",
      passphrase: BREAK_GLASS,
    });
    const wrongSecret = await login({ kind: "passphrase", email: OWNER, passphrase: "nope" });
    // Same length as the real one, differing only in its last character.
    const nearMiss = await login({
      kind: "passphrase",
      email: OWNER,
      passphrase: `${BREAK_GLASS.slice(0, -1)}X`,
    });

    expect(wrongEmail.status).toBe(401);
    expect(wrongSecret.status).toBe(401);
    expect(nearMiss.status).toBe(401);
    const bodies = await Promise.all([wrongEmail.text(), wrongSecret.text(), nearMiss.text()]);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0] ?? "{}")).toMatchObject({ error: "unauthorized" });
    expect(wrongEmail.headers.get("Set-Cookie")).toBeNull();
    expect(await db().select().from(sessions)).toHaveLength(0);
    expect(await db().select().from(users)).toHaveLength(0);
  });

  it("does not trim the passphrase", async () => {
    const response = await login({
      kind: "passphrase",
      email: OWNER,
      passphrase: ` ${BREAK_GLASS}`,
    });
    expect(response.status).toBe(401);
  });

  it.each([
    ["an unknown kind", { kind: "code", code: "K7QM2XPA" }],
    ["a missing passphrase", { kind: "passphrase", email: OWNER }],
    ["a missing email", { kind: "passphrase", passphrase: BREAK_GLASS }],
    ["an empty passphrase", { kind: "passphrase", email: OWNER, passphrase: "" }],
    ["no kind", { email: OWNER, passphrase: BREAK_GLASS }],
  ])("answers 400 to %s", async (_label, body) => {
    const response = await login(body);
    expect(response.status).toBe(400);
  });

  it("answers 400 to a body that is not JSON", async () => {
    const response = await call("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "kind=passphrase",
    });
    expect(response.status).toBe(400);
  });

  it("fails closed with 500 when AUTH_PEPPER is missing", async () => {
    env.AUTH_PEPPER = undefined;
    const response = await login({ kind: "passphrase", email: OWNER, passphrase: BREAK_GLASS });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "misconfigured" });
    expect(await db().select().from(sessions)).toHaveLength(0);
  });

  it.each([
    ["OWNER_EMAIL", undefined],
    ["OWNER_EMAIL", ""],
    ["BREAK_GLASS", undefined],
    ["BREAK_GLASS", ""],
  ] as const)("refuses with 401 when %s is %j", async (name, value) => {
    env[name] = value;
    const response = await login({ kind: "passphrase", email: OWNER, passphrase: BREAK_GLASS });
    expect(response.status).toBe(401);
    expect(await db().select().from(sessions)).toHaveLength(0);
  });
});

describe("requireIdentity", () => {
  it("answers /api/me from a valid session", async () => {
    const token = await signIn();
    const response = await me(cookie(token));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: OWNER, role: "admin" });
  });

  it("takes the role from users, not from anything the client holds", async () => {
    const token = await signIn();
    await db().update(users).set({ role: "agent" }).where(eq(users.email, OWNER));
    expect(await (await me(cookie(token))).json()).toEqual({ email: OWNER, role: "agent" });
  });

  it("prefers the session over a valid Access JWT for another email", async () => {
    const access = await fakeAccess();
    configureAccess(access);
    const token = await signIn();
    const jwt = await access.sign("someone-else@example.com");

    const response = await me({ ...cookie(token), "Cf-Access-Jwt-Assertion": jwt });
    expect(await response.json()).toEqual({ email: OWNER, role: "admin" });
  });

  it("prefers the session over DEV_USER_EMAIL on localhost", async () => {
    const token = await signIn();
    const response = await me(cookie(token), "http://localhost");
    expect(await response.json()).toEqual({ email: OWNER, role: "admin" });
  });

  it("still honours DEV_USER_EMAIL on localhost with no session", async () => {
    const response = await me(undefined, "http://localhost");
    expect(await response.json()).toEqual({ email: "admin@example.com", role: "admin" });
  });

  it("accepts a signed Access JWT alone, as a header or as the CF_Authorization cookie", async () => {
    const access = await fakeAccess();
    configureAccess(access);
    const jwt = await access.sign("Agent@Example.com");

    const viaHeader = await me({ "Cf-Access-Jwt-Assertion": jwt });
    expect(viaHeader.status).toBe(200);
    expect(await viaHeader.json()).toEqual({ email: "agent@example.com", role: "agent" });

    const viaCookie = await me({ Cookie: `CF_Authorization=${jwt}` });
    expect(viaCookie.status).toBe(200);
  });

  it("refuses an Access JWT signed by another key", async () => {
    const access = await fakeAccess();
    configureAccess(access);
    // Right issuer, audience and kid: only the signature is wrong.
    const { privateKey } = await generateKeyPair("RS256");
    const forged = await new SignJWT({ email: OWNER })
      .setProtectedHeader({ alg: "RS256", kid: access.kid })
      .setIssuer(access.teamDomain)
      .setAudience(access.aud)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const response = await me({ "Cf-Access-Jwt-Assertion": forged });
    expect(response.status).toBe(401);
  });

  it("falls back to the Access JWT when the session cookie has expired", async () => {
    const access = await fakeAccess();
    configureAccess(access);
    const token = await signIn();
    await db()
      .update(sessions)
      .set({ expiresAt: Date.now() - 1 });
    const jwt = await access.sign("agent@example.com");

    const response = await me({ ...cookie(token), "Cf-Access-Jwt-Assertion": jwt });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: "agent@example.com", role: "agent" });
  });

  it("answers 401, not 500, with neither a session nor Access configured", async () => {
    const response = await me();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthorized" });
  });

  it("answers 401 to an unknown token", async () => {
    const response = await me(cookie("not-a-real-token"));
    expect(response.status).toBe(401);
  });

  it("falls through to 401 once the session has expired", async () => {
    const token = await signIn();
    await db()
      .update(sessions)
      .set({ expiresAt: Date.now() - 1 });
    expect((await me(cookie(token))).status).toBe(401);
  });

  it("falls through to 401 once the user is deactivated", async () => {
    const token = await signIn();
    await db().update(users).set({ active: false }).where(eq(users.email, OWNER));
    expect((await me(cookie(token))).status).toBe(401);
  });

  it("skips the session lookup without AUTH_PEPPER instead of trusting the cookie", async () => {
    const token = await signIn();
    env.AUTH_PEPPER = undefined;
    expect((await me(cookie(token))).status).toBe(401);
  });

  it("voids every session when AUTH_PEPPER rotates", async () => {
    const token = await signIn();
    env.AUTH_PEPPER = "rotated-pepper";
    expect((await me(cookie(token))).status).toBe(401);
  });
});

describe("with Access configured (cutover phase 1)", () => {
  it("still lets login and logout through with no JWT", async () => {
    configureAccess(await fakeAccess());
    const response = await login({ kind: "passphrase", email: OWNER, passphrase: BREAK_GLASS });
    expect(response.status).toBe(200);
    const token = tokenFrom(response);
    const out = await call("/api/auth/logout", { method: "POST", headers: cookie(token) });
    expect(out.status).toBe(204);
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes this session, clears the cookie, and the next /api/me is 401", async () => {
    const token = await signIn();
    const response = await call("/api/auth/logout", { method: "POST", headers: cookie(token) });

    expect(response.status).toBe(204);
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));
    expect(setCookie).toContain("Max-Age=0");
    expect(await db().select().from(sessions)).toHaveLength(0);
    expect((await me(cookie(token))).status).toBe(401);
  });

  it("leaves other sessions alone", async () => {
    const first = await signIn();
    await signIn();
    await call("/api/auth/logout", { method: "POST", headers: cookie(first) });
    expect(await db().select().from(sessions)).toHaveLength(1);
  });

  it("answers 204 without a session", async () => {
    const response = await call("/api/auth/logout", { method: "POST" });
    expect(response.status).toBe(204);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});

describe("log hygiene", () => {
  it("never logs the break-glass secret, a token or a hash", async () => {
    const calls: unknown[][] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        calls.push(args);
      });
    }

    const token = await signIn();
    await login({ kind: "passphrase", email: OWNER, passphrase: "wrong" });
    await login({ kind: "code", code: "x" });
    await me(cookie(token));
    await me(cookie("bogus"));
    await call("/api/auth/logout", { method: "POST", headers: cookie(token) });
    env.AUTH_PEPPER = undefined;
    await login({ kind: "passphrase", email: OWNER, passphrase: BREAK_GLASS });

    const hash = await hmacHex(PEPPER, token);
    const logged = JSON.stringify(calls);
    for (const secret of [BREAK_GLASS, token, hash, PEPPER]) {
      expect(logged).not.toContain(secret);
    }
  });
});
