/**
 * Whether a tournée stop has left the agent's work (ADR-0036). Derived, never
 * written: the server computes it on every sync, and nothing else decides it.
 */
import { isOpen } from "./constants";
import type { Status } from "./constants";

export type StopProspect = {
  assignedTo: string | null;
  status: Status;
  mergedInto: string | null;
};

/**
 * A visited stop never leaves: Carnet and the counter keep it, whatever the visit
 * did to the prospect. An unvisited one leaves unless it is still the agent's, open
 * and not merged.
 */
export function isStopLeft(
  prospect: StopProspect,
  agentEmail: string,
  visitedToday: boolean,
): boolean {
  if (visitedToday) return false;
  return !(
    prospect.assignedTo === agentEmail &&
    isOpen(prospect.status) &&
    prospect.mergedInto === null
  );
}
