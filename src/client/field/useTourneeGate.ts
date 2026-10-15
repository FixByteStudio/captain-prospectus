/**
 * The gate's inputs, read live from Dexie, and its decision — see
 * `tournee-gate.ts`. The pulled tournée, the outbox and the snapshot all
 * change under the screen (a sync lands, a swipe is written), so the gate
 * moves by itself and no screen has to navigate on a sync.
 */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { fieldDb, getMeta } from "./db";
import { decideTourneeGate, holdGate, type GateInput, type TourneeGate } from "./tournee-gate";

type Stored = Omit<GateInput, "identity" | "now">;

/**
 * `now` is the frame's field clock (`useFieldNow`), the one it also keys the
 * start screen by; it turns over at Brussels midnight, which brings the gates
 * back. `onForm` is whether the route is a visit or add-prospect form: the gate
 * does not close under one that was entered open (`holdGate`).
 */
export function useTourneeGate(identity: string, now: number, onForm: boolean): TourneeGate {
  const [wasOpen, setWasOpen] = useState(false);

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

  const live: TourneeGate = stored
    ? decideTourneeGate({ ...stored, identity, now })
    : { kind: "loading" };
  const held = holdGate(live, onForm, wasOpen);
  // Adjusted during render, React's pattern for state derived from a changing value.
  if (held.wasOpen !== wasOpen) setWasOpen(held.wasOpen);
  return held.gate;
}
