import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { getDb } from "../src/worker/db/client";
import { sessions, users } from "../src/worker/db/schema";
import { SESSION_COOKIE, SESSION_TTL_MS, hmacHex, newSessionToken } from "../src/worker/session";

/**
 * Signs a test in through a real D1 session rather than DEV_USER_EMAIL: inserts
 * a `sessions` row for an existing user and returns the `Cookie` header value.
 * The lifetime is the user's role's unless `expiresAt` says otherwise.
 */
export async function testSessionCookie(
  email: string,
  opts: { expiresAt?: number } = {},
): Promise<string> {
  const pepper = env.AUTH_PEPPER;
  if (!pepper) throw new Error("testSessionCookie needs AUTH_PEPPER (vitest.config.ts)");
  // users.email is stored lowercased.
  const userEmail = email.toLowerCase();
  const db = getDb(env.DB);
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, userEmail))
    .limit(1);
  if (!user) throw new Error(`testSessionCookie: no users row for ${email}`);

  const token = newSessionToken();
  const now = Date.now();
  await db.insert(sessions).values({
    tokenHash: await hmacHex(pepper, token),
    userEmail,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: opts.expiresAt ?? now + SESSION_TTL_MS[user.role],
  });
  return `${SESSION_COOKIE}=${token}`;
}
