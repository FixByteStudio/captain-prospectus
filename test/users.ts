import { env } from "cloudflare:test";
import { getDb } from "../src/worker/db/client";
import { users } from "../src/worker/db/schema";

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
