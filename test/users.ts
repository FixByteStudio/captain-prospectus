import { env } from "cloudflare:test";
import { notInArray, sql } from "drizzle-orm";
import { getDb } from "../src/worker/db/client";
import { users } from "../src/worker/db/schema";
import type { Role } from "../src/shared/constants";

/**
 * The two users `POST /api/dev/seed` inserts locally. DEV_USER_EMAIL
 * (vitest.config.ts) names the admin, and requireIdentity reads the role from
 * these rows (ADR-0029).
 */
export const TEST_ADMIN = "admin@example.com";
export const TEST_AGENT = "agent@example.com";

/** Inserts both as active users; an existing row is left as it is. */
export async function seedTestUsers(): Promise<void> {
  await getDb(env.DB)
    .insert(users)
    .values([
      { email: TEST_ADMIN, role: "admin", active: true, createdAt: 0 },
      { email: TEST_AGENT, role: "agent", active: true, createdAt: 0 },
    ])
    .onConflictDoNothing();
}

/** Inserts or updates one user, so a test can give an email any role and active flag. */
export async function seedUser(email: string, role: Role, active = true): Promise<void> {
  await getDb(env.DB)
    .insert(users)
    .values({ email, role, active, createdAt: 0 })
    .onConflictDoUpdate({ target: users.email, set: { role, active } });
}

/** Back to exactly the two seeded users, active with their own roles; drops what a test added. */
export async function resetTestUsers(): Promise<void> {
  const db = getDb(env.DB);
  await db.delete(users).where(notInArray(users.email, [TEST_ADMIN, TEST_AGENT]));
  await db
    .insert(users)
    .values([
      { email: TEST_ADMIN, role: "admin", active: true, createdAt: 0 },
      { email: TEST_AGENT, role: "agent", active: true, createdAt: 0 },
    ])
    .onConflictDoUpdate({
      target: users.email,
      set: { role: sql`excluded.role`, active: true },
    });
}
