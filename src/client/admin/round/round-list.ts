import type { AgentRoundResponse } from "../../../shared/schemas";
import { buildTodayList, type TodayItem } from "../../../shared/today";

/**
 * Today's stops for one agent, as the admin reads them. The order is the shared
 * rule's (src/shared/today.ts) — never re-sorted when a position exists. With
 * none, the rule has nothing to walk from, so the same stops read by name.
 */
export function roundStops(data: AgentRoundResponse, now: number): TodayItem[] {
  const { position } = data;
  const { now: stops } = buildTodayList(
    data.prospects,
    [],
    position ? { lat: position.lat, lng: position.lng } : null,
    now,
  );
  if (position) return stops;
  return [...stops].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
