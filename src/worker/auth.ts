/**
 * Who is calling — docs/domains/identity-access.md.
 *
 * Session first (ADR-0029): a `__Host-` cookie whose token's HMAC is a live
 * `sessions` row of an active user. The session slides: a request at least
 * SESSION_SLIDE_MS after `last_seen_at` pushes `expires_at` to now + its role's
 * TTL and re-sends the cookie, so a device in use never expires (GH #307).
 * Then, on a local host only (localhost,
 * 127.0.0.1, [::1]), DEV_USER_EMAIL, whose role is its active `users` row's;
 * without one the caller gets a 401.
 * Then, until the cutover's phase 3, the Cloudflare Access JWT (ADR-0006) —
 * isolated in `identityFromAccess` so removing it is deleting one function.
 *
 * INVARIANT 10: identity comes from the server only. The
 * Cf-Access-Authenticated-User-Email header is never trusted as proof: it is
 * spoofable if the Worker is ever reachable without Access in front of it.
 *
 * `ctx.access` is deliberately NOT used. A Worker serving Static Assets runs
 * behind an internal router Worker that does not forward it, so it would always
 * be undefined here. See ADR-0006.
 */
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Role } from "../shared/constants";
import { getDb, type Db } from "./db/client";
import { sessions, users } from "./db/schema";
import {
  SESSION_COOKIE,
  SESSION_SLIDE_MS,
  SESSION_TTL_MS,
  hmacHex,
  newSessionId,
  readCookie,
  sessionCookie,
} from "./session";
import type { AppEnv, Bindings, Identity } from "./types";

export type { Identity, AppEnv } from "./types";

const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
const ACCESS_COOKIE = "CF_Authorization";

/**
 * JWKS is cached in module scope and so lives for the isolate's lifetime.
 * INVARIANT 13: Workers Free allows 10 ms CPU per request; refetching and
 * reparsing the key set on every request would spend a chunk of that budget
 * (and a subrequest) for nothing. jose refreshes the keys itself when it sees
 * an unknown `kid`.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Exported so the dev routes gate on the same list. Two copies of it, in a repo
 * whose threat model has a row named "Dev impersonation leaking to prod", is
 * exactly the drift that row is about.
 */
export function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function roleFor(email: string, adminEmails: string | undefined): Role {
  return parseEmails(adminEmails).includes(email.toLowerCase()) ? "admin" : "agent";
}

/** Comma-separated env list to lowercased emails. Empty entries are dropped. */
export function parseEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The roster: active `users` rows, ordered by email (ADR-0029). Who may be
 * assigned, walk a round or appear on the dashboard; not who may sign in.
 */
export async function activeRoster(db: Db): Promise<{ email: string; role: Role }[]> {
  return db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(users.email);
}

/** The active row for one email, or undefined: the same definition of "on the roster". */
export async function activeRosterMember(
  db: Db,
  email: string,
): Promise<{ email: string; role: Role } | undefined> {
  const [row] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), eq(users.active, true)))
    .limit(1);
  return row;
}

export function unauthorized(message: string): HTTPException {
  return new HTTPException(401, {
    res: Response.json({ error: "unauthorized", message }, { status: 401 }),
  });
}

/** A missing AUTH_PEPPER must fail closed, never fall through to open access. */
export function misconfigured(): HTTPException {
  return new HTTPException(500, {
    res: Response.json(
      { error: "misconfigured", message: "Sign-in is not configured on this Worker." },
      { status: 500 },
    ),
  });
}

/**
 * A session's caller: who, the session's public id (null only in the rare race
 * where a row written by the previous Worker is still waiting for one), and the
 * refreshed cookie when this request slid the session.
 */
export type SessionCaller = { identity: Identity; sessionId: string | null; cookie: string | null };

/**
 * The session cookie's caller, or null: no cookie, no pepper, an unknown or
 * expired token, or a deactivated user. The role is the `users` row's, never
 * the cookie's. Without AUTH_PEPPER no token can be hashed, so the lookup is
 * skipped rather than guessed.
 *
 * Within SESSION_SLIDE_MS of the last slide nothing is written. Past it, one
 * conditional UPDATE slides the session and gives a pre-#307 row its id; of
 * two requests racing on it only the one that gets a row back re-sends the
 * cookie. The TTL is the role's now, so a demoted admin slides to an agent's.
 */
export async function identityFromSession(
  env: Bindings,
  req: Request,
): Promise<SessionCaller | null> {
  const token = readCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  if (!token || !env.AUTH_PEPPER) return null;

  const tokenHash = await hmacHex(env.AUTH_PEPPER, token);
  const db = getDb(env.DB);
  const now = Date.now();
  const [row] = await db
    .select({
      email: users.email,
      role: users.role,
      id: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.email, sessions.userEmail))
    .where(
      and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now), eq(users.active, true)),
    )
    .limit(1);
  if (!row) return null;

  const identity: Identity = { email: row.email, role: row.role };
  if (row.id !== null && now - row.lastSeenAt < SESSION_SLIDE_MS) {
    return { identity, sessionId: row.id, cookie: null };
  }

  const ttl = SESSION_TTL_MS[row.role];
  const [slid] = await db
    .update(sessions)
    .set({
      lastSeenAt: now,
      expiresAt: now + ttl,
      id: sql`coalesce(${sessions.id}, ${newSessionId()})`,
    })
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        or(lte(sessions.lastSeenAt, now - SESSION_SLIDE_MS), isNull(sessions.id)),
      ),
    )
    .returning({ id: sessions.id });
  if (!slid) return { identity, sessionId: row.id, cookie: null };
  return { identity, sessionId: slid.id, cookie: sessionCookie(token, ttl) };
}

/** DEV_USER_EMAIL's `users` row, or null when it has none or is inactive. */
async function identityFromDevUser(env: Bindings, devUserEmail: string): Promise<Identity | null> {
  return (await activeRosterMember(getDb(env.DB), devUserEmail.trim())) ?? null;
}

function readAccessToken(req: Request): string | null {
  // Browsers navigating the SPA send the Access session as a cookie.
  return req.headers.get(ACCESS_JWT_HEADER) || readCookie(req.headers.get("Cookie"), ACCESS_COOKIE);
}

/**
 * The Cloudflare Access fallback, ADR-0029 phase 1 and 2 only: null when Access
 * is not configured, a 401 when it is and the JWT is missing, invalid or its
 * email's `users` row is inactive; an active row's role wins over ADMIN_EMAILS.
 * Phase 3 deletes this function, `jose` and the Access vars.
 */
async function identityFromAccess(env: Bindings, req: Request): Promise<Identity | null> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!teamDomain || !aud) return null;

  const token = readAccessToken(req);
  if (!token) throw unauthorized("Sign in again to continue.");

  let email: string;
  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience: aud,
    });
    const claim = payload.email;
    if (typeof claim !== "string" || !claim) throw new Error("no email claim");
    email = claim.toLowerCase();
  } catch {
    throw unauthorized("Your session has expired. Sign in again to sync.");
  }
  // A `users` row outranks the vars: inactive is refused, active decides the
  // role. ADMIN_EMAILS decides only for an email with no row.
  const [row] = await getDb(env.DB)
    .select({ role: users.role, active: users.active })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!row) return { email, role: roleFor(email, env.ADMIN_EMAILS) };
  if (!row.active) throw unauthorized("This account is deactivated. Ask an admin.");
  return { email, role: row.role };
}

/**
 * Puts the caller's identity (and, for a session, its id) on the context, or
 * answers 401. A slid session's cookie is appended after `next()`, so it rides
 * on whatever the handler answered, an HTTPException's response included.
 */
export const requireIdentity = createMiddleware<AppEnv>(async (c, next) => {
  const session = await identityFromSession(c.env, c.req.raw);
  if (session) {
    c.set("identity", session.identity);
    if (session.sessionId) c.set("sessionId", session.sessionId);
    await next();
    if (session.cookie) c.header("Set-Cookie", session.cookie, { append: true });
    return;
  }

  // Local development only. Honoured solely on a local host (localhost,
  // 127.0.0.1, [::1], as isLocalHost decides), so a production request can
  // never reach this branch even if the variable were set. After the session,
  // so a developer signed in through /login is who it says.
  const url = new URL(c.req.url);
  if (isLocalHost(url.hostname) && c.env.DEV_USER_EMAIL) {
    const dev = await identityFromDevUser(c.env, c.env.DEV_USER_EMAIL);
    // No row, or a deactivated one, is a deactivated user: 401, not Access.
    if (!dev) {
      throw unauthorized(
        "DEV_USER_EMAIL has no active users row. Set it to admin@example.com or agent@example.com after pnpm db:seed:local.",
      );
    }
    c.set("identity", dev);
    return next();
  }

  const access = await identityFromAccess(c.env, c.req.raw);
  if (access) {
    c.set("identity", access);
    return next();
  }

  throw unauthorized("Sign in to continue.");
});

/** Admin-only routes. Runs after requireIdentity. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("identity").role !== "admin") {
    throw new HTTPException(403, {
      res: Response.json(
        { error: "forbidden", message: "This page is for admins." },
        { status: 403 },
      ),
    });
  }
  return next();
});
