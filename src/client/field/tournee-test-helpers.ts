/**
 * Fixtures for the screens that read today's tournée (ADR-0036): a pulled
 * tournée and its numbered stops, written to Dexie the way a sync would.
 * Tests only.
 */
import { vi } from "vitest";
import { brusselsPeriod } from "../../shared/period";
import type { Prospect, SyncResponse, VisitedStop } from "../../shared/schemas";
import { fieldDb } from "./db";
import { runSync } from "./sync";

/** The clock every screen test fixes through the mocked `useSyncState().lastSyncAt`. */
export const TOURNEE_NOW = 1_700_000_000_000;

/**
 * The phone's clock on the tournée's day. `useFieldNow` takes the later of the mocked
 * `lastSyncAt` and the real mount time, so a screen test that fakes the former must
 * fake the latter too. Only `Date`: Dexie and Testing Library keep their timers.
 * Pair with `vi.useRealTimers()` in `afterEach`.
 */
export function setPhoneClockToTourneeDay(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TOURNEE_NOW);
}

/** Caches `prospects` and pulls a tournée for the day of `now` numbering them 1, 2, 3… or by `numbers`. */
export async function seedPulledTournee(
  prospects: readonly Prospect[],
  { numbers, now = TOURNEE_NOW }: { numbers?: readonly number[]; now?: number } = {},
): Promise<void> {
  const tourneeId = crypto.randomUUID();
  const dayStart = brusselsPeriod(now, 1).from;
  await fieldDb.prospects.bulkPut([...prospects]);
  await fieldDb.tournees.put({
    id: tourneeId,
    dayStart,
    startedAt: dayStart + 1,
    clientStartedAt: dayStart + 1,
  });
  await fieldDb.tourneeStops.bulkPut(
    prospects.map((p, i) => ({
      id: crypto.randomUUID(),
      tourneeId,
      prospectId: p.id,
      number: numbers?.[i] ?? i + 1,
      addedAt: dayStart + 1,
      left: false,
      joiner: false,
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

/**
 * A cache wipe and a pull, the way the phone does it: clears the tables a sync
 * replaces, then runs the real `runSync` against a stub response carrying the
 * tournée of `prospects` (numbered 1, 2, 3…) and the server's `visited` door-days.
 */
export async function wipeAndPull(
  identity: string,
  prospects: readonly Prospect[],
  { visited = [], now = TOURNEE_NOW }: { visited?: readonly VisitedStop[]; now?: number } = {},
): Promise<void> {
  await Promise.all([fieldDb.prospects.clear(), clearTourneeTables()]);
  const dayStart = brusselsPeriod(now, 1).from;
  const body: SyncResponse = {
    serverTime: now,
    accepted: { prospects: [], visits: [], tournees: [], stops: [] },
    idMap: {},
    prospects: [...prospects],
    script: null,
    tournee: {
      id: crypto.randomUUID(),
      dayStart,
      startedAt: dayStart + 1,
      clientStartedAt: dayStart + 1,
      stops: prospects.map((p, i) => ({
        id: crypto.randomUUID(),
        prospectId: p.id,
        number: i + 1,
        addedAt: dayStart + 1,
        left: false,
        joiner: false,
      })),
    },
    visitedStops: [...visited],
  };
  const result = await runSync({
    db: fieldDb,
    identity,
    fetchFn: (async () =>
      new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch,
    now: () => now,
  });
  if (result.status !== "ok") throw new Error(`the stub pull failed: ${result.status}`);
}
