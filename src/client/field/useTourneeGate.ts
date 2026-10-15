/**
 * The gate's inputs, read live from Dexie, and its decision — see
 * `tournee-gate.ts`. The pulled tournée, the outbox and the snapshot all
 * change under the screen (a sync lands, a swipe is written), so the gate
 * moves by itself and no screen has to navigate on a sync.
 */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { fieldDb, getMeta } from "./db";
import { useSyncState } from "./useSync";
import { decideTourneeGate, type GateInput, type TourneeGate } from "./tournee-gate";

type Stored = Omit<GateInput, "identity" | "now">;

export function useTourneeGate(identity: string): TourneeGate {
  // "Today" is `useRound`'s pattern: the last sync of this session, else the
  // moment the screens opened, both on the phone's clock like the swipe's
  // `startedAt`. `meta.lastSyncAt` is the server's clock and only answers
  // "has a pull ever succeeded?". Midnight timers are entry 9.
  const { lastSyncAt: syncedAt } = useSyncState();
  const [openedAt] = useState(() => Date.now());

  const stored = useLiveQuery(async (): Promise<Stored> => {
    const [lastSyncAt, pulled, outboxTournees, prospects, outboxProspects] = await Promise.all([
      getMeta(fieldDb, "lastSyncAt"),
      fieldDb.tournees.toArray(),
      fieldDb.outboxTournees.toArray(),
      fieldDb.prospects.toArray(),
      fieldDb.outboxProspects.toArray(),
    ]);
    return { lastSyncAt, pulled, outboxTournees, prospects, outboxProspects };
  }, []);

  if (!stored) return { kind: "loading" };
  return decideTourneeGate({
    ...stored,
    identity,
    now: syncedAt ?? openedAt,
  });
}
