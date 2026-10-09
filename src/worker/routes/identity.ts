/**
 * Who may sign in, and as what — docs/domains/identity-access.md, ADR-0029.
 *
 * Mounted under /api/admin, behind `requireAdmin` (index.ts). Users are
 * deactivated, never deleted; the last active admin can be neither demoted nor
 * deactivated. A one-time code, and the signed-in admin's own passphrase, are
 * generated here and shown once; only their HMAC is stored, and nothing here
 * logs them. Demoting or deactivating a user clears their passphrase.
 */
import { Hono } from "hono";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { OPEN_STATUSES } from "../../shared/constants";
import { normaliseCredential } from "../../shared/credential";
import {
  agentEmailParamSchema,
  userCreateSchema,
  userUpdateSchema,
  type LoginCodeResponse,
  type PassphraseResponse,
  type User,
  type UsersResponse,
} from "../../shared/schemas";
import { getDb, type Db } from "../db/client";
import { loginCodes, prospects, sessions, users } from "../db/schema";
import { LOGIN_CODE_TTL_MS, hmacHex, newLoginCode, newPassphrase } from "../session";
import { misconfigured } from "../auth";
import { validate } from "../validate";
import type { AppEnv } from "../types";

export const identityRoutes = new Hono<AppEnv>();

// SQLite's NOCASE folds ASCII only, so names sort here: case and accents ignored.
const nameOrder = new Intl.Collator("fr", { sensitivity: "base" });

async function userRows(db: Db, email?: string): Promise<User[]> {
  const liveSessions = sql<number>`(SELECT count(*) FROM ${sessions} WHERE ${sessions.userEmail} = ${users.email} AND ${sessions.expiresAt} > ${Date.now()})`;
  const openProspects = db
    .select({ n: sql<number>`count(*)`.as("n"), assignedTo: prospects.assignedTo })
    .from(prospects)
    .where(and(inArray(prospects.status, [...OPEN_STATUSES]), isNull(prospects.mergedInto)))
    .groupBy(prospects.assignedTo)
    .as("open");
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      sessions: liveSessions,
      openProspects: sql<number>`coalesce(${openProspects.n}, 0)`,
    })
    .from(users)
    .leftJoin(openProspects, eq(openProspects.assignedTo, users.email))
    .where(email === undefined ? undefined : eq(users.email, email));
  // Unnamed rows (the break-glass owner) last, then name, then email.
  return rows.sort((a, b) => {
    if ((a.name === null) !== (b.name === null)) return a.name === null ? 1 : -1;
    const byName = a.name === null || b.name === null ? 0 : nameOrder.compare(a.name, b.name);
    return byName || (a.email < b.email ? -1 : a.email > b.email ? 1 : 0);
  });
}

identityRoutes.get("/users", async (c) => {
  const rows = await userRows(getDb(c.env.DB));
  return c.json<UsersResponse>({ users: rows });
});

identityRoutes.post("/users", validate("json", userCreateSchema), async (c) => {
  const { email, name, role } = c.req.valid("json");
  const db = getDb(c.env.DB);

  // A second POST for the same email answers 409, never a second row.
  const inserted = await db
    .insert(users)
    .values({ email, name, role, active: true, createdAt: Date.now() })
    .onConflictDoNothing()
    .returning({ email: users.email });
  if (inserted.length === 0) {
    return c.json({ error: "email_taken", message: "This email already has an account." }, 409);
  }

  const [row] = await userRows(db, email);
  if (!row)
    return c.json({ error: "internal", message: "Une erreur est survenue. Réessayez." }, 500);
  return c.json<User>(row, 201);
});

identityRoutes.patch(
  "/users/:email",
  validate("param", agentEmailParamSchema),
  validate("json", userUpdateSchema),
  async (c) => {
    const { email } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);

    // Only the fields in the body are SET, and the guard reads the row as it is
    // when the UPDATE runs: no read-then-write, so concurrent PATCHes neither
    // write stale values back nor both pass the last-admin check.
    const set: Partial<typeof users.$inferInsert> = {};
    if (body.role !== undefined) set.role = body.role;
    if (body.active !== undefined) set.active = body.active;
    // A passphrase belongs to an active admin: demoting or deactivating drops
    // it in the same guarded UPDATE, so a refused PATCH keeps it.
    if (body.role === "agent" || body.active === false) set.passphraseHash = null;

    const newRole = body.role ?? null;
    const newActive = body.active === undefined ? null : body.active ? 1 : 0;
    const guard = sql`(NOT (${users.role} = 'admin' AND ${users.active} = 1)
      OR (coalesce(${newRole}, ${users.role}) = 'admin' AND coalesce(${newActive}, ${users.active}) = 1)
      OR EXISTS (SELECT 1 FROM ${users} AS u WHERE u.role = 'admin' AND u.active = 1 AND u.email <> ${email}))`;

    const update = db
      .update(users)
      .set(set)
      .where(and(eq(users.email, email), guard))
      .returning({ email: users.email });
    // Sessions and unused codes go only with a deactivation, and only if the
    // update landed.
    const nowInactive = sql`EXISTS (SELECT 1 FROM ${users} WHERE ${users.email} = ${email} AND ${users.active} = 0)`;
    const [updated] =
      body.active === false
        ? await db.batch([
            update,
            db.delete(sessions).where(and(eq(sessions.userEmail, email), nowInactive)),
            db
              .delete(loginCodes)
              .where(and(eq(loginCodes.userEmail, email), isNull(loginCodes.usedAt), nowInactive)),
          ])
        : [await update];

    if (updated.length === 0) {
      const [again] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!again) return c.json({ error: "not_found" }, 404);
      return c.json({ error: "last_admin", message: "Keep at least one active admin." }, 409);
    }
    return c.body(null, 204);
  },
);

/**
 * A one-time code for the user's next device, the admin's own row included.
 * Any older unused code is deleted in the same batch, so only the newest works.
 * The insert reads the row as it is when it runs: a user deactivated meanwhile
 * gets no code.
 */
identityRoutes.post("/users/:email/code", validate("param", agentEmailParamSchema), async (c) => {
  const pepper = c.env.AUTH_PEPPER;
  if (!pepper) throw misconfigured();
  const { email } = c.req.valid("param");
  const db = getDb(c.env.DB);

  const code = newLoginCode();
  const codeHash = await hmacHex(pepper, normaliseCredential(code));
  const now = Date.now();
  const expiresAt = now + LOGIN_CODE_TTL_MS;

  const [, inserted] = await db.batch([
    db.delete(loginCodes).where(and(eq(loginCodes.userEmail, email), isNull(loginCodes.usedAt))),
    db
      .insert(loginCodes)
      .select(
        sql`SELECT ${codeHash}, ${users.email}, ${now}, ${expiresAt}, NULL FROM ${users} WHERE ${users.email} = ${email} AND ${users.active} = 1`,
      )
      .returning({ email: loginCodes.userEmail }),
  ]);

  if (inserted.length === 0) {
    const [row] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json({ error: "user_inactive", message: "This user is deactivated." }, 409);
  }
  return c.json<LoginCodeResponse>({ code, expiresAt }, 201);
});

/**
 * The signed-in admin's own passphrase, and nobody else's: no body, the email
 * is the caller's identity. Only its HMAC is stored, replacing the old one at
 * once; sessions stay as they are. An admin with no active `users` row (signed
 * in through Access only) has nothing to attach it to: 404, nothing written.
 */
identityRoutes.post("/me/passphrase", async (c) => {
  const pepper = c.env.AUTH_PEPPER;
  if (!pepper) throw misconfigured();
  const { email } = c.get("identity");

  const passphrase = newPassphrase();
  const updated = await getDb(c.env.DB)
    .update(users)
    .set({ passphraseHash: await hmacHex(pepper, passphrase) })
    .where(and(eq(users.email, email), eq(users.role, "admin"), eq(users.active, true)))
    .returning({ email: users.email });
  if (updated.length === 0) return c.json({ error: "not_found" }, 404);
  // The secret in clear: no cache, browser or proxy, may keep a copy.
  c.header("Cache-Control", "no-store");
  return c.json<PassphraseResponse>({ passphrase });
});
