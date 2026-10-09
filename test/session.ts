import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { getDb } from "../src/worker/db/client";
import { sessions, users } from "../src/worker/db/schema";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  hmacHex,
  newSessionId,
  newSessionToken,
} from "../src/worker/session";

/**
 * Signs a test in through a real D1 session rather than DEV_USER_EMAIL: inserts
 * a `sessions` row for an existing user and returns the `Cookie` header value
 * and the session's public id. The lifetime is the user's role's unless
 * `expiresAt` says otherwise; `lastSeenAt` defaults to now, so no slide.
 */
export async function testSession(
  email: string,
  opts: {
    expiresAt?: number;
    lastSeenAt?: number;
    createdAt?: number;
    deviceLabel?: string | null;
    /** null writes a row as the Worker before GH #307 did. */
    id?: string | null;
  } = {},
): Promise<{ cookie: string; id: string | null; tokenHash: string }> {
  const pepper = env.AUTH_PEPPER;
  if (!pepper) throw new Error("testSession needs AUTH_PEPPER (vitest.config.ts)");
  // users.email is stored lowercased.
  const userEmail = email.toLowerCase();
  const db = getDb(env.DB);
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, userEmail))
    .limit(1);
  if (!user) throw new Error(`testSession: no users row for ${email}`);

  const token = newSessionToken();
  const tokenHash = await hmacHex(pepper, token);
  const now = Date.now();
  const id = opts.id === undefined ? newSessionId() : opts.id;
  await db.insert(sessions).values({
    tokenHash,
    userEmail,
    createdAt: opts.createdAt ?? now,
    lastSeenAt: opts.lastSeenAt ?? now,
    expiresAt: opts.expiresAt ?? now + SESSION_TTL_MS[user.role],
    id,
    deviceLabel: opts.deviceLabel ?? null,
  });
  return { cookie: `${SESSION_COOKIE}=${token}`, id, tokenHash };
}

/** testSession's `Cookie` header value alone, for the many tests that need nothing else. */
export async function testSessionCookie(
  email: string,
  opts: { expiresAt?: number } = {},
): Promise<string> {
  return (await testSession(email, opts)).cookie;
}
