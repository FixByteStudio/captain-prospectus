/**
 * Sign in and sign out (ADR-0029). Mounted before the identity gate: these are
 * the routes a caller with no identity must reach.
 *
 * Two kinds so far. `passphrase` is break-glass: `OWNER_EMAIL` plus
 * `BREAK_GLASS` opens an admin session. `code` spends a one-time code an admin
 * generated (identity-access.md) and opens a session with the user's own role.
 * Nothing here logs — not the passphrase, not the code, not the token, not a
 * hash (docs/security.md).
 *
 * Every login goes through loginThrottle first (CAP-7), so later login kinds
 * share its per-IP counter.
 */
import { Hono } from "hono";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Role } from "../../shared/constants";
import { normaliseCredential } from "../../shared/credential";
import { loginRequestSchema, type MeResponse } from "../../shared/schemas";
import { misconfigured, unauthorized } from "../auth";
import { getDb } from "../db/client";
import { loginThrottle } from "../login-throttle";
import { loginCodes, sessions, users } from "../db/schema";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearedSessionCookie,
  hmacBytes,
  hmacHex,
  newSessionToken,
  readCookie,
  sessionCookie,
} from "../session";
import type { AppEnv } from "../types";
import { validate } from "../validate";

export const authRoutes = new Hono<AppEnv>();

/** One body for every refusal, so it never tells which part was wrong. */
const REFUSED = "Wrong email or passphrase.";
/** Wrong, expired, used, superseded or deactivated all read the same. */
const CODE_REFUSED = "This code does not work.";

/** A new session's row and the token its cookie carries; the TTL is the role's. */
async function newSession(pepper: string, email: string, role: Role, now: number) {
  const token = newSessionToken();
  const ttl = SESSION_TTL_MS[role];
  const row = {
    tokenHash: await hmacHex(pepper, token),
    userEmail: email,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + ttl,
  };
  return { row, cookie: sessionCookie(token, ttl) };
}

authRoutes.post("/login", loginThrottle, validate("json", loginRequestSchema), async (c) => {
  const pepper = c.env.AUTH_PEPPER;
  if (!pepper) throw misconfigured();

  const body = c.req.valid("json");
  const db = getDb(c.env.DB);

  if (body.kind === "code") {
    const now = Date.now();
    const codeHash = await hmacHex(pepper, normaliseCredential(body.code));
    const token = newSessionToken();
    const tokenHash = await hmacHex(pepper, token);
    // One conditional UPDATE spends the code: of two logins racing on it, only
    // one gets a row back. The session is inserted in the same batch, so the
    // two land or fail together: no spent code without its session, and no
    // session slipping in after a deactivation. `changes() = 1` keeps a loser
    // that ran in the same millisecond from matching the winner's used_at.
    const [spentRows] = await db.batch([
      db
        .update(loginCodes)
        .set({ usedAt: now })
        .where(
          and(
            eq(loginCodes.codeHash, codeHash),
            isNull(loginCodes.usedAt),
            gt(loginCodes.expiresAt, now),
            sql`EXISTS (SELECT 1 FROM ${users} WHERE ${users.email} = ${loginCodes.userEmail} AND ${users.active} = 1)`,
          ),
        )
        .returning({
          email: loginCodes.userEmail,
          role: sql<Role>`(SELECT ${users.role} FROM ${users} WHERE ${users.email} = ${loginCodes.userEmail})`,
        }),
      db.insert(sessions).select(
        sql`SELECT ${tokenHash}, ${loginCodes.userEmail}, ${now}, ${now},
            ${now} + CASE ${users.role} WHEN 'admin' THEN ${SESSION_TTL_MS.admin} ELSE ${SESSION_TTL_MS.agent} END
            FROM ${loginCodes} JOIN ${users} ON ${users.email} = ${loginCodes.userEmail}
            WHERE ${loginCodes.codeHash} = ${codeHash} AND ${loginCodes.usedAt} = ${now}
              AND ${users.active} = 1 AND changes() = 1`,
      ),
    ]);
    const [spent] = spentRows;
    if (!spent) throw unauthorized(CODE_REFUSED);

    c.header("Set-Cookie", sessionCookie(token, SESSION_TTL_MS[spent.role]));
    return c.json<MeResponse>({ email: spent.email, role: spent.role });
  }

  const owner = c.env.OWNER_EMAIL?.trim().toLowerCase();
  const breakGlass = c.env.BREAK_GLASS;
  if (!owner || !breakGlass) throw unauthorized(REFUSED);

  // Both sides are HMAC digests, so the lengths always match and the
  // comparison leaks neither the secret's length nor where it differs.
  const [typed, expected] = await Promise.all([
    hmacBytes(pepper, body.passphrase),
    hmacBytes(pepper, breakGlass),
  ]);
  const secretOk = crypto.subtle.timingSafeEqual(typed, expected);
  if (!secretOk || body.email !== owner) throw unauthorized(REFUSED);

  const now = Date.now();
  const role = "admin" as const;
  const session = await newSession(pepper, owner, role, now);

  // Break-glass creates the owner, or puts a deactivated or demoted owner back
  // as an active admin (ADR-0029 decision 7). One batch, so a session never
  // exists for a user row that was not written.
  await db.batch([
    db
      .insert(users)
      .values({ email: owner, role, active: true, createdAt: now })
      .onConflictDoUpdate({ target: users.email, set: { role, active: true } }),
    db.insert(sessions).values(session.row),
  ]);

  c.header("Set-Cookie", session.cookie);
  return c.json<MeResponse>({ email: owner, role });
});

/** Ends this device's session, if it has one. Always 204, always clears the cookie. */
authRoutes.post("/logout", async (c) => {
  const token = readCookie(c.req.header("Cookie"), SESSION_COOKIE);
  const pepper = c.env.AUTH_PEPPER;
  if (token && pepper) {
    await getDb(c.env.DB)
      .delete(sessions)
      .where(eq(sessions.tokenHash, await hmacHex(pepper, token)));
  }
  c.header("Set-Cookie", clearedSessionCookie());
  return c.body(null, 204);
});
