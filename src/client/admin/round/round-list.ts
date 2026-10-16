import type { AgentRoundResponse, Prospect } from "../../../shared/schemas";
import { mapPins, walkingPath, type MapPin } from "../../field/round-map";
import { distanceMeters, type Point } from "../../../shared/geo";

/** One row of the admin round: a prospect still to do, under its swipe number (ADR-0036). */
export type RoundStop = Prospect & {
  number: number;
  /** Metres from the agent's last reading, or null when either end has no position. */
  distanceM: number | null;
};

/**
 * The stops still to do, as the server sent them: in the swipe's number order,
 * gaps left as gaps. The stored reading only gives the distances; it never
 * orders or numbers anything. Null before the agent's swipe.
 */
export function roundStops(data: AgentRoundResponse): RoundStop[] | null {
  if (data.tournee === null) return null;
  const { position } = data;
  return data.tournee.stops.map(({ number, prospect }) => ({
    ...prospect,
    number,
    distanceM:
      position && prospect.lat !== null && prospect.lng !== null
        ? distanceMeters(position, { lat: prospect.lat, lng: prospect.lng })
        : null,
  }));
}

/**
 * What the admin's map draws, as Carte does: pins keep the rows' numbers, the
 * lowest-numbered pin is gold and the dashed path runs in number order, with or
 * without a position. The position only places the marker.
 */
export function roundMap(
  stops: readonly RoundStop[],
  position: Point | null,
): { pins: MapPin[]; path: [number, number][]; point: Point | null } {
  const pins = mapPins(stops);
  return {
    pins,
    path: walkingPath(pins),
    point: position ? { lat: position.lat, lng: position.lng } : null,
  };
}
