/**
 * When to sync next, and whether to keep going — docs/domains/field-operations.md.
 *
 * Split out of the hook that uses it so the rules can be tested without a
 * browser, a timer or a network. Every function here is pure.
 */
import { backoffDelayMs, SYNC_INTERVAL_MS, type SyncResult, type SyncStatus } from "./sync";

/**
 * The pass cap, backstop under `shouldDrain`'s progress rule
 * (docs/domains/field-operations.md, "Repeats" means while it is making
 * progress). Six passes of 200 clear 1200 visits, past a week of two agents'
 * output; the rest waits for the next trigger, seconds later.
 */
export const MAX_DRAIN_PASSES = 6;

/**
 * Whether to run another pass at once: only after a success that left rows
 * behind and made progress — docs/domains/field-operations.md ("Repeats" means
 * while it is making progress). A failure backs off instead.
 */
export function shouldDrain(result: SyncResult, passesSoFar: number): boolean {
  if (result.status !== "ok") return false;
  if (result.remaining <= 0) return false;
  if (result.acceptedProspects + result.acceptedVisits <= 0) return false;
  return passesSoFar < MAX_DRAIN_PASSES;
}

/**
 * `ok` returns to the 60 s heartbeat; anything else backs off, `auth` and
 * `upgrade` included: neither fixes itself, so polling faster changes nothing
 * while the outbox sits safely on disk.
 */
export function nextDelayMs(status: SyncStatus, consecutiveFailures: number): number {
  if (status === "ok") return SYNC_INTERVAL_MS;
  return backoffDelayMs(Math.max(1, consecutiveFailures));
}

/** A failure streak: reset by success, incremented by anything else. */
export function nextFailureCount(status: SyncStatus, consecutiveFailures: number): number {
  return status === "ok" ? 0 : consecutiveFailures + 1;
}

/**
 * Whether this status is worth putting in front of the agent.
 *
 * `ok` is not news. The rest each have a line in `copy.sync` that says what
 * happened and what to do about it.
 */
export function isWorthReporting(status: SyncStatus): boolean {
  return status !== "ok";
}
