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
 * Nothing else: a request carrying a Cloudflare Access JWT and no session is a
 * 401 (ADR-0034).
 *
 * INVARIANT 10: identity comes from the server only, never a client header.
 */
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { and, eq, gt, lte } from "drizzle-orm";
import type { Role } from "../shared/constants";
import { getDb, type Db } from "./db/client";
import { sessions, users } from "./db/schema";
import {
  SESSION_COOKIE,
  SESSION_SLIDE_MS,
  SESSION_TTL_MS,
  hmacHex,
  readCookie,
  sessionCookie,
} from "./session";
import type { AppEnv, Bindings, Identity } from "./types";

export type { Identity, AppEnv } from "./types";

/**
 * Exported so the dev routes gate on the same list. Two copies of it, in a repo
 * whose threat model has a row named "Dev impersonation leaking to prod", is
 * exactly the drift that row is about.
 */
export function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * The roster: active **agents**, ordered by email (ADR-0029, ADR-0037). Who may
 * be assigned, walk a round or appear on the dashboard; not who may sign in.
 */
export async function activeRoster(db: Db): Promise<{ email: string; role: Role }[]> {
  return db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.active, true), eq(users.role, "agent")))
    .orderBy(users.email);
}

/** The active agent row for one email, or undefined: the same definition of "on the roster". */
export async function activeRosterMember(
  db: Db,
  email: string,
): Promise<{ email: string; role: Role } | undefined> {
  const [row] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(
      and(eq(users.email, email.toLowerCase()), eq(users.active, true), eq(users.role, "agent")),
    )
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
 * A session's caller: who, the session's public id, and the refreshed cookie
 * when this request slid the session.
 */
export type SessionCaller = { identity: Identity; sessionId: string; cookie: string | null };

/**
 * The session cookie's caller, or null: no cookie, no pepper, an unknown or
 * expired token, or a deactivated user. The role is the `users` row's, never
 * the cookie's. Without AUTH_PEPPER no token can be hashed, so the lookup is
 * skipped rather than guessed.
 *
 * Within SESSION_SLIDE_MS of the last slide nothing is written. Past it, one
 * conditional UPDATE slides the session; of two requests racing on it only
 * the one that gets a row back re-sends the cookie. The TTL is the role's, which
 * is fixed at creation (ADR-0037).
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
  if (now - row.lastSeenAt < SESSION_SLIDE_MS) {
    return { identity, sessionId: row.id, cookie: null };
  }

  const ttl = SESSION_TTL_MS[row.role];
  const [slid] = await db
    .update(sessions)
    .set({ lastSeenAt: now, expiresAt: now + ttl })
    .where(and(eq(sessions.tokenHash, tokenHash), lte(sessions.lastSeenAt, now - SESSION_SLIDE_MS)))
    .returning({ id: sessions.id });
  if (!slid) return { identity, sessionId: row.id, cookie: null };
  return { identity, sessionId: slid.id, cookie: sessionCookie(token, ttl) };
}

/** DEV_USER_EMAIL's `users` row, or null when it has none or is inactive. */
async function identityFromDevUser(env: Bindings, devUserEmail: string): Promise<Identity | null> {
  // Any active user, admin included: only the roster narrows to agents.
  const [row] = await getDb(env.DB)
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, devUserEmail.trim().toLowerCase()), eq(users.active, true)))
    .limit(1);
  return row ?? null;
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
    c.set("sessionId", session.sessionId);
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
    // No row, or a deactivated one, is a deactivated user: 401.
    if (!dev) {
      throw unauthorized(
        "DEV_USER_EMAIL has no active users row. Set it to admin@example.com or agent@example.com after pnpm db:seed:local.",
      );
    }
    c.set("identity", dev);
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

/** Field routes (ADR-0037): an admin does no tournée. Runs after requireIdentity. */
export const requireAgent = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("identity").role !== "agent") {
    throw new HTTPException(403, {
      res: Response.json(
        { error: "forbidden", message: "This page is for agents." },
        { status: 403 },
      ),
    });
  }
  return next();
});
