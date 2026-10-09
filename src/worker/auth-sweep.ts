/**
 * The auth tables' share of the nightly sweep (CAP-10, ADR-0029 decision 11):
 * delete the rows nothing can use any more.
 *
 * Each rule is the exact complement of the one that reads the row: a session or
 * code counts while `expires_at > now`, and a throttle window counts until
 * `window_start + LOGIN_WINDOW_MS`. A live session or an open lockout is
 * therefore never touched, however long since it was last used.
 *
 * Bounded per table, because a flood of failed logins can write a day's request
 * quota of `login_attempts` rows and deleting them all at once could spend the
 * D1 write quota (docs/free-tier-budget.md). No index: normally the tables hold a
 * few rows per user, so a scan is a few reads; after a flood `login_attempts`
 * is read in full each night until it drains.
 */
import { lte, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { AUTH_SWEEP_BATCH } from "../shared/constants";
import { loginAttempts, loginCodes, sessions } from "./db/schema";
import { LOGIN_WINDOW_MS } from "./login-throttle";
import type { Db } from "./db/client";

export type AuthSweepCounts = {
  loginCodesDeleted: number;
  sessionsDeleted: number;
  loginAttemptsDeleted: number;
};

/**
 * Delete up to AUTH_SWEEP_BATCH rows matching `where`. SQLite has no DELETE ...
 * LIMIT, so the bound goes on a rowid subquery; that also covers
 * `login_attempts`, whose key is composite. Two bound parameters at most
 * (INVARIANT 7).
 */
async function deleteBatch(db: Db, table: SQLiteTable, name: string, where: SQL): Promise<number> {
  const deleted = await db
    .delete(table)
    .where(
      sql`rowid IN (SELECT rowid FROM ${sql.identifier(name)} WHERE ${where} LIMIT ${AUTH_SWEEP_BATCH})`,
    )
    .returning({ rowid: sql<number>`rowid` });
  return deleted.length;
}

/**
 * Each table in its own try/catch, so one failing delete stops neither the
 * others nor the visit redaction. A failed table counts zero and tomorrow's run
 * finds the same rows. The log carries the error's name only: the rows hold
 * hashes.
 */
export async function sweepAuthRows(db: Db, now: number): Promise<AuthSweepCounts> {
  const run = async (name: string, table: SQLiteTable, where: SQL): Promise<number> => {
    try {
      return await deleteBatch(db, table, name, where);
    } catch (err) {
      console.error(`${name} sweep failed`, err instanceof Error ? err.name : "unknown");
      return 0;
    }
  };

  return {
    loginCodesDeleted: await run("login_codes", loginCodes, lte(loginCodes.expiresAt, now)),
    sessionsDeleted: await run("sessions", sessions, lte(sessions.expiresAt, now)),
    loginAttemptsDeleted: await run(
      "login_attempts",
      loginAttempts,
      lte(loginAttempts.windowStart, now - LOGIN_WINDOW_MS),
    ),
  };
}
