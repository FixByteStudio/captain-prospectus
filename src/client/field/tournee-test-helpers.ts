/**
 * Fixtures for the screens that read today's tournée (ADR-0036): a pulled
 * tournée and its numbered stops, written to Dexie the way a sync would.
 * Tests only.
 */
import { brusselsPeriod } from "../../shared/period";
import type { Prospect } from "../../shared/schemas";
import { fieldDb } from "./db";

/** The clock every screen test fixes through the mocked `useSyncState().lastSyncAt`. */
export const TOURNEE_NOW = 1_700_000_000_000;

/** Caches `prospects` and pulls a tournée for the day of `now` numbering them 1, 2, 3… or by `numbers`. */
export async function seedPulledTournee(
  prospects: readonly Prospect[],
  { numbers, now = TOURNEE_NOW }: { numbers?: readonly number[]; now?: number } = {},
): Promise<void> {
  const tourneeId = crypto.randomUUID();
  const dayStart = brusselsPeriod(now, 1).from;
  await fieldDb.prospects.bulkPut([...prospects]);
  await fieldDb.tournees.put({ id: tourneeId, dayStart, startedAt: dayStart + 1 });
  await fieldDb.tourneeStops.bulkPut(
    prospects.map((p, i) => ({
      id: crypto.randomUUID(),
      tourneeId,
      prospectId: p.id,
      number: numbers?.[i] ?? i + 1,
      addedAt: dayStart + 1,
      left: false,
    })),
  );
}

export async function clearTourneeTables(): Promise<void> {
  await Promise.all([
    fieldDb.tournees.clear(),
    fieldDb.tourneeStops.clear(),
    fieldDb.visitedStops.clear(),
    fieldDb.outboxTournees.clear(),
    fieldDb.outboxStops.clear(),
  ]);
}
