import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { loginAttempts, loginCodes, sessions, users } from "./db/schema";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, throttleKey } from "./login-throttle";
import { LOGIN_CODE_TTL_MS, SESSION_COOKIE, hmacHex } from "./session";
import { SignJWT, generateKeyPair } from "jose";
import { fakeAccess, type FakeAccess } from "../../test/access-jwt";
import { testSessionCookie } from "../../test/session";
import { TEST_ADMIN, TEST_AGENT, seedTestUsers } from "../../test/users";
import { normaliseCredential } from "../shared/credential";
import type { LoginCodeResponse, PassphraseResponse } from "../shared/schemas";
import { workerFetch } from "../../test/worker-fetch";

/**
 * Own login (ADR-0029, GH #299): break-glass, the session cookie, and the
 * identity gate's order — session, then DEV_USER_EMAIL on localhost, then the
 * Access JWT, then 401.
 *
 * Requests go to a non-local host, so DEV_USER_EMAIL (bound in
 * vitest.config.ts) is ignored unless a test says otherwise. Each test wipes
 * `users`, then puts back the two rows test/setup-worker.ts seeds.
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
  return workerFetch(`${host}${path}`, init);
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
  await db().delete(loginAttempts);
  await db().delete(sessions);
  await db().delete(loginCodes);
  await db().delete(users);
  await seedTestUsers();
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

    const [user] = await db().select().from(users).where(eq(users.email, OWNER));
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
    expect(await db().select().from(users).where(eq(users.email, OWNER))).toHaveLength(0);
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
    ["an unknown kind", { kind: "passkey" }],
    ["an empty code", { kind: "code", code: "" }],
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

  it("signs in through a test session cookie on a non-local host", async () => {
    const response = await me({ Cookie: await testSessionCookie(TEST_AGENT) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: TEST_AGENT, role: "agent" });
  });

  it("prefers a session for one user over DEV_USER_EMAIL naming another", async () => {
    env.DEV_USER_EMAIL = TEST_ADMIN;
    const response = await me({ Cookie: await testSessionCookie(TEST_AGENT) }, "http://localhost");
    expect(await response.json()).toEqual({ email: TEST_AGENT, role: "agent" });
  });

  it("refuses a test session cookie once its expiry has passed", async () => {
    const response = await me({
      Cookie: await testSessionCookie(TEST_AGENT, { expiresAt: Date.now() - 1 }),
    });
    expect(response.status).toBe(401);
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

describe("POST /api/auth/login — code (GH #305)", () => {
  /** Generates a code for `email` the way the Agents page does. */
  async function generate(email: string): Promise<LoginCodeResponse> {
    const response = await call(`/api/admin/users/${encodeURIComponent(email)}/code`, {
      method: "POST",
      headers: { Cookie: await testSessionCookie(TEST_ADMIN) },
    });
    expect(response.status).toBe(201);
    return (await response.json()) as LoginCodeResponse;
  }

  /** "K7QM2XPA" as an agent might type it: lowercase, split by a space. */
  const typed = (code: string) =>
    `${code.slice(0, 4).toLowerCase()} ${code.slice(4).toLowerCase()}`;

  const agentSessions = () =>
    db().select().from(sessions).where(eq(sessions.userEmail, TEST_AGENT));

  it("opens an agent session for a code typed in lowercase with a space, and spends it", async () => {
    const { code } = await generate(TEST_AGENT);

    const response = await login({ kind: "code", code: typed(code) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: TEST_AGENT, role: "agent" });
    expect(response.headers.get("Set-Cookie")).toContain(`Max-Age=${(90 * DAY_MS) / 1000}`);
    const token = tokenFrom(response);
    expect(await (await me(cookie(token))).json()).toEqual({ email: TEST_AGENT, role: "agent" });

    const [row] = await db().select().from(loginCodes);
    expect(row?.usedAt).not.toBeNull();
    const [session] = await agentSessions();
    expect(session?.tokenHash).toBe(await hmacHex(PEPPER, token));
    expect(session && session.expiresAt - session.createdAt).toBe(90 * DAY_MS);
  });

  it("reads I, L and O typed for 1 and 0", async () => {
    const { code } = await generate(TEST_AGENT);
    const lookalike = code.replace(/1/g, "l").replace(/0/g, "o");
    expect((await login({ kind: "code", code: lookalike })).status).toBe(200);
  });

  it("gives an admin's own code an admin session with the admin lifetime", async () => {
    const { code } = await generate(TEST_ADMIN);
    const response = await login({ kind: "code", code });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: TEST_ADMIN, role: "admin" });
    expect(response.headers.get("Set-Cookie")).toContain(`Max-Age=${(30 * DAY_MS) / 1000}`);
    const [session] = await db()
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, await hmacHex(PEPPER, tokenFrom(response))));
    expect(session?.userEmail).toBe(TEST_ADMIN);
    expect(session && session.expiresAt - session.createdAt).toBe(30 * DAY_MS);
  });

  it("refuses a wrong code with 401 unauthorized and opens nothing", async () => {
    await generate(TEST_AGENT);
    const response = await login({ kind: "code", code: "ZZZZZZZZ" });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthorized" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await agentSessions()).toHaveLength(0);
  });

  it("refuses a code once it has expired", async () => {
    const { code, expiresAt } = await generate(TEST_AGENT);
    vi.spyOn(Date, "now").mockReturnValue(expiresAt);
    expect((await login({ kind: "code", code })).status).toBe(401);
  });

  it("refuses a code already used", async () => {
    const { code } = await generate(TEST_AGENT);
    expect((await login({ kind: "code", code })).status).toBe(200);
    expect((await login({ kind: "code", code })).status).toBe(401);
    expect(await agentSessions()).toHaveLength(1);
  });

  it("refuses a code a newer one superseded, and takes the newer one", async () => {
    const older = await generate(TEST_AGENT);
    const newer = await generate(TEST_AGENT);
    expect((await login({ kind: "code", code: older.code })).status).toBe(401);
    expect((await login({ kind: "code", code: newer.code })).status).toBe(200);
  });

  it("refuses the code of a user deactivated since", async () => {
    const { code } = await generate(TEST_AGENT);
    // Behind the route's back, so the code row is still there.
    await db().update(users).set({ active: false }).where(eq(users.email, TEST_AGENT));
    expect((await login({ kind: "code", code })).status).toBe(401);
  });

  it("lets exactly one of two concurrent logins spend a code", async () => {
    const { code } = await generate(TEST_AGENT);
    const responses = await Promise.all([
      login({ kind: "code", code }),
      login({ kind: "code", code: typed(code) }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await agentSessions()).toHaveLength(1);
  });

  it("opens no session for the loser of a race in the same millisecond", async () => {
    const { code } = await generate(TEST_AGENT);
    vi.spyOn(Date, "now").mockReturnValue(Date.now());
    expect((await login({ kind: "code", code })).status).toBe(200);
    expect((await login({ kind: "code", code })).status).toBe(401);
    expect(await agentSessions()).toHaveLength(1);
  });

  it("answers 15 minutes from generation in expiresAt", async () => {
    const before = Date.now();
    const { expiresAt } = await generate(TEST_AGENT);
    expect(expiresAt).toBeGreaterThanOrEqual(before + LOGIN_CODE_TTL_MS);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + LOGIN_CODE_TTL_MS);
  });

  it("never logs the code nor stores it in plaintext", async () => {
    const calls: unknown[][] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        calls.push(args);
      });
    }

    const { code } = await generate(TEST_AGENT);
    await login({ kind: "code", code: "WRONG000" });
    const token = tokenFrom(await login({ kind: "code", code: typed(code) }));

    const hash = await hmacHex(PEPPER, code);
    const logged = JSON.stringify(calls);
    for (const secret of [code, typed(code), hash, token]) {
      expect(logged).not.toContain(secret);
    }
    const [row] = await db().select().from(loginCodes);
    expect(row?.codeHash).toBe(hash);
    expect(JSON.stringify(row)).not.toContain(code);
  });
});

describe("POST /api/auth/login — generated passphrase (GH #306)", () => {
  /** Generates the signed-in admin's own passphrase the way the Agents page does. */
  async function generatePassphrase(email = TEST_ADMIN): Promise<string> {
    const response = await call("/api/admin/me/passphrase", {
      method: "POST",
      headers: { Cookie: await testSessionCookie(email) },
    });
    expect(response.status).toBe(200);
    return ((await response.json()) as PassphraseResponse).passphrase;
  }

  /** "K7QM2XPA…" as an admin might type it: lowercase, hyphen-grouped, O for 0. */
  const typed = (passphrase: string) =>
    (passphrase.match(/.{4}/g) ?? []).join("-").toLowerCase().replace(/0/g, "o");

  it("opens a 30-day admin session from the passphrase typed loosely", async () => {
    // Fixed, with both 0 and 1, so O-for-0 and I/L-for-1 are exercised on every run.
    const passphrase = "K7QM2XPA9DWE10TN8B01";
    await db()
      .update(users)
      .set({ passphraseHash: await hmacHex(PEPPER, passphrase) })
      .where(eq(users.email, TEST_ADMIN));

    const response = await login({
      kind: "passphrase",
      email: ` ${TEST_ADMIN.toUpperCase()} `,
      passphrase: "k7qm-2xpa-9dwe-iotn-8bol",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: TEST_ADMIN, role: "admin" });
    expect(response.headers.get("Set-Cookie")).toContain(`Max-Age=${(30 * DAY_MS) / 1000}`);
    const [session] = await db().select().from(sessions);
    expect(session?.userEmail).toBe(TEST_ADMIN);
    expect(session && session.expiresAt - session.createdAt).toBe(30 * DAY_MS);
    expect((await me(cookie(tokenFrom(response)))).status).toBe(200);
  });

  it("works with break-glass configured but missed, and without it", async () => {
    const passphrase = await generatePassphrase();
    const body = { kind: "passphrase", email: TEST_ADMIN, passphrase };
    expect((await login(body)).status).toBe(200);
    env.BREAK_GLASS = undefined;
    env.OWNER_EMAIL = undefined;
    expect((await login(body)).status).toBe(200);
  });

  it("lets the owner sign in with a generated passphrase as well as break-glass", async () => {
    await signIn();
    const passphrase = await generatePassphrase(OWNER);
    expect((await login({ kind: "passphrase", email: OWNER, passphrase })).status).toBe(200);
    expect(
      (await login({ kind: "passphrase", email: OWNER, passphrase: BREAK_GLASS })).status,
    ).toBe(200);
  });

  it("refuses the old passphrase once a new one is generated", async () => {
    const old = await generatePassphrase();
    const fresh = await generatePassphrase();
    expect((await login({ kind: "passphrase", email: TEST_ADMIN, passphrase: old })).status).toBe(
      401,
    );
    expect((await login({ kind: "passphrase", email: TEST_ADMIN, passphrase: fresh })).status).toBe(
      200,
    );
  });

  it("refuses every failure with the same body and opens no session", async () => {
    const passphrase = await generatePassphrase();
    const agentHash = await hmacHex(PEPPER, normaliseCredential(passphrase));
    await db()
      .insert(users)
      .values([
        {
          email: "gone@x.be",
          role: "admin",
          active: false,
          passphraseHash: agentHash,
          createdAt: 1,
        },
        { email: "nohash@x.be", role: "admin", active: true, createdAt: 1 },
      ]);
    // An agent row holding a hash is not reachable through the routes, but must still be refused.
    await db().update(users).set({ passphraseHash: agentHash }).where(eq(users.email, TEST_AGENT));
    await db().delete(sessions);

    const responses = await Promise.all([
      login({ kind: "passphrase", email: "unknown@x.be", passphrase }),
      login({ kind: "passphrase", email: "nohash@x.be", passphrase }),
      login({ kind: "passphrase", email: "gone@x.be", passphrase }),
      login({ kind: "passphrase", email: TEST_AGENT, passphrase }),
      login({ kind: "passphrase", email: TEST_ADMIN, passphrase: `${passphrase.slice(0, -1)}X` }),
      login({ kind: "passphrase", email: TEST_ADMIN, passphrase: "0".repeat(64) }),
    ]);
    const bodies = await Promise.all(responses.map((r) => r.text()));
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(new Set(bodies).size).toBe(1);
    expect(responses.every((r) => r.headers.get("Set-Cookie") === null)).toBe(true);
    expect(await db().select().from(sessions)).toEqual([]);
  });

  it("stores only the HMAC of the passphrase and never logs it", async () => {
    const calls: unknown[][] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        calls.push(args);
      });
    }
    const passphrase = await generatePassphrase();
    await login({ kind: "passphrase", email: TEST_ADMIN, passphrase: typed(passphrase) });
    await login({ kind: "passphrase", email: TEST_ADMIN, passphrase: "wrong" });

    const [row] = await db().select().from(users).where(eq(users.email, TEST_ADMIN));
    const hash = await hmacHex(PEPPER, passphrase);
    expect(row?.passphraseHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.passphraseHash).toBe(hash);
    expect(JSON.stringify(row)).not.toContain(passphrase);
    const logged = JSON.stringify(calls);
    for (const secret of [passphrase, typed(passphrase), hash]) {
      expect(logged).not.toContain(secret);
    }
  });
});

describe("login throttle (CAP-7)", () => {
  const IP_A = "203.0.113.7";
  const IP_B = "198.51.100.23";
  const VALID = { kind: "passphrase", email: OWNER, passphrase: BREAK_GLASS };
  const WRONG = { kind: "passphrase", email: OWNER, passphrase: "wrong" };
  // One minute into a window, so 14 minutes of it remain.
  const NOW = 1_000 * LOGIN_WINDOW_MS + 60_000;

  function loginFrom(ip: string | null, body: unknown): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ip) headers["CF-Connecting-IP"] = ip;
    return call("/api/auth/login", { method: "POST", headers, body: JSON.stringify(body) });
  }

  async function fail(ip: string | null, times: number): Promise<void> {
    for (let i = 0; i < times; i++) {
      expect((await loginFrom(ip, WRONG)).status).toBe(401);
    }
  }

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  it("refuses the 11th login from one IP with 429 and Retry-After, even a valid one", async () => {
    await fail(IP_A, LOGIN_MAX_FAILURES);

    const response = await loginFrom(IP_A, VALID);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe(String(14 * 60));
    expect(await response.json()).toMatchObject({ error: "too_many_attempts" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await db().select().from(sessions)).toEqual([]);
  });

  it("still lets another IP sign in", async () => {
    await fail(IP_A, LOGIN_MAX_FAILURES);
    expect((await loginFrom(IP_B, VALID)).status).toBe(200);
  });

  it("refuses a locked IP before validating the body", async () => {
    await fail(IP_A, LOGIN_MAX_FAILURES);
    expect((await loginFrom(IP_A, { kind: "nope" })).status).toBe(429);
  });

  it("counts a malformed body as a failure", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      expect((await loginFrom(IP_A, { kind: "nope" })).status).toBe(400);
    }
    expect((await loginFrom(IP_A, VALID)).status).toBe(429);
  });

  it("counts afresh once the window ends", async () => {
    await fail(IP_A, LOGIN_MAX_FAILURES);
    vi.spyOn(Date, "now").mockReturnValue(NOW - 60_000 + LOGIN_WINDOW_MS);
    expect((await loginFrom(IP_A, VALID)).status).toBe(200);
  });

  it("puts requests without CF-Connecting-IP in one shared bucket", async () => {
    await fail(null, LOGIN_MAX_FAILURES);
    expect((await loginFrom(null, VALID)).status).toBe(429);
    expect((await loginFrom(IP_A, VALID)).status).toBe(200);
  });

  it("counts the 401 a Worker without OWNER_EMAIL answers", async () => {
    env.OWNER_EMAIL = undefined;
    await fail(IP_A, LOGIN_MAX_FAILURES);
    expect((await loginFrom(IP_A, VALID)).status).toBe(429);
  });

  it("counts a refused generated passphrase", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      const body = { kind: "passphrase", email: TEST_ADMIN, passphrase: "ZZZZ-ZZZZ" };
      expect((await loginFrom(IP_A, body)).status).toBe(401);
    }
    expect((await loginFrom(IP_A, VALID)).status).toBe(429);
  });

  it("counts a refused code like a refused passphrase", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      expect((await loginFrom(IP_A, { kind: "code", code: "ZZZZZZZZ" })).status).toBe(401);
    }
    expect((await loginFrom(IP_A, VALID)).status).toBe(429);
  });

  it("does not reset the count on a success", async () => {
    await fail(IP_A, 5);
    expect((await loginFrom(IP_A, VALID)).status).toBe(200);
    expect(await db().select({ failures: loginAttempts.failures }).from(loginAttempts)).toEqual([
      { failures: 5 },
    ]);
  });

  it("stores the IP only as its HMAC", async () => {
    await fail(IP_A, 1);
    await fail(null, 1);
    const rows = await db().select().from(loginAttempts);
    expect(rows.map((r) => r.ipHash).sort()).toEqual(
      [await hmacHex(PEPPER, IP_A), await hmacHex(PEPPER, "unknown")].sort(),
    );
    expect(JSON.stringify(rows)).not.toContain(IP_A);
    expect(rows.every((r) => r.windowStart === NOW - 60_000)).toBe(true);
  });

  it("steps aside without AUTH_PEPPER, so the route still answers 500", async () => {
    env.AUTH_PEPPER = undefined;
    expect((await loginFrom(IP_A, VALID)).status).toBe(500);
    expect(await db().select().from(loginAttempts)).toEqual([]);
  });

  it("lets at most 10 of a parallel burst reach the credential", async () => {
    const responses = await Promise.all(
      Array.from({ length: 2 * LOGIN_MAX_FAILURES }, () => loginFrom(IP_A, WRONG)),
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(LOGIN_MAX_FAILURES);
    expect(statuses.filter((s) => s === 429)).toHaveLength(LOGIN_MAX_FAILURES);
  });

  it("does not count the 429s a locked IP keeps getting", async () => {
    await fail(IP_A, LOGIN_MAX_FAILURES);
    await loginFrom(IP_A, WRONG);
    await loginFrom(IP_A, VALID);
    expect(await db().select({ failures: loginAttempts.failures }).from(loginAttempts)).toEqual([
      { failures: LOGIN_MAX_FAILURES },
    ]);
  });

  it("counts every address of one IPv6 /64 in one bucket", async () => {
    for (let i = 1; i <= LOGIN_MAX_FAILURES; i++) {
      expect((await loginFrom(`2001:db8:1:2::${i.toString(16)}`, WRONG)).status).toBe(401);
    }
    expect((await loginFrom("2001:0db8:0001:0002:ffff:0:0:1", VALID)).status).toBe(429);
    expect((await loginFrom("2001:db8:1:3::1", VALID)).status).toBe(200);
  });

  it("logs neither the IP nor the credential", async () => {
    const calls: unknown[][] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        calls.push(args);
      });
    }
    await fail(IP_A, LOGIN_MAX_FAILURES);
    await loginFrom(IP_A, VALID);
    await loginFrom(IP_B, VALID);

    const logged = JSON.stringify(calls);
    for (const secret of [IP_A, IP_B, BREAK_GLASS, await hmacHex(PEPPER, IP_A)]) {
      expect(logged).not.toContain(secret);
    }
  });
});

describe("throttleKey", () => {
  it("keeps an IPv4 address whole and maps an IPv4-mapped IPv6 address to it", () => {
    expect(throttleKey("203.0.113.7")).toBe("203.0.113.7");
    expect(throttleKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("cuts IPv6 to its /64, however it is written", () => {
    const key = "2001:db8:1:2::/64";
    expect(throttleKey("2001:db8:1:2::a")).toBe(key);
    expect(throttleKey("2001:0DB8:0001:0002:ffff:0:0:1")).toBe(key);
    expect(throttleKey("2001:db8:1:2:3:4:5:6")).toBe(key);
    expect(throttleKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(throttleKey("::1")).toBe("0:0:0:0::/64");
  });

  it("puts a missing address in the unknown bucket", () => {
    expect(throttleKey(undefined)).toBe("unknown");
  });
});

describe("requireIdentity — DEV_USER_EMAIL on a local host (GH #300)", () => {
  const LOCAL = "http://localhost";

  it("takes the seeded admin's role from users", async () => {
    env.DEV_USER_EMAIL = TEST_ADMIN;
    const response = await me(undefined, LOCAL);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: TEST_ADMIN, role: "admin" });
  });

  it("takes the seeded agent's role from users, and admin routes answer 403", async () => {
    env.DEV_USER_EMAIL = TEST_AGENT;
    const response = await me(undefined, LOCAL);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: TEST_AGENT, role: "agent" });
    expect((await call("/api/admin/prospects", undefined, LOCAL)).status).toBe(403);
  });

  it("lowercases DEV_USER_EMAIL before the lookup", async () => {
    env.DEV_USER_EMAIL = "Agent@Example.COM";
    expect(await (await me(undefined, LOCAL)).json()).toEqual({ email: TEST_AGENT, role: "agent" });
  });

  it("takes the role from the row, not from ADMIN_EMAILS", async () => {
    // vitest.config.ts lists admin@example.com in ADMIN_EMAILS.
    await db().update(users).set({ role: "agent" }).where(eq(users.email, TEST_ADMIN));
    env.DEV_USER_EMAIL = TEST_ADMIN;
    expect(await (await me(undefined, LOCAL)).json()).toEqual({ email: TEST_ADMIN, role: "agent" });
  });

  it.each(["http://127.0.0.1", "http://[::1]"])(
    "honours it on %s as on localhost",
    async (host) => {
      env.DEV_USER_EMAIL = TEST_AGENT;
      const response = await me(undefined, host);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ email: TEST_AGENT, role: "agent" });
    },
  );

  it("answers 401 to an email with no users row", async () => {
    env.DEV_USER_EMAIL = "nobody@example.com";
    const response = await me(undefined, LOCAL);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthorized" });
  });

  it("answers 401 to an inactive row", async () => {
    await db().update(users).set({ active: false }).where(eq(users.email, TEST_AGENT));
    env.DEV_USER_EMAIL = TEST_AGENT;
    expect((await me(undefined, LOCAL)).status).toBe(401);
  });

  it("does not fall through to a valid Access JWT when the row is missing", async () => {
    const access = await fakeAccess();
    configureAccess(access);
    env.DEV_USER_EMAIL = "nobody@example.com";
    const jwt = await access.sign(TEST_AGENT);
    expect((await me({ "Cf-Access-Jwt-Assertion": jwt }, LOCAL)).status).toBe(401);
  });

  it("is ignored off a local host", async () => {
    env.DEV_USER_EMAIL = TEST_ADMIN;
    expect((await me()).status).toBe(401);
  });
});
