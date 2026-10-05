/**
 * The latest reading the phone took, kept for the next sync — ADR-0028, "On the
 * phone".
 *
 * Module memory only: not React state, Dexie or localStorage, so a reload
 * forgets it and nothing about it outlives the page on the device's disk. It
 * never calls geolocation; `useAgentPosition` is the only caller of that, and
 * sync only reads what the hook already took.
 *
 * A reading is stamped with the confirmed identity active when it was taken.
 * `SyncProvider` supplies that identity (`null` while it is cache-sourced), so
 * a reading taken under a name the Access cookie may not match is never kept.
 */
import type { AgentPosition } from "../../shared/schemas";
import { agentPositionSchema } from "../../shared/schemas";
import { brusselsPeriod } from "../../shared/period";

/** The confirmed identity right now, or null when there is none. */
let current: string | null = null;
let last: { stamp: string; position: AgentPosition } | null = null;

/** Drop the reading. An identity change and `clearAgentCache` end here; a sign-out ends in `setReadingIdentity(null)`. */
export function dropReading(): void {
  last = null;
}

/**
 * Tell the module who is confirmed. A reading stamped by anyone else goes: after
 * a switch there must be nothing left that another agent's sync could send.
 */
export function setReadingIdentity(identity: string | null): void {
  current = identity;
  if (last && last.stamp !== identity) last = null;
}

/**
 * Keep a reading the hook just took, unless there is no confirmed identity, it
 * would not pass the wire schema, or a newer one is held. Checked here as well
 * as at send time so a coarse fix (accuracy past the cap) never displaces a good
 * earlier one and leaves the day with nothing to send.
 */
export function rememberReading(position: AgentPosition): void {
  if (current === null) return;
  if (!agentPositionSchema.safeParse(position).success) return;
  if (last && last.stamp === current && last.position.capturedAt > position.capturedAt) return;
  last = { stamp: current, position };
}

/**
 * The reading `runSync` may send as `identity`, or `undefined` for "send no
 * field": stamped by that identity, taken today in Brussels (the server clamps
 * to receipt, so only the lower bound matters here), and valid on the wire.
 */
export function readingToSend(identity: string, now: number): AgentPosition | undefined {
  if (!last || last.stamp !== identity) return undefined;
  if (last.position.capturedAt < brusselsPeriod(now, 1).from) return undefined;
  const parsed = agentPositionSchema.safeParse(last.position);
  return parsed.success ? parsed.data : undefined;
}
