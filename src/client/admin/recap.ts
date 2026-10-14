import { HOUR_MS } from "../../shared/constants";
import type { RecapResponse } from "../../shared/schemas";
import { copy } from "../copy";
import { formatDay } from "../format";

const MINUTE_MS = 60_000;

/**
 * The recap card's four lines (docs/design.md › Layout), shared by the full
 * card and the rail's Tooltip so the two can never say different things. The
 * age reads the server's two clocks, never the device's.
 */
export function recapLines(data: RecapResponse): {
  date: string;
  agents: string;
  visits: string;
  received: string | null;
} {
  return {
    date: formatDay(data.date),
    agents: copy.recap.agents(data.activeAgents, data.rosterSize),
    visits: copy.recap.visits(data.visitsToday),
    received:
      data.lastReceivedAt === null ? null : receivedAgo(data.serverTime - data.lastReceivedAt),
  };
}

/** Under a minute is "à l'instant"; whole minutes below an hour, then whole hours. */
export function receivedAgo(ageMs: number): string {
  if (ageMs < MINUTE_MS) return copy.recap.receivedNow;
  if (ageMs < HOUR_MS) return copy.recap.receivedMinutes(Math.floor(ageMs / MINUTE_MS));
  return copy.recap.receivedHours(Math.floor(ageMs / HOUR_MS));
}
