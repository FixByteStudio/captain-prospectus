/**
 * The agent's latest reading — ADR-0028. One row per agent, newest wins, gone
 * by the next morning. The "today" rule lives here and nowhere else, so the
 * write, the read and the sweep cannot disagree.
 */
import { eq, sql } from "drizzle-orm";
import { brusselsMidnightDaysFromNow } from "../shared/period";
import type { AgentPosition } from "../shared/schemas";
import { agentPositions } from "./db/schema";
import type { Db } from "./db/client";

/** The reading's time, clamped like `visited_at` (INVARIANT 12). */
function clamped(capturedAt: number, receivedAt: number): number {
  return Math.min(capturedAt, receivedAt);
}

/** Whether a clamped reading time falls on today's Brussels date. */
export function isToday(clampedAt: number, now: number): boolean {
  return clampedAt >= brusselsMidnightDaysFromNow(now, 0);
}

/** Stores the reading unless it is stale or not strictly newer than the stored one. */
export async function writeAgentPosition(
  db: Db,
  email: string,
  position: AgentPosition,
  now: number,
): Promise<void> {
  if (!isToday(clamped(position.capturedAt, now), now)) return;
  const row = {
    agentEmail: email,
    lat: position.lat,
    lng: position.lng,
    accuracy: position.accuracy,
    capturedAt: position.capturedAt,
    receivedAt: now,
  };
  await db
    .insert(agentPositions)
    .values(row)
    .onConflictDoUpdate({
      target: agentPositions.agentEmail,
      set: {
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
        accuracy: sql`excluded.accuracy`,
        capturedAt: sql`excluded.captured_at`,
        receivedAt: sql`excluded.received_at`,
      },
      setWhere: sql`excluded.captured_at > ${agentPositions.capturedAt}`,
    });
}

/** The stored reading with `capturedAt` clamped, or null when absent or not from today. */
export async function readAgentPosition(
  db: Db,
  email: string,
  now: number,
): Promise<AgentPosition | null> {
  const [row] = await db
    .select()
    .from(agentPositions)
    .where(eq(agentPositions.agentEmail, email))
    .limit(1);
  if (!row) return null;
  const at = clamped(row.capturedAt, row.receivedAt);
  if (!isToday(at, now)) return null;
  return { lat: row.lat, lng: row.lng, accuracy: row.accuracy, capturedAt: at };
}

/** Deletes the rows `readAgentPosition` would serve as null; returns how many. */
export async function sweepAgentPositions(db: Db, now: number): Promise<number> {
  const deleted = await db
    .delete(agentPositions)
    .where(
      sql`min(${agentPositions.capturedAt}, ${agentPositions.receivedAt}) < ${brusselsMidnightDaysFromNow(now, 0)}`,
    )
    .returning({ email: agentPositions.agentEmail });
  return deleted.length;
}
