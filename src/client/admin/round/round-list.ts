import type { AgentRoundResponse } from "../../../shared/schemas";
import { mapPins, walkingPath, type MapPin } from "../../field/round-map";
import type { Point } from "../../../shared/geo";
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

/**
 * What the admin's map draws for these stops. Pins keep the list's numbers.
 * Gold pin 1 and the dashed path say "walk from here", which only holds when
 * the order came from a stored position; with none, both are dropped so the
 * map implies no next step it cannot know (story 5.6).
 */
export function roundMap(
  stops: readonly TodayItem[],
  position: Point | null,
): { pins: MapPin[]; path: [number, number][]; point: Point | null } {
  const pins = mapPins(stops);
  if (!position) {
    return { pins: pins.map((pin) => ({ ...pin, next: false })), path: [], point: null };
  }
  return { pins, path: walkingPath(pins), point: { lat: position.lat, lng: position.lng } };
}
