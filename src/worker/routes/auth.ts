/**
 * Sign in and sign out (ADR-0029, ADR-0038). Mounted before the identity gate:
 * these are the routes a caller with no identity must reach.
 *
 * A kind names the form, and each form serves one role. `code` is the agent
 * form: an active agent's one-time code. `admin` is the admin form: break-glass
 * first (`OWNER_EMAIL` plus `BREAK_GLASS`, as typed), otherwise an active
 * admin's code whose user is the email typed. The role check sits in the
 * UPDATE that spends the code, so a code typed on the wrong form stays unspent.
 * Nothing here logs — not the code, not the token, not a hash, not the
 * User-Agent (docs/security.md). A session stores only the device label parsed
 * from it (GH #307).
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
import { deviceLabel } from "../device-label";
import { loginThrottle } from "../login-throttle";
import { loginCodes, sessions, users } from "../db/schema";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearedSessionCookie,
  hmacBytes,
  hmacHex,
  newSessionId,
  newSessionToken,
  readCookie,
  sessionCookie,
} from "../session";
import type { AppEnv } from "../types";
import { validate } from "../validate";

export const authRoutes = new Hono<AppEnv>();

/** Wrong, expired, used, superseded, deactivated or on the wrong form all read the same. */
const REFUSED = "This code does not work.";

/** A fresh session token and the hash that is stored in its place. */
async function newToken(pepper: string) {
  const token = newSessionToken();
  return { token, tokenHash: await hmacHex(pepper, token) };
}

/** A new session's row and the token its cookie carries; the TTL is the role's. */
async function newSession(
  pepper: string,
  email: string,
  role: Role,
  now: number,
  label: string | null,
) {
  const { token, tokenHash } = await newToken(pepper);
  const ttl = SESSION_TTL_MS[role];
  const row = {
    tokenHash,
    userEmail: email,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + ttl,
    id: newSessionId(),
    deviceLabel: label,
  };
  return { row, cookie: sessionCookie(token, ttl) };
}

authRoutes.post("/login", loginThrottle, validate("json", loginRequestSchema), async (c) => {
  const pepper = c.env.AUTH_PEPPER;
  if (!pepper) throw misconfigured();

  const body = c.req.valid("json");
  const db = getDb(c.env.DB);
  const label = deviceLabel(c.req.header("User-Agent"));

  if (body.kind === "admin") {
    const owner = c.env.OWNER_EMAIL?.trim().toLowerCase();
    const breakGlass = c.env.BREAK_GLASS;
    if (owner && breakGlass) {
      // Both sides are HMAC digests, so the lengths always match and the
      // comparison leaks neither the secret's length nor where it differs.
      const [typed, expected] = await Promise.all([
        hmacBytes(pepper, body.code),
        hmacBytes(pepper, breakGlass),
      ]);
      const secretOk = crypto.subtle.timingSafeEqual(typed, expected);
      if (secretOk && body.email === owner) {
        const now = Date.now();
        const role = "admin" as const;
        const session = await newSession(pepper, owner, role, now, label);

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
      }
    }
  }

  // One conditional UPDATE spends the code: of two logins racing on it, only
  // one gets a row back. The role (and, on the admin form, the email) is part
  // of its WHERE, so a code typed on the wrong form is refused unspent. The
  // session is inserted in the same batch, so the two land or fail together:
  // no spent code without its session, and no session slipping in after a
  // deactivation. `changes() = 1` keeps a loser that ran in the same
  // millisecond from matching the winner's used_at. The SELECT is positional,
  // so its columns follow the schema's order.
  const role: Role = body.kind === "admin" ? "admin" : "agent";
  const email = body.kind === "admin" ? body.email : null;
  const now = Date.now();
  const codeHash = await hmacHex(pepper, normaliseCredential(body.code));
  const { token, tokenHash } = await newToken(pepper);
  const [spentRows] = await db.batch([
    db
      .update(loginCodes)
      .set({ usedAt: now })
      .where(
        and(
          eq(loginCodes.codeHash, codeHash),
          isNull(loginCodes.usedAt),
          gt(loginCodes.expiresAt, now),
          email ? eq(loginCodes.userEmail, email) : undefined,
          sql`EXISTS (SELECT 1 FROM ${users} WHERE ${users.email} = ${loginCodes.userEmail} AND ${users.active} = 1 AND ${users.role} = ${role})`,
        ),
      )
      .returning({ email: loginCodes.userEmail }),
    db.insert(sessions).select(
      sql`SELECT ${tokenHash}, ${loginCodes.userEmail}, ${now}, ${now}, ${now + SESSION_TTL_MS[role]},
          ${newSessionId()}, ${label}
          FROM ${loginCodes} JOIN ${users} ON ${users.email} = ${loginCodes.userEmail}
          WHERE ${loginCodes.codeHash} = ${codeHash} AND ${loginCodes.usedAt} = ${now}
            AND ${users.active} = 1 AND ${users.role} = ${role} AND changes() = 1`,
    ),
  ]);
  const [spent] = spentRows;
  if (!spent) throw unauthorized(REFUSED);

  c.header("Set-Cookie", sessionCookie(token, SESSION_TTL_MS[role]));
  return c.json<MeResponse>({ email: spent.email, role });
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
