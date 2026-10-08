import { applyD1Migrations, env } from "cloudflare:test";
import { seedTestUsers } from "./users";

// Every worker test starts against a database built by the real migrations,
// so a migration that does not apply fails the suite rather than production.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
// DEV_USER_EMAIL's role is its users row's (ADR-0029), so the suite needs both.
await seedTestUsers();
