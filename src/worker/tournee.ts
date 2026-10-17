/**
 * The tournée at sync (ADR-0036): write what the phone sends, read back today's.
 * Insert-only and idempotent (INVARIANTS 2 and 4); nothing here updates a row.
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { chunk } from "../shared/chunk";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import type { TodayTournee, TourneeStopSync, TourneeSync } from "../shared/schemas";
import { isJoiner, isStopLeft } from "../shared/tournee";
import { boundParamsPerRow } from "./db/client";
import type { Db } from "./db/client";
import { prospects, tourneeStops, tournees, users } from "./db/schema";
import type { NewTourneeRow, NewTourneeStopRow } from "./db/schema";

/**
 * Stores the tournées and stops of one sync and reports every id the phone may
 * forget. A phone sends a stop in the same request as its tournée or after that
 * tournée was accepted. Every tournée is stored and accepted, even one that will
 * lose its day to the agent's other phone (the earliest swipe is read, not the
 * first stored). A stop whose tournée is not the agent's or not stored is drained,
 * since it can never be attached later and an outbox row kept for it would retry
 * for ever (INVARIANT 5).
 * A stop whose prospect does not exist yet is NOT accepted while its tournée's
 * day lasts: it is a field prospect still on its way, and the phone resends the
 * stop once that prospect is accepted. After that day it is accepted and not
 * stored. A number collision is decided by the unique (tournée, number) index.
 */
export async function writeTournees(
  db: Db,
  email: string,
  now: number,
  newTournees: readonly TourneeSync[],
  newStops: readonly TourneeStopSync[],
  idMap: Readonly<Record<string, string>>,
): Promise<{ tournees: string[]; stops: string[] }> {
  /** Stops of the agent's own tournée whose prospect has not arrived yet. */
  const waiting = new Set<string>();
  if (newTournees.length > 0) {
    const rows: NewTourneeRow[] = newTournees.map((t) => {
      // INVARIANT 12, as for `visited_at`. The day is the swipe's own, so a
      // tournée started before midnight and synced after keeps its day.
      const startedAt = Math.min(t.startedAt, now);
      return {
        id: t.id,
        agentEmail: email,
        dayStart: brusselsMidnightDaysFromNow(startedAt, 0),
        startedAt,
        clientStartedAt: t.startedAt,
        receivedAt: now,
      };
    });
    // No conflict target: only the id (a resend) can conflict.
    for (const batch of chunk(rows, boundParamsPerRow(tournees))) {
      await db.insert(tournees).values(batch).onConflictDoNothing();
    }
  }

  if (newStops.length > 0) {
    // The agent's own tournées among those named, found after the insert so a
    // tournée stored a moment ago counts, one that will lose its day included.
    const owned = new Map<string, number>();
    const named = [...new Set(newStops.map((s) => s.tourneeId))];
    // Each batch binds its ids plus the agent's email, hence 2 per id (50 ids, 51 params).
    for (const batch of chunk(named, 2)) {
      for (const row of await db
        .select({ id: tournees.id, dayStart: tournees.dayStart })
        .from(tournees)
        .where(and(eq(tournees.agentEmail, email), inArray(tournees.id, batch)))) {
        owned.set(row.id, row.dayStart);
      }
    }

    const mapped = newStops.map((s) => ({ ...s, prospectId: idMap[s.prospectId] ?? s.prospectId }));
    const known = new Set<string>();
    const wanted = [
      ...new Set(mapped.filter((s) => owned.has(s.tourneeId)).map((s) => s.prospectId)),
    ];
    for (const batch of chunk(wanted, 1)) {
      for (const row of await db
        .select({ id: prospects.id })
        .from(prospects)
        .where(inArray(prospects.id, batch))) {
        known.add(row.id);
      }
    }

    // The foreign key would fail the whole statement, and with it every stop in
    // the batch, so a stop whose prospect is not here is held back from the insert.
    const insertable = mapped.filter((s) => owned.has(s.tourneeId) && known.has(s.prospectId));
    const today = brusselsMidnightDaysFromNow(now, 0);
    for (const s of mapped) {
      // Once the tournée's day has passed, a prospect that never arrived is
      // dropped: the stop could no longer be shown, and resending it is for ever.
      const dayStart = owned.get(s.tourneeId);
      if (dayStart !== undefined && dayStart >= today && !known.has(s.prospectId)) {
        waiting.add(s.id);
      }
    }
    // Two phones of one agent can append different joiners under the same number:
    // the unique (tournée, number) index keeps the first stored (ADR-0036 › Numbers).
    // The loser's stop is still accepted, and its next pull makes the phone
    // re-append that prospect as the next number.
    const rows: NewTourneeStopRow[] = insertable.map((s) => ({
      id: s.id,
      tourneeId: s.tourneeId,
      prospectId: s.prospectId,
      number: s.number,
      addedAt: Math.min(s.addedAt, now),
      clientAddedAt: s.addedAt,
      receivedAt: now,
    }));
    for (const batch of chunk(rows, boundParamsPerRow(tourneeStops))) {
      await db.insert(tourneeStops).values(batch).onConflictDoNothing();
    }
  }

  return {
    tournees: newTournees.map((t) => t.id),
    stops: newStops.filter((s) => !waiting.has(s.id)).map((s) => s.id),
  };
}

/**
 * The agent's tournée for the Brussels day `now` falls in (the earliest swipe by
 * the phone's `client_started_at`, id breaking a tie), its stops in number
 * order, or null before the first swipe. `visitedProspectIds` is today's door-days,
 * read once by the caller (`doorDaysOn`).
 */
export async function todayTournee(
  db: Db,
  email: string,
  now: number,
  visitedProspectIds: ReadonlySet<string>,
): Promise<TodayTournee | null> {
  const [tournee] = await db
    .select()
    .from(tournees)
    .where(
      and(
        eq(tournees.agentEmail, email),
        eq(tournees.dayStart, brusselsMidnightDaysFromNow(now, 0)),
      ),
    )
    .orderBy(asc(tournees.clientStartedAt), asc(tournees.id))
    .limit(1);
  if (!tournee) return null;

  const rows = await db
    .select({
      id: tourneeStops.id,
      prospectId: tourneeStops.prospectId,
      number: tourneeStops.number,
      addedAt: tourneeStops.addedAt,
      clientAddedAt: tourneeStops.clientAddedAt,
      assignedTo: prospects.assignedTo,
      status: prospects.status,
      mergedInto: prospects.mergedInto,
    })
    .from(tourneeStops)
    .innerJoin(prospects, eq(prospects.id, tourneeStops.prospectId))
    .where(eq(tourneeStops.tourneeId, tournee.id))
    .orderBy(asc(tourneeStops.number), asc(tourneeStops.addedAt), asc(tourneeStops.id));

  return {
    id: tournee.id,
    dayStart: tournee.dayStart,
    startedAt: tournee.startedAt,
    clientStartedAt: tournee.clientStartedAt,
    stops: rows.map((r) => ({
      id: r.id,
      prospectId: r.prospectId,
      number: r.number,
      addedAt: r.addedAt,
      joiner: isJoiner(r.clientAddedAt, tournee.clientStartedAt),
      left: isStopLeft(r, email, visitedProspectIds.has(r.prospectId)),
    })),
  };
}

/**
 * Roster members who started the tournée of the Brussels day `dayStart` begins:
 * the swipe alone counts, with no visit needed. One helper serves « Agents en
 * tournée » and the recap's « actifs aujourd'hui », so they are the same figure
 * (ADR-0036). It drives from the handful of active `users` rows into
 * `tournees_agent_day_started_idx`, led by `(agent_email, day_start)`; a bare
 * `day_start = ?` would scan every tournée ever stored on each 15 s recap poll.
 */
export async function agentsStartedOn(db: Db, dayStart: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(
      and(
        eq(users.active, true),
        sql`exists (select 1 from ${tournees} where ${tournees.agentEmail} = ${users.email} and ${tournees.dayStart} = ${dayStart})`,
      ),
    );
  return row?.n ?? 0;
}
