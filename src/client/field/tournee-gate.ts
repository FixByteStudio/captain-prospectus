/**
 * Which screen the field route shows before the app — ADR-0036 › The gates,
 * docs/design.md › Before the swipe. Pure, so the table is testable without
 * Dexie or a browser.
 *
 * The location dialog is a gate too, but a screen's own (`StartScreen`), not a
 * decision made here.
 */
import { brusselsPeriod } from "../../shared/period";
import type { FieldProspect, Prospect } from "../../shared/schemas";
import { snapshotProspects, type SnapshotProspect } from "../../shared/tournee";
import type { PulledTournee, StoredTournee } from "./db";
import { writtenByOrUnstamped } from "./outbox-stamp";

export type TourneeGate =
  /** The local store has not answered yet. */
  | { kind: "loading" }
  /** No pull has ever succeeded on this phone. */
  | { kind: "neverLoaded" }
  /** Pulled at least once, and a swipe would freeze no stop. */
  | { kind: "nothingAssigned" }
  /** Stops to preview and a swipe to start them. */
  | { kind: "start"; snapshot: SnapshotProspect[] }
  /** A tournée exists for today, pulled or queued: the app. */
  | { kind: "open" };

export type GateInput = {
  lastSyncAt: number | undefined;
  pulled: readonly PulledTournee[];
  outboxTournees: readonly StoredTournee[];
  prospects: readonly Prospect[];
  outboxProspects: readonly (FieldProspect & { writtenBy?: string })[];
  identity: string;
  /** "Today" for the Brussels day and for which follow-ups are due. */
  now: number;
};

export function decideTourneeGate(input: GateInput): TourneeGate {
  const { from } = brusselsPeriod(input.now, 1);
  const mine = writtenByOrUnstamped(input.identity);

  // Either source is enough, and the pulled one wins on the server: the first
  // swipe of the day is the one it keeps (ADR-0036). Another identity's queued
  // tournée says nothing about this agent's day.
  const swipedToday =
    input.pulled.some((t) => t.dayStart === from) ||
    input.outboxTournees.some((t) => mine(t) && brusselsPeriod(t.startedAt, 1).from === from);
  if (swipedToday) return { kind: "open" };

  if (input.lastSyncAt === undefined) return { kind: "neverLoaded" };

  const snapshot = snapshotProspects(
    input.prospects,
    input.outboxProspects.filter(mine),
    input.now,
  );
  return snapshot.length === 0 ? { kind: "nothingAssigned" } : { kind: "start", snapshot };
}

/**
 * The gate the frame shows: `live`, except that an open visit or add-prospect
 * form does not lose its screen when the gate closes under it, at midnight say
 * (ADR-0036 › The gates, docs/design.md › Midnight). The agent saves it or
 * leaves it; the next route, which is not a form, shows `live`.
 *
 * Generic on purpose: any open-to-gated change under a form waits, not only
 * midnight. `wasOpen` is the caller's memory of "this form was entered while
 * the gate was open", handed back as the next value.
 */
export function holdGate(
  live: TourneeGate,
  onForm: boolean,
  wasOpen: boolean,
): { gate: TourneeGate; wasOpen: boolean } {
  const open = live.kind === "open";
  const held = onForm && wasOpen;
  return { gate: !open && held ? { kind: "open" } : live, wasOpen: open || held };
}
