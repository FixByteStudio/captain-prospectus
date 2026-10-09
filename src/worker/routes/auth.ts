/**
 * Sign in and sign out (ADR-0029). Mounted before the identity gate: these are
 * the routes a caller with no identity must reach.
 *
 * Two kinds so far. `passphrase` is break-glass first: `OWNER_EMAIL` plus
 * `BREAK_GLASS` opens an admin session. Otherwise it is an active admin's
 * generated passphrase, checked against `users.passphrase_hash`. `code` spends
 * a one-time code an admin generated (identity-access.md) and opens a session
 * with the user's own role.
 * Nothing here logs — not the passphrase, not the code, not the token, not a
 * hash, not the User-Agent (docs/security.md). A session stores only the
 * device label parsed from it (GH #307).
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

/** One body for every refusal, so it never tells which part was wrong. */
const REFUSED = "Wrong email or passphrase.";
/** Stands in for a missing hash, so a refusal compares as long as a match. */
const DUMMY_HASH = "0".repeat(64);
/** Wrong, expired, used, superseded or deactivated all read the same. */
const CODE_REFUSED = "This code does not work.";

/** A new session's row and the token its cookie carries; the TTL is the role's. */
async function newSession(
  pepper: string,
  email: string,
  role: Role,
  now: number,
  label: string | null,
) {
  const token = newSessionToken();
  const ttl = SESSION_TTL_MS[role];
  const row = {
    tokenHash: await hmacHex(pepper, token),
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
    // The SELECT is positional, so its columns follow the schema's order.
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
            ${now} + CASE ${users.role} WHEN 'admin' THEN ${SESSION_TTL_MS.admin} ELSE ${SESSION_TTL_MS.agent} END,
            ${newSessionId()}, ${label}
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
  if (owner && breakGlass) {
    // Both sides are HMAC digests, so the lengths always match and the
    // comparison leaks neither the secret's length nor where it differs.
    const [typed, expected] = await Promise.all([
      hmacBytes(pepper, body.passphrase),
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

  // An admin's generated passphrase (identity-access.md). Every refusal does the
  // same work — one HMAC, one read by key, one constant-time compare against
  // the stored hash or a dummy — so neither the body nor the timing tells an
  // unknown email from a wrong passphrase.
  const typedHash = await hmacHex(pepper, normaliseCredential(body.passphrase));
  const [user] = await db
    .select({ role: users.role, active: users.active, passphraseHash: users.passphraseHash })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);
  const stored = user?.passphraseHash;
  const hasHash = stored != null && stored.length === DUMMY_HASH.length;
  const encoder = new TextEncoder();
  const hashOk = crypto.subtle.timingSafeEqual(
    encoder.encode(typedHash),
    encoder.encode(hasHash ? stored : DUMMY_HASH),
  );
  if (!hashOk || !hasHash || !user?.active || user.role !== "admin") {
    throw unauthorized(REFUSED);
  }

  // The insert re-reads the row as it is when it runs, so a demotion,
  // deactivation or regeneration that lands first opens no session. The SELECT
  // is positional, so its columns follow the schema's order.
  const now = Date.now();
  const token = newSessionToken();
  const tokenHash = await hmacHex(pepper, token);
  const inserted = await db
    .insert(sessions)
    .select(
      sql`SELECT ${tokenHash}, ${users.email}, ${now}, ${now}, ${now + SESSION_TTL_MS.admin},
          ${newSessionId()}, ${label}
          FROM ${users}
          WHERE ${users.email} = ${body.email} AND ${users.role} = 'admin'
            AND ${users.active} = 1 AND ${users.passphraseHash} = ${typedHash}`,
    )
    .returning({ email: sessions.userEmail });
  if (inserted.length === 0) throw unauthorized(REFUSED);

  c.header("Set-Cookie", sessionCookie(token, SESSION_TTL_MS.admin));
  return c.json<MeResponse>({ email: body.email, role: "admin" });
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
