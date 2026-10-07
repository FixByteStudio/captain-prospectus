/**
 * Sign in and sign out (ADR-0029). Mounted before the identity gate: these are
 * the routes a caller with no identity must reach.
 *
 * Only break-glass exists so far: `OWNER_EMAIL` plus `BREAK_GLASS` in the
 * passphrase form opens an admin session. Nothing here logs — not the
 * passphrase, not the token, not a hash (docs/security.md).
 *
 * Every login goes through loginThrottle first (CAP-7), so later login kinds
 * share its per-IP counter.
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { loginRequestSchema, type MeResponse } from "../../shared/schemas";
import { misconfigured, unauthorized } from "../auth";
import { getDb } from "../db/client";
import { loginThrottle } from "../login-throttle";
import { sessions, users } from "../db/schema";
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

authRoutes.post("/login", loginThrottle, validate("json", loginRequestSchema), async (c) => {
  const pepper = c.env.AUTH_PEPPER;
  if (!pepper) throw misconfigured();

  const body = c.req.valid("json");
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
  const ttl = SESSION_TTL_MS[role];
  const token = newSessionToken();
  const db = getDb(c.env.DB);

  // Break-glass creates the owner, or puts a deactivated or demoted owner back
  // as an active admin (ADR-0029 decision 7). One batch, so a session never
  // exists for a user row that was not written.
  await db.batch([
    db
      .insert(users)
      .values({ email: owner, role, active: true, createdAt: now })
      .onConflictDoUpdate({ target: users.email, set: { role, active: true } }),
    db.insert(sessions).values({
      tokenHash: await hmacHex(pepper, token),
      userEmail: owner,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + ttl,
    }),
  ]);

  c.header("Set-Cookie", sessionCookie(token, ttl));
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
